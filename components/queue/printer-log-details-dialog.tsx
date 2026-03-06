"use client";

import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  canCancelStatus,
  canRetryStatus,
  PrinterLogRow,
  formatDate,
  getInvokerLabel,
  getStatusMeta,
} from "./shared";
import { CopyableInlineValue } from "../member-table/member-details-primitives";

export function PrinterLogDetailsDialog({
  open,
  onOpenChange,
  row,
  canManageQueue,
  onRetry,
  onCancel,
  actionBusy,
  retrying,
  canceling,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: PrinterLogRow | null;
  canManageQueue: boolean;
  onRetry: (row: PrinterLogRow) => void;
  onCancel: (row: PrinterLogRow) => void;
  actionBusy: boolean;
  retrying: boolean;
  canceling: boolean;
}) {
  const status = row ? getStatusMeta(row) : null;
  const fullName = row ? `${row.firstname ?? ""} ${row.lastname ?? ""}`.trim() : "";
  const canRetry = Boolean(row && canManageQueue && canRetryStatus(row.status));
  const canCancel = Boolean(row && canManageQueue && canCancelStatus(row.status));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Utskriftsdetaljer</DialogTitle>
          <DialogDescription>Detaljer for valgt loggrad.</DialogDescription>
        </DialogHeader>
        {row ? (
          <div className="grid gap-2 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Logg-ID</span>
              <span className="font-medium">{row.id}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Tidspunkt</span>
              <span className="font-medium">{formatDate(row.created_at)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Sist statusendret</span>
              <span className="font-medium">{formatDate(row.status_updated_at)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Navn</span>
              <span className="font-medium">{fullName || "-"}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">E-post</span>
              <CopyableInlineValue value={row.email || "-"} copyLabel="E-post" />
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">UUID</span>
              <CopyableInlineValue value={row.ref || "-"} copyLabel="UUID" />
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Status</span>
              <Badge variant="outline" className={status?.className}>
                {status?.label}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Forsøk</span>
              <span className="font-medium">{row.attempt_count}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Printer-ID</span>
              <span className="font-medium">{row.printer_id || "-"}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Claimed</span>
              <span className="font-medium">{formatDate(row.claimed_at)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Startet</span>
              <span className="font-medium">{formatDate(row.started_at)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Avsluttet</span>
              <span className="font-medium">{formatDate(row.finished_at)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Kjørt av</span>
              <span className="font-medium">{getInvokerLabel(row)}</span>
            </div>
            <div className="grid gap-1">
              <span className="text-muted-foreground">Brukermelding</span>
              <span className="font-medium break-words">{row.user_message_no || "-"}</span>
            </div>
            <div className="grid gap-1">
              <span className="text-muted-foreground">Error code</span>
              <span className="font-medium break-words">{row.error_code || "-"}</span>
            </div>
            <div className="grid gap-1">
              <span className="text-muted-foreground">Teknisk feildetalj</span>
              <span className="font-medium break-words">{row.technical_error || "-"}</span>
            </div>
            {canManageQueue ? (
              <div className="mt-2 flex items-center gap-2 border-t pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!canRetry || actionBusy}
                  onClick={() => row && onRetry(row)}
                >
                  {retrying ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Retry...
                    </>
                  ) : (
                    "Retry"
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!canCancel || actionBusy}
                  onClick={() => row && onCancel(row)}
                >
                  {canceling ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Avbryter...
                    </>
                  ) : (
                    "Avbryt"
                  )}
                </Button>
              </div>
            ) : null}
            {!canManageQueue ? (
              <div className="text-xs text-muted-foreground">
                Du mangler tilgang til Retry/Avbryt på printerjobber.
              </div>
            ) : null}
            {canManageQueue && !canRetry && !canCancel ? (
              <div className="text-xs text-muted-foreground">
                Ingen handlinger tilgjengelig for denne statusen.
              </div>
            ) : null}
            {canManageQueue && canRetry && !canCancel ? (
              <div className="text-xs text-muted-foreground">
                Jobben kan retryes fra denne statusen.
              </div>
            ) : null}
            {canManageQueue && canCancel && !canRetry ? (
              <div className="text-xs text-muted-foreground">
                Jobben kan avbrytes fra denne statusen.
              </div>
            ) : null}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">Ingen loggrad valgt.</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
