"use client";

/**
 * Client queue page wrapper for table + details dialog state.
 *
 * How: Receives server-provided rows, handles row selection, and triggers route refresh.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useMemberPageSizeDefault } from "@/lib/table-settings";
import { PrinterQueueDataTable } from "@/components/queue/printer-queue-data-table";
import { PrinterLogDetailsDialog } from "@/components/queue/printer-log-details-dialog";
import {
  isPrinterOffline,
  type PrinterHealthRow,
  type PrinterLogRow,
} from "@/components/queue/shared";
import { cancelPrinterQueueJob, retryPrinterQueueJob } from "@/lib/queue/client-actions";

export type { PrinterHealthRow, PrinterLogRow };

/**
 * Renders printer queue logs page.
 *
 */
export default function PrinterQueueLogsPage({
  initialData,
  printerHealth,
  canManageQueue,
}: {
  initialData: PrinterLogRow[];
  printerHealth: PrinterHealthRow | null;
  canManageQueue: boolean;
}) {
  const router = useRouter();
  const defaultPageSize = useMemberPageSizeDefault();
  const [selectedLog, setSelectedLog] = React.useState<PrinterLogRow | null>(null);
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [retryingId, setRetryingId] = React.useState<string | null>(null);
  const [cancelingId, setCancelingId] = React.useState<string | null>(null);
  const isOffline = isPrinterOffline(printerHealth?.last_heartbeat ?? null);
  const printerReady = !isOffline;
  const printerStatusLabel = printerReady ? "PC: Klar for utskrift" : "PC: Frakoblet";
  const printerConnected = printerHealth?.printer_connected;
  const printerConnectionKnown = typeof printerConnected === "boolean";
  const printerConnectedNow = printerConnected === true;
  const printerConnectionLabel = !printerConnectionKnown
    ? "Printer: Ukjent"
    : printerConnectedNow
      ? "Printer: Tilkoblet"
      : "Printer: Frakoblet";

  const handleRetry = React.useCallback(
    async (row: PrinterLogRow) => {
      setRetryingId(row.id);
      const toastId = toast.loading("Sender retry...", { duration: 10000 });
      try {
        const { response, payload } = await retryPrinterQueueJob(row.id);
        if (!response.ok) {
          throw new Error(
            typeof payload?.error === "string" && payload.error.trim()
              ? payload.error
              : "Kunne ikke retrye utskriftsjobb.",
          );
        }
        toast.success("Retry sendt.", {
          id: toastId,
          description: "Jobben er satt tilbake til kø.",
        });
        setDetailsOpen(false);
        setSelectedLog(null);
        router.refresh();
      } catch (error: unknown) {
        toast.error("Retry feilet.", {
          id: toastId,
          description:
            error instanceof Error ? error.message : "Ukjent feil ved retry.",
          duration: Infinity,
        });
      } finally {
        setRetryingId(null);
      }
    },
    [router],
  );

  const handleCancel = React.useCallback(
    async (row: PrinterLogRow) => {
      setCancelingId(row.id);
      const toastId = toast.loading("Avbryter jobb...", { duration: 10000 });
      try {
        const { response, payload } = await cancelPrinterQueueJob(row.id);
        if (!response.ok) {
          throw new Error(
            typeof payload?.error === "string" && payload.error.trim()
              ? payload.error
              : "Kunne ikke avbryte utskriftsjobb.",
          );
        }
        toast.success("Jobb avbrutt.", {
          id: toastId,
          description: "Status er oppdatert til avbrutt.",
        });
        setDetailsOpen(false);
        setSelectedLog(null);
        router.refresh();
      } catch (error: unknown) {
        toast.error("Avbryt feilet.", {
          id: toastId,
          description:
            error instanceof Error ? error.message : "Ukjent feil ved avbryt.",
          duration: Infinity,
        });
      } finally {
        setCancelingId(null);
      }
    },
    [router],
  );

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-balance">Printerkø</h1>
            <p className="text-muted-foreground text-pretty">Viser utskriftslogger</p>
          </div>
          <div className="hidden flex-none items-center gap-2 lg:flex">
            <div
              className={`inline-flex items-center gap-2.5 whitespace-nowrap rounded-full border px-4 py-2 text-sm ${
                printerReady
                  ? "border-emerald-500/45 text-emerald-700 dark:text-emerald-200"
                  : "border-rose-500/45 text-rose-700 dark:text-rose-200"
              }`}
              style={{
                backgroundColor: printerReady
                  ? "rgba(16, 185, 129, 0.11)"
                  : "rgba(244, 63, 94, 0.11)",
              }}
            >
              {printerReady ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-300" />
              )}
              <span className="font-semibold">{printerStatusLabel}</span>
            </div>
            <div
              className={`inline-flex items-center gap-2.5 whitespace-nowrap rounded-full border px-4 py-2 text-sm ${
                !printerConnectionKnown
                  ? "border-amber-500/45 text-amber-700 dark:text-amber-200"
                  : printerConnectedNow
                    ? "border-emerald-500/45 text-emerald-700 dark:text-emerald-200"
                    : "border-rose-500/45 text-rose-700 dark:text-rose-200"
              }`}
              style={{
                backgroundColor: !printerConnectionKnown
                  ? "rgba(245, 158, 11, 0.11)"
                  : printerConnectedNow
                    ? "rgba(16, 185, 129, 0.11)"
                    : "rgba(244, 63, 94, 0.11)",
              }}
              title={printerHealth?.printer_state_reason ?? undefined}
            >
              {printerConnectedNow ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
              ) : (
                <AlertTriangle
                  className={`h-4 w-4 ${
                    !printerConnectionKnown
                      ? "text-amber-600 dark:text-amber-300"
                      : "text-rose-600 dark:text-rose-300"
                  }`}
                />
              )}
              <span className="font-semibold">{printerConnectionLabel}</span>
            </div>
          </div>
        </div>

        <div className="lg:hidden">
          <div className="flex flex-wrap gap-2">
            <div
              className={`inline-flex items-center gap-2.5 rounded-full border px-4 py-2 text-sm ${
                printerReady
                  ? "border-emerald-500/45 text-emerald-700 dark:text-emerald-200"
                  : "border-rose-500/45 text-rose-700 dark:text-rose-200"
              }`}
              style={{
                backgroundColor: printerReady
                  ? "rgba(16, 185, 129, 0.11)"
                  : "rgba(244, 63, 94, 0.11)",
              }}
            >
              {printerReady ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-300" />
              )}
              <span className="font-semibold">{printerStatusLabel}</span>
            </div>
            <div
              className={`inline-flex items-center gap-2.5 rounded-full border px-4 py-2 text-sm ${
                !printerConnectionKnown
                  ? "border-amber-500/45 text-amber-700 dark:text-amber-200"
                  : printerConnectedNow
                    ? "border-emerald-500/45 text-emerald-700 dark:text-emerald-200"
                    : "border-rose-500/45 text-rose-700 dark:text-rose-200"
              }`}
              style={{
                backgroundColor: !printerConnectionKnown
                  ? "rgba(245, 158, 11, 0.11)"
                  : printerConnectedNow
                    ? "rgba(16, 185, 129, 0.11)"
                    : "rgba(244, 63, 94, 0.11)",
              }}
              title={printerHealth?.printer_state_reason ?? undefined}
            >
              {printerConnectedNow ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
              ) : (
                <AlertTriangle
                  className={`h-4 w-4 ${
                    !printerConnectionKnown
                      ? "text-amber-600 dark:text-amber-300"
                      : "text-rose-600 dark:text-rose-300"
                  }`}
                />
              )}
              <span className="font-semibold">{printerConnectionLabel}</span>
            </div>
          </div>
        </div>
      </div>

      <Card className="border-0 bg-transparent shadow-none">
        <CardHeader className="px-0 pt-0">
          <CardTitle>Oversikt</CardTitle>
          <CardDescription>Søk og sjekk status for utskriftskøen</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
        <PrinterQueueDataTable
          data={initialData}
          defaultPageSize={defaultPageSize}
          onRefresh={() => router.refresh()}
          onRowClick={(row) => {
            setSelectedLog(row);
            setDetailsOpen(true);
          }}
        />
        </CardContent>
      </Card>

      <PrinterLogDetailsDialog
        open={detailsOpen}
        onOpenChange={(open) => {
          setDetailsOpen(open);
          if (!open) {
            setSelectedLog(null);
          }
        }}
        row={selectedLog}
        canManageQueue={canManageQueue}
        onRetry={handleRetry}
        onCancel={handleCancel}
        actionBusy={Boolean(retryingId || cancelingId)}
        retrying={selectedLog?.id === retryingId}
        canceling={selectedLog?.id === cancelingId}
      />
    </div>
  );
}
