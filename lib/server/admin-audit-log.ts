import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminAuditStatus = "ok" | "error";

type LogAdminActionParams = {
  actorId: string;
  action: string;
  targetTable?: string | null;
  targetId?: string | null;
  status?: AdminAuditStatus;
  errorMessage?: string | null;
  details?: Record<string, unknown> | null;
};

/**
 * Writes an application-level admin audit event.
 *
 * Data contract:
 * - `actorId`: current authenticated member UUID.
 * - `action`: stable action key (e.g. `member.create`, `member.rename`).
 * - `targetTable`/`targetId`: logical target reference for traceability.
 * - `status`: `ok` or `error`.
 * - `details`: action-specific structured payload (counts, before/after, flags).
 *
 * Best-effort helper: callers may ignore its result if logging should not block
 * the primary mutation flow.
 */
export async function logAdminAction(
  supabase: SupabaseClient,
  params: LogAdminActionParams,
) {
  const {
    actorId,
    action,
    targetTable = null,
    targetId = null,
    status = "ok",
    errorMessage = null,
    details = null,
  } = params;

  return supabase.from("admin_audit_log").insert({
    actor_id: actorId,
    action,
    target_table: targetTable,
    target_id: targetId,
    status,
    error_message: errorMessage,
    details: details ?? {},
  });
}
