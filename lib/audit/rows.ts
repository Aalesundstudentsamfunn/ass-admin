import type { SupabaseClient } from "@supabase/supabase-js";
import { PRIVILEGE_OPTIONS } from "@/lib/privilege-config";
import type { AuditLogRow } from "@/lib/audit/types";

type DbAuditRow = {
  id: string | number | null;
  created_at: string | null;
  actor_id: string | null;
  action: string | null;
  target_table: string | null;
  target_id: string | null;
  status: string | null;
  error_message: string | null;
  details: Record<string, unknown> | null;
};

type DbMemberRow = {
  id: string;
  firstname: string | null;
  lastname: string | null;
  email: string | null;
};

type DetailsObject = Record<string, unknown>;

type ResolvedTarget = {
  targetName: string | null;
  targetUuid: string | null;
  targetEmail: string | null;
};

const ACTION_LABELS: Record<string, string> = {
  "member.create": "Opprettet medlem",
  "member.activate": "Aktiverte medlemskap",
  "member.rename": "Oppdaterte navn",
  "member.privilege.update": "Oppdaterte tilgang",
  "member.delete": "Slettet medlem",
  "member.ban": "Utestengte bruker",
  "member.unban": "Opphevet utestenging",
  "member.membership_status.update": "Oppdaterte medlemsstatus",
  "member.password_reset.send": "Sendte passordlenke",
  "member.update": "Oppdaterte medlem",
};

const PRIVILEGE_LABELS = new Map(
  PRIVILEGE_OPTIONS.map((option) => [option.value, option.label] as const),
);

const FIELD_LABELS: Record<string, string> = {
  privilege_type: "Tilgang",
  is_membership_active: "Aktivt medlemskap",
  is_banned: "Kontostatus",
  firstname: "Fornavn",
  lastname: "Etternavn",
  email: "E-post",
  password_set_at: "Passord satt",
};

/**
 * Converts unknown values to trimmed strings.
 *
 * How: Returns `null` for non-strings or empty strings after trim.
 * @returns string | null
 */
function asString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * Converts unknown values to numbers when possible.
 *
 * How: Accepts finite numbers and numeric strings.
 * @returns number | null
 */
function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Normalizes user ids before lookups.
 *
 * How: Trims whitespace only.
 * @returns string | null
 */
function normalizeId(value: string | null): string | null {
  return value?.trim() || null;
}

/**
 * Normalizes emails for deterministic map keys.
 *
 * How: Trims and lowercases.
 * @returns string | null
 */
function normalizeEmail(value: string | null): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized ? normalized : null;
}

/**
 * Validates UUID strings.
 *
 * How: Uses canonical UUID v1-v5 pattern.
 * @returns boolean
 */
function isUuid(value: string | null): value is string {
  if (!value) {
    return false;
  }
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Basic email validator for lookup routing.
 *
 * How: Checks for a minimal `local@domain.tld` shape.
 * @returns boolean
 */
function isEmail(value: string | null): value is string {
  if (!value) {
    return false;
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Returns safe object view of details payload.
 *
 * How: Keeps only plain object-like values.
 * @returns Record<string, unknown>
 */
function detailsOf(row: DbAuditRow): Record<string, unknown> {
  if (row.details && typeof row.details === "object" && !Array.isArray(row.details)) {
    return row.details;
  }
  return {};
}

/**
 * Returns a nested details object when present.
 *
 * How: Reads `details[key]` and keeps only plain object-like payloads.
 * @returns DetailsObject
 */
function nestedDetailsObject(details: Record<string, unknown>, key: string): DetailsObject {
  const value = details[key];
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as DetailsObject;
  }
  return {};
}

/**
 * Reads optional string arrays from details payload.
 *
 * How: Keeps only non-empty string entries.
 * @returns string[]
 */
function readStringArray(details: Record<string, unknown>, key: string): string[] {
  const raw = details[key];
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map((item) => asString(item)).filter((item): item is string => Boolean(item));
}

/**
 * Formats member display name consistently.
 *
 * How: Prefers `firstname lastname`, then email, then null.
 * @returns string | null
 */
function toMemberLabel(member: DbMemberRow | undefined): string | null {
  if (!member) {
    return null;
  }
  const name = `${member.firstname ?? ""} ${member.lastname ?? ""}`.trim();
  if (name) {
    return name;
  }
  return member.email ?? null;
}

/**
 * Converts booleans to `Ja`/`Nei`.
 *
 * How: Returns `null` for unknown states.
 * @returns string | null
 */
function yesNo(value: unknown): string | null {
  if (typeof value !== "boolean") {
    return null;
  }
  return value ? "Ja" : "Nei";
}

/**
 * Formats privilege values for diff labels.
 *
 * How: maps known privilege numbers to configured labels.
 * @returns string | null
 */
function privilegeLabel(value: unknown): string | null {
  const numeric = asNumber(value);
  if (numeric === null) {
    return null;
  }
  return PRIVILEGE_LABELS.get(numeric) ?? String(numeric);
}

/**
 * Converts raw detail values into display values per field type.
 *
 * How: Handles booleans, privilege levels, and null-ish values.
 * @returns string | null
 */
function formatFieldValue(field: string, value: unknown): string | null {
  if (field === "privilege_type") {
    return privilegeLabel(value);
  }
  if (field === "is_membership_active") {
    return yesNo(value);
  }
  if (field === "is_banned") {
    if (typeof value !== "boolean") {
      return null;
    }
    return value ? "Bannlyst" : "OK";
  }
  if (typeof value === "boolean") {
    return yesNo(value);
  }
  if (value === null || value === undefined || value === "") {
    return null;
  }
  return String(value);
}

/**
 * Reads previous value keys for a field from details payload.
 *
 * How: Checks common key variants used by API handlers.
 * @returns unknown
 */
function previousFieldValue(details: Record<string, unknown>, field: string): unknown {
  const oldDetails = nestedDetailsObject(details, "old");
  return details[`previous_${field}`] ?? details[`prev_${field}`] ?? details[`old_${field}`] ?? oldDetails[field];
}

/**
 * Reads next/current value keys for a field from details payload.
 *
 * How: Checks common key variants used by API handlers.
 * @returns unknown
 */
function nextFieldValue(details: Record<string, unknown>, field: string): unknown {
  const newDetails = nestedDetailsObject(details, "new");
  return details[`next_${field}`] ?? details[field] ?? newDetails[field];
}

/**
 * Compares two raw values with json fallback.
 *
 * How: Uses strict equality first and falls back to stringified payload compare.
 * @returns boolean
 */
function valuesEqual(left: unknown, right: unknown): boolean {
  if (left === right) {
    return true;
  }
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}

/**
 * Builds a single `before -> after` line for a known field when data exists.
 *
 * How: formats values by field type and emits stable human-readable output.
 * @returns string | null
 */
function buildFieldDiffLine(details: Record<string, unknown>, field: string): string | null {
  const label = FIELD_LABELS[field] ?? field;
  const before = formatFieldValue(field, previousFieldValue(details, field));
  const after = formatFieldValue(field, nextFieldValue(details, field));

  if (before === null && after === null) {
    return null;
  }
  if (before !== null && after !== null && before !== after) {
    return `${label}: ${before} -> ${after}`;
  }
  if (after !== null) {
    return `${label}: ${after}`;
  }
  return `${label}: ${before ?? "-"}`;
}

/**
 * Maps raw audit status values to UI status union.
 *
 * How: Supports `ok`, `error`, and fallback `unknown`.
 * @returns "ok" | "error" | "unknown"
 */
function toStatus(value: string | null): AuditLogRow["status"] {
  if (value === "ok") {
    return "ok";
  }
  if (value === "error") {
    return "error";
  }
  return "unknown";
}

/**
 * Loads member rows by UUID and returns lookup map.
 *
 * How: Filters invalid ids and queries in chunks to avoid long `in` lists.
 * @returns Promise<Map<string, DbMemberRow>>
 */
async function fetchMembersByIds(
  supabase: SupabaseClient,
  ids: string[],
) {
  const uniqueIds = Array.from(new Set(ids.filter((value) => isUuid(value))));
  const map = new Map<string, DbMemberRow>();

  if (!uniqueIds.length) {
    return map;
  }

  const chunkSize = 100;
  for (let index = 0; index < uniqueIds.length; index += chunkSize) {
    const chunk = uniqueIds.slice(index, index + chunkSize);
    const { data, error } = await supabase
      .from("members")
      .select("id, firstname, lastname, email")
      .in("id", chunk);

    if (error) {
      throw error;
    }

    for (const row of (data ?? []) as DbMemberRow[]) {
      map.set(row.id, row);
    }
  }

  return map;
}

/**
 * Loads member rows by email and returns lookup map keyed by normalized email.
 *
 * How: Normalizes emails before query + map insertion.
 * @returns Promise<Map<string, DbMemberRow>>
 */
async function fetchMembersByEmails(
  supabase: SupabaseClient,
  emails: string[],
) {
  const uniqueEmails = Array.from(
    new Set(
      emails
        .map((value) => normalizeEmail(value))
        .filter((value): value is string => isEmail(value)),
    ),
  );
  const map = new Map<string, DbMemberRow>();

  if (!uniqueEmails.length) {
    return map;
  }

  const chunkSize = 100;
  for (let index = 0; index < uniqueEmails.length; index += chunkSize) {
    const chunk = uniqueEmails.slice(index, index + chunkSize);
    const { data, error } = await supabase
      .from("members")
      .select("id, firstname, lastname, email")
      .in("email", chunk);

    if (error) {
      throw error;
    }

    for (const row of (data ?? []) as DbMemberRow[]) {
      const key = normalizeEmail(asString(row.email));
      if (key) {
        map.set(key, row);
      }
    }
  }

  return map;
}

/**
 * Extracts possible target UUIDs from a raw audit row.
 *
 * How: Reads `target_id`, `details.member_id`, `details.member_ids`, `details.auth_user_id`.
 * @returns string[]
 */
function getTargetLookupIds(row: DbAuditRow): string[] {
  const details = detailsOf(row);
  const values: string[] = [];

  const fromTargetId = normalizeId(asString(row.target_id));
  if (isUuid(fromTargetId)) {
    values.push(fromTargetId);
  }

  const memberId = normalizeId(asString(details.member_id));
  if (isUuid(memberId)) {
    values.push(memberId);
  }

  const authUserId = normalizeId(asString(details.auth_user_id));
  if (isUuid(authUserId)) {
    values.push(authUserId);
  }

  for (const id of readStringArray(details, "member_ids")) {
    const normalized = normalizeId(id);
    if (isUuid(normalized)) {
      values.push(normalized);
    }
  }

  return Array.from(new Set(values));
}

/**
 * Extracts possible target emails from a raw audit row.
 *
 * How: Reads `target_id` and `details.email`.
 * @returns string[]
 */
function getTargetLookupEmails(row: DbAuditRow): string[] {
  const details = detailsOf(row);
  const values: string[] = [];

  const fromTargetId = normalizeEmail(asString(row.target_id));
  if (isEmail(fromTargetId)) {
    values.push(fromTargetId);
  }

  const email = normalizeEmail(asString(details.email));
  if (isEmail(email)) {
    values.push(email);
  }

  return Array.from(new Set(values));
}

/**
 * Resolves target label data from ids/emails against member maps.
 *
 * How: Prefers UUID matches first, then email matches.
 * @returns ResolvedTarget
 */
function resolveTarget(
  row: DbAuditRow,
  membersById: Map<string, DbMemberRow>,
  membersByEmail: Map<string, DbMemberRow>,
): ResolvedTarget {
  const details = detailsOf(row);
  const candidateIds = getTargetLookupIds(row);
  const candidateEmails = getTargetLookupEmails(row);

  for (const id of candidateIds) {
    const member = membersById.get(id);
    if (!member) {
      continue;
    }
    return {
      targetName: toMemberLabel(member),
      targetUuid: member.id,
      targetEmail: member.email ?? null,
    };
  }

  for (const email of candidateEmails) {
    const member = membersByEmail.get(email);
    if (!member) {
      continue;
    }
    return {
      targetName: toMemberLabel(member),
      targetUuid: member.id,
      targetEmail: member.email ?? null,
    };
  }

  const fallbackId = normalizeId(asString(row.target_id));
  const fallbackEmail = normalizeEmail(asString(row.target_id)) ?? normalizeEmail(asString(details.email));

  return {
    targetName: fallbackEmail ?? fallbackId,
    targetUuid: isUuid(fallbackId) ? fallbackId : null,
    targetEmail: isEmail(fallbackEmail) ? fallbackEmail : null,
  };
}

/**
 * Builds a user-facing actor label.
 *
 * How: Uses member name/email when available, otherwise "Supabase".
 * @returns string
 */
function toActorLabel(actor: DbMemberRow | undefined): string {
  return toMemberLabel(actor) ?? "Supabase";
}

/**
 * Returns a stable event label for audit rows.
 *
 * How: Uses configured labels and falls back to the raw action key.
 * @returns string
 */
function buildEventLabel(row: DbAuditRow): string {
  const action = asString(row.action);
  if (!action) {
    return "Ukjent hendelse";
  }
  if (action === "member.update" && !normalizeId(asString(row.actor_id))) {
    return "Synkroniserte medlem fra Auth";
  }
  return ACTION_LABELS[action] ?? action;
}

/**
 * Builds a search/display target string.
 *
 * How: Prefers name, then email, then UUID.
 * @returns string | null
 */
function buildTargetLabel(
  targetName: string | null,
  targetUuid: string | null,
  targetEmail: string | null,
): string | null {
  return targetName ?? targetEmail ?? targetUuid ?? null;
}

/**
 * Builds concise human-readable change descriptions.
 *
 * How: Parses structured `details` by action and emits one-liners.
 * @returns string | null
 */
function buildChangeLines(row: DbAuditRow): string[] {
  const action = asString(row.action);
  const details = detailsOf(row);
  const lines: string[] = [];

  if (!action) {
    return lines;
  }

  if (action === "member.membership_status.update") {
    const next = typeof details.is_active === "boolean" ? details.is_active : null;
    const prev =
      typeof details.previous_is_active === "boolean"
        ? details.previous_is_active
        : typeof next === "boolean"
          ? !next
          : null;
    if (typeof prev === "boolean" && typeof next === "boolean") {
      lines.push(`Aktivt medlemskap: ${yesNo(prev)} -> ${yesNo(next)}`);
    } else if (typeof next === "boolean") {
      lines.push(`Aktivt medlemskap: ${yesNo(next)}`);
    }

    const updatedCount = asNumber(details.updated_count);
    if (updatedCount !== null && updatedCount > 1) {
      lines.push(`Antall oppdatert: ${updatedCount}`);
    }
    return lines;
  }

  if (action === "member.rename") {
    const prevFirst = asString(details.previous_firstname);
    const prevLast = asString(details.previous_lastname);
    const nextFirst = asString(details.firstname);
    const nextLast = asString(details.lastname);
    const prevName = `${prevFirst ?? ""} ${prevLast ?? ""}`.trim();
    const nextName = `${nextFirst ?? ""} ${nextLast ?? ""}`.trim();
    if (prevName && nextName && prevName !== nextName) {
      lines.push(`Navn: ${prevName} -> ${nextName}`);
      return lines;
    }
    if (nextName) {
      lines.push(`Navn: ${nextName}`);
    }
    return lines;
  }

  if (action === "member.privilege.update") {
    const previous = privilegeLabel(details.previous_privilege_type);
    const next = privilegeLabel(details.privilege_type);
    if (previous && next && previous !== next) {
      lines.push(`Tilgang: ${previous} -> ${next}`);
      return lines;
    }
    if (next) {
      lines.push(`Tilgang: ${next}`);
      return lines;
    }
    const updatedCount = asNumber(details.updated_count);
    if (updatedCount !== null && updatedCount > 1) {
      lines.push(`Tilgang oppdatert for ${updatedCount} medlemmer`);
    }
    return lines;
  }

  if (action === "member.ban" || action === "member.unban") {
    const bannedValue =
      typeof details.is_banned === "boolean"
        ? details.is_banned
        : typeof details.next_banned === "boolean"
          ? details.next_banned
          : null;
    if (typeof bannedValue === "boolean") {
      lines.push(`Kontostatus: ${bannedValue ? "Bannlyst" : "OK"}`);
    }
    const membershipValue = yesNo(details.is_membership_active);
    if (membershipValue) {
      lines.push(`Aktivt medlemskap: ${membershipValue}`);
    }
    return lines;
  }

  if (action === "member.create" || action === "member.activate") {
    const privilege = privilegeLabel(details.privilege_type);
    if (privilege) {
      lines.push(`Tilgang: ${privilege}`);
    }
    const activeMembership = yesNo(details.is_membership_active);
    if (activeMembership) {
      lines.push(`Aktivt medlemskap: ${activeMembership}`);
    }
    return lines;
  }

  if (action === "member.delete") {
    const count = asNumber(details.deleted_count) ?? asNumber(details.count);
    if (count && count > 1) {
      lines.push(`Slettet ${count} medlemmer`);
      return lines;
    }
    lines.push("Slettet medlem");
    return lines;
  }

  if (action === "member.password_reset.send") {
    lines.push("Passordlenke sendt");
    return lines;
  }

  if (action === "member.update") {
    const changedFields = readStringArray(details, "changed_fields");
    const oldDetails = nestedDetailsObject(details, "old");
    const newDetails = nestedDetailsObject(details, "new");
    const oldNewKeys = Array.from(new Set([...Object.keys(oldDetails), ...Object.keys(newDetails)]));
    const inferredFields = oldNewKeys.filter((field) => !valuesEqual(oldDetails[field], newDetails[field]));
    const fieldsToInspect = changedFields.length
      ? changedFields
      : inferredFields.length
        ? inferredFields
        : ["privilege_type", "is_membership_active", "firstname", "lastname", "is_banned"];

    if (fieldsToInspect.length > 0) {
      for (const field of fieldsToInspect) {
        const diffLine = buildFieldDiffLine(details, field);
        if (diffLine) {
          lines.push(diffLine);
        }
      }
      if (lines.length === 0) {
        if (changedFields.length) {
          lines.push(`Felter: ${changedFields.join(", ")}`);
        } else {
          lines.push(
            normalizeId(asString(row.actor_id))
              ? "Oppdaterte medlem"
              : "Synkroniserte medlemsdata fra Auth",
          );
        }
      }
      return lines;
    }
  }

  return lines;
}

/**
 * Loads and adapts the latest admin audit rows for dashboard rendering.
 *
 * How: Fetches raw rows, enriches actor/target names from `members`, and builds concise labels.
 * @returns Promise<{ rows: AuditLogRow[]; errorMessage: string | null }>
 */
export async function fetchAuditRows(
  supabase: SupabaseClient,
): Promise<{ rows: AuditLogRow[]; errorMessage: string | null }> {
  const { data, error } = await supabase
    .from("admin_audit_log")
    .select("id, created_at, actor_id, action, target_table, target_id, status, error_message, details")
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) {
    if (error.message.includes("Could not find the table")) {
      return {
        rows: [],
        errorMessage:
          "Fant ikke public.admin_audit_log. Opprett audit-tabellen først.",
      };
    }
    return { rows: [], errorMessage: error.message };
  }

  const dbRows = (data ?? []) as DbAuditRow[];
  const filteredRows = dbRows;

  const actorIds = Array.from(
    new Set(
      filteredRows
        .map((row) => normalizeId(asString(row.actor_id)))
        .filter((value): value is string => isUuid(value)),
    ),
  );
  const targetIds = Array.from(new Set(filteredRows.flatMap((row) => getTargetLookupIds(row))));
  const targetEmails = Array.from(new Set(filteredRows.flatMap((row) => getTargetLookupEmails(row))));
  const memberIds = Array.from(new Set([...actorIds, ...targetIds]));

  const [membersById, membersByEmail] = await Promise.all([
    fetchMembersByIds(supabase, memberIds),
    fetchMembersByEmails(supabase, targetEmails),
  ]);

  const rows: AuditLogRow[] = filteredRows.map((row) => {
    const actorId = normalizeId(asString(row.actor_id));
    const actor = actorId ? membersById.get(actorId) : undefined;
    const target = resolveTarget(row, membersById, membersByEmail);
    const details = detailsOf(row);
    const source = "app.admin";
    const changeItems = buildChangeLines(row);

    return {
      id: String(row.id ?? ""),
      created_at: row.created_at,
      action_key: asString(row.action),
      event: buildEventLabel(row),
      target: buildTargetLabel(target.targetName, target.targetUuid, target.targetEmail),
      target_name: target.targetName,
      target_uuid: target.targetUuid,
      target_email: target.targetEmail,
      change: changeItems.length ? (changeItems.length === 1 ? changeItems[0] : `${changeItems[0]} (+${changeItems.length - 1})`) : null,
      change_items: changeItems,
      actor_label: toActorLabel(actor),
      actor_id: actorId,
      actor_email: actor?.email ?? null,
      ip_address: null,
      status: toStatus(asString(row.status)),
      error_message: row.error_message ?? null,
      source,
      raw: {
        ...row,
        details,
        _source: source,
      },
    };
  });

  return { rows, errorMessage: null };
}
