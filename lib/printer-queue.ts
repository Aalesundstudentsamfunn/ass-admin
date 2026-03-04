/**
 * Printer queue data helpers for enqueueing jobs and watching lifecycle state.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

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

export type PrinterQueueEntry = {
  firstname: string;
  lastname: string;
  email: string;
  ref: string | number;
  ref_invoker: string;
  committee: string | null;
};

export type PrinterQueueRow = {
  id: string | number;
  status: PrinterJobStatus;
  status_updated_at: string | null;
  attempt_count: number | null;
  user_message_no: string | null;
  error_code: string | null;
  technical_error: string | null;
  claimed_at: string | null;
  started_at: string | null;
  finished_at: string | null;
};

const TERMINAL_STATUSES = new Set<PrinterJobStatus>([
  "completed",
  "needs_review",
  "failed",
  "canceled",
]);

function normalizeStatus(value: unknown): PrinterJobStatus | null {
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
      return null;
  }
}

/**
 * Inserts a new print request in `public.printer_queue`.
 */
export async function enqueuePrinterQueue(
  supabase: SupabaseClient,
  entry: PrinterQueueEntry,
) {
  return supabase
    .from("printer_queue")
    .insert({
      ...entry,
      status: "queued",
      user_message_no: null,
      error_code: null,
      technical_error: null,
    })
    .select(
      "id, status, status_updated_at, attempt_count, user_message_no, error_code, technical_error, claimed_at, started_at, finished_at",
    )
    .single();
}

/**
 * Subscribes to queue updates and polls as fallback until terminal status.
 *
 * Returns an unsubscribe function that clears realtime + polling resources.
 */
export function watchPrinterQueueStatus(
  supabase: SupabaseClient,
  {
    queueId,
    ref,
    refInvoker,
    onCompleted,
    onError,
    onNeedsReview,
    onCanceled,
    onUpdate,
    pollingIntervalMs = 3000,
    timeoutMs = 30000,
    onTimeout,
  }: {
    queueId?: string | number;
    ref?: string | number;
    refInvoker?: string;
    onCompleted?: () => void;
    onError?: (message: string) => void;
    onNeedsReview?: (message: string) => void;
    onCanceled?: (message: string) => void;
    onUpdate?: (row: PrinterQueueRow) => void;
    pollingIntervalMs?: number;
    timeoutMs?: number;
    onTimeout?: () => void;
  },
) {
  const filter = queueId
    ? `id=eq.${queueId}`
    : ref !== undefined && refInvoker
      ? `ref=eq.${ref},ref_invoker=eq.${refInvoker}`
      : null;

  if (!filter) {
    return () => { };
  }

  let isClosed = false;
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let timeoutTriggered = false;

  const cleanup = () => {
    if (isClosed) return;
    isClosed = true;
    supabase.removeChannel(channel);
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  const handleRow = (row: PrinterQueueRow) => {
    const status = normalizeStatus(row?.status);
    if (!status) {
      return;
    }

    if (!TERMINAL_STATUSES.has(status)) {
      onUpdate?.(row);
      return;
    }

    onUpdate?.(row);

    const userMessage = row.user_message_no || "Ukjent status fra printerkøen.";
    if (status === "completed") {
      onCompleted?.();
    } else if (status === "needs_review") {
      onNeedsReview?.(userMessage);
    } else if (status === "canceled") {
      onCanceled?.(userMessage);
    } else {
      onError?.(userMessage);
    }
    cleanup();
  };

  const projection =
    "id, status, status_updated_at, attempt_count, user_message_no, error_code, technical_error, claimed_at, started_at, finished_at";

  const pollStatus = async () => {
    if (isClosed) return;
    try {
      if (queueId !== undefined) {
        const { data, error } = await supabase
          .from("printer_queue")
          .select(projection)
          .eq("id", queueId)
          .maybeSingle();

        if (!error && data) {
          handleRow(data as PrinterQueueRow);
        }
      } else if (ref !== undefined && refInvoker) {
        const { data, error } = await supabase
          .from("printer_queue")
          .select(projection)
          .eq("ref", ref)
          .eq("ref_invoker", refInvoker)
          .order("id", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && data) {
          handleRow(data as PrinterQueueRow);
        }
      }
    } catch {
      // Ignore polling errors; realtime updates will still be handled when available.
    }
  };

  const channel = supabase
    .channel(`printer_queue:${filter}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "printer_queue", filter },
      (payload) => {
        const row = payload.new as PrinterQueueRow;
        handleRow(row);
      },
    )
    .subscribe();

  pollStatus();
  pollInterval = setInterval(pollStatus, pollingIntervalMs);
  if (timeoutMs > 0) {
    timeoutId = setTimeout(() => {
      if (isClosed) return;
      if (timeoutTriggered) return;
      timeoutTriggered = true;
      onTimeout?.();
    }, timeoutMs);
  }

  return () => {
    cleanup();
  };
}
