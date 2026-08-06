/**
 * POST /api/admin/members/renew-membership
 * Fornyer ett medlemskap til inneværende periode.
 * Access is restricted by shared assertPermission guard (requirement: manageMembers).
 *
 * Bevisst én om gangen, uten bulk-variant. Fornying deler ut et betalt medlemsår,
 * og et masseklikk på en side med utløpte medlemmer ville delt ut hundrevis av
 * dem uten at noen tok stilling til det. Sperreknappen (membership-status) tåler
 * bulk fordi den bare løfter eller setter en restriksjon.
 *
 * Selve skrivingen skjer i `activate_membership()`, samme RPC som mobilappen
 * bruker via edge-funksjonen, slik at reglene for hvem som kan fornye og hva som
 * blokkerer det finnes ett sted.
 */
import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/server/assert-permission";
import { logAdminAction } from "@/lib/server/admin-audit-log";

/**
 * Oversetter en sentinelfeil fra `activate_membership()` til norsk tekst.
 */
function activationErrorMessage(message: string) {
  if (message.includes("MEMBERSHIP_DISABLED")) {
    return "Medlemskapet er sperret. Stortinget må oppheve sperren først.";
  }
  if (message.includes("ALREADY_ACTIVE")) {
    return "Dette medlemskapet er allerede aktivt.";
  }
  if (message.includes("MEMBER_BANNED")) {
    return "Brukeren er utestengt.";
  }
  if (message.includes("MEMBER_NOT_FOUND")) {
    return "Fant ikke medlemmet.";
  }
  if (message.includes("FORBIDDEN") || message.includes("ACTOR_REQUIRED")) {
    return "Mangler tilgang til å fornye medlemskap.";
  }
  return message;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const memberId = String(body?.member_id ?? "").trim();

    if (!memberId) {
      return NextResponse.json({ error: "Medlems-ID mangler." }, { status: 400 });
    }

    const permission = await assertPermission({ requirement: "manageMembers" });
    if (!permission.ok) {
      return permission.response;
    }
    const { supabase, userId } = permission;

    const { data, error } = await supabase.rpc("activate_membership", {
      p_member_id: memberId,
    });

    if (error) {
      const message = activationErrorMessage(error.message ?? "");
      await logAdminAction(supabase, {
        actorId: userId,
        action: "member.activate",
        targetTable: "members",
        targetId: memberId,
        status: "error",
        errorMessage: message,
        details: { member_id: memberId },
      });
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const member = (Array.isArray(data) ? data[0] : data) as
      | {
          id: string;
          is_membership_active: boolean | null;
          membership_active_until: string | null;
        }
      | undefined;

    if (!member) {
      return NextResponse.json(
        { error: "Fornyingen returnerte ingen medlem." },
        { status: 400 },
      );
    }

    await logAdminAction(supabase, {
      actorId: userId,
      action: "member.activate",
      targetTable: "members",
      targetId: member.id,
      status: "ok",
      details: {
        member_id: member.id,
        is_membership_active: member.is_membership_active,
        membership_active_until: member.membership_active_until,
      },
    });

    return NextResponse.json({
      ok: true,
      member_id: member.id,
      is_membership_active: member.is_membership_active,
      membership_active_until: member.membership_active_until,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ukjent feil" },
      { status: 500 },
    );
  }
}
