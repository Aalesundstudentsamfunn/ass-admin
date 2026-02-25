"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { shouldAutoPrint } from "@/lib/members/shared";
import { isMembershipActive } from "@/lib/privilege-checks";
import { logAdminAction } from "@/lib/server/admin-audit-log";
import type {
  AddMemberActionResult,
  CheckMemberEmailResult,
} from "@/lib/members/actions-types";
import {
  ensureAuthUser,
  normalizeMemberEmail,
  queueMemberCardPrint,
  resolveActionActor,
  toMemberPrivilege,
} from "./support";

type ExistingMemberLookup = {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  privilege_type: number | null;
  is_membership_active: boolean | null;
  is_banned: boolean | null;
};

/**
 * Logs a member action with target table fixed to `members`.
 */
async function logMemberAction(
  sb: Awaited<ReturnType<typeof createClient>>,
  {
    actorId,
    action,
    targetId,
    status = "ok",
    errorMessage = null,
    details = null,
  }: {
    actorId: string;
    action: string;
    targetId: string | null;
    status?: "ok" | "error";
    errorMessage?: string | null;
    details?: Record<string, unknown> | null;
  },
) {
  await logAdminAction(sb, {
    actorId,
    action,
    targetTable: "members",
    targetId,
    status,
    errorMessage,
    details,
  });
}

/**
 * Server action used by add-member dialog to check member/email state.
 */
export async function checkMemberEmail(
  _: unknown,
  formData: FormData,
): Promise<CheckMemberEmailResult> {
  const normalizedEmail = normalizeMemberEmail(String(formData.get("email") ?? ""));
  if (!normalizedEmail) {
    return { ok: false, error: "E-post mangler." };
  }

  try {
    const sb = await createClient();
    const actor = await resolveActionActor(sb);
    if (!actor.ok) {
      return { ok: false, error: actor.error };
    }

    const { data: existingMembers, error: lookupError } = await sb
      .from("members")
      .select("id, firstname, lastname, email, privilege_type, is_membership_active, is_banned")
      .ilike("email", normalizedEmail)
      .limit(2);

    if (lookupError) {
      return { ok: false, error: lookupError.message };
    }

    const existingMemberRows = (existingMembers ?? []) as ExistingMemberLookup[];
    if (existingMemberRows.length > 1) {
      return { ok: false, error: "Fant flere medlemsrader for denne e-posten. Kontakt IT." };
    }
    const existingMember = existingMemberRows[0] ?? null;

    if (!existingMember) {
      return {
        ok: true,
        email: normalizedEmail,
        exists: false,
        active: false,
        banned: false,
      };
    }

    if (existingMember.is_banned === true) {
      await logMemberAction(sb, {
        actorId: actor.userId,
        action: "member.create.check",
        targetId: existingMember.id,
        status: "error",
        errorMessage: "E-posten kan ikke brukes.",
        details: {
          email: normalizedEmail,
          member_id: existingMember.id,
          reason: "banned_email",
        },
      });
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
 * Server action: activates an existing inactive membership by email.
 */
export async function activateMember(
  _: unknown,
  formData: FormData,
): Promise<AddMemberActionResult> {
  const normalizedEmail = normalizeMemberEmail(String(formData.get("email") ?? ""));

  if (!normalizedEmail) {
    return { ok: false, error: "E-post mangler." };
  }

  try {
    const sb = await createClient();
    const actor = await resolveActionActor(sb);
    if (!actor.ok) {
      return { ok: false, error: actor.error };
    }
    const createdBy = actor.userId;

    const { data: existingMembers, error: lookupError } = await sb
      .from("members")
      .select("id, firstname, lastname, email, privilege_type, is_membership_active, is_banned")
      .ilike("email", normalizedEmail)
      .limit(2);

    if (lookupError) {
      await logMemberAction(sb, {
        actorId: createdBy,
        action: "member.activate",
        targetId: normalizedEmail,
        status: "error",
        errorMessage: lookupError.message,
        details: { email: normalizedEmail },
      });
      return { ok: false, error: lookupError.message };
    }

    const existingMemberRows = (existingMembers ?? []) as ExistingMemberLookup[];
    if (existingMemberRows.length > 1) {
      await logMemberAction(sb, {
        actorId: createdBy,
        action: "member.activate",
        targetId: normalizedEmail,
        status: "error",
        errorMessage: "Fant flere medlemsrader for denne e-posten.",
        details: {
          email: normalizedEmail,
          reason: "duplicate_email_rows",
          duplicate_count: existingMemberRows.length,
        },
      });
      return { ok: false, error: "Fant flere medlemsrader for denne e-posten. Kontakt IT." };
    }
    const existingMember = existingMemberRows[0] ?? null;

    if (!existingMember) {
      await logMemberAction(sb, {
        actorId: createdBy,
        action: "member.activate",
        targetId: normalizedEmail,
        status: "error",
        errorMessage: "Fant ikke medlem med denne e-posten.",
        details: { email: normalizedEmail },
      });
      return { ok: false, error: "Fant ikke medlem med denne e-posten." };
    }
    if (existingMember.is_banned === true) {
      await logMemberAction(sb, {
        actorId: createdBy,
        action: "member.activate",
        targetId: existingMember.id,
        status: "error",
        errorMessage: "E-posten kan ikke brukes.",
        details: { email: normalizedEmail },
      });
      return { ok: false, error: "E-posten kan ikke brukes." };
    }
    if (isMembershipActive(existingMember.is_membership_active)) {
      await logMemberAction(sb, {
        actorId: createdBy,
        action: "member.activate",
        targetId: existingMember.id,
        status: "error",
        errorMessage: "Dette medlemskapet er allerede aktivt.",
        details: { email: normalizedEmail },
      });
      return { ok: false, error: "Dette medlemskapet er allerede aktivt." };
    }

    const { data: updatedMember, error: updateError } = await sb
      .from("members")
      .update({ is_membership_active: true })
      .eq("id", existingMember.id)
      .select("id, firstname, lastname, email, privilege_type, is_membership_active")
      .maybeSingle();

    if (updateError) {
      await logMemberAction(sb, {
        actorId: createdBy,
        action: "member.activate",
        targetId: existingMember.id,
        status: "error",
        errorMessage: updateError.message,
        details: { email: normalizedEmail },
      });
      return { ok: false, error: updateError.message };
    }

    if (!updatedMember) {
      await logMemberAction(sb, {
        actorId: createdBy,
        action: "member.activate",
        targetId: existingMember.id,
        status: "error",
        errorMessage: "Mangler tilgang til å aktivere medlemskap.",
        details: { email: normalizedEmail },
      });
      return { ok: false, error: "Mangler tilgang til å aktivere medlemskap." };
    }

    await logMemberAction(sb, {
      actorId: createdBy,
      action: "member.activate",
      targetId: updatedMember.id,
      details: {
        email: updatedMember.email,
        privilege_type: updatedMember.privilege_type,
        is_membership_active: true,
      },
    });

    revalidatePath("/dashboard/members");
    return {
      ok: true,
      autoPrint: false,
    };
  } catch (error: unknown) {
    return { ok: false, error: String(error) };
  }
}

/**
 * Server action: creates a member and links/creates auth user for the email.
 */
export async function addNewMember(
  _: unknown,
  formData: FormData,
): Promise<AddMemberActionResult> {
  const firstname = String(formData.get("firstname") ?? "");
  const normalizedEmail = normalizeMemberEmail(String(formData.get("email") ?? ""));
  const lastname = String(formData.get("lastname") ?? "");
  const voluntary = Boolean(formData.get("voluntary"));
  const autoPrint = shouldAutoPrint(formData.get("autoPrint"));

  try {
    const sb = await createClient();
    const actor = await resolveActionActor(sb);
    if (!actor.ok) {
      return { ok: false, error: actor.error };
    }
    const createdBy = actor.userId;

    const { data: existingMembers, error: lookupError } = await sb
      .from("members")
      .select("id, privilege_type, is_membership_active, is_banned")
      .ilike("email", normalizedEmail)
      .limit(2);

    if (lookupError) {
      await logMemberAction(sb, {
        actorId: createdBy,
        action: "member.create",
        targetId: normalizedEmail,
        status: "error",
        errorMessage: lookupError.message,
        details: { email: normalizedEmail },
      });
      return { ok: false, error: lookupError.message };
    }

    const existingMemberRows = (existingMembers ?? []) as Array<
      Pick<ExistingMemberLookup, "id" | "privilege_type" | "is_membership_active" | "is_banned">
    >;
    if (existingMemberRows.length > 1) {
      await logMemberAction(sb, {
        actorId: createdBy,
        action: "member.create",
        targetId: normalizedEmail,
        status: "error",
        errorMessage: "Fant flere medlemsrader for denne e-posten.",
        details: {
          email: normalizedEmail,
          reason: "duplicate_email_rows",
          duplicate_count: existingMemberRows.length,
        },
      });
      return { ok: false, error: "Fant flere medlemsrader for denne e-posten. Kontakt IT." };
    }
    const existingMember = existingMemberRows[0] ?? null;

    if (existingMember) {
      if (existingMember.is_banned === true) {
        await logMemberAction(sb, {
          actorId: createdBy,
          action: "member.create",
          targetId: normalizedEmail,
          status: "error",
          errorMessage: "E-posten kan ikke brukes.",
          details: { email: normalizedEmail },
        });
        return { ok: false, error: "E-posten kan ikke brukes." };
      }
      if (isMembershipActive(existingMember.is_membership_active)) {
        await logMemberAction(sb, {
          actorId: createdBy,
          action: "member.create",
          targetId: normalizedEmail,
          status: "error",
          errorMessage: "E-posten finnes allerede med aktivt medlemskap.",
          details: { email: normalizedEmail },
        });
        return { ok: false, error: "E-posten finnes allerede med aktivt medlemskap." };
      }

      await logMemberAction(sb, {
        actorId: createdBy,
        action: "member.create",
        targetId: normalizedEmail,
        status: "error",
        errorMessage: "E-posten finnes allerede, bruk Aktiver medlemskap.",
        details: { email: normalizedEmail },
      });
      return { ok: false, error: "E-posten finnes allerede, bruk Aktiver medlemskap." };
    }

    const { userId } = await ensureAuthUser(normalizedEmail, firstname, lastname);
    const privilegeType = toMemberPrivilege(voluntary);

    const { data: newMember, error: insertError } = await sb
      .from("members")
      .insert({
        id: userId,
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
      await logMemberAction(sb, {
        actorId: createdBy,
        action: "member.create",
        targetId: normalizedEmail,
        status: "error",
        errorMessage: insertError?.message ?? "Failed to add new member.",
        details: { email: normalizedEmail },
      });
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
      await logMemberAction(sb, {
        actorId: createdBy,
        action: "member.card_print.enqueue",
        targetId: newMember.id,
        status: "error",
        errorMessage: `added user but failed to add to printer queue: ${queueError.message}`,
        details: {
          email: newMember.email,
          auto_print: true,
          auth_user_id: userId,
        },
      });
      return { ok: false, error: `added user but failed to add to printer queue: ${queueError.message}` };
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
