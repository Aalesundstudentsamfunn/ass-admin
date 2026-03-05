"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { toast } from "sonner";
import { watchPrinterQueueStatus } from "@/lib/printer-queue";

const PRINT_WARNING_AFTER_MS = 25_000;
const PRINT_GRACE_PERIOD_MS = 180_000;
const PRINT_WARNING_DURATION_MS = 6_000;

export type PrintMonitorOptions = {
  supabase: SupabaseClient;
  queueId?: string | number;
  ref?: string | number;
  refInvoker?: string;
  queuedDescription: string;
  completedMessage: string;
  toastId?: string | number | null;
  warningAfterMs?: number;
  gracePeriodMs?: number;
  warningDurationMs?: number;
  onSettled?: () => void;
};

/**
 * Watches one print job with staged timeout behavior.
 * - loading toast starts immediately
 * - warning toast after warningAfterMs
 * - hard timeout after warningAfterMs + gracePeriodMs
 */
export function watchPrintJobWithGrace({
  supabase,
  queueId,
  ref,
  refInvoker,
  queuedDescription,
  completedMessage,
  toastId,
  warningAfterMs = PRINT_WARNING_AFTER_MS,
  gracePeriodMs = PRINT_GRACE_PERIOD_MS,
  warningDurationMs = PRINT_WARNING_DURATION_MS,
  onSettled,
}: PrintMonitorOptions) {
  let settled = false;
  let unsubscribe: (() => void) | null = null;

  const statusToastId = toast.loading("Venter på utskrift...", {
    id: toastId ?? undefined,
    description: queuedDescription,
    duration: Infinity,
  });

  const settle = (renderToast: () => void) => {
    if (settled) {
      return;
    }
    settled = true;
    if (warningTimer) {
      clearTimeout(warningTimer);
    }
    if (hardTimeoutTimer) {
      clearTimeout(hardTimeoutTimer);
    }
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    renderToast();
    onSettled?.();
  };

  const warningTimer = setTimeout(() => {
    if (settled) {
      return;
    }
    toast.warning("Utskrift tar lengre tid enn vanlig.", {
      description: "Vi følger fortsatt med og oppdaterer deg automatisk.",
      duration: warningDurationMs,
    });
  }, warningAfterMs);

  const hardTimeoutTimer = setTimeout(() => {
    settle(() => {
      toast.error("Utskrift feilet.", {
        id: statusToastId,
        description: "Utskriften ble ikke ferdig i tide. Sjekk printerkøen manuelt.",
        duration: Infinity,
      });
    });
  }, warningAfterMs + gracePeriodMs);

  unsubscribe = watchPrinterQueueStatus(supabase, {
    queueId,
    ref,
    refInvoker,
    timeoutMs: 0,
    onCompleted: () => {
      settle(() => {
        toast.success(completedMessage, {
          id: statusToastId,
          duration: 10000,
        });
      });
    },
    onNeedsReview: (message) => {
      settle(() => {
        toast.warning("Utskrift må sjekkes manuelt.", {
          id: statusToastId,
          description: message,
          duration: Infinity,
        });
      });
    },
    onError: (message) => {
      settle(() => {
        toast.error("Utskrift feilet.", {
          id: statusToastId,
          description: message,
          duration: Infinity,
        });
      });
    },
    onCanceled: (message) => {
      settle(() => {
        toast.error("Utskrift avbrutt.", {
          id: statusToastId,
          description: message,
          duration: Infinity,
        });
      });
    },
  });

  return () => {
    if (settled) {
      return;
    }
    settled = true;
    clearTimeout(warningTimer);
    clearTimeout(hardTimeoutTimer);
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    toast.dismiss(statusToastId);
    onSettled?.();
  };
}
