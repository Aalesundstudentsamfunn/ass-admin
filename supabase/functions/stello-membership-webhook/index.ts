// stello-membership-webhook
//
// Receives membership purchases from Stello and lands them in public.members as
// members whose period has not started. Staff finish the job at the card printer
// by pressing Aktiver, exactly as they do for a lapsed member.
//
// Deploy with verify_jwt = false. The caller is Stello, not a signed-in user;
// the HMAC below is the authentication.
//
// ── Delivery contract ────────────────────────────────────────────────────────
//
// POST /functions/v1/stello-membership-webhook
//
//   Stello-Signature: t=<unix seconds>,v1=<hex hmac-sha256>
//
// v1 is HMAC-SHA256 over the exact bytes `${t}.${rawBody}` keyed with the shared
// secret, hex encoded. Stripe's scheme, and chosen for that reason: Stello is
// building this as an integration any organiser can enable, so the side ÅSS
// implements should be the one with the most existing prose to point at.
//
//   {
//     "type": "membership.purchased",
//     "passId": "<membershipPasses _id - the idempotency key>",
//     "email": "buyer@example.com",
//     "firstname": "...",
//     "lastname": "...",
//     "purchasedAt": 1775000000000        // optional, epoch ms
//   }
//
// Responses, and what Stello should do with them:
//   200  accepted, or already seen. Stop.
//   400  malformed. Stop - retrying will not help.
//   401  bad or stale signature. Stop.
//   500  our fault. Retry with backoff.
//
// ── What this deliberately does not do ───────────────────────────────────────
//
// It never activates anything, and it never touches an existing member's period.
// A purchase is evidence that someone paid, not that they have collected a card;
// only staff standing in front of the person can confirm that. For a member we
// already know, the delivery records the purchase and stops - the add-member
// screen then shows them as lapsed with a purchase attached, which is the state
// staff know how to resolve.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/** How far a delivery's timestamp may drift before we refuse it. */
const REPLAY_WINDOW_SECONDS = 300;

/**
 * The period stamped on a member created by a purchase.
 *
 * A far-past date rather than null, because membership_active_until is NOT NULL,
 * and rather than the column default, which is the *current* period and would
 * land the member active. The trigger derives is_membership_active from it, so
 * the row arrives inactive without this function saying so.
 */
const PENDING_PERIOD = "2000-01-01";

const SUPPORTED_TYPE = "membership.purchased";

type Payload = {
  type: string;
  passId: string;
  email: string;
  firstname: string;
  lastname: string;
  purchasedAt: number | null;
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function hex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Compares two hex digests without leaking where they diverge.
 *
 * How: fixed work over the full length, accumulating differences rather than
 * returning at the first one. Length is compared up front, which is safe - the
 * digest length is not a secret.
 */
function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** Pulls `t` and `v1` out of a `Stello-Signature` header. */
function parseSignatureHeader(header: string) {
  let timestamp: string | null = null;
  let signature: string | null = null;

  for (const part of header.split(",")) {
    const [key, value] = part.split("=", 2).map((piece) => piece?.trim() ?? "");
    if (key === "t") timestamp = value;
    if (key === "v1") signature = value;
  }

  return { timestamp, signature };
}

/**
 * Verifies the delivery signature over the raw request body.
 *
 * How: re-signs `${t}.${rawBody}` with the shared secret and compares. The raw
 * text is signed rather than a re-serialised object, because any difference in
 * key order or whitespace would break a signature that is otherwise fine.
 */
async function verifySignature(
  rawBody: string,
  header: string,
  secret: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { timestamp, signature } = parseSignatureHeader(header);
  if (!timestamp || !signature) {
    return { ok: false, error: "Malformed signature header." };
  }

  const sentAt = Number(timestamp);
  if (!Number.isFinite(sentAt)) {
    return { ok: false, error: "Malformed signature timestamp." };
  }

  const driftSeconds = Math.abs(Math.floor(Date.now() / 1000) - sentAt);
  if (driftSeconds > REPLAY_WINDOW_SECONDS) {
    return { ok: false, error: "Signature timestamp outside the replay window." };
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expected = hex(
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`${timestamp}.${rawBody}`),
    ),
  );

  if (!timingSafeEqual(expected, signature.toLowerCase())) {
    return { ok: false, error: "Signature mismatch." };
  }

  return { ok: true };
}

/** Validates the delivery body, returning either a payload or why it was refused. */
function parsePayload(raw: string): { ok: true; payload: Payload } | { ok: false; error: string } {
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { ok: false, error: "Body is not valid JSON." };
  }

  const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

  const type = text(body.type);
  const passId = text(body.passId);
  const email = text(body.email).toLowerCase();
  const firstname = text(body.firstname);
  const lastname = text(body.lastname);

  if (type !== SUPPORTED_TYPE) {
    return { ok: false, error: `Unsupported event type: ${type || "(missing)"}.` };
  }
  if (!passId) return { ok: false, error: "passId is required." };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "A valid email is required." };
  }
  // Both are NOT NULL on members and there is no sensible placeholder, so a
  // delivery without them cannot produce a member. Refusing with 400 is honest:
  // the fix is on the Stello side, at the checkout that failed to collect a name.
  if (!firstname || !lastname) {
    return { ok: false, error: "firstname and lastname are required." };
  }

  const purchasedAtRaw = body.purchasedAt;
  const purchasedAt =
    typeof purchasedAtRaw === "number" && Number.isFinite(purchasedAtRaw)
      ? purchasedAtRaw
      : null;

  return { ok: true, payload: { type, passId, email, firstname, lastname, purchasedAt } };
}

function createServiceClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase function env vars are missing.");
  }
  return createClient(supabaseUrl, serviceRoleKey);
}

type ServiceClient = ReturnType<typeof createServiceClient>;

/**
 * Finds the member for an address.
 *
 * How: an equality match on the lowercased address, not the `ilike` the
 * staff-facing paths use. `ilike` treats `_` and `%` as wildcards, so an address
 * containing either would match strangers - survivable when a human is reading
 * the result, not when a webhook is about to attach a purchase to whatever comes
 * back. Every address written by this function is lowercased, and the unique
 * index on members.email keeps that honest.
 */
async function findMemberByEmail(sb: ServiceClient, email: string) {
  const { data, error } = await sb
    .from("members")
    .select("id, email, is_banned")
    .eq("email", email)
    .maybeSingle();

  if (error) throw error;
  return data as { id: string; email: string; is_banned: boolean | null } | null;
}

/** Finds an existing auth user for an address, paging through the admin list. */
async function findAuthUserByEmail(sb: ServiceClient, email: string) {
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const match = data.users.find(
      (user) => (user.email ?? "").trim().toLowerCase() === email,
    );
    if (match) return match;

    if (data.users.length < perPage) return null;
    page += 1;
  }
}

/**
 * Creates the member row for a purchase, minting the auth user it hangs off.
 *
 * How: members.id is a foreign key to auth.users, so the auth user comes first.
 * The password is random and never delivered - the buyer sets a real one through
 * password reset, the same route every member created by staff takes.
 */
async function createPendingMember(sb: ServiceClient, payload: Payload) {
  const existingUser = await findAuthUserByEmail(sb, payload.email);
  let userId = existingUser?.id ?? null;

  if (!userId) {
    const { data, error } = await sb.auth.admin.createUser({
      email: payload.email,
      password: `${crypto.randomUUID().replace(/-/g, "")}Aa1!`,
      email_confirm: true,
      user_metadata: {
        full_name: `${payload.firstname} ${payload.lastname}`.trim(),
        firstname: payload.firstname,
        lastname: payload.lastname,
      },
    });
    if (error || !data.user) throw error ?? new Error("Failed to create auth user.");
    userId = data.user.id;
  }

  const { data: member, error: insertError } = await sb
    .from("members")
    .insert({
      id: userId,
      email: payload.email,
      firstname: payload.firstname,
      lastname: payload.lastname,
      privilege_type: 1,
      membership_active_until: PENDING_PERIOD,
      // created_by is null: no staff member created this. The column is a
      // foreign key to members, so there is nothing else honest to put here.
      created_by: null,
    })
    .select("id")
    .single();

  if (insertError) throw insertError;
  return (member as { id: string }).id;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed." }, 405);
  }

  const secret = Deno.env.get("STELLO_WEBHOOK_SECRET") ?? "";
  if (!secret) {
    console.error("STELLO_WEBHOOK_SECRET is not configured.");
    return json({ ok: false, error: "Receiver is not configured." }, 500);
  }

  const rawBody = await req.text();
  const signatureHeader = req.headers.get("Stello-Signature") ?? "";
  if (!signatureHeader) {
    return json({ ok: false, error: "Missing Stello-Signature header." }, 401);
  }

  const verified = await verifySignature(rawBody, signatureHeader, secret);
  if (!verified.ok) {
    return json({ ok: false, error: verified.error }, 401);
  }

  const parsed = parsePayload(rawBody);
  if (!parsed.ok) {
    return json({ ok: false, error: parsed.error }, 400);
  }
  const payload = parsed.payload;

  try {
    const sb = createServiceClient();

    // Cheap idempotency check. It is not the guarantee - the primary key on
    // pass_id is, and the insert below leans on it for the case where two
    // deliveries of the same pass race past this point.
    const { data: seen, error: seenError } = await sb
      .from("stello_membership_purchases")
      .select("pass_id")
      .eq("pass_id", payload.passId)
      .maybeSingle();

    if (seenError) throw seenError;
    if (seen) {
      return json({ ok: true, status: "already_processed", passId: payload.passId });
    }

    let member = await findMemberByEmail(sb, payload.email);
    let createdMember = false;

    if (!member) {
      try {
        const memberId = await createPendingMember(sb, payload);
        member = { id: memberId, email: payload.email, is_banned: false };
        createdMember = true;
      } catch (error) {
        // Lost a race against another delivery for the same person: the unique
        // index on members.email fired. The row we wanted now exists, so use it.
        const code = (error as { code?: string })?.code;
        if (code !== "23505") throw error;
        member = await findMemberByEmail(sb, payload.email);
        if (!member) throw error;
      }
    }

    const { error: purchaseError } = await sb
      .from("stello_membership_purchases")
      .insert({
        pass_id: payload.passId,
        member_id: member.id,
        email: payload.email,
        created_member: createdMember,
        purchased_at: payload.purchasedAt ? new Date(payload.purchasedAt).toISOString() : null,
        payload: JSON.parse(rawBody),
      });

    if (purchaseError) {
      // Same pass delivered twice concurrently. The member is recorded either
      // way, so this is a success from Stello's side.
      if ((purchaseError as { code?: string }).code === "23505") {
        return json({ ok: true, status: "already_processed", passId: payload.passId });
      }
      throw purchaseError;
    }

    return json({
      ok: true,
      status: createdMember ? "member_created" : "purchase_recorded",
      passId: payload.passId,
      memberId: member.id,
      // Surfaced so a delivery to someone barred from ÅSS is visible in Stello's
      // delivery log rather than silently filed. Nothing here acts on it.
      banned: member.is_banned === true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    console.error("stello-membership-webhook failed", message);
    return json({ ok: false, error: message }, 500);
  }
});
