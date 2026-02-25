/**
 * POST /api/admin/members/delete
 * Deletes users from auth.users. public.members rows are removed by FK cascade.
 * Access is restricted by shared assertPermission guard (requirement: deleteMembers).
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertPermission } from "@/lib/server/assert-permission";
import { logAdminAction } from "@/lib/server/admin-audit-log";

type MemberSnapshot = {
  id: string;
  firstname: string | null;
  lastname: string | null;
  email: string | null;
  privilege_type: number | null;
  is_membership_active: boolean | null;
  is_banned: boolean | null;
  created_at: string | null;
};

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

    const { data: existingMembers, error: existingMembersError } = await supabase
      .from("members")
      .select("id, firstname, lastname, email, privilege_type, is_membership_active, is_banned, created_at")
      .in("id", memberIds);

    if (existingMembersError) {
      return NextResponse.json({ error: existingMembersError.message }, { status: 400 });
    }

    const snapshotById = new Map(
      ((existingMembers ?? []) as MemberSnapshot[]).map((member) => [String(member.id), member]),
    );

    const admin = createAdminClient();
    const failures: Array<{ id: string; message: string }> = [];

    for (const id of memberIds) {
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) {
        failures.push({ id, message: error.message });
      }
    }

    const failedIds = new Set(failures.map((item) => item.id));
    const deletedIds = memberIds.filter((id) => !failedIds.has(id));
    const deletedMembers = deletedIds.map((id) => {
      const snapshot = snapshotById.get(id);
      return {
        id,
        firstname: snapshot?.firstname ?? null,
        lastname: snapshot?.lastname ?? null,
        email: snapshot?.email ?? null,
        privilege_type: snapshot?.privilege_type ?? null,
        is_membership_active: snapshot?.is_membership_active ?? null,
        is_banned: snapshot?.is_banned ?? null,
        created_at: snapshot?.created_at ?? null,
      };
    });

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
          deleted_count: deletedIds.length,
          deleted_member_ids: deletedIds,
          deleted_members: deletedMembers,
          requested_member_ids: memberIds,
          failed: failures,
        },
      });
      return NextResponse.json(
        {
          error: "Kunne ikke slette alle brukere.",
          failed: failures,
          deleted: deletedIds.length,
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
        requested_member_ids: memberIds,
        deleted_member_ids: memberIds,
        deleted_members: deletedMembers,
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
