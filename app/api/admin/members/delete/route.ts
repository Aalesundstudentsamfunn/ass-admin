/**
 * POST /api/admin/members/delete
 * Deletes users from auth.users. public.members rows are removed by FK cascade.
 * Access is restricted by shared assertPermission guard (requirement: deleteMembers).
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertPermission } from "@/lib/server/assert-permission";
import { logAdminAction } from "@/lib/server/admin-audit-log";

/**
 * Extracts requested member ids from either `member_id` or `member_ids`.
 */
function normalizeIds(body: unknown) {
  const payload = (body ?? {}) as {
    member_id?: unknown;
    member_ids?: unknown;
  };
  const idsFromArray = Array.isArray(payload.member_ids)
    ? payload.member_ids.map((value) => String(value ?? "").trim()).filter(Boolean)
    : [];
  const singleId = String(payload.member_id ?? "").trim();
  return Array.from(new Set(singleId ? [singleId, ...idsFromArray] : idsFromArray));
}

/**
 * Deletes one or many members by deleting the linked auth users.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const memberIds = normalizeIds(body);

    if (!memberIds.length) {
      return NextResponse.json({ error: "Medlems-ID mangler." }, { status: 400 });
    }

    const permission = await assertPermission({ requirement: "deleteMembers" });
    if (!permission.ok) {
      return permission.response;
    }
    const { supabase, userId } = permission;

    if (memberIds.includes(userId)) {
      return NextResponse.json({ error: "Du kan ikke slette din egen bruker." }, { status: 400 });
    }

    const admin = createAdminClient();
    const failures: Array<{ id: string; message: string }> = [];

    for (const id of memberIds) {
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) {
        failures.push({ id, message: error.message });
      }
    }

    if (failures.length > 0) {
      await logAdminAction(supabase, {
        actorId: userId,
        action: "member.delete",
        targetTable: "members",
        targetId: memberIds.length === 1 ? memberIds[0] : null,
        status: "error",
        errorMessage: "Kunne ikke slette alle brukere.",
        details: {
          requested_count: memberIds.length,
          deleted_count: memberIds.length - failures.length,
          failed: failures,
        },
      });
      return NextResponse.json(
        {
          error: "Kunne ikke slette alle brukere.",
          failed: failures,
          deleted: memberIds.length - failures.length,
        },
        { status: 400 },
      );
    }

    await logAdminAction(supabase, {
      actorId: userId,
      action: "member.delete",
      targetTable: "members",
      targetId: memberIds.length === 1 ? memberIds[0] : null,
      status: "ok",
      details: {
        requested_count: memberIds.length,
        deleted_count: memberIds.length,
        member_ids: memberIds,
      },
    });

    return NextResponse.json({ ok: true, deleted: memberIds.length });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ukjent feil." },
      { status: 500 },
    );
  }
}
