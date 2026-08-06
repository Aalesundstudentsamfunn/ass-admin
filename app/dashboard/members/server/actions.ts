"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { shouldAutoPrint } from "@/lib/members/shared";
import { parseCommitteeId } from "@/lib/committee-options";
import { logAdminAction } from "@/lib/server/admin-audit-log";
import { fetchCommitteeNameByIdMap } from "@/lib/server/committee-type";
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
  committee: number | null;
  is_membership_active: boolean | null;
  membership_active_until: string | null;
  membership_disabled_at: string | null;
  is_banned: boolean | null;
};

/**
 * Slår opp komiténavnet et kort skal trykkes med.
 *
 * How: Vanlige medlemmer har ingen komité, og da skal kortet trykkes uten. Feiler
 * oppslaget, trykker vi heller uten komité enn å stoppe en fornying som allerede
 * er skrevet til databasen.
 * @returns komiténavn, eller null når medlemmet ikke har en.
 */
async function resolveCommitteeName(
  sb: Awaited<ReturnType<typeof createClient>>,
  committeeId: number | null | undefined,
) {
  if (typeof committeeId !== "number") {
    return null;
  }
  const { nameById } = await fetchCommitteeNameByIdMap(sb, [committeeId]);
  return nameById.get(committeeId) ?? null;
}

/**
 * Oversetter en feil fra `activate_membership()` til tekst for skjermen.
 *
 * How: RPC-en kaster bare sentinelverdier, ikke ferdig tekst, slik at ordlyden
 * bor her og ikke i databasen.
 * @returns norsk feilmelding.
 */
function activationErrorMessage(message: string) {
  if (message.includes("MEMBERSHIP_DISABLED")) {
    return "Medlemskapet er deaktivert. Stortinget må slå det på igjen først.";
  }
  if (message.includes("ALREADY_ACTIVE")) {
    return "Dette medlemskapet er allerede aktivt.";
  }
  if (message.includes("MEMBER_BANNED")) {
    return "E-posten kan ikke brukes.";
  }
  if (message.includes("MEMBER_NOT_FOUND")) {
    return "Fant ikke medlemmet.";
  }
  if (message.includes("FORBIDDEN") || message.includes("ACTOR_REQUIRED")) {
    return "Mangler tilgang til å aktivere medlemskap.";
  }
  return message;
}

/**
 * Avgjør om et medlemskap er aktivt nå.
 *
 * How: Krever både det utledede flagget og en periode som fortsatt løper.
 * Flagget alene dekker deaktivering (`membership_disabled_at`), men står stille
 * fra en periode utløper til nattjobben rekker å utlede det på nytt; datoen
 * alene overser deaktivering. Begge trengs.
 * @returns true når medlemskapet gjelder i dag.
 */
function hasActiveMembership(
  member: Pick<ExistingMemberLookup, "is_membership_active" | "membership_active_until">,
) {
  return member.is_membership_active === true
    && hasRunningMembership(member.membership_active_until);
}

/**
 * Avgjør om selve perioden fortsatt løper, uten hensyn til deaktivering.
 *
 * @returns true når utløpsdatoen er i dag eller senere.
 */
function hasRunningMembership(activeUntil: string | null | undefined) {
  if (!activeUntil) {
    return false;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(activeUntil);
  if (!match) {
    return false;
  }
  const expiry = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const now = new Date();
  return expiry >= new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

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
      .select("id, firstname, lastname, email, privilege_type, committee, is_membership_active, membership_active_until, membership_disabled_at, is_banned")
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
      active: hasActiveMembership(existingMember),
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
  const autoPrint = shouldAutoPrint(formData.get("autoPrint"));

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
      .select("id, firstname, lastname, email, privilege_type, committee, is_membership_active, membership_active_until, membership_disabled_at, is_banned")
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
    if (hasActiveMembership(existingMember)) {
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

    // All aktivering går gjennom `activate_membership()`. Den skriver perioden,
    // lar triggeren utlede `is_membership_active`, og avviser deaktiverte
    // medlemskap - det er også veien mobilappen bruker via edge-funksjonen, så
    // regelen finnes bare ett sted.
    const { data: activated, error: activateError } = await sb.rpc("activate_membership", {
      p_member_id: existingMember.id,
    });

    if (activateError) {
      const message = activationErrorMessage(activateError.message ?? "");
      await logMemberAction(sb, {
        actorId: createdBy,
        action: "member.activate",
        targetId: existingMember.id,
        status: "error",
        errorMessage: message,
        details: { email: normalizedEmail },
      });
      return { ok: false, error: message };
    }

    const updatedMember = (Array.isArray(activated) ? activated[0] : activated) as
      | Pick<
          ExistingMemberLookup,
          "id" | "email" | "privilege_type" | "is_membership_active" | "membership_active_until"
        >
      | undefined;

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
        is_membership_active: updatedMember.is_membership_active,
        membership_active_until: updatedMember.membership_active_until,
        auto_print: autoPrint,
      },
    });

    if (!autoPrint) {
      revalidatePath("/dashboard/members");
      return { ok: true, autoPrint: false };
    }

    // Fornying gir et nytt medlemsår, og medlemmet står ved kortskriveren når det
    // skjer. Uten dette var aktivering den ene veien inn i medlemslisten som
    // ikke skrev ut noe - og med Stello blir den veien den vanlige.
    const committeeForPrint = await resolveCommitteeName(sb, existingMember.committee);
    const { data: queueRow, error: queueError } = await queueMemberCardPrint(
      sb,
      {
        id: existingMember.id,
        firstname: existingMember.firstname,
        lastname: existingMember.lastname,
        email: updatedMember.email,
      },
      createdBy,
      committeeForPrint,
    );

    if (queueError) {
      await logMemberAction(sb, {
        actorId: createdBy,
        action: "member.card_print.enqueue",
        targetId: existingMember.id,
        status: "error",
        errorMessage: `aktiverte medlemskap, men klarte ikke legge i utskriftskø: ${queueError.message}`,
        details: { email: normalizedEmail, auto_print: true },
      });
      // Medlemskapet ER fornyet. Å returnere feil her ville fått staben til å
      // prøve igjen og møte "allerede aktivt", så dette rapporteres som en
      // utskriftsfeil, ikke en aktiveringsfeil.
      return {
        ok: false,
        error: `Medlemskapet er fornyet, men kortet kunne ikke legges i utskriftskø: ${queueError.message}`,
      };
    }

    revalidatePath("/dashboard/members");
    return {
      ok: true,
      autoPrint: true,
      queueId: queueRow?.id,
      queueRef: existingMember.id,
      queueInvoker: createdBy,
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
  const committeeId = parseCommitteeId(formData.get("committee"));
  const autoPrint = shouldAutoPrint(formData.get("autoPrint"));

  if (voluntary) {
    if (committeeId === null) {
      return { ok: false, error: "Komité må velges for frivillig." };
    }
  } else if (committeeId !== null) {
    return { ok: false, error: "Komité kan bare settes for frivillig." };
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
      Pick<
        ExistingMemberLookup,
        "id" | "privilege_type" | "is_membership_active" | "membership_active_until" | "is_banned"
      >
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
      if (hasActiveMembership(existingMember)) {
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
    let committeeForMemberId: number | null = null;
    let committeeForPrint: string | null = null;
    if (voluntary && committeeId !== null) {
      const { nameById, error: committeeError } = await fetchCommitteeNameByIdMap(sb, [
        committeeId,
      ]);
      const committeeLabel = nameById.get(committeeId) ?? "";
      if (committeeError || !committeeLabel) {
        return { ok: false, error: committeeError ?? "Ugyldig komitévalg." };
      }
      committeeForMemberId = committeeId;
      committeeForPrint = committeeLabel;
    }

    const { data: newMember, error: insertError } = await sb
      .from("members")
      .insert({
        id: userId,
        email: normalizedEmail,
        firstname,
        lastname,
        committee: committeeForMemberId,
        privilege_type: privilegeType,
        created_by: createdBy,
      })
      // Verken membership_active_until eller is_membership_active settes her med
      // vilje: kolonnens default er compute_membership_expiry(), samme regel som
      // brukes ved fornying, og triggeren utleder flagget av den. Vi leser begge
      // tilbake for å få dem med i revisjonsloggen.
      .select("id, firstname, lastname, email, privilege_type, created_by, is_membership_active, membership_active_until")
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

    await logMemberAction(sb, {
      actorId: createdBy,
      action: "member.create",
      targetId: newMember.id,
      status: "ok",
      details: {
        email: newMember.email,
        privilege_type: privilegeType,
        committee_id: committeeForMemberId,
        committee: committeeForPrint,
        is_membership_active: newMember.is_membership_active,
        membership_active_until: newMember.membership_active_until,
        auto_print: autoPrint,
      },
    });

    if (!autoPrint) {
      revalidatePath("/dashboard/members");
      return { ok: true, autoPrint: false };
    }

    const { data: queueRow, error: queueError } = await queueMemberCardPrint(
      sb,
      newMember,
      createdBy,
      committeeForPrint,
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
          committee_id: committeeForMemberId,
          committee: committeeForPrint,
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
