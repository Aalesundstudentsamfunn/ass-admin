import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

export type AdminAuditStatus = "ok" | "error" | "partial";

type LogAdminActionParams = {
  actorId: string;
  action: string;
  targetTable?: string | null;
  targetId?: string | null;
  status?: AdminAuditStatus;
  errorMessage?: string | null;
  details?: Record<string, unknown> | null;
};

type MemberIdentitySnapshot = {
  id: string;
  firstname: string | null;
  lastname: string | null;
  email: string | null;
  name: string | null;
};

const SPECIFIC_MEMBER_UPDATE_ACTIONS = new Set([
  "member.activate",
  "member.privilege.update",
  "member.membership_status.update",
  "member.rename",
  "member.password_bootstrap.send",
  "member.ban",
  "member.unban",
]);

const MEMBER_SNAPSHOT_KEYS = [
  "member_id",
  "target_id",
  "member_ids",
  "updated_member_ids",
  "failed_member_ids",
  "deleted_member_ids",
  "requested_member_ids",
  "invalid_member_ids",
] as const;

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
 * Normalizes emails for deterministic lookups.
 */
function normalizeEmail(value: string | null) {
  const normalized = value?.trim().toLowerCase();
  return normalized || null;
}

/**
 * Returns true for UUID-like strings.
 */
function isUuid(value: string | null): value is string {
  if (!value) {
    return false;
  }
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Returns true for basic email-like strings.
 */
function isEmail(value: string | null): value is string {
  if (!value) {
    return false;
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Parses member snapshot-like object.
 */
function parseSnapshotObject(value: unknown): MemberIdentitySnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const row = value as Record<string, unknown>;
  const id = asString(row.id);
  if (!isUuid(id)) {
    return null;
  }
  return {
    id,
    firstname: asString(row.firstname),
    lastname: asString(row.lastname),
    email: normalizeEmail(asString(row.email)),
    name: asString(row.name),
  };
}

/**
 * Builds a stable display name from snapshot values.
 */
function toSnapshotName(snapshot: Pick<MemberIdentitySnapshot, "firstname" | "lastname" | "email" | "id" | "name">) {
  const explicitName = asString(snapshot.name);
  if (explicitName) {
    return explicitName;
  }
  const combined = `${snapshot.firstname ?? ""} ${snapshot.lastname ?? ""}`.trim();
  if (combined) {
    return combined;
  }
  return snapshot.email ?? snapshot.id;
}

/**
 * Extracts target identifiers from params/details.
 */
function extractMemberLookupTargets(params: LogAdminActionParams) {
  const memberIds = new Set<string>();
  const emails = new Set<string>();
  const details = params.details ?? {};
  const targetId = asString(params.targetId);

  if (isUuid(targetId)) {
    memberIds.add(targetId);
  } else if (isEmail(targetId)) {
    emails.add(normalizeEmail(targetId)!);
  }

  const directEmail = normalizeEmail(asString((details as Record<string, unknown>).email));
  if (directEmail) {
    emails.add(directEmail);
  }

  for (const key of MEMBER_SNAPSHOT_KEYS) {
    const value = (details as Record<string, unknown>)[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        const normalized = asString(item);
        if (isUuid(normalized)) {
          memberIds.add(normalized);
        } else if (isEmail(normalized)) {
          emails.add(normalizeEmail(normalized)!);
        }
      }
      continue;
    }

    const normalized = asString(value);
    if (isUuid(normalized)) {
      memberIds.add(normalized);
    } else if (isEmail(normalized)) {
      emails.add(normalizeEmail(normalized)!);
    }
  }

  return {
    memberIds: Array.from(memberIds),
    emails: Array.from(emails),
  };
}

/**
 * Extracts inline row snapshots embedded in details payload.
 */
function extractInlineMemberSnapshots(details: Record<string, unknown>): MemberIdentitySnapshot[] {
  const snapshots = new Map<string, MemberIdentitySnapshot>();

  const singleKeys = ["old", "new", "member", "target_member"] as const;
  for (const key of singleKeys) {
    const parsed = parseSnapshotObject(details[key]);
    if (parsed) {
      snapshots.set(parsed.id, parsed);
    }
  }

  const collectionKeys = ["deleted_members", "target_members"] as const;
  for (const key of collectionKeys) {
    const value = details[key];
    if (!Array.isArray(value)) {
      continue;
    }
    for (const item of value) {
      const parsed = parseSnapshotObject(item);
      if (parsed) {
        snapshots.set(parsed.id, parsed);
      }
    }
  }

  return Array.from(snapshots.values());
}

/**
 * Adds normalized target member identity snapshots to audit details.
 */
async function enrichMemberDetails(
  _supabase: SupabaseClient,
  targetId: string | null,
  details: Record<string, unknown> | null,
) {
  const nextDetails: Record<string, unknown> = { ...(details ?? {}) };
  const { memberIds, emails } = extractMemberLookupTargets({
    actorId: "",
    action: "",
    targetTable: "members",
    targetId,
    details: nextDetails,
  });

  const snapshots = new Map<string, MemberIdentitySnapshot>();
  const admin = createAdminClient();

  if (memberIds.length > 0) {
    const { data } = await admin
      .from("members")
      .select("id, firstname, lastname, email")
      .in("id", memberIds);

    for (const row of data ?? []) {
      const id = asString((row as { id?: unknown }).id);
      if (!isUuid(id)) {
        continue;
      }
      snapshots.set(id, {
        id,
        firstname: asString((row as { firstname?: unknown }).firstname),
        lastname: asString((row as { lastname?: unknown }).lastname),
        email: normalizeEmail(asString((row as { email?: unknown }).email)),
        name: null,
      });
    }
  }

  if (emails.length > 0) {
    const { data } = await admin
      .from("members")
      .select("id, firstname, lastname, email")
      .in("email", emails);

    for (const row of data ?? []) {
      const id = asString((row as { id?: unknown }).id);
      if (!isUuid(id)) {
        continue;
      }
      snapshots.set(id, {
        id,
        firstname: asString((row as { firstname?: unknown }).firstname),
        lastname: asString((row as { lastname?: unknown }).lastname),
        email: normalizeEmail(asString((row as { email?: unknown }).email)),
        name: null,
      });
    }

    // Fallback for mixed-case emails when exact `in(email, ...)` misses rows.
    const unresolvedEmails = emails.filter((email) => {
      for (const snapshot of snapshots.values()) {
        if (normalizeEmail(snapshot.email) === email) {
          return false;
        }
      }
      return true;
    });

    for (const email of unresolvedEmails) {
      const { data: row } = await admin
        .from("members")
        .select("id, firstname, lastname, email")
        .ilike("email", email)
        .maybeSingle();
      const id = asString((row as { id?: unknown } | null)?.id);
      if (!isUuid(id)) {
        continue;
      }
      snapshots.set(id, {
        id,
        firstname: asString((row as { firstname?: unknown }).firstname),
        lastname: asString((row as { lastname?: unknown }).lastname),
        email: normalizeEmail(asString((row as { email?: unknown }).email)),
        name: null,
      });
    }
  }

  for (const snapshot of extractInlineMemberSnapshots(nextDetails)) {
    const existing = snapshots.get(snapshot.id);
    snapshots.set(snapshot.id, {
      id: snapshot.id,
      firstname: snapshot.firstname ?? existing?.firstname ?? null,
      lastname: snapshot.lastname ?? existing?.lastname ?? null,
      email: snapshot.email ?? existing?.email ?? null,
      name: snapshot.name ?? existing?.name ?? null,
    });
  }

  for (const id of memberIds) {
    if (snapshots.has(id)) {
      continue;
    }
    snapshots.set(id, {
      id,
      firstname: null,
      lastname: null,
      email: null,
      name: id,
    });
  }

  for (const email of emails) {
    const hasEmailSnapshot = Array.from(snapshots.values()).some(
      (snapshot) => normalizeEmail(snapshot.email) === email,
    );
    if (hasEmailSnapshot) {
      continue;
    }
    snapshots.set(`email:${email}`, {
      id: `email:${email}`,
      firstname: null,
      lastname: null,
      email,
      name: email,
    });
  }

  const targetMembers = Array.from(snapshots.values()).map((snapshot) => ({
    ...snapshot,
    name: toSnapshotName(snapshot),
  }));

  if (targetMembers.length > 0) {
    nextDetails.target_members = targetMembers;
    nextDetails.target_member_count = targetMembers.length;
    const firstTarget = targetMembers[0];
    nextDetails.target_member_id = firstTarget.id ?? null;
    nextDetails.target_member_email = firstTarget.email ?? null;
    nextDetails.target_member_name = firstTarget.name ?? null;
  } else if (nextDetails.target_members == null) {
    nextDetails.target_members = [];
    nextDetails.target_member_count = 0;
    nextDetails.target_member_id = null;
    nextDetails.target_member_email = null;
    nextDetails.target_member_name = null;
  }

  return nextDetails;
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

  const updatedMemberIds = (details as Record<string, unknown>).updated_member_ids;
  if (Array.isArray(updatedMemberIds)) {
    for (const value of updatedMemberIds) {
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
  const resolvedDetails =
    targetTable === "members"
      ? await enrichMemberDetails(supabase, targetId, details)
      : details ?? {};

  const result = await supabase.from("admin_audit_log").insert({
    actor_id: actorId,
    action,
    target_table: targetTable,
    target_id: targetId,
    status,
    error_message: errorMessage,
    details: resolvedDetails,
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
        details: resolvedDetails,
      });
    } catch {
      // Best effort cleanup only.
    }
  }

  return result;
}
