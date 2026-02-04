"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowUpDown, Trash2, Filter, Printer } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { enqueuePrinterQueue, watchPrinterQueueStatus } from "@/lib/printer-queue";
import { MEMBER_PAGE_SIZES, useMemberPageSizeDefault } from "@/lib/table-settings";
import { ColumnDef, flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, SortingState, useReactTable, ColumnFiltersState, VisibilityState } from "@tanstack/react-table";
import { CreateUserDialog } from "@/components/add-new-member";
import { useRouter } from "next/navigation";

/**
 * Liquid Glass Users Page
 * - Uses shadcn/ui + TanStack Table
 * - Columns: id, firstname, lastname, email
 * - Row actions: "Mer info" and Delete (red)
 * - Responsive + dark/light aware + liquid glass aesthetic
 */

// ----- Types -----------------------------------------------------------------
export type UserRow = {
  id: string | number;
  firstname: string;
  lastname: string;
  email: string;
  is_voluntary: boolean;
};

// ----- Liquid Glass primitives ----------------------------------------------
function Glass({ className = "", children }: React.PropsWithChildren<{ className?: string }>) {
  return <div className={cn("relative rounded-2xl border backdrop-blur-xl", "bg-white/65 border-white/50 shadow-[0_1px_0_rgba(255,255,255,0.6),0_10px_30px_-10px_rgba(16,24,40,0.25)]", "dark:bg-white/5 dark:border-white/10 dark:shadow-[0_1px_0_rgba(255,255,255,0.07),0_20px_60px_-20px_rgba(0,0,0,0.6)]", className)}>{children}</div>;
}

// ----- Columns ---------------------------------------------------------------
function buildColumns(onDelete: (id: string | number) => Promise<void>, isDeleting: boolean) {
  return [
    {
      id: "search",
      accessorFn: (row: UserRow) => `${row.firstname} ${row.lastname} ${row.email ?? ""}`.trim(),
      filterFn: (row, columnId, value) => {
        const query = String(value ?? "").trim().toLowerCase();
        if (!query) {
          return true;
        }
        const haystack = String(row.getValue(columnId) ?? "").toLowerCase();
        return haystack.includes(query);
      },
      enableSorting: false,
      enableHiding: true,
    },
    {
      accessorKey: "id",
      header: ({ column }) => (
        <button className="inline-flex items-center gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          ID <ArrowUpDown className="h-3.5 w-3.5" />
        </button>
      ),
      cell: ({ row }) => <span className="font-medium">{row.getValue("id")}</span>,
      enableHiding: false,
      size: 80,
    },
    {
      accessorKey: "firstname",
      header: ({ column }) => (
        <button className="inline-flex items-center gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          First name <ArrowUpDown className="h-3.5 w-3.5" />
        </button>
      ),
      cell: ({ row }) => <span>{row.getValue("firstname")}</span>,
    },
    {
      accessorKey: "lastname",
      header: ({ column }) => (
        <button className="inline-flex items-center gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Last name <ArrowUpDown className="h-3.5 w-3.5" />
        </button>
      ),
      cell: ({ row }) => <span>{row.getValue("lastname")}</span>,
    },
    {
      accessorKey: "email",
      header: ({ column }) => (
        <button className="inline-flex items-center gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Email <ArrowUpDown className="h-3.5 w-3.5" />
        </button>
      ),
      cell: ({ row }) => (
        <a href={`mailto:${row.getValue("email")}`} className="underline-offset-2 hover:underline">
          {row.getValue("email")}
        </a>
      ),
    },
    {
      accessorKey: "is_voluntary",
      header: ({ column }) => (
        <button className="inline-flex items-center gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Frivillig <ArrowUpDown className="h-3.5 w-3.5" />
        </button>
      ),
      cell: ({ row }) => <span>{row.getValue("is_voluntary") ? "Ja" : ""}</span>,
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const user = row.original as UserRow;
        return (
          <div className="flex items-center gap-2 justify-end">
            <Button
              variant="default"
              size="sm"
              className="rounded-lg"
              onClick={async () => {
                const supabase = createClient();
                const toastId = toast.loading("Sender til utskriftskø...", { duration: 10000 });
                const { data: authData, error: authError } = await supabase.auth.getUser();

                if (authError || !authData.user) {
                  console.error("Kunne ikke hente innlogget bruker for printer_queue", authError);
                  toast.error("Kunne ikke legge til i utskriftskø.", {
                    id: toastId,
                    description: "Prøv å logge inn på nytt.",
                    duration: Infinity,
                  });
                  return;
                }

                const { data: queueRow, error } = await enqueuePrinterQueue(supabase, {
                  firstname: user.firstname,
                  lastname: user.lastname,
                  email: user.email,
                  ref: user.id,
                  ref_invoker: authData.user.id,
                  is_voluntary: user.is_voluntary,
                });

                if (error) {
                  console.error("Feil ved innsending til printer_queue", error);
                  toast.error("Kunne ikke legge til i utskriftskø.", error.message ? { id: toastId, description: error.message, duration: Infinity } : { id: toastId, duration: Infinity });
                } else {
                  toast.loading("Venter på utskrift...", {
                    id: toastId,
                    description: "Utskrift starter når skriveren er klar.",
                    duration: Infinity,
                  });

                  watchPrinterQueueStatus(supabase, {
                    queueId: queueRow?.id,
                    ref: user.id,
                    refInvoker: authData.user.id,
                    timeoutMs: 25000,
                    timeoutErrorMessage: "Sjekk printer-PCen. Hvis den er offline, kontakt IT.",
                    onCompleted: () => {
                      toast.success("Utskrift sendt til printer.", { id: toastId, duration: 10000 });
                    },
                    onError: (message) => {
                      toast.error("Utskrift feilet.", { id: toastId, description: message, duration: Infinity });
                    },
                    onTimeout: () => {
                      toast.error("Utskrift tar lengre tid enn vanlig.", {
                        id: toastId,
                        description: "Sjekk printer-PCen. Hvis den er offline, kontakt IT.",
                        duration: Infinity,
                      });
                    },
                  });
                }
              }}>
              <Printer className="mr-1 h-4 w-4" /> Print kort
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="rounded-lg"
              disabled={isDeleting}
              onClick={async () => {
                onDelete(user.id);
              }}>
              <Trash2 className="mr-1 h-4 w-4" /> {isDeleting ? "Sletter..." : "Delete"}
            </Button>
          </div>
        );
      },
      enableHiding: false,
    },
  ] as ColumnDef<UserRow, unknown>[];
}

// ----- DataTable -------------------------------------------------------------
function DataTable({ columns, data, defaultPageSize }: { columns: ColumnDef<UserRow, unknown>[]; data: UserRow[]; defaultPageSize: number }) {
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "id", desc: true }]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({ search: false });
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: defaultPageSize });
  const pageSizeOptions = MEMBER_PAGE_SIZES;

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, columnVisibility, pagination },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  React.useEffect(() => {
    setPagination((prev) => ({ ...prev, pageSize: defaultPageSize, pageIndex: 0 }));
  }, [defaultPageSize]);

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative w-full max-w-xs">
            <Input
              placeholder="Søk navn eller e-post…"
              value={(table.getColumn("search")?.getFilterValue() as string) ?? ""}
              onChange={(e) => table.getColumn("search")?.setFilterValue(e.target.value)}
              className="rounded-xl bg-background/60"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              <Filter className="h-4 w-4" />
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CreateUserDialog />
        </div>
      </div>

      {/* Table */}
      <Glass>
        <div className="overflow-x-auto rounded-2xl">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="whitespace-nowrap">
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
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
      </Glass>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          Viser {table.getRowModel().rows.length} av {table.getFilteredRowModel().rows.length} rader
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Rader per side</span>
          <select
            value={table.getState().pagination.pageSize}
            onChange={(e) => {
              const next = Number(e.target.value);
              if (Number.isNaN(next)) {
                return;
              }
              table.setPageSize(next);
              table.setPageIndex(0);
            }}
            className="h-8 w-20 rounded-xl border border-border/60 bg-background/60 px-2 text-xs"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <Button variant="outline" size="sm" className="rounded-xl" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
            Forrige
          </Button>
          {/* Go to page input */}
          <span className="text-xs">Gå til side</span>
          <Input
            type="number"
            min={1}
            max={table.getPageCount()}
            value={table.getState().pagination.pageIndex + 1}
            onChange={(e) => {
              let page = Number(e.target.value) - 1;
              if (!isNaN(page)) {
                page = Math.max(0, Math.min(page, table.getPageCount() - 1));
                table.setPageIndex(page);
              }
            }}
            className="w-16 h-8 px-2 py-1 text-xs"
            style={{ fontVariantNumeric: "tabular-nums" }}
          />
          <Button variant="outline" size="sm" className="rounded-xl" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            Neste
          </Button>
        </div>
      </div>
    </div>
  );
}

// ----- Page ------------------------------------------------------------------
export default function UsersPage({ initialData }: { initialData: UserRow[] }) {
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);
  const defaultPageSize = useMemberPageSizeDefault();
  const [rows, setRows] = React.useState<UserRow[]>(initialData);
  const [isDeleting, setIsDeleting] = React.useState(false);

  // Update rows when initialData changes (after router.refresh())
  React.useEffect(() => {
    setRows(initialData);
  }, [initialData]);

  const columns = React.useMemo(
    () =>
      buildColumns(async (id: string | number) => {
        const confirmed = window.confirm("Er du sikker på at du vil slette dette medlemmet?");
        if (!confirmed) {
          toast.message("Sletting avbrutt.", { duration: 10000 });
          return;
        }

        const toastId = toast.loading("Sletter medlem...", { duration: 10000 });
        setIsDeleting(true);
        try {
          console.log("deleting..");
          console.log((await supabase.auth.getUser()).data.user?.email);
          const targetId = typeof id === "string" ? Number(id) : id;
          if (Number.isNaN(targetId)) {
            throw new Error("Invalid member id");
          }

          // Optimistically remove from UI
          setRows((prev) => prev.filter((row) => row.id !== id));

          const { error: deleteError, data } = await supabase.from("ass_members").delete().eq("id", targetId);
          if (deleteError) {
            throw new Error(deleteError.message);
          }
          console.log(data);
          toast.success("Medlem slettet.", { id: toastId, duration: 10000 });
          router.refresh();
        } catch (error) {
          console.error("Failed to delete member", error);
          toast.error("Kunne ikke slette medlem.", {
            id: toastId,
            description: error instanceof Error ? error.message : String(error),
            duration: Infinity,
          });
          // Restore on error
          setRows(initialData);
        } finally {
          setIsDeleting(false);
        }
      }, isDeleting),
    [supabase, isDeleting, router, initialData],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-balance">Medlemmer med betalt åss medlemskap</h1>
        <p className="text-muted-foreground text-pretty">Administrer aktive medlemmer</p>
      </div>

      <Card className="border-0 bg-transparent shadow-none">
        <CardHeader className="px-0 pt-0">
          <CardTitle>Oversikt</CardTitle>
          <CardDescription>Sorter, filtrer og håndter medlemmer</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <DataTable columns={columns} data={rows} defaultPageSize={defaultPageSize} />
        </CardContent>
      </Card>
    </div>
  );
}
