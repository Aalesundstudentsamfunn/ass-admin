import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/server/assert-permission";
import { logAdminAction } from "@/lib/server/admin-audit-log";

type QueueAuditContext = {
  queueId: string | null;
  status: string | null;
  memberId: string | null;
  memberEmail: string | null;
  memberName: string | null;
  refInvoker: string | null;
  errorCode: string | null;
  userMessageNo: string | null;
};

function parseJobId(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }
  return Math.trunc(numeric);
}

function asString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toMemberName(firstname: unknown, lastname: unknown) {
  const first = asString(firstname) ?? "";
  const last = asString(lastname) ?? "";
  const combined = `${first} ${last}`.trim();
  return combined || null;
}

function extractAuditContext(row: unknown): QueueAuditContext {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    return {
      queueId: null,
      status: null,
      memberId: null,
      memberEmail: null,
      memberName: null,
      refInvoker: null,
      errorCode: null,
      userMessageNo: null,
    };
  }

  const payload = row as Record<string, unknown>;
  return {
    queueId: asString(payload.id) ?? (payload.id != null ? String(payload.id) : null),
    status: asString(payload.status),
    memberId: asString(payload.ref),
    memberEmail: asString(payload.email),
    memberName: toMemberName(payload.firstname, payload.lastname),
    refInvoker: asString(payload.ref_invoker),
    errorCode: asString(payload.error_code),
    userMessageNo: asString(payload.user_message_no),
  };
}

function buildAuditDetails(jobId: number, context: QueueAuditContext) {
  return {
    job_id: jobId,
    printer_queue_id: context.queueId ?? String(jobId),
    next_status: context.status,
    target_member_id: context.memberId,
    target_member_email: context.memberEmail,
    target_member_name: context.memberName,
    requested_member_ids: context.memberId ? [context.memberId] : [],
    queue_ref_invoker: context.refInvoker,
    error_code: context.errorCode,
    user_message_no: context.userMessageNo,
  };
}

/**
 * POST /api/admin/printer-queue/cancel
 * Cancels one printer queue job via RPC.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const jobId = parseJobId((body as { job_id?: unknown })?.job_id);
    if (jobId === null) {
      return NextResponse.json({ error: "Ugyldig jobb-ID." }, { status: 400 });
    }

    const permission = await assertPermission({ requirement: "manageMembers" });
    if (!permission.ok) {
      return permission.response;
    }
    const { supabase, userId } = permission;

    const { data, error } = await supabase.rpc("cancel_print_job", {
      p_job_id: jobId,
      p_actor: userId,
    });

    if (error) {
      const { data: existingRow } = await supabase
        .from("printer_queue")
        .select("id, status, ref, email, firstname, lastname, ref_invoker, error_code, user_message_no")
        .eq("id", jobId)
        .maybeSingle();
      const existingContext = extractAuditContext(existingRow);

      await logAdminAction(supabase, {
        actorId: userId,
        action: "printer.queue.cancel",
        targetTable: "printer_queue",
        targetId: String(jobId),
        status: "error",
        errorMessage: error.message,
        details: {
          ...buildAuditDetails(jobId, existingContext),
          rpc_error: error.message,
        },
      });
      return NextResponse.json(
        { error: "Kunne ikke avbryte utskriftsjobben." },
        { status: 400 },
      );
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      return NextResponse.json(
        { error: "Kunne ikke hente oppdatert jobb etter avbryt." },
        { status: 500 },
      );
    }

    const nextContext = extractAuditContext(row);
    await logAdminAction(supabase, {
      actorId: userId,
      action: "printer.queue.cancel",
      targetTable: "printer_queue",
      targetId: String(jobId),
      status: "ok",
      details: buildAuditDetails(jobId, nextContext),
    });

    return NextResponse.json({ ok: true, row });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Ukjent feil ved avbryting av utskriftsjobb.",
      },
      { status: 500 },
    );
  }
}
