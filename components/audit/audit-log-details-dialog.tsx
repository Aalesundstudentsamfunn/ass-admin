"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatAuditDate, getAuditStatusMeta, type AuditLogRow } from "./shared";

/**
 * Reusable copy-to-clipboard text renderer used for ids/emails in audit details.
 */
function CopyableValue({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!copied) {
      return;
    }
    const timeout = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  const handleCopy = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label} kopiert.`);
    } catch {
      toast.error(`Kunne ikke kopiere ${label.toLowerCase()}.`);
    }
  };

  return (
    <span className="group relative inline-flex max-w-full items-center justify-end">
      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex max-w-full items-center gap-1.5 break-all text-right underline-offset-2 hover:underline"
      >
        {value}
        {copied ? <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
      </button>
      <span className="pointer-events-none absolute -top-7 right-0 whitespace-nowrap rounded-md bg-foreground/90 px-2 py-1 text-[10px] text-background opacity-0 transition-opacity group-hover:opacity-100">
        {copied ? "Kopiert" : "Kopier"}
      </span>
    </span>
  );
}

/**
 * Detailed modal view for a selected audit row.
 *
 * How: Splits data into Hendelse/Mål/Utfører sections, supports copy on IDs/emails, and lazy-toggle raw JSON.
 */
export function AuditLogDetailsDialog({
  open,
  onOpenChange,
  row,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: AuditLogRow | null;
}) {
  /**
   * Pretty-printed raw payload from `admin_audit_log`.
   * Kept as local memoized value since raw data can be large.
   */
  const prettyJson = React.useMemo(() => {
    if (!row?.raw) {
      return "";
    }
    try {
      return JSON.stringify(row.raw, null, 2);
    } catch {
      return "";
    }
  }, [row]);

  const status = row ? getAuditStatusMeta(row.status) : null;
  const [rawOpen, setRawOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setRawOpen(false);
      return;
    }
    setRawOpen(false);
  }, [open, row?.id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] overflow-hidden p-0 sm:max-w-4xl">
        <div className="max-h-[88vh] overflow-y-auto p-6">
          <DialogHeader>
            <DialogTitle>Auditloggdetaljer</DialogTitle>
            <DialogDescription>Detaljert informasjon om valgt hendelse.</DialogDescription>
          </DialogHeader>
          {row ? (
            <div className="mt-4 min-w-0 space-y-4 text-sm">
              <div className="space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-foreground/80">Hendelse</div>
                <div className="grid grid-cols-[9rem_minmax(0,1fr)] gap-y-2 gap-x-4">
                  <div className="text-muted-foreground">Tidspunkt</div>
                  <div className="min-w-0 text-right">{formatAuditDate(row.created_at)}</div>
                  <div className="text-muted-foreground">Hendelse</div>
                  <div className="min-w-0 text-right break-all">{row.event || "-"}</div>
                  <div className="text-muted-foreground">Status</div>
                  <div className="min-w-0 text-right">{status?.label ?? "Ukjent"}</div>
                  {row.error_message ? (
                    <>
                      <div className="text-muted-foreground">Error</div>
                      <div className="min-w-0 text-right break-all">{row.error_message}</div>
                    </>
                  ) : null}
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-foreground/80">Mål</div>
                <div className="grid grid-cols-[9rem_minmax(0,1fr)] gap-y-2 gap-x-4">
                  <div className="text-muted-foreground">Navn</div>
                  <div className="min-w-0 text-right break-all">{row.target_name || "-"}</div>
                  <div className="text-muted-foreground">E-post</div>
                  <div className="min-w-0 text-right break-all">
                    {row.target_email ? <CopyableValue value={row.target_email} label="Target e-post" /> : "-"}
                  </div>
                  <div className="text-muted-foreground">UUID</div>
                  <div className="min-w-0 text-right break-all">
                    {row.target_uuid ? <CopyableValue value={row.target_uuid} label="Target UUID" /> : "-"}
                  </div>
                  {row.change_items?.length ? (
                    <>
                      <div className="text-muted-foreground">Endring</div>
                      <div className="min-w-0 text-right break-all">
                        <div className="space-y-1">
                          {row.change_items.map((item, index) => (
                            <div key={`${row.id}-change-${index}`}>{item}</div>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : row.change ? (
                    <>
                      <div className="text-muted-foreground">Endring</div>
                      <div className="min-w-0 text-right break-all">{row.change}</div>
                    </>
                  ) : null}
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-foreground/80">Utfører</div>
                <div className="grid grid-cols-[9rem_minmax(0,1fr)] gap-y-2 gap-x-4">
                  <div className="text-muted-foreground">Bruker</div>
                  <div className="min-w-0 text-right break-all">{row.actor_label || "-"}</div>
                  {row.actor_id ? (
                    <>
                      <div className="text-muted-foreground">Bruker-ID</div>
                      <div className="min-w-0 text-right break-all">
                        <CopyableValue value={row.actor_id} label="Bruker-ID" />
                      </div>
                    </>
                  ) : null}
                  {row.actor_email ? (
                    <>
                      <div className="text-muted-foreground">E-post</div>
                      <div className="min-w-0 text-right break-all">
                        <CopyableValue value={row.actor_email} label="E-post" />
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium">Raw data</div>
              <button
                type="button"
                className="rounded-md border border-border/60 bg-background/60 px-2 py-1 text-xs hover:bg-muted/50"
                onClick={() => setRawOpen((prev) => !prev)}
              >
                {rawOpen ? "Skjul" : "Vis"}
              </button>
            </div>
            {rawOpen ? (
              <pre className="max-h-[40vh] max-w-full overflow-auto whitespace-pre-wrap break-all rounded-xl border border-border/60 bg-background/60 p-3 text-xs leading-relaxed">
                {prettyJson || "{}"}
              </pre>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
