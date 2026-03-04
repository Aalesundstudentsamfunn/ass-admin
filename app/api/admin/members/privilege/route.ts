/**
 * POST /api/admin/members/privilege
 * Updates privilege_type for one or more members with server-side role checks.
 * Access is restricted by shared assertPermission guard (requirement: manageMembers).
 */
import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/server/assert-permission";
import { canAssignPrivilege, canSetOwnPrivilege, memberPrivilege } from "@/lib/privilege-checks";
import { logAdminAction } from "@/lib/server/admin-audit-log";

/**
 * Updates member privilege with per-target validation and explicit audit logging.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const nextPrivilege = Number(body?.privilege_type);
    const singleId = String(body?.member_id ?? "").trim();
    const idsFromArray: string[] = Array.isArray(body?.member_ids)
      ? body.member_ids
          .map((value: unknown) => String(value ?? "").trim())
          .filter((value: string): value is string => Boolean(value))
      : [];
    const memberIds = Array.from(new Set(singleId ? [singleId, ...idsFromArray] : idsFromArray));

    if (!Number.isFinite(nextPrivilege)) {
      return NextResponse.json({ error: "Ugyldig tilgangsnivå." }, { status: 400 });
    }
    if (!memberIds.length) {
      return NextResponse.json({ error: "Medlems-ID mangler." }, { status: 400 });
    }

    const permission = await assertPermission({ requirement: "manageMembers" });
    if (!permission.ok) {
      return permission.response;
    }
    const { supabase, userId, privilege: actorPrivilege } = permission;

    const { data: targetRows, error: targetError } = await supabase
      .from("members")
      .select("id, privilege_type")
      .in("id", memberIds);

    if (targetError) {
      await logAdminAction(supabase, {
        actorId: userId,
        action: "member.privilege.update",
        targetTable: "members",
        targetId: memberIds.length === 1 ? memberIds[0] : null,
        status: "error",
        errorMessage: targetError.message,
        details: {
          member_ids: memberIds,
          privilege_type: nextPrivilege,
        },
      });
      return NextResponse.json({ error: targetError.message }, { status: 400 });
    }

    const targets = targetRows ?? [];
    if (!targets.length) {
      return NextResponse.json({ error: "Fant ingen medlemmer å oppdatere." }, { status: 404 });
    }

    const invalidIds: string[] = [];
    const unchangedIds: string[] = [];
    const idsToUpdate: string[] = [];
    const previousById = new Map<string, number>();

    for (const target of targets) {
      const id = String(target.id);
      const currentTargetPrivilege = memberPrivilege(target.privilege_type);
      if (currentTargetPrivilege === nextPrivilege) {
        unchangedIds.push(id);
        continue;
      }

      if (id === userId && !canSetOwnPrivilege(actorPrivilege, nextPrivilege)) {
        invalidIds.push(id);
        continue;
      }

      if (!canAssignPrivilege(actorPrivilege, nextPrivilege, currentTargetPrivilege)) {
        invalidIds.push(id);
        continue;
      }

      idsToUpdate.push(id);
      previousById.set(id, currentTargetPrivilege);
    }

    if (invalidIds.length) {
      await logAdminAction(supabase, {
        actorId: userId,
        action: "member.privilege.update",
        targetTable: "members",
        targetId: memberIds.length === 1 ? memberIds[0] : null,
        status: "error",
        errorMessage: "En eller flere medlemmer kunne ikke oppdateres med dette nivået.",
        details: {
          member_ids: memberIds,
          invalid_member_ids: invalidIds,
          unchanged_member_ids: unchangedIds,
          privilege_type: nextPrivilege,
        },
      });
      return NextResponse.json(
        { error: "En eller flere medlemmer kunne ikke oppdateres med dette nivået." },
        { status: 403 },
      );
    }

    if (!idsToUpdate.length) {
      return NextResponse.json({ ok: true, updated: 0, unchanged: unchangedIds.length });
    }

    const { error: updateError } = await supabase
      .from("members")
      .update({ privilege_type: nextPrivilege })
      .in("id", idsToUpdate);

    if (updateError) {
      await logAdminAction(supabase, {
        actorId: userId,
        action: "member.privilege.update",
        targetTable: "members",
        targetId: memberIds.length === 1 ? memberIds[0] : null,
        status: "error",
        errorMessage: updateError.message,
        details: {
          member_ids: idsToUpdate,
          privilege_type: nextPrivilege,
        },
      });
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    const singlePrevious =
      idsToUpdate.length === 1 ? previousById.get(idsToUpdate[0]) ?? null : null;

    await logAdminAction(supabase, {
      actorId: userId,
      action: "member.privilege.update",
      targetTable: "members",
      targetId: idsToUpdate.length === 1 ? idsToUpdate[0] : null,
      status: "ok",
      details: {
        member_ids: idsToUpdate,
        privilege_type: nextPrivilege,
        previous_privilege_type: singlePrevious,
        updated_count: idsToUpdate.length,
        unchanged_count: unchangedIds.length,
      },
    });

    return NextResponse.json({
      ok: true,
      updated: idsToUpdate.length,
      unchanged: unchangedIds.length,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ukjent feil" },
      { status: 500 },
    );
  }
}
