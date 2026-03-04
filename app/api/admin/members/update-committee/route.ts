/**
 * POST /api/admin/members/update-committee
 * Updates committee for one member.
 * Access is restricted by shared assertPermission guard (requirement: manageMembershipStatus).
 */
import { NextResponse } from "next/server";
import { canEditPrivilegeForTarget } from "@/lib/privilege-checks";
import { logAdminAction } from "@/lib/server/admin-audit-log";
import { assertPermission } from "@/lib/server/assert-permission";

/**
 * Updates member committee with server-side validation and per-target privilege checks.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const memberId = String(body?.member_id ?? "").trim();

    const rawCommittee = body?.committee;
    let nextCommittee: string | null = null;
    if (rawCommittee === null || rawCommittee === undefined) {
      nextCommittee = null;
    } else if (typeof rawCommittee === "string") {
      const trimmed = rawCommittee.trim();
      nextCommittee = trimmed.length ? trimmed : null;
    } else {
      return NextResponse.json({ error: "Ugyldig komitéverdi." }, { status: 400 });
    }

    if (!memberId) {
      return NextResponse.json({ error: "Medlems-ID mangler." }, { status: 400 });
    }

    const permission = await assertPermission({ requirement: "manageMembershipStatus" });
    if (!permission.ok) {
      return permission.response;
    }
    const { supabase, userId, privilege } = permission;

    const { data: targetMember, error: targetError } = await supabase
      .from("members")
      .select("id, privilege_type, committee")
      .eq("id", memberId)
      .single();

    if (targetError || !targetMember) {
      return NextResponse.json({ error: "Fant ikke medlem." }, { status: 404 });
    }

    if (!canEditPrivilegeForTarget(privilege, targetMember.privilege_type)) {
      return NextResponse.json(
        { error: "Du har ikke tilgang til å oppdatere komité for dette medlemmet." },
        { status: 403 },
      );
    }

    const previousCommittee =
      typeof targetMember.committee === "string" && targetMember.committee.trim()
        ? targetMember.committee
        : null;

    if (previousCommittee === nextCommittee) {
      return NextResponse.json({ ok: true, unchanged: true, committee: previousCommittee });
    }

    const { error: updateError } = await supabase
      .from("members")
      .update({ committee: nextCommittee })
      .eq("id", memberId);

    if (updateError) {
      await logAdminAction(supabase, {
        actorId: userId,
        action: "member.committee.update",
        targetTable: "members",
        targetId: memberId,
        status: "error",
        errorMessage: updateError.message,
        details: {
          member_id: memberId,
          previous_committee: previousCommittee,
          committee: nextCommittee,
        },
      });
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    await logAdminAction(supabase, {
      actorId: userId,
      action: "member.committee.update",
      targetTable: "members",
      targetId: memberId,
      status: "ok",
      details: {
        member_id: memberId,
        previous_committee: previousCommittee,
        committee: nextCommittee,
      },
    });

    return NextResponse.json({
      ok: true,
      committee: nextCommittee,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ukjent feil" },
      { status: 500 },
    );
  }
}
