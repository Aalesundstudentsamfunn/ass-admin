export type PrinterJobStatus =
  | "queued"
  | "claimed"
  | "rendering"
  | "spooled"
  | "printing"
  | "completed"
  | "needs_review"
  | "failed"
  | "canceled";

export type PrinterHealthRow = {
  id: string;
  last_heartbeat: string | null;
  status: string | null;
  realtime_connected: boolean;
  mode: string | null;
  printer_connected: boolean | null;
  printer_state_reason: string | null;
  last_error: string | null;
};

export type QueueSummary = {
  queued: number;
  active: number;
  needsAttention: number;
  completed: number;
  total: number;
};

export type PrinterLogRow = {
  id: string;
  created_at: string | null;
  firstname: string;
  lastname: string;
  email: string;
  status: PrinterJobStatus;
  status_updated_at: string | null;
  attempt_count: number;
  printer_id: string | null;
  claimed_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  user_message_no: string | null;
  error_code: string | null;
  technical_error: string | null;
  ref: string | null;
  ref_invoker: string | null;
  ref_invoker_name: string | null;
};

// Mark printer offline quicker so dashboard reflects real outages faster.
export const PRINTER_OFFLINE_THRESHOLD_MS = 90 * 1000;

const ACTIVE_STATUSES = new Set<PrinterJobStatus>([
  "claimed",
  "rendering",
  "spooled",
  "printing",
]);

const TERMINAL_STATUSES = new Set<PrinterJobStatus>([
  "completed",
  "needs_review",
  "failed",
  "canceled",
]);

const NEEDS_ATTENTION_STATUSES = new Set<PrinterJobStatus>([
  "failed",
  "needs_review",
]);

const RETRY_ALLOWED_STATUSES = new Set<PrinterJobStatus>([
  "failed",
  "needs_review",
  "canceled",
]);

const CANCEL_ALLOWED_STATUSES = new Set<PrinterJobStatus>([
  "queued",
  "claimed",
  "rendering",
  "spooled",
  "printing",
  "needs_review",
]);

type StatusMeta = {
  label: string;
  className: string;
  sortValue: number;
};

const STATUS_META: Record<PrinterJobStatus | "unknown", StatusMeta> = {
  queued: {
    label: "I kø",
    className:
      "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-500/40 dark:bg-slate-500/15 dark:text-slate-300",
    sortValue: 10,
  },
  claimed: {
    label: "Reservert",
    className:
      "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/15 dark:text-blue-300",
    sortValue: 20,
  },
  rendering: {
    label: "Genererer",
    className:
      "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-500/40 dark:bg-indigo-500/15 dark:text-indigo-300",
    sortValue: 30,
  },
  spooled: {
    label: "Spooler",
    className:
      "border-cyan-300 bg-cyan-50 text-cyan-700 dark:border-cyan-500/40 dark:bg-cyan-500/15 dark:text-cyan-300",
    sortValue: 40,
  },
  printing: {
    label: "Skriver ut",
    className:
      "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-500/40 dark:bg-violet-500/15 dark:text-violet-300",
    sortValue: 50,
  },
  completed: {
    label: "Ferdig",
    className:
      "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300",
    sortValue: 60,
  },
  needs_review: {
    label: "Må sjekkes",
    className:
      "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300",
    sortValue: 70,
  },
  failed: {
    label: "Feilet",
    className:
      "border-red-300 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-500/15 dark:text-red-300",
    sortValue: 80,
  },
  canceled: {
    label: "Avbrutt",
    className:
      "border-neutral-300 bg-neutral-50 text-neutral-700 dark:border-neutral-500/40 dark:bg-neutral-500/15 dark:text-neutral-300",
    sortValue: 90,
  },
  unknown: {
    label: "Ukjent",
    className:
      "border-neutral-300 bg-neutral-50 text-neutral-700 dark:border-neutral-500/40 dark:bg-neutral-500/15 dark:text-neutral-300",
    sortValue: 100,
  },
};

function parseDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

export function normalizePrinterStatus(value: unknown): PrinterJobStatus | "unknown" {
  switch (value) {
    case "queued":
    case "claimed":
    case "rendering":
    case "spooled":
    case "printing":
    case "completed":
    case "needs_review":
    case "failed":
    case "canceled":
      return value;
    default:
      return "unknown";
  }
}

/**
 * Formats queue timestamps for table/details display.
 *
 * How: Returns `-` for null, falls back to raw value for invalid date strings.
 */
export function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }
  const date = parseDate(value);
  if (!date) {
    return value;
  }
  return date.toLocaleString("no-NO");
}

/**
 * Formats relative time in Norwegian.
 */
export function formatRelativeTime(value: string | null, now = Date.now()) {
  if (!value) {
    return "ukjent";
  }
  const date = parseDate(value);
  if (!date) {
    return "ukjent";
  }

  const diffMs = now - date.getTime();
  const absMs = Math.abs(diffMs);

  if (absMs < 10_000) {
    return "nå nettopp";
  }

  const future = diffMs < 0;
  const asPhrase = (count: number, unit: string) =>
    future ? `om ${count} ${unit}` : `${count} ${unit} siden`;

  if (absMs < 60_000) {
    const seconds = Math.round(absMs / 1000);
    return asPhrase(seconds, seconds === 1 ? "sekund" : "sekunder");
  }
  if (absMs < 3_600_000) {
    const minutes = Math.round(absMs / 60_000);
    return asPhrase(minutes, minutes === 1 ? "minutt" : "minutter");
  }
  if (absMs < 86_400_000) {
    const hours = Math.round(absMs / 3_600_000);
    return asPhrase(hours, hours === 1 ? "time" : "timer");
  }
  const days = Math.round(absMs / 86_400_000);
  return asPhrase(days, days === 1 ? "dag" : "dager");
}

export function isActiveStatus(status: PrinterJobStatus) {
  return ACTIVE_STATUSES.has(status);
}

export function isTerminalStatus(status: PrinterJobStatus) {
  return TERMINAL_STATUSES.has(status);
}

export function isNeedsAttentionStatus(status: PrinterJobStatus) {
  return NEEDS_ATTENTION_STATUSES.has(status);
}

export function canRetryStatus(status: PrinterJobStatus) {
  return RETRY_ALLOWED_STATUSES.has(status);
}

export function canCancelStatus(status: PrinterJobStatus) {
  return CANCEL_ALLOWED_STATUSES.has(status);
}

export function isPrinterOffline(lastHeartbeat: string | null, now = Date.now()) {
  const heartbeat = parseDate(lastHeartbeat);
  if (!heartbeat) {
    return true;
  }
  return now - heartbeat.getTime() >= PRINTER_OFFLINE_THRESHOLD_MS;
}

/**
 * Returns a UI-safe health row where stale heartbeat forces offline/fallback.
 *
 * Why: when the printer PC is disconnected, DB fields can remain stale until a new heartbeat arrives.
 */
export function withDerivedPrinterHealth(row: PrinterHealthRow | null, now = Date.now()) {
  if (!row) {
    return null;
  }
  if (!isPrinterOffline(row.last_heartbeat, now)) {
    return row;
  }
  return {
    ...row,
    status: "offline",
    mode: "fallback",
    realtime_connected: false,
    printer_connected: false,
    printer_state_reason: "stale_heartbeat",
  };
}

/**
 * Maps queue status to display metadata used by badges and sorting.
 */
export function getStatusMeta(rowOrStatus: PrinterLogRow | PrinterJobStatus | null | undefined) {
  const status =
    typeof rowOrStatus === "string"
      ? normalizePrinterStatus(rowOrStatus)
      : normalizePrinterStatus(rowOrStatus?.status);
  return STATUS_META[status];
}

/**
 * Resolves who triggered the queue entry for UI display.
 */
export function getInvokerLabel(row: PrinterLogRow) {
  return row.ref_invoker_name ?? "Ukjent";
}
