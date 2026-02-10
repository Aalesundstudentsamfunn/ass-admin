import type { SupabaseClient } from "@supabase/supabase-js";

export type PrinterQueueEntry = {
  firstname: string;
  lastname: string;
  email: string;
  ref: string | number;
  ref_invoker: string;
  is_voluntary: boolean;
};

export type PrinterQueueRow = {
  id: string | number;
  completed: boolean;
  error_msg: string | null;
};

export async function enqueuePrinterQueue(
  supabase: SupabaseClient,
  entry: PrinterQueueEntry,
) {
  return supabase
    .from("printer_queue")
    .insert({
      ...entry,
      completed: false,
      error_msg: null,
    })
    .select("id, completed, error_msg")
    .single();
}

export function watchPrinterQueueStatus(
  supabase: SupabaseClient,
  {
    queueId,
    ref,
    refInvoker,
    onCompleted,
    onError,
    onUpdate,
    pollingIntervalMs = 3000,
    timeoutMs = 30000,
    onTimeout,
    timeoutErrorMessage,
  }: {
    queueId?: string | number;
    ref?: string | number;
    refInvoker?: string;
    onCompleted?: () => void;
    onError?: (message: string) => void;
    onUpdate?: (row: PrinterQueueRow) => void;
    pollingIntervalMs?: number;
    timeoutMs?: number;
    onTimeout?: () => void;
    timeoutErrorMessage?: string;
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
    onUpdate?.(row);

    if (row?.error_msg) {
      if (timeoutTriggered && row.error_msg === timeoutErrorMessage) {
        cleanup();
        return;
      }
      onError?.(row.error_msg);
      cleanup();
    } else if (row?.completed) {
      onCompleted?.();
      cleanup();
    }
  };

  const markTimeoutError = async () => {
    if (!timeoutErrorMessage) return;
    let targetId = queueId;

    if (targetId === undefined && ref !== undefined && refInvoker) {
      const { data } = await supabase
        .from("printer_queue")
        .select("id, completed, error_msg")
        .eq("ref", ref)
        .eq("ref_invoker", refInvoker)
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!data || data.completed || data.error_msg) {
        return;
      }
      targetId = data.id;
    }

    if (targetId === undefined) return;

    await supabase
      .from("printer_queue")
      .update({ error_msg: timeoutErrorMessage })
      .eq("id", targetId)
      .eq("completed", false)
      .is("error_msg", null);
  };

  const pollStatus = async () => {
    if (isClosed) return;
    try {
      if (queueId !== undefined) {
        const { data, error } = await supabase
          .from("printer_queue")
          .select("id, completed, error_msg")
          .eq("id", queueId)
          .maybeSingle();

        if (!error && data) {
          handleRow(data as PrinterQueueRow);
        }
      } else if (ref !== undefined && refInvoker) {
        const { data, error } = await supabase
          .from("printer_queue")
          .select("id, completed, error_msg")
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
      timeoutTriggered = true;
      void markTimeoutError();
      onTimeout?.();
    }, timeoutMs);
  }

  return () => {
    cleanup();
  };
}
