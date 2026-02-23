"use client";

export type PrinterLogRow = {
  id: string;
  created_at: string | null;
  firstname: string;
  lastname: string;
  email: string;
  completed: boolean;
  error_msg: string | null;
  ref: string | null;
  ref_invoker: string | null;
  ref_invoker_name: string | null;
};

/**
 * Formats queue timestamps for table/details display.
 *
 * How: Returns `-` for null, falls back to raw value for invalid date strings.
 * @returns string
 */
export function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

/**
 * Maps queue row state to display metadata used by status badges and sorting.
 *
 * How: Prioritizes error > completed > pending and returns label/class/sort rank.
 * @returns { label: string; className: string; sortValue: number }
 */
export function getStatusMeta(row: PrinterLogRow) {
  if (row.error_msg) {
    return {
      label: "Feilet",
      className: "border-red-500/40 bg-red-500/15 text-red-200",
      sortValue: 2,
    };
  }
  if (row.completed) {
    return {
      label: "Ferdig",
      className: "border-emerald-500/40 bg-emerald-500/15 text-emerald-200",
      sortValue: 0,
    };
  }
  return {
    label: "Pending",
    className: "border-amber-500/40 bg-amber-500/15 text-amber-200",
    sortValue: 1,
  };
}

/**
 * Resolves who triggered the queue entry for UI display.
 *
 * How: Uses joined `ref_invoker_name`, defaults to "Ukjent".
 * @returns string
 */
export function getInvokerLabel(row: PrinterLogRow) {
  return row.ref_invoker_name ?? "Ukjent";
}
