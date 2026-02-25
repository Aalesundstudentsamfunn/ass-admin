"use client";

import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PrinterLogRow, formatDate, getInvokerLabel, getStatusMeta } from "./shared";
import { CopyableInlineValue } from "../member-table/member-details-primitives";

export function PrinterLogDetailsDialog({ open, onOpenChange, row }: { open: boolean; onOpenChange: (open: boolean) => void; row: PrinterLogRow | null }) {
  const status = row ? getStatusMeta(row) : null;
  const fullName = row ? `${row.firstname ?? ""} ${row.lastname ?? ""}`.trim() : "";

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
              <span className="text-muted-foreground">Navn</span>
              <span className="font-medium">{fullName || "-"}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">E-post</span>
              <CopyableInlineValue value={String(row.email)} copyLabel="E-post" />
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">UUID</span>
              <CopyableInlineValue value={String(row.ref)} copyLabel="UUID" />
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Status</span>
              <Badge variant="outline" className={status?.className}>
                {status?.label}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Kjørt av</span>
              <span className="font-medium">{getInvokerLabel(row)}</span>
            </div>
            <div className="grid gap-1">
              <span className="text-muted-foreground">Feilmelding</span>
              <span className="font-medium break-words">{row.error_msg || "-"}</span>
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">Ingen loggrad valgt.</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
