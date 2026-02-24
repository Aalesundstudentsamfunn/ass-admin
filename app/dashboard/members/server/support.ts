import { randomBytes } from "crypto";
import type { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enqueuePrinterQueue } from "@/lib/printer-queue";
import { getInviteRedirectUrl } from "@/lib/auth/urls";
import { canManageMembers } from "@/lib/privilege-checks";
import { PRIVILEGE_LEVELS } from "@/lib/privilege-config";
import type { PrintableMember } from "@/lib/members/shared";

type MemberServerClient = Awaited<ReturnType<typeof createClient>>;

type AuthUserLike = {
  id: string;
  email?: string | null;
  app_metadata?: Record<string, unknown> | null;
  banned_until?: string | null;
};

/**
 * Feature toggle for sending invite emails on member creation.
 *
 * - true: creates auth user via invite flow (email is sent)
 * - false: creates auth user silently (no email is sent)
 */
const shouldSendInviteEmailOnCreate = () =>
  String(process.env.MEMBER_AUTH_SEND_INVITE_EMAILS ?? "true").toLowerCase() === "true";

/**
 * Normalizes member emails for stable lookups across members/auth tables.
 */
export const normalizeMemberEmail = (value: string) => value.trim().toLowerCase();

/**
 * Maps the create/activate voluntary toggle to stored privilege value.
 */
export const toMemberPrivilege = (isVoluntary: boolean) =>
  isVoluntary ? PRIVILEGE_LEVELS.VOLUNTARY : PRIVILEGE_LEVELS.MEMBER;

/**
 * Resolves the current actor and verifies member-management permission.
 */
export const resolveActionActor = async (sb: MemberServerClient) => {
  const { data: authData, error: authError } = await sb.auth.getUser();
  if (authError || !authData.user) {
    return { ok: false as const, error: "Du må være innlogget for å legge til medlem." };
  }

  const { data: me, error: meError } = await sb
    .from("members")
    .select("privilege_type")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (meError) {
    return { ok: false as const, error: meError.message };
  }
  if (!canManageMembers(me?.privilege_type)) {
    return { ok: false as const, error: "Mangler tilgang." };
  }

  return { ok: true as const, userId: authData.user.id };
};

/**
 * Enqueues card printing for one member in `printer_queue`.
 */
export const queueMemberCardPrint = (
  sb: MemberServerClient,
  member: PrintableMember,
  createdBy: string,
  privilegeType: number,
) =>
  enqueuePrinterQueue(sb, {
    firstname: member.firstname,
    lastname: member.lastname,
    email: member.email,
    ref: member.id,
    ref_invoker: createdBy,
    is_voluntary: privilegeType >= PRIVILEGE_LEVELS.VOLUNTARY,
  });

/**
 * Paginates Supabase auth users and returns the one matching email.
 */
async function findAuthUserByEmail(email: string): Promise<AuthUserLike | null> {
  const admin = createAdminClient();
  const normalizedEmail = normalizeMemberEmail(email);
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw error;
    }
    const match = data?.users?.find((user) => user.email?.toLowerCase() === normalizedEmail);
    if (match) {
      return match;
    }
    if (!data?.users || data.users.length < perPage) {
      return null;
    }
    page += 1;
  }
}

/**
 * Creates temporary one-time password for invite bootstrap.
 */
function generateTemporaryPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const bytes = randomBytes(18);
  let password = "";
  for (let i = 0; i < bytes.length; i += 1) {
    password += chars[bytes[i] % chars.length];
  }
  return password;
}

/**
 * Checks whether an auth user is currently banned.
 */
function isAuthUserBanned(user: AuthUserLike | null | undefined) {
  if (!user) {
    return false;
  }
  if (user.app_metadata?.is_banned === true) {
    return true;
  }
  if (typeof user.banned_until === "string" && user.banned_until.length > 0) {
    const until = Date.parse(user.banned_until);
    if (Number.isFinite(until) && until > Date.now()) {
      return true;
    }
  }
  return false;
}

/**
 * Resolves existing auth user or creates/invites a new one.
 */
export async function ensureAuthUser(email: string, firstname: string, lastname: string) {
  const admin = createAdminClient();
  const normalizedEmail = normalizeMemberEmail(email);
  const existing = await findAuthUserByEmail(normalizedEmail);

  if (existing) {
    if (isAuthUserBanned(existing)) {
      throw new Error("E-posten kan ikke brukes.");
    }
    return { userId: existing.id, temporaryPassword: null as string | null };
  }

  const temporaryPassword = generateTemporaryPassword();
  const name = `${firstname} ${lastname}`.trim();
  const userMetadata = {
    full_name: name,
    firstname,
    lastname,
    temporary_password: temporaryPassword,
    temporary_password_created_at: new Date().toISOString(),
  };

  if (shouldSendInviteEmailOnCreate()) {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(normalizedEmail, {
      redirectTo: getInviteRedirectUrl(),
      data: userMetadata,
    });

    if (error || !data?.user) {
      throw error ?? new Error("Kunne ikke sende invitasjon.");
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(data.user.id, {
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: userMetadata,
    });

    if (updateError) {
      throw updateError;
    }

    return { userId: data.user.id, temporaryPassword };
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: normalizedEmail,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: userMetadata,
  });

  if (error || !data?.user) {
    throw error ?? new Error("Kunne ikke opprette auth-bruker.");
  }

  return { userId: data.user.id, temporaryPassword };
}
