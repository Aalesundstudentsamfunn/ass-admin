import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import DataTable from "./_wrapped_page";
import type { UserRow } from "./_wrapped_page";
import { ActionsProvider } from "./providers";
import { revalidatePath } from "next/cache";
import { enqueuePrinterQueue } from "@/lib/printer-queue";
import { randomBytes } from "crypto";
import { canManageMembers, isMembershipActive } from "@/lib/privilege-checks";
import { PRIVILEGE_LEVELS } from "@/lib/privilege-config";
import { shouldAutoPrint, type PrintableMember } from "@/lib/members/shared";

/**
 * Paginates auth users and returns the user with matching email, if any.
 */
const findAuthUserByEmail = async (email: string) => {
  const admin = createAdminClient();
  const normalizedEmail = email.trim().toLowerCase();
  let page = 1;
  const perPage = 200;

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
};

/**
 * Normalizes emails used across member lookup, insert, and auth lookup.
 */
const normalizeEmail = (value: string) => value.trim().toLowerCase();

/**
 * Generates a temporary password for invited users.
 */
const generateTemporaryPassword = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const bytes = randomBytes(18);
  let password = "";
  for (let i = 0; i < bytes.length; i += 1) {
    password += chars[bytes[i] % chars.length];
  }
  return password;
};

/**
 * Checks whether the auth user currently has an active ban.
 */
const isAuthUserBanned = (user: { app_metadata?: Record<string, unknown> | null; banned_until?: string | null } | null | undefined) => {
  if (!user) {
    return false;
  }
  const appBanned = user.app_metadata?.is_banned;
  if (appBanned === true) {
    return true;
  }
  if (typeof user.banned_until === "string" && user.banned_until.length > 0) {
    const until = Date.parse(user.banned_until);
    if (Number.isFinite(until) && until > Date.now()) {
      return true;
    }
  }
  return false;
};

/**
 * Finds or creates an auth user by email.
 * For new users, sends invite and sets a generated temporary password.
 */
const ensureAuthUser = async (email: string, firstname: string, lastname: string) => {
  const admin = createAdminClient();
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await findAuthUserByEmail(normalizedEmail);
  if (existing) {
    if (isAuthUserBanned(existing)) {
      throw new Error("E-posten kan ikke brukes.");
    }
    return { user: existing, temporaryPassword: null };
  }

  const temporaryPassword = generateTemporaryPassword();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const name = `${firstname} ${lastname}`.trim();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(normalizedEmail, {
    redirectTo: siteUrl ? `${siteUrl.replace(/\/$/, "")}/auth/login` : undefined,
    data: {
      full_name: name,
      firstname,
      lastname,
      temporary_password: temporaryPassword,
    },
  });
  if (error || !data?.user) {
    throw error ?? new Error("Kunne ikke sende invitasjon.");
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(data.user.id, {
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: {
      full_name: name,
      firstname,
      lastname,
      temporary_password: temporaryPassword,
      temporary_password_created_at: new Date().toISOString(),
    },
  });

  if (updateError) {
    throw updateError;
  }

  return { user: data.user, temporaryPassword };
};

/**
 * Maps the form's voluntary toggle to stored privilege level.
 */
const toPrivilegeType = (isVoluntary: boolean) =>
  isVoluntary ? PRIVILEGE_LEVELS.VOLUNTARY : PRIVILEGE_LEVELS.MEMBER;

/**
 * Adds a member card print job to the printer queue.
 * Shared by both create and activate flows.
 */
const queueMemberCardPrint = async (
  sb: Awaited<ReturnType<typeof createClient>>,
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
 * Gets and validates current actor for member-management server actions.
 */
const getCurrentActor = async (sb: Awaited<ReturnType<typeof createClient>>) => {
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
 * Server action: checks whether email already exists and returns member state.
 */
async function checkMemberEmail(_: unknown, formData: FormData) {
  "use server";

  const normalizedEmail = normalizeEmail(String(formData.get("email") ?? ""));
  if (!normalizedEmail) {
    return { ok: false, error: "E-post mangler." };
  }

  try {
    const sb = await createClient();
    const actor = await getCurrentActor(sb);
    if (!actor.ok) {
      return { ok: false, error: actor.error };
    }

    const { data: existingMember, error: lookupError } = await sb
      .from("members")
      .select("id, firstname, lastname, email, privilege_type, is_membership_active, is_banned")
      .ilike("email", normalizedEmail)
      .maybeSingle();

    if (lookupError) {
      return { ok: false, error: lookupError.message };
    }

    if (!existingMember) {
      return {
        ok: true,
        email: normalizedEmail,
        exists: false,
        active: false,
        banned: false,
      };
    }

    return {
      ok: true,
      email: normalizedEmail,
      exists: true,
      active: isMembershipActive(existingMember.is_membership_active),
      banned: existingMember.is_banned === true,
      member: {
        id: existingMember.id,
        firstname: existingMember.firstname,
        lastname: existingMember.lastname,
        email: existingMember.email,
        privilege_type: existingMember.privilege_type,
        is_banned: existingMember.is_banned,
      },
    };
  } catch (error: unknown) {
    return { ok: false, error: String(error) };
  }
}

/**
 * Server action: re-activates an existing inactive member by email.
 */
async function activateMember(_: unknown, formData: FormData) {
  "use server";

  const normalizedEmail = normalizeEmail(String(formData.get("email") ?? ""));
  const voluntary = Boolean(formData.get("voluntary"));
  const autoPrint = shouldAutoPrint(formData.get("autoPrint"));

  if (!normalizedEmail) {
    return { ok: false, error: "E-post mangler." };
  }

  try {
    const sb = await createClient();
    const actor = await getCurrentActor(sb);
    if (!actor.ok) {
      return { ok: false, error: actor.error };
    }
    const createdBy = actor.userId;

    const { data: existingMember, error: lookupError } = await sb
      .from("members")
      .select("id, firstname, lastname, email, privilege_type, is_membership_active, is_banned")
      .ilike("email", normalizedEmail)
      .maybeSingle();

    if (lookupError) {
      return { ok: false, error: lookupError.message };
    }
    if (!existingMember) {
      return { ok: false, error: "Fant ikke medlem med denne e-posten." };
    }
    if (existingMember.is_banned === true) {
      return { ok: false, error: "E-posten kan ikke brukes." };
    }
    if (isMembershipActive(existingMember.is_membership_active)) {
      return { ok: false, error: "Dette medlemskapet er allerede aktivt." };
    }

    const privilegeType = toPrivilegeType(voluntary);
    const { data: updatedMember, error: updateError } = await sb
      .from("members")
      .update({ privilege_type: privilegeType, is_membership_active: true })
      .eq("id", existingMember.id)
      .select("id, firstname, lastname, email, privilege_type")
      .single();

    if (updateError || !updatedMember) {
      return { ok: false, error: updateError?.message ?? "Kunne ikke aktivere medlemskap." };
    }

    if (!autoPrint) {
      revalidatePath("/dashboard/members");
      return { ok: true, autoPrint: false };
    }

    const { data: queueRow, error: queueError } = await queueMemberCardPrint(
      sb,
      updatedMember,
      createdBy,
      privilegeType,
    );

    if (queueError) {
      return { ok: false, error: "medlemskap aktivert men utskrift feilet: " + queueError.message };
    }

    revalidatePath("/dashboard/members");
    return {
      ok: true,
      autoPrint: true,
      queueId: queueRow?.id,
      queueRef: updatedMember.id,
      queueInvoker: createdBy,
    };
  } catch (error: unknown) {
    return { ok: false, error: String(error) };
  }
}

/**
 * Server action: creates a new member and links/creates auth user.
 */
async function addNewMember(_: unknown, formData: FormData) {
  "use server";

  const firstname = String(formData.get("firstname") ?? "");
  const normalizedEmail = normalizeEmail(String(formData.get("email") ?? ""));
  const lastname = String(formData.get("lastname") ?? "");
  const voluntary = Boolean(formData.get("voluntary"));
  const autoPrint = shouldAutoPrint(formData.get("autoPrint"));

  try {
    const sb = await createClient();
    const actor = await getCurrentActor(sb);
    if (!actor.ok) {
      return { ok: false, error: actor.error };
    }
    const createdBy = actor.userId;

    const { data: existingMember, error: lookupError } = await sb
      .from("members")
      .select("id, privilege_type, is_membership_active, is_banned")
      .ilike("email", normalizedEmail)
      .maybeSingle();

    if (lookupError) {
      return { ok: false, error: lookupError.message };
    }
    if (existingMember) {
      if (existingMember.is_banned === true) {
        return { ok: false, error: "E-posten kan ikke brukes." };
      }
      if (isMembershipActive(existingMember.is_membership_active)) {
        return { ok: false, error: "E-posten finnes allerede med aktivt medlemskap." };
      }
      return { ok: false, error: "E-posten finnes allerede, bruk Aktiver medlemskap." };
    }

    const authResult = await ensureAuthUser(normalizedEmail, firstname, lastname);
    const authUser = authResult.user;
    const privilegeType = toPrivilegeType(voluntary);

    const { data: newMember, error: insertError } = await sb
      .from("members")
      .insert({
        id: authUser.id,
        email: normalizedEmail,
        firstname,
        lastname,
        privilege_type: privilegeType,
        is_membership_active: true,
        created_by: createdBy,
      })
      .select("id, firstname, lastname, email, privilege_type, created_by")
      .single();

    if (insertError || !newMember) {
      return { ok: false, error: insertError?.message ?? "Failed to add new member." };
    }

    if (!autoPrint) {
      revalidatePath("/dashboard/members");
      return { ok: true, autoPrint: false };
    }

    const { data: queueRow, error: queueError } = await queueMemberCardPrint(
      sb,
      newMember,
      createdBy,
      privilegeType,
    );

    if (queueError) {
      return { ok: false, error: "added user but failed to add to printer queue: " + queueError.message };
    }

    revalidatePath("/dashboard/members");
    return {
      ok: true,
      autoPrint: true,
      queueId: queueRow?.id,
      queueRef: newMember.id,
      queueInvoker: createdBy,
    };
  } catch (error: unknown) {
    return { ok: false, error: String(error) };
  }
}

export default async function MembersPage() {
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("members")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return <div>Error: {error?.message}</div>;
  }
  const mappedRows = (rows ?? []).map((row): UserRow => ({
    id: row.id,
    firstname: row.firstname,
    lastname: row.lastname,
    email: row.email,
    added_by: row.created_by ?? null,
    created_at: row.created_at ?? null,
    password_set_at: row.password_set_at ?? null,
    is_membership_active: row.is_membership_active ?? null,
    is_banned: row.is_banned ?? null,
    profile_id: null,
    privilege_type: row.privilege_type ?? null,
  }));

  return (
    <ActionsProvider
      addNewMember={addNewMember}
      checkMemberEmail={checkMemberEmail}
      activateMember={activateMember}
    >
      <DataTable initialData={mappedRows} />
    </ActionsProvider>
  );
}
