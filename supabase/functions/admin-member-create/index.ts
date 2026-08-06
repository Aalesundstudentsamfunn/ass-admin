// admin-member-create
//
// Backs the mobile add-member screen: check an email, create a member, or
// activate an existing one. Deployed only - this file was recovered from the
// deployed source (version 14) and is the copy to edit from now on.
//
// What changed from version 14, and why the mobile app does not need rebuilding:
// the request and response shapes are untouched. Only the server side moves.
//
//   activate  no longer writes is_membership_active. That flag is derived from
//             membership_active_until, so writing it left the member expired,
//             and once the nightly refresh job exists it would be undone the
//             same night. Activation now goes through the activate_membership()
//             RPC, which writes the period.
//   check     no longer trusts the flag alone. It is derived and a nightly job
//             keeps it honest, but there is a window between a period elapsing
//             and the job running, and this is the answer the add-member screen
//             branches on.
//   create    no longer passes is_membership_active. The trigger derives it.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// --- Per-user rate limiting (sliding window, resets on worker cold-start) ---
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 15; // max calls per user per window
const rateLimitMap = new Map<string, number[]>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const recent = (rateLimitMap.get(userId) ?? []).filter(
    (t) => t > windowStart,
  );
  if (recent.length >= RATE_LIMIT_MAX) return false;
  recent.push(now);
  rateLimitMap.set(userId, recent);
  return true;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MANAGE_MEMBERS_PRIVILEGE = 2;
const MEMBER_PRIVILEGE = 1;
const VOLUNTARY_PRIVILEGE = 2;

const MEMBER_COLUMNS =
  "id, firstname, lastname, email, privilege_type, is_membership_active, membership_active_until, membership_disabled_at, is_banned";

type ExistingMemberRow = {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  privilege_type: number | null;
  is_membership_active: boolean | null;
  membership_active_until: string | null;
  membership_disabled_at: string | null;
  is_banned: boolean | null;
};

type AuthUserLike = {
  id: string;
  email?: string | null;
  app_metadata?: Record<string, unknown> | null;
  banned_until?: string | null;
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value.trim().toLowerCase() === "true";
  }

  return false;
}

function parseCommitteeId(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.trim());
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

/**
 * Today as the database sees it.
 *
 * How: the database runs in UTC and compute_membership_expiry() compares against
 * CURRENT_DATE, so the boundary has to be read in UTC here too. Reading it in
 * Oslo time would disagree with the database for the hour or two either side of
 * local midnight.
 */
function databaseToday() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Is this membership currently running?
 *
 * How: tests the derived flag AND the period. The flag alone is what the trigger
 * and the nightly job maintain, but between a period elapsing and that job
 * running it is stale by up to a day, and this decides which branch the
 * add-member screen shows. ISO dates compare correctly as strings.
 */
function isMembershipActive(
  member: Pick<
    ExistingMemberRow,
    "is_membership_active" | "membership_active_until"
  >,
) {
  if (member.is_membership_active !== true) {
    return false;
  }
  const activeUntil = member.membership_active_until;
  return typeof activeUntil === "string" && activeUntil >= databaseToday();
}

function isMemberBanned(
  member: Pick<ExistingMemberRow, "is_banned" | "privilege_type">,
) {
  return member.is_banned === true || (member.privilege_type ?? 1) === 0;
}

function isAuthUserBanned(user: AuthUserLike | null | undefined) {
  if (!user) {
    return false;
  }

  if (user.app_metadata?.is_banned === true) {
    return true;
  }

  if (typeof user.banned_until === "string" && user.banned_until.length > 0) {
    const bannedUntil = Date.parse(user.banned_until);
    return Number.isFinite(bannedUntil) && bannedUntil > Date.now();
  }

  return false;
}

function buildTemporaryPassword() {
  return `${crypto.randomUUID().replace(/-/g, "")}Aa1!`;
}

function memberSummary(member: ExistingMemberRow) {
  return {
    id: member.id,
    firstname: member.firstname,
    lastname: member.lastname,
    email: member.email,
    privilege_type: member.privilege_type,
    is_banned: isMemberBanned(member),
    is_membership_active: member.is_membership_active,
    membership_active_until: member.membership_active_until,
    membership_disabled_at: member.membership_disabled_at,
  };
}

function createServiceClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const publishableKey =
    Deno.env.get("SUPABASE_ANON_KEY") ??
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
    Deno.env.get("SB_PUBLISHABLE_KEY") ??
    "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    throw new Error("Supabase function env vars are missing.");
  }

  return {
    admin: createClient(supabaseUrl, serviceRoleKey),
    authClientFor: (authorization: string) =>
      createClient(supabaseUrl, publishableKey, {
        global: {
          headers: {
            Authorization: authorization,
          },
        },
      }),
  };
}

async function getAuthorizedContext(req: Request) {
  const authorization = req.headers.get("Authorization") ?? "";
  if (!authorization) {
    return { ok: false as const, error: "You must be logged in." };
  }

  const { admin, authClientFor } = createServiceClient();
  const authClient = authClientFor(authorization);

  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser();

  if (authError || !user) {
    return { ok: false as const, error: "You must be logged in." };
  }

  const { data: actor, error: actorError } = await admin
    .from("members")
    .select("id, privilege_type")
    .eq("id", user.id)
    .maybeSingle();

  if (actorError) {
    return { ok: false as const, error: actorError.message };
  }

  if ((actor?.privilege_type ?? 0) < MANAGE_MEMBERS_PRIVILEGE) {
    return { ok: false as const, error: "Access denied." };
  }

  return {
    ok: true as const,
    admin,
    actorId: user.id,
  };
}

async function lookupMemberByEmail(
  admin: ReturnType<typeof createServiceClient>["admin"],
  email: string,
) {
  const { data, error } = await admin
    .from("members")
    .select(MEMBER_COLUMNS)
    .ilike("email", email)
    .limit(2);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as ExistingMemberRow[];
  if (rows.length > 1) {
    throw new Error("Found multiple member rows for this email. Contact IT.");
  }

  return rows[0] ?? null;
}

async function findAuthUserByEmail(
  admin: ReturnType<typeof createServiceClient>["admin"],
  email: string,
): Promise<AuthUserLike | null> {
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw error;
    }

    const match =
      data.users.find((user) => normalizeEmail(user.email) === email) ?? null;
    if (match) {
      return match;
    }

    if (data.users.length < perPage) {
      return null;
    }

    page += 1;
  }
}

async function validateCommitteeId(
  admin: ReturnType<typeof createServiceClient>["admin"],
  committeeId: number,
) {
  const { data, error } = await admin
    .from("committee_type")
    .select("id")
    .eq("id", committeeId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return !!data;
}

async function ensureAuthUser(
  admin: ReturnType<typeof createServiceClient>["admin"],
  email: string,
  firstname: string,
  lastname: string,
) {
  const existingUser = await findAuthUserByEmail(admin, email);
  if (existingUser) {
    if (isAuthUserBanned(existingUser)) {
      throw new Error("This email cannot be used.");
    }

    return existingUser.id;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: buildTemporaryPassword(),
    email_confirm: true,
    user_metadata: {
      full_name: `${firstname} ${lastname}`.trim(),
      firstname,
      lastname,
    },
  });

  if (error || !data.user) {
    throw error ?? new Error("Failed to create auth user.");
  }

  return data.user.id;
}

/**
 * Turns an activate_membership() error into the message the till should show.
 *
 * How: the RPC raises bare sentinels rather than prose so the wording lives here
 * rather than in the database. Anything unrecognised is passed through, because
 * a surprise from Postgres is more useful on screen than "unknown error".
 */
function activationErrorMessage(message: string) {
  if (message.includes("MEMBERSHIP_DISABLED")) {
    return "This membership has been disabled. Stortinget must re-enable it first.";
  }
  if (message.includes("ALREADY_ACTIVE")) {
    return "This membership is already active.";
  }
  if (message.includes("MEMBER_BANNED")) {
    return "This email cannot be used.";
  }
  if (message.includes("MEMBER_NOT_FOUND")) {
    return "No member exists for this email.";
  }
  if (message.includes("FORBIDDEN")) {
    return "Access denied.";
  }
  return message;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed." }, 405);
  }

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "";

    const context = await getAuthorizedContext(req);
    if (!context.ok) {
      return json({ ok: false, error: context.error });
    }

    const { admin, actorId } = context;

    if (!checkRateLimit(actorId)) {
      return json({ ok: false, error: "Too many requests. Try again shortly." }, 429);
    }

    if (action === "check") {
      const email = normalizeEmail(body.email);
      if (!email) {
        return json({ ok: false, error: "Email is required." });
      }

      const member = await lookupMemberByEmail(admin, email);
      if (!member) {
        return json({
          ok: true,
          email,
          exists: false,
          active: false,
          banned: false,
          member: null,
        });
      }

      return json({
        ok: true,
        email,
        exists: true,
        active: isMembershipActive(member),
        banned: isMemberBanned(member),
        member: memberSummary(member),
      });
    }

    if (action === "activate") {
      const email = normalizeEmail(body.email);
      if (!email) {
        return json({ ok: false, error: "Email is required." });
      }

      const member = await lookupMemberByEmail(admin, email);
      if (!member) {
        return json({ ok: false, error: "No member exists for this email." });
      }

      // The RPC re-checks banned, disabled and already-active under a row lock.
      // Only the ban is pre-checked here, to keep the wording identical to the
      // create path's refusal for the same reason.
      if (isMemberBanned(member)) {
        return json({ ok: false, error: "This email cannot be used." });
      }

      const { data: activated, error: activateError } = await admin.rpc(
        "activate_membership",
        { p_member_id: member.id, p_actor_id: actorId },
      );

      if (activateError) {
        return json({
          ok: false,
          error: activationErrorMessage(activateError.message ?? ""),
        });
      }

      const updatedMember = (Array.isArray(activated) ? activated[0] : activated) as
        | ExistingMemberRow
        | undefined;

      if (!updatedMember) {
        return json({ ok: false, error: "Activation returned no member." });
      }

      return json({
        ok: true,
        actorId,
        member: memberSummary({
          ...updatedMember,
          membership_disabled_at: updatedMember.membership_disabled_at ?? null,
        }),
      });
    }

    if (action === "create") {
      const email = normalizeEmail(body.email);
      const firstname =
        typeof body.firstname === "string" ? body.firstname.trim() : "";
      const lastname =
        typeof body.lastname === "string" ? body.lastname.trim() : "";
      const voluntary = normalizeBoolean(body.voluntary);
      const committeeId = parseCommitteeId(body.committeeId);

      if (!email) {
        return json({ ok: false, error: "Email is required." });
      }

      if (!firstname || !lastname) {
        return json({ ok: false, error: "First and last name are required." });
      }

      if (voluntary && committeeId === null) {
        return json({
          ok: false,
          error: "Committee is required for a voluntary member.",
        });
      }

      if (!voluntary && committeeId !== null) {
        return json({
          ok: false,
          error: "Committee can only be set for a voluntary member.",
        });
      }

      const existingMember = await lookupMemberByEmail(admin, email);
      if (existingMember) {
        if (isMemberBanned(existingMember)) {
          return json({ ok: false, error: "This email cannot be used." });
        }

        if (isMembershipActive(existingMember)) {
          return json({
            ok: false,
            error: "This email already has an active membership.",
          });
        }

        return json({
          ok: false,
          error: "This email already exists. Activate the membership instead.",
        });
      }

      if (voluntary && committeeId !== null) {
        const committeeIsValid = await validateCommitteeId(admin, committeeId);
        if (!committeeIsValid) {
          return json({ ok: false, error: "Invalid committee selection." });
        }
      }

      const userId = await ensureAuthUser(admin, email, firstname, lastname);
      const privilegeType = voluntary ? VOLUNTARY_PRIVILEGE : MEMBER_PRIVILEGE;

      // membership_active_until is left to the column default,
      // compute_membership_expiry(), and is_membership_active is derived from it
      // by the trigger. Passing either here would just be a second, drifting
      // copy of the same rule.
      const { data: createdMember, error: insertError } = await admin
        .from("members")
        .insert({
          id: userId,
          email,
          firstname,
          lastname,
          committee: voluntary ? committeeId : null,
          privilege_type: privilegeType,
          created_by: actorId,
        })
        .select(MEMBER_COLUMNS)
        .single();

      if (insertError) {
        return json({ ok: false, error: insertError.message });
      }

      return json({
        ok: true,
        actorId,
        member: memberSummary(createdMember as ExistingMemberRow),
      });
    }

    return json({ ok: false, error: "Unsupported action." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return json({ ok: false, error: message }, 500);
  }
});
