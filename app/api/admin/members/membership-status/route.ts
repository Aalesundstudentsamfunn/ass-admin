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

    const currentById = new Map(
      (existingRows ?? []).map((row) => [String(row.id), row.is_membership_active === true]),
    );
    const unchangedIds: string[] = [];
    let idsToUpdate: string[] = [];
    for (const id of memberIds) {
      if (!currentById.has(id)) {
        continue;
      }
      if (currentById.get(id) === isActive) {
        unchangedIds.push(id);
        continue;
      }
      idsToUpdate.push(id);
    }

    // Guard: banned users must not be re-activated through membership endpoint.
    let blockedIds: string[] = [];
    if (isActive) {
      const { data: bannedRows, error: bannedCheckError } = await supabase
        .from("members")
        .select("id")
        .in("id", idsToUpdate)
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
            unchanged_member_ids: unchangedIds,
          },
          });
        return NextResponse.json({ error: bannedCheckError.message }, { status: 400 });
      }

      blockedIds = (bannedRows ?? []).map((row) => String(row.id));
      if (blockedIds.length > 0) {
        const blockedSet = new Set(blockedIds);
        idsToUpdate = idsToUpdate.filter((id) => !blockedSet.has(id));
      }
    }

    if (!idsToUpdate.length) {
      return NextResponse.json({
        ok: true,
        updated: 0,
        skipped: unchangedIds.length + blockedIds.length,
      });
    }

    const previousActiveCount = idsToUpdate.filter((id) => currentById.get(id) === true).length;
    const previousInactiveCount = idsToUpdate.length - previousActiveCount;
    const previousSingleValue =
      idsToUpdate.length === 1 ? currentById.get(idsToUpdate[0]) ?? null : null;

    const { error } = await supabase
      .from("members")
      .update({ is_membership_active: isActive })
      .in("id", idsToUpdate);

    if (error) {
      await logAdminAction(supabase, {
        actorId: userId,
        action: "member.membership_status.update",
        targetTable: "members",
        targetId: memberIds.length === 1 ? memberIds[0] : null,
        status: "error",
        errorMessage: error.message,
        details: {
          member_ids: idsToUpdate,
          requested_member_ids: memberIds,
          is_active: isActive,
          previous_is_active: previousSingleValue,
          previous_active_count: previousActiveCount,
          previous_inactive_count: previousInactiveCount,
          skipped_unchanged_count: unchangedIds.length,
          skipped_unavailable_count: blockedIds.length,
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
        member_ids: idsToUpdate,
        requested_member_ids: memberIds,
        is_active: isActive,
        previous_is_active: previousSingleValue,
        previous_active_count: previousActiveCount,
        previous_inactive_count: previousInactiveCount,
        updated_count: idsToUpdate.length,
        skipped_unchanged_count: unchangedIds.length,
        skipped_unavailable_count: blockedIds.length,
      },
    });

    return NextResponse.json({
      ok: true,
      updated: idsToUpdate.length,
      skipped: unchangedIds.length + blockedIds.length,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Ukjent feil" }, { status: 500 });
  }
}
