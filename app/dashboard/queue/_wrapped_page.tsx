"use client";

/**
 * Client queue page wrapper for table + details dialog state.
 *
 * How: Receives server-provided rows, handles row selection, and triggers route refresh.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useMemberPageSizeDefault } from "@/lib/table-settings";
import { PrinterQueueDataTable } from "@/components/queue/printer-queue-data-table";
import { PrinterLogDetailsDialog } from "@/components/queue/printer-log-details-dialog";
import type { PrinterLogRow } from "@/components/queue/shared";

export type { PrinterLogRow };

/**
 * Renders printer queue logs page.
 *
 */
export default function PrinterQueueLogsPage({ initialData }: { initialData: PrinterLogRow[] }) {
  const router = useRouter();
  const defaultPageSize = useMemberPageSizeDefault();
  const [selectedLog, setSelectedLog] = React.useState<PrinterLogRow | null>(null);
  const [detailsOpen, setDetailsOpen] = React.useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-balance">Printerkø</h1>
        <p className="text-muted-foreground text-pretty">Viser utskriftslogger</p>
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
      />
    </div>
  );
}
