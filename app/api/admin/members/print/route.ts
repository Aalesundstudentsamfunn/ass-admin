/**
 * POST /api/admin/members/print
 * Enqueues print jobs for one or more members.
 * Logs to admin_audit_log only when one or more jobs fail before entering printer_queue.
 */
import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/server/assert-permission";
import { logAdminAction } from "@/lib/server/admin-audit-log";
import { parseCommitteeId } from "@/lib/committee-options";
import { fetchCommitteeNameByIdMap } from "@/lib/server/committee-type";

type MemberRow = {
  id: string;
  firstname: string | null;
  lastname: string | null;
  email: string | null;
  committee: number | string | null;
  is_banned: boolean | null;
};

/**
 * Supports both single `member_id` and bulk `member_ids`.
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
 * Enqueues print jobs and returns queued/failed summaries.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const memberIds = normalizeIds(body);
    if (!memberIds.length) {
      return NextResponse.json({ error: "Medlems-ID mangler." }, { status: 400 });
    }

    const permission = await assertPermission({ requirement: "manageMembers" });
    if (!permission.ok) {
      return permission.response;
    }
    const { supabase, userId } = permission;

    const { data: members, error: membersError } = await supabase
      .from("members")
      .select("id, firstname, lastname, email, committee, is_banned")
      .in("id", memberIds);

    if (membersError) {
      return NextResponse.json({ error: membersError.message }, { status: 400 });
    }

    const memberById = new Map(
      ((members ?? []) as MemberRow[]).map((member) => [String(member.id), member]),
    );
    const committeeIds = Array.from(
      new Set(
        ((members ?? []) as MemberRow[])
          .map((member) => parseCommitteeId(member.committee))
          .filter((value): value is number => value !== null),
      ),
    );
    const committeeNameById = new Map<number, string>();
    if (committeeIds.length > 0) {
      const { nameById, error: committeeError } = await fetchCommitteeNameByIdMap(
        supabase,
        committeeIds,
      );
      if (committeeError) {
        return NextResponse.json({ error: committeeError }, { status: 400 });
      }
      for (const [id, name] of nameById.entries()) {
        committeeNameById.set(id, name);
      }
    }

    const queued: Array<{ queue_id: string | number; member_id: string }> = [];
    const failed: Array<{ id: string; message: string }> = [];
    const invalidIds: string[] = [];
    const blockedBannedIds: string[] = [];

    for (const memberId of memberIds) {
      const member = memberById.get(memberId);
      if (!member) {
        invalidIds.push(memberId);
        failed.push({ id: memberId, message: "Medlem ikke funnet." });
        continue;
      }
      if (member.is_banned === true) {
        blockedBannedIds.push(memberId);
        failed.push({ id: memberId, message: "Noe gikk galt, ta kontakt med IT." });
        continue;
      }
      const committeeId = parseCommitteeId(member.committee);
      const committeeName =
        committeeId === null ? null : committeeNameById.get(committeeId) ?? null;

      const { data: queueRow, error: queueError } = await supabase
        .from("printer_queue")
        .insert({
          firstname: member.firstname ?? "",
          lastname: member.lastname ?? "",
          email: member.email ?? "",
          ref: member.id,
          ref_invoker: userId,
          committee: committeeName,
          status: "queued",
          status_updated_at: new Date().toISOString(),
          user_message_no: null,
          error_code: null,
          technical_error: null,
        })
        .select("id")
        .single();

      if (queueError) {
        failed.push({ id: memberId, message: queueError.message });
        continue;
      }

      queued.push({
        queue_id: queueRow.id as string | number,
        member_id: memberId,
      });
    }

    if (failed.length > 0) {
      const failedIds = failed.map((entry) => entry.id);
      const status = queued.length > 0 ? "partial" : "error";

      await logAdminAction(supabase, {
        actorId: userId,
        action: "member.card_print.enqueue",
        targetTable: "members",
        targetId: memberIds.length === 1 ? memberIds[0] : null,
        status,
        errorMessage: "Kunne ikke legge til i utskriftskø.",
        details: {
          requested_member_ids: memberIds,
          queued_member_ids: queued.map((entry) => entry.member_id),
          failed_member_ids: failedIds,
          blocked_banned_ids: blockedBannedIds,
          invalid_member_ids: invalidIds,
          failed,
        },
      });

      if (!queued.length) {
        return NextResponse.json(
          {
            error: "Kunne ikke legge til i utskriftskø.",
            status,
            queued: [],
            failed,
          },
          { status: 400 },
        );
      }
    }

    return NextResponse.json({
      ok: failed.length === 0,
      status: failed.length > 0 ? "partial" : "ok",
      queued,
      failed,
      queued_count: queued.length,
      failed_count: failed.length,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ukjent feil." },
      { status: 500 },
    );
  }
}
