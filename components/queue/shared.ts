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

export function getInvokerLabel(row: PrinterLogRow) {
  return row.ref_invoker_name ?? "Ukjent";
}
