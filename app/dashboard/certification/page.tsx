"use client";

/**
 * Server route for `certification` dashboard view.
 */

import * as React from "react";
import { SupabaseClient } from "@supabase/supabase-js";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { createClient } from "@/lib/supabase/client";
import { useCurrentPrivilege } from "@/lib/use-current-privilege";
import { canManageCertificates as hasCertificateAccess } from "@/lib/privilege-checks";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GlassPanel } from "@/components/ui/glass-panel";
import { TablePaginationControls } from "@/components/ui/table-pagination-controls";

type HolderProfile = {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
};

type CertificateType = {
  id: number;
  type: string;
};

type RelationMaybeArray<T> = T | T[] | null;

type CertificateDbRow = {
  id: number;
  created_at: string;
  application_id: number | null;
  holder: RelationMaybeArray<HolderProfile>;
  type: RelationMaybeArray<CertificateType>;
};

type CertificateRow = {
  id: number;
  created_at: string;
  application_id: number | null;
  holder: HolderProfile | null;
  type: CertificateType | null;
};

const CERTIFICATE_SELECT = `
  id,
  created_at,
  application_id,
  holder:profiles!holder ( id, firstname, lastname, email ),
  type:certificate_type!type ( id, type )
`;

function normalizeRelation<T>(value: RelationMaybeArray<T> | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/**
 * Normalizes one raw certificate row (with nested relation shape) to flat UI shape.
 *
 * How: Collapses `holder`/`type` relation arrays to a single object or `null`.
 * @returns CertificateRow
 */
function normalizeCertificateRow(row: CertificateDbRow): CertificateRow {
  return {
    id: row.id,
    created_at: row.created_at,
    application_id: row.application_id ?? null,
    holder: normalizeRelation(row.holder),
    type: normalizeRelation(row.type),
  };
}

/**
 * Loads certificates with holder/type relations from Supabase.
 *
 * How: Queries `certificate`, orders by creation time, and maps each row with `normalizeCertificateRow`.
 * @returns Promise<CertificateRow[]>
 */
async function fetchCertificates(client: SupabaseClient): Promise<CertificateRow[]> {
  const { data, error } = await client
    .from("certificate")
    .select(CERTIFICATE_SELECT)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Supabase error while loading certificates:", error);
    return [];
  }

  return (data ?? []).map((row) => normalizeCertificateRow(row as unknown as CertificateDbRow));
}

/**
 * Filters certificates by holder name or email.
 *
 * How: Applies case-insensitive match over firstname, lastname, full name, and email.
 * @returns CertificateRow[]
 */
function filterCertificates(rows: CertificateRow[], search: string): CertificateRow[] {
  const query = search.trim().toLowerCase();
  if (!query) {
    return rows;
  }

  return rows.filter((row) => {
    if (!row.holder) {
      return false;
    }
    const fullName = `${row.holder.firstname ?? ""} ${row.holder.lastname ?? ""}`.trim();
    return (
      (row.holder.firstname ?? "").toLowerCase().includes(query) ||
      (row.holder.lastname ?? "").toLowerCase().includes(query) ||
      (row.holder.email ?? "").toLowerCase().includes(query) ||
      fullName.toLowerCase().includes(query)
    );
  });
}

/**
 * Row-level destructive action cell for certificate deletion.
 *
 * How: Uses a confirmation dialog before invoking `onDelete`.
 */
function ActionsCell({
  cert,
  onDelete,
}: {
  cert: CertificateRow;
  onDelete?: (id: number) => Promise<void>;
}) {
  const [open, setOpen] = React.useState(false);

  if (!onDelete) {
    return null;
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="destructive" size="sm" className="rounded-lg">
            Slett
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bekreft sletting</DialogTitle>
            <DialogDescription>
              Er du sikker på at du vil slette sertifikat #{cert.id}? Dette kan ikke angres.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Avbryt
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={async () => {
                setOpen(false);
                await onDelete(cert.id);
              }}
            >
              Slett
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Builds certification table columns with optional action column.
 *
 * How: Uses a stable column model and injects `ActionsCell` only when delete is allowed.
 * @returns ColumnDef<CertificateRow>[]
 */
function buildColumns(onDelete?: (id: number) => Promise<void>): ColumnDef<CertificateRow>[] {
  const columns: ColumnDef<CertificateRow>[] = [
    {
      accessorKey: "id",
      header: () => <span>ID</span>,
      cell: ({ row }) => <span className="font-medium">{row.getValue("id")}</span>,
      enableHiding: false,
      size: 80,
    },
    {
      accessorKey: "holder",
      header: () => <span>Holder</span>,
      cell: ({ row }) => {
        const holder = row.getValue("holder") as CertificateRow["holder"];
        return <span>{holder ? `${holder.firstname} ${holder.lastname}` : "—"}</span>;
      },
    },
    {
      accessorKey: "holder",
      id: "email",
      header: () => <span>E-post</span>,
      cell: ({ row }) => {
        const holder = row.getValue("holder") as CertificateRow["holder"];
        if (!holder?.email) {
          return <span>—</span>;
        }
        return (
          <a className="underline-offset-2 hover:underline" href={`mailto:${holder.email}`}>
            {holder.email}
          </a>
        );
      },
    },
    {
      accessorKey: "type",
      header: () => <span>Type</span>,
      cell: ({ row }) => {
        const type = row.getValue("type") as CertificateRow["type"];
        return <span>{type?.type ?? "—"}</span>;
      },
    },
    {
      accessorKey: "application_id",
      header: () => <span>Søknad</span>,
      cell: ({ row }) => {
        const applicationId = row.getValue("application_id") as number | null;
        if (!applicationId) {
          return <span>—</span>;
        }
        return (
          <a href={`/dashboard/certification-application#app-${applicationId}`} className="underline text-primary">
            {applicationId}
          </a>
        );
      },
    },
  ];

  if (onDelete) {
    columns.push({
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => <ActionsCell cert={row.original} onDelete={onDelete} />,
    });
  }

  return columns;
}

/**
 * Generic table wrapper for certificate rows.
 *
 * How: Owns TanStack sorting/filtering/pagination state and renders shared pagination controls.
 */
function DataTable({
  columns,
  data,
}: {
  columns: ColumnDef<CertificateRow, unknown>[];
  data: CertificateRow[];
}) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, columnVisibility },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div className="space-y-3">
      <GlassPanel>
        <div className="overflow-x-auto rounded-2xl">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="whitespace-nowrap">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="align-middle">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    Ingen resultater.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </GlassPanel>

      <TablePaginationControls
        rowCount={table.getRowModel().rows.length}
        filteredCount={table.getFilteredRowModel().rows.length}
        pageIndex={table.getState().pagination.pageIndex}
        pageCount={table.getPageCount()}
        canPrevious={table.getCanPreviousPage()}
        canNext={table.getCanNextPage()}
        onPrevious={() => table.previousPage()}
        onNext={() => table.nextPage()}
        onPageIndexChange={(page) => table.setPageIndex(page)}
      />
    </div>
  );
}

/**
 * Certification dashboard page.
 *
 * How: Loads rows from Supabase, applies client search filter, and enables delete actions for authorized roles.
 */
export default function CertificationPage() {
  const supabase = React.useMemo(() => createClient(), []);
  const [rows, setRows] = React.useState<CertificateRow[]>([]);
  const [search, setSearch] = React.useState("");
  const currentPrivilege = useCurrentPrivilege();
  const canManageCertificates = hasCertificateAccess(currentPrivilege);

  React.useEffect(() => {
    let active = true;
    const load = async () => {
      const nextRows = await fetchCertificates(supabase);
      if (active) {
        setRows(nextRows);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [supabase]);

  const filteredRows = React.useMemo(() => filterCertificates(rows, search), [rows, search]);

  const handleDelete = React.useCallback(
    async (certificateId: number) => {
      const applicationId = rows.find((row) => row.id === certificateId)?.application_id ?? null;

      let applicationDeleteError: Error | null = null;
      if (applicationId !== null) {
        const { error } = await supabase
          .from("certification_application")
          .delete()
          .eq("id", applicationId);
        if (error) {
          applicationDeleteError = error;
        }
      }

      const { error: certificateDeleteError } = await supabase
        .from("certificate")
        .delete()
        .eq("id", certificateId);

      if (certificateDeleteError) {
        console.error("Failed to delete certificate:", certificateDeleteError);
        return;
      }

      if (applicationDeleteError) {
        console.error("Failed to delete related application, must be removed manually:", applicationDeleteError);
      }

      setRows((prev) => prev.filter((row) => row.id !== certificateId));
    },
    [rows, supabase],
  );

  const columns = React.useMemo(
    () => buildColumns(canManageCertificates ? handleDelete : undefined),
    [canManageCertificates, handleDelete],
  );

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Sertifikater</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Oversikt over alle utstedte sertifikater. Klikk på Søknad for å gå til søknaden.
      </p>

      <Card className="border-0 bg-transparent shadow-none">
        <CardHeader className="px-0 pt-0">
          <CardTitle>Oversikt</CardTitle>
          <CardDescription>Sorter, søk og se sertifikater.</CardDescription>
          <div className="mb-4 max-w-sm">
            <Input
              placeholder="Søk navn eller e-post…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="px-0">
          <DataTable columns={columns} data={filteredRows} />
        </CardContent>
      </Card>
    </div>
  );
}
