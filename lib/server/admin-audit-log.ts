import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

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

const SPECIFIC_MEMBER_UPDATE_ACTIONS = new Set([
  "member.activate",
  "member.privilege.update",
  "member.membership_status.update",
  "member.rename",
  "member.ban",
  "member.unban",
]);

/**
 * Reads non-empty string from unknown value.
 */
function asString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * Extracts updated member ids for cleanup of generic `member.update` rows.
 */
function extractMemberIdsForCleanup(params: LogAdminActionParams): string[] {
  const ids = new Set<string>();
  const targetId = asString(params.targetId);
  if (targetId) {
    ids.add(targetId);
  }

  const details = params.details ?? {};
  const detailsMemberId = asString((details as Record<string, unknown>).member_id);
  if (detailsMemberId) {
    ids.add(detailsMemberId);
  }

  const detailsMemberIds = (details as Record<string, unknown>).member_ids;
  if (Array.isArray(detailsMemberIds)) {
    for (const value of detailsMemberIds) {
      const normalized = asString(value);
      if (normalized) {
        ids.add(normalized);
      }
    }
  }

  return Array.from(ids);
}

/**
 * Removes duplicate generic member.update rows written by DB-level triggers.
 *
 * We keep the specific action and prune generic updates for the same actor/target
 * in a short time window around the specific action.
 */
async function pruneGenericMemberUpdateDuplicates(params: LogAdminActionParams) {
  if (!SPECIFIC_MEMBER_UPDATE_ACTIONS.has(params.action)) {
    return;
  }
  if (params.status && params.status !== "ok") {
    return;
  }
  if (params.targetTable !== "members") {
    return;
  }

  const memberIds = extractMemberIdsForCleanup(params);
  if (!memberIds.length) {
    return;
  }

  const admin = createAdminClient();
  const now = Date.now();
  const from = new Date(now - 10_000).toISOString();
  const to = new Date(now + 2_000).toISOString();

  await admin
    .from("admin_audit_log")
    .delete()
    .eq("actor_id", params.actorId)
    .eq("action", "member.update")
    .in("target_id", memberIds)
    .gte("created_at", from)
    .lte("created_at", to);
}

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

  const result = await supabase.from("admin_audit_log").insert({
    actor_id: actorId,
    action,
    target_table: targetTable,
    target_id: targetId,
    status,
    error_message: errorMessage,
    details: details ?? {},
  });

  if (!result.error) {
    try {
      await pruneGenericMemberUpdateDuplicates({
        actorId,
        action,
        targetTable,
        targetId,
        status,
        errorMessage,
        details: details ?? {},
      });
    } catch {
      // Best effort cleanup only.
    }
  }

  return result;
}
