/**
 * Shared audit display helpers used by table + details components.
 */
import type { AuditLogRow } from "@/lib/audit/types";

export type { AuditLogRow };

/**
 * Formats audit timestamps as `dd/mm/yyyy, hh:mm:ss` for table/details UI.
 *
 * How: Parses ISO string safely and falls back to raw input when parsing fails.
 * @returns string
 */
export function formatAuditDate(value: string | null) {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const year = String(parsed.getFullYear());
  const hours = String(parsed.getHours()).padStart(2, "0");
  const minutes = String(parsed.getMinutes()).padStart(2, "0");
  const seconds = String(parsed.getSeconds()).padStart(2, "0");
  return `${day}/${month}/${year}, ${hours}:${minutes}:${seconds}`;
}

/**
 * Maps audit status values to badge label/style + sort rank.
 *
 * How: Returns a stable display tuple for `ok`, `error`, and unknown statuses.
 * @returns { label: string; className: string; sortValue: number }
 */
export function getAuditStatusMeta(status: AuditLogRow["status"]) {
  if (status === "error") {
    return {
      label: "Feilet",
      className:
        "border-red-500/40 bg-red-500/10 text-red-200 dark:text-red-300",
      sortValue: 2,
    };
  }
  if (status === "ok") {
    return {
      label: "OK",
      className:
        "border-emerald-500/40 bg-emerald-500/10 text-emerald-200 dark:text-emerald-300",
      sortValue: 1,
    };
  }
  return {
    label: "Ukjent",
    className: "border-border/60 bg-background/60 text-muted-foreground",
    sortValue: 0,
  };
}
