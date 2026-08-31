// stello-membership-webhook
//
// Receives membership events from Stello and lands them in public.members as
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
//   Stello-Signature:   t=<unix seconds>,v1=<hex>[,v1=<hex>]
//   Stello-Event-Type:  same as `type` in the body
//   Stello-Event-Id:    same as `id` in the body - the idempotency key
//   Stello-Delivery-Id: this attempt; changes on every retry. Logged, not stored
//                       as an identity.
//
// Each v1 is HMAC-SHA256 over the exact bytes `${t}.${rawBody}`, hex encoded,
// keyed with the endpoint secret. There may be more than one, and ANY match is
// accepted: for 24 hours after a secret rotation Stello signs with both the new
// and the old secret, which is what lets the secret rotate with no failed
// deliveries. A receiver that only checked the first v1 would work today and
// break silently on the afternoon somebody rotates.
//
// Every event type shares one envelope and the resource sits at `data.object`:
//
//   {
//     "id": "<envelope id - the idempotency key>",
//     "type": "membership.purchased",
//     "created": "2026-08-31T14:22:07.000Z",
//     "data": { "object": {
//       "id": "<pass id>",
//       "member": { "email": "...", "first_name": "...", "last_name": "..." },
//       "membership_type": { "name": "Ordinært medlemskap" },
//       "valid_until": "2027-08-31T14:22:07.000Z",   // or null
//       "amount_paid": 25000,                        // integer øre
//       ...
//     } }
//   }
//
// Every timestamp is an ISO 8601 UTC string, not the epoch milliseconds the
// previous payload used. Values Stello does not hold are null, never omitted, so
// a key being present says nothing about it having a value.
//
// Responses, and what Stello does with them:
//   2xx  accepted. Stop. Also the answer for event types we do not handle.
//   4xx  Stello gives up immediately AND counts a failure. 24 consecutive
//        failures, or 72 unbroken hours of them, and the endpoint is switched
//        off. Reserved here for deliveries that are malformed rather than merely
//        unfamiliar - retrying those would not help either.
//   5xx  our fault. Stello retries with backoff for roughly a day.
//
// ── Delivery semantics ───────────────────────────────────────────────────────
//
// At least once, and unordered. Two consequences the code below is built around:
//
//   - The same envelope id can arrive twice, commonly because Stello failed to
//     read a 200 for work we did complete. stello_webhook_events is the ledger
//     that makes the second delivery a no-op.
//   - A retried membership.purchased can land after the membership.refunded that
//     followed it. Envelope `created` is compared against what the pass already
//     holds, and a refund is terminal for a pass regardless.
//
// Stello aborts at 10 seconds. The work here is a handful of queries and stays
// well inside that, so it is done before answering rather than after: answering
// first would mean a failed write is reported as a success and never retried,
// and losing a purchase is worse than the latency we would save.
//
// ── What this deliberately does not do ───────────────────────────────────────
//
// A purchase never activates anything and never touches an existing member's
// period. It is evidence that someone paid, not that they have collected a card;
// only staff standing in front of the person can confirm that. For a member we
// already know, the delivery records the purchase and stops - the add-member
// screen then shows them as lapsed with a purchase attached, which is the state
// staff know how to resolve.
//
// A refund is the one event that does write membership standing, through
// stello_revoke_membership(). The asymmetry is deliberate: nobody has to be
// standing at the printer for us to know their money went back.
//
// It also no longer reports `banned` in the response body. Stello used to read
// that and paint a badge; it does not read the response body at all now, so the
// flag is written to the function log instead of into a field nothing consumes.

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

const EVENT_PURCHASED = "membership.purchased";
const EVENT_REFUNDED = "membership.refunded";

/** The envelope, reduced to the parts this receiver routes on. */
type Envelope = {
  id: string;
  type: string;
  /** Envelope `created`, normalised to ISO. The ordering key. */
  createdAt: string | null;
  object: Record<string, unknown> | null;
};

/** `data.object` for a membership pass, reduced to what we store. */
type Pass = {
  passId: string;
  email: string;
  firstname: string;
  lastname: string;
  purchasedAt: string | null;
  validUntil: string | null;
  membershipType: string | null;
  orderId: string | null;
  /** Integer øre, as Stello sends it. 25000 = 250,00 kr. */
  amountPaid: number | null;
  currency: string | null;
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

/**
 * Pulls `t` and every `v1` out of a `Stello-Signature` header.
 *
 * Plural: during a secret rotation Stello sends one v1 per live secret.
 */
function parseSignatureHeader(header: string) {
  let timestamp: string | null = null;
  const signatures: string[] = [];

  for (const part of header.split(",")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key === "t") timestamp = value;
    if (key === "v1" && value) signatures.push(value);
  }

  return { timestamp, signatures };
}

/**
 * Verifies the delivery signature over the raw request body.
 *
 * How: re-signs `${t}.${rawBody}` with the endpoint secret and compares against
 * every candidate, accepting on any match. The raw text is signed rather than a
 * re-serialised object, because any difference in key order or whitespace would
 * break a signature that is otherwise fine.
 *
 * The timestamp is inside the signed material, so refusing anything outside the
 * replay window is what stops a captured delivery being replayed later.
 */
async function verifySignature(
  rawBody: string,
  header: string,
  secret: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { timestamp, signatures } = parseSignatureHeader(header);
  if (!timestamp || signatures.length === 0) {
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

  const matched = signatures.some((candidate) =>
    timingSafeEqual(expected, candidate.toLowerCase())
  );

  return matched ? { ok: true } : { ok: false, error: "Signature mismatch." };
}

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/**
 * Normalises a Stello timestamp to ISO, or null.
 *
 * Stello now sends ISO 8601 UTC strings throughout. Epoch milliseconds are still
 * accepted because the contract is additive and parsing leniently costs nothing;
 * what is not accepted is a string that does not parse, which becomes null
 * rather than an Invalid Date propagating into the database.
 */
function isoOrNull(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Reads the envelope, falling back to the headers for the identity fields.
 *
 * The headers carry the same values as the body and are populated on every
 * delivery, so a body that has drifted still routes and still deduplicates.
 */
function readEnvelope(body: Record<string, unknown>, headers: Headers): Envelope {
  const data = record(body.data);
  return {
    id: text(body.id) || text(headers.get("Stello-Event-Id")),
    type: text(body.type) || text(headers.get("Stello-Event-Type")),
    createdAt: isoOrNull(body.created),
    object: data ? record(data.object) : null,
  };
}

/**
 * Validates `data.object` as a membership pass.
 *
 * `requireName` is false for refunds: we are looking a member up, not creating
 * one, so a pass sold without a name can still be revoked.
 */
function readPass(
  object: Record<string, unknown> | null,
  requireName: boolean,
): { ok: true; pass: Pass } | { ok: false; error: string } {
  if (!object) return { ok: false, error: "data.object is missing." };

  const member = record(object.member) ?? {};
  const membershipType = record(object.membership_type) ?? {};

  const passId = text(object.id);
  const email = text(member.email).toLowerCase();
  const firstname = text(member.first_name);
  const lastname = text(member.last_name);

  if (!passId) return { ok: false, error: "data.object.id is required." };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "A valid data.object.member.email is required." };
  }
  // Both are NOT NULL on members and there is no sensible placeholder, so a
  // delivery without them cannot produce a member. Refusing with 400 is honest:
  // the fix is on the Stello side, at the checkout that failed to collect a name.
  if (requireName && (!firstname || !lastname)) {
    return { ok: false, error: "member.first_name and member.last_name are required." };
  }

  const amountPaid = object.amount_paid;

  return {
    ok: true,
    pass: {
      passId,
      email,
      firstname,
      lastname,
      purchasedAt: isoOrNull(object.purchased_at),
      validUntil: isoOrNull(object.valid_until),
      membershipType: text(membershipType.name) || null,
      orderId: text(object.order_id) || null,
      amountPaid:
        typeof amountPaid === "number" && Number.isFinite(amountPaid)
          ? Math.trunc(amountPaid)
          : null,
      currency: text(object.currency).toLowerCase() || null,
    },
  };
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

const errorCode = (error: unknown) => (error as { code?: string } | null)?.code;

/**
 * Pulls a message out of whatever was thrown.
 *
 * PostgREST hands back plain objects rather than Errors, so `instanceof Error`
 * alone turns every database failure into "Unknown error." in the log - which is
 * the one line anyone reads when a delivery has been retrying for an hour.
 */
function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  const candidate = error as { message?: unknown; details?: unknown; code?: unknown } | null;
  const message = typeof candidate?.message === "string" ? candidate.message : "";
  const details = typeof candidate?.details === "string" ? candidate.details : "";
  const code = typeof candidate?.code === "string" ? candidate.code : "";
  const parts = [code, message, details].filter(Boolean);
  return parts.length ? parts.join(": ") : "Unknown error.";
}

/**
 * Claims the envelope id in the delivery ledger.
 *
 * Returns "already_processed" only when a previous delivery both claimed the id
 * and finished. A row claimed but never marked processed is an attempt that died
 * halfway - Stello retried precisely because it never saw our 200 - so the work
 * is redone rather than reported as complete.
 */
async function claimEvent(
  sb: ServiceClient,
  envelope: Envelope,
  deliveryId: string | null,
  payload: unknown,
): Promise<"claimed" | "already_processed"> {
  const { error } = await sb.from("stello_webhook_events").insert({
    event_id: envelope.id,
    event_type: envelope.type,
    event_created: envelope.createdAt,
    pass_id: text((envelope.object ?? {}).id) || null,
    delivery_id: deliveryId,
    payload,
  });

  if (!error) return "claimed";
  if (errorCode(error) !== "23505") throw error;

  const { data, error: readError } = await sb
    .from("stello_webhook_events")
    .select("processed_at")
    .eq("event_id", envelope.id)
    .maybeSingle();

  if (readError) throw readError;
  if ((data as { processed_at: string | null } | null)?.processed_at) {
    return "already_processed";
  }

  // Same event, new attempt. Keep the delivery id of the attempt that is
  // actually running, since that is the one Stello's log will be showing.
  await sb
    .from("stello_webhook_events")
    .update({ delivery_id: deliveryId })
    .eq("event_id", envelope.id);

  return "claimed";
}

async function markProcessed(sb: ServiceClient, eventId: string) {
  const { error } = await sb
    .from("stello_webhook_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("event_id", eventId);
  if (error) throw error;
}

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
async function createPendingMember(sb: ServiceClient, pass: Pass) {
  const existingUser = await findAuthUserByEmail(sb, pass.email);
  let userId = existingUser?.id ?? null;

  if (!userId) {
    const { data, error } = await sb.auth.admin.createUser({
      email: pass.email,
      password: `${crypto.randomUUID().replace(/-/g, "")}Aa1!`,
      email_confirm: true,
      user_metadata: {
        full_name: `${pass.firstname} ${pass.lastname}`.trim(),
        firstname: pass.firstname,
        lastname: pass.lastname,
      },
    });
    if (error || !data.user) throw error ?? new Error("Failed to create auth user.");
    userId = data.user.id;
  }

  const { data: member, error: insertError } = await sb
    .from("members")
    .insert({
      id: userId,
      email: pass.email,
      firstname: pass.firstname,
      lastname: pass.lastname,
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

type PassRow = {
  pass_id: string;
  member_id: string;
  status: string;
  event_created: string | null;
};

async function findPassRow(sb: ServiceClient, passId: string) {
  const { data, error } = await sb
    .from("stello_membership_purchases")
    .select("pass_id, member_id, status, event_created")
    .eq("pass_id", passId)
    .maybeSingle();

  if (error) throw error;
  return data as PassRow | null;
}

/** The columns every delivery refreshes on the pass row. */
function passColumns(envelope: Envelope, pass: Pass, rawBody: string) {
  return {
    email: pass.email,
    event_id: envelope.id,
    event_created: envelope.createdAt,
    purchased_at: pass.purchasedAt,
    valid_until: pass.validUntil,
    membership_type: pass.membershipType,
    order_id: pass.orderId,
    amount_paid: pass.amountPaid,
    currency: pass.currency,
    // The verified payload as delivered. Cheap to keep, and the only way to
    // reconstruct what happened when a delivery turns out to have been wrong.
    payload: JSON.parse(rawBody),
  };
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

  const deliveryId = req.headers.get("Stello-Delivery-Id");

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    console.error("stello-membership-webhook: body is not valid JSON", { deliveryId });
    return json({ ok: false, error: "Body is not valid JSON." }, 400);
  }

  const envelope = readEnvelope(body, req.headers);
  console.log("stello-membership-webhook delivery", {
    deliveryId,
    eventId: envelope.id,
    type: envelope.type,
    created: envelope.createdAt,
  });

  // Unknown types answer 200 and stop. Not politeness: Stello adds event types
  // over time and an endpoint subscribed to a group receives new verbs in that
  // group automatically, so a 4xx here would count failures against an endpoint
  // that is working perfectly. `webhook.test`, which Stello sends from the
  // dashboard with "data": { "object": null }, lands here too.
  if (envelope.type !== EVENT_PURCHASED && envelope.type !== EVENT_REFUNDED) {
    if (envelope.id) {
      // Best effort: the ledger is where a new verb becomes visible to us, but
      // failing to record one must not turn a fine delivery into a retry.
      try {
        const sb = createServiceClient();
        await claimEvent(sb, envelope, deliveryId, body);
        await markProcessed(sb, envelope.id);
      } catch (error) {
        console.error("stello-membership-webhook: could not record unhandled event", {
          deliveryId,
          type: envelope.type,
          message: errorMessage(error),
        });
      }
    }
    return json({ ok: true, status: "ignored", type: envelope.type || null });
  }

  if (!envelope.id) {
    return json({ ok: false, error: "Envelope id is required." }, 400);
  }

  const parsed = readPass(envelope.object, envelope.type === EVENT_PURCHASED);
  if (!parsed.ok) {
    console.error("stello-membership-webhook: unusable payload", {
      deliveryId,
      eventId: envelope.id,
      error: parsed.error,
    });
    return json({ ok: false, error: parsed.error }, 400);
  }
  const pass = parsed.pass;

  try {
    const sb = createServiceClient();

    if (await claimEvent(sb, envelope, deliveryId, body) === "already_processed") {
      return json({ ok: true, status: "already_processed", eventId: envelope.id });
    }

    const existing = await findPassRow(sb, pass.passId);

    // Deliveries are unordered. Anything older than what the pass already holds
    // is a retry that lost its race and has nothing left to say.
    if (
      existing?.event_created && envelope.createdAt &&
      Date.parse(envelope.createdAt) < Date.parse(existing.event_created)
    ) {
      await markProcessed(sb, envelope.id);
      return json({ ok: true, status: "stale_ignored", passId: pass.passId });
    }

    if (envelope.type === EVENT_REFUNDED) {
      const memberId = existing?.member_id ??
        (await findMemberByEmail(sb, pass.email))?.id ?? null;

      // A refund for someone we never received the purchase for. Nothing to
      // revoke, and inventing a member from a refund would be worse than the
      // gap. The delivery is on the ledger for whoever goes looking.
      if (!memberId) {
        console.warn("stello-membership-webhook: refund for unknown member", {
          deliveryId,
          eventId: envelope.id,
          passId: pass.passId,
        });
        await markProcessed(sb, envelope.id);
        return json({ ok: true, status: "unknown_member", passId: pass.passId });
      }

      if (existing) {
        const { error } = await sb
          .from("stello_membership_purchases")
          .update(passColumns(envelope, pass, rawBody))
          .eq("pass_id", pass.passId);
        if (error) throw error;
      } else {
        // The purchase delivery never arrived, or arrived before this pass was
        // a row. Record the pass so the refund has something to mark.
        const { error } = await sb
          .from("stello_membership_purchases")
          .insert({
            pass_id: pass.passId,
            member_id: memberId,
            created_member: false,
            ...passColumns(envelope, pass, rawBody),
          });
        if (error && errorCode(error) !== "23505") throw error;
      }

      // The RPC owns the status flip and the kill-switch; it is the only caller
      // able to write membership_disabled_at past the protect trigger.
      const { data: disabled, error: revokeError } = await sb.rpc(
        "stello_revoke_membership",
        { p_member_id: memberId, p_pass_id: pass.passId, p_event_id: envelope.id },
      );
      if (revokeError) throw revokeError;

      await markProcessed(sb, envelope.id);
      return json({
        ok: true,
        status: disabled === true ? "membership_revoked" : "refund_recorded",
        passId: pass.passId,
        memberId,
      });
    }

    // membership.purchased from here down.

    // A refund is terminal for a pass. A purchase delivery arriving afterwards
    // is the unordered case, not a new sale, and must not resurrect it.
    if (existing?.status === "refunded") {
      await markProcessed(sb, envelope.id);
      return json({ ok: true, status: "refund_wins", passId: pass.passId });
    }

    let member = existing
      ? { id: existing.member_id, email: pass.email, is_banned: null as boolean | null }
      : await findMemberByEmail(sb, pass.email);
    let createdMember = false;

    if (!member) {
      try {
        const memberId = await createPendingMember(sb, pass);
        member = { id: memberId, email: pass.email, is_banned: false };
        createdMember = true;
      } catch (error) {
        // Lost a race against another delivery for the same person: the unique
        // index on members.email fired. The row we wanted now exists, so use it.
        if (errorCode(error) !== "23505") throw error;
        member = await findMemberByEmail(sb, pass.email);
        if (!member) throw error;
      }
    }

    if (existing) {
      const { error } = await sb
        .from("stello_membership_purchases")
        .update(passColumns(envelope, pass, rawBody))
        .eq("pass_id", pass.passId);
      if (error) throw error;
    } else {
      const { error } = await sb
        .from("stello_membership_purchases")
        .insert({
          pass_id: pass.passId,
          member_id: member.id,
          created_member: createdMember,
          ...passColumns(envelope, pass, rawBody),
        });

      // Same pass delivered twice concurrently. The member is recorded either
      // way, so this is a success from Stello's side.
      if (error && errorCode(error) !== "23505") throw error;
    }

    if (member.is_banned === true) {
      // Stello no longer reads the response body, so this is the only place a
      // purchase by someone barred from ÅSS shows up. Nothing here acts on it.
      console.warn("stello-membership-webhook: purchase by a banned member", {
        deliveryId,
        eventId: envelope.id,
        memberId: member.id,
      });
    }

    await markProcessed(sb, envelope.id);
    return json({
      ok: true,
      status: createdMember ? "member_created" : "purchase_recorded",
      passId: pass.passId,
      memberId: member.id,
    });
  } catch (error) {
    const message = errorMessage(error);
    console.error("stello-membership-webhook failed", { deliveryId, message });
    return json({ ok: false, error: message }, 500);
  }
});
