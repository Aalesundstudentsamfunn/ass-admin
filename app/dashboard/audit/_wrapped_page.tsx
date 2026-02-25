"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useMemberPageSizeDefault } from "@/lib/table-settings";
import { AuditLogDataTable } from "@/components/audit/audit-log-data-table";
import { AuditLogDetailsDialog } from "@/components/audit/audit-log-details-dialog";
import type { AuditLogRow } from "@/lib/audit/types";

export type { AuditLogRow };

/**
 * Client wrapper for audit table and details dialog state.
 *
 * How: Receives mapped audit rows from server, refreshes via router, and tracks currently selected entry.
 */
export default function AuditLogsPage({ initialData }: { initialData: AuditLogRow[] }) {
  /**
   * Client wrapper for audit list + details dialog state.
   * Server page provides fully mapped `initialData`.
   */
  const router = useRouter();
  const defaultPageSize = useMemberPageSizeDefault();
  const [selectedLog, setSelectedLog] = React.useState<AuditLogRow | null>(null);
  const [detailsOpen, setDetailsOpen] = React.useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-balance">Logg</h1>
        <p className="text-muted-foreground text-pretty">Viser hendelser registrert av admin-funksjoner i appen</p>
      </div>

      <Card className="border-0 bg-transparent shadow-none">
        <CardHeader className="px-0 pt-0">
          <CardTitle>Oversikt</CardTitle>
          <CardDescription>Søk, sorter og åpne detaljer for auditlogg</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <AuditLogDataTable
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

      <AuditLogDetailsDialog
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
