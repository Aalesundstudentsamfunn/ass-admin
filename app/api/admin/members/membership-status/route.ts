/**
 * POST /api/admin/members/membership-status
 * Updates is_membership_active for one or more members.
 * Access is restricted by shared assertPermission guard (requirement: manageMembershipStatus).
 */
import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/server/assert-permission";
import { logAdminAction } from "@/lib/server/admin-audit-log";

/**
 * Bulk-updates membership active state with guardrails for banned users.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const isActive = Boolean(body?.is_active);
    const idsFromArray: string[] = Array.isArray(body?.member_ids)
      ? body.member_ids
          .map((value: unknown) => String(value ?? "").trim())
          .filter((value: string): value is string => Boolean(value))
      : [];
    const singleId = String(body?.member_id ?? "").trim();
    const memberIds: string[] = Array.from(
      new Set(singleId ? [singleId, ...idsFromArray] : idsFromArray),
    );

    if (!memberIds.length) {
      return NextResponse.json({ error: "Medlems-ID mangler." }, { status: 400 });
    }

    const permission = await assertPermission({ requirement: "manageMembershipStatus" });
    if (!permission.ok) {
      return permission.response;
    }
    const { supabase, userId } = permission;

    const { data: existingRows, error: existingRowsError } = await supabase
      .from("members")
      .select("id, is_membership_active")
      .in("id", memberIds);

    if (existingRowsError) {
      await logAdminAction(supabase, {
        actorId: userId,
        action: "member.membership_status.update",
        targetTable: "members",
        targetId: memberIds.length === 1 ? memberIds[0] : null,
        status: "error",
        errorMessage: existingRowsError.message,
        details: {
          member_ids: memberIds,
          is_active: isActive,
        },
      });
      return NextResponse.json({ error: existingRowsError.message }, { status: 400 });
    }

    const previousById = new Map(
      (existingRows ?? []).map((row) => [row.id, row.is_membership_active]),
    );
    const previousActiveCount = (existingRows ?? []).filter(
      (row) => row.is_membership_active === true,
    ).length;
    const previousInactiveCount = (existingRows ?? []).filter(
      (row) => row.is_membership_active !== true,
    ).length;
    const previousSingleValue =
      memberIds.length === 1 ? previousById.get(memberIds[0]) ?? null : null;

    // Guard: banned users must not be re-activated through membership endpoint.
    if (isActive) {
      const { data: bannedRows, error: bannedCheckError } = await supabase
        .from("members")
        .select("id")
        .in("id", memberIds)
        .eq("is_banned", true);

      if (bannedCheckError) {
        await logAdminAction(supabase, {
          actorId: userId,
          action: "member.membership_status.update",
          targetTable: "members",
          targetId: memberIds.length === 1 ? memberIds[0] : null,
          status: "error",
          errorMessage: bannedCheckError.message,
          details: {
            member_ids: memberIds,
            is_active: isActive,
          },
          });
        return NextResponse.json({ error: bannedCheckError.message }, { status: 400 });
      }

      if ((bannedRows ?? []).length > 0) {
        await logAdminAction(supabase, {
          actorId: userId,
          action: "member.membership_status.update",
          targetTable: "members",
          targetId: memberIds.length === 1 ? memberIds[0] : null,
          status: "error",
          errorMessage: "Én eller flere brukere kan ikke aktiveres.",
          details: {
            member_ids: memberIds,
            is_active: isActive,
            blocked_banned_ids: (bannedRows ?? []).map((row) => row.id),
          },
          });
        return NextResponse.json(
          { error: "Én eller flere brukere kan ikke aktiveres." },
          { status: 400 },
        );
      }
    }

    const { error } = await supabase
      .from("members")
      .update({ is_membership_active: isActive })
      .in("id", memberIds);

    if (error) {
      await logAdminAction(supabase, {
        actorId: userId,
        action: "member.membership_status.update",
        targetTable: "members",
        targetId: memberIds.length === 1 ? memberIds[0] : null,
        status: "error",
        errorMessage: error.message,
        details: {
          member_ids: memberIds,
          is_active: isActive,
          previous_is_active: previousSingleValue,
          previous_active_count: previousActiveCount,
          previous_inactive_count: previousInactiveCount,
        },
      });
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    await logAdminAction(supabase, {
      actorId: userId,
      action: "member.membership_status.update",
      targetTable: "members",
      targetId: memberIds.length === 1 ? memberIds[0] : null,
      status: "ok",
      details: {
        member_ids: memberIds,
        is_active: isActive,
        previous_is_active: previousSingleValue,
        previous_active_count: previousActiveCount,
        previous_inactive_count: previousInactiveCount,
        updated_count: memberIds.length,
      },
    });

    return NextResponse.json({ ok: true, updated: memberIds.length });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Ukjent feil" }, { status: 500 });
  }
}
