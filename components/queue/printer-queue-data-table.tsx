"use client";

import * as React from "react";
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
import { ArrowUpDown, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { GlassPanel } from "@/components/ui/glass-panel";
import { TablePaginationControls } from "@/components/ui/table-pagination-controls";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { MEMBER_PAGE_SIZES } from "@/lib/table-settings";
import { formatDate, getInvokerLabel, getStatusMeta, PrinterLogRow } from "./shared";

const DEFAULT_QUEUE_SORT: SortingState = [{ id: "created_at", desc: true }];

function buildColumns(): ColumnDef<PrinterLogRow, unknown>[] {
  return [
    {
      id: "search",
      accessorFn: (row: PrinterLogRow) =>
        [
          row.firstname,
          row.lastname,
          row.email,
          row.ref ?? "",
          row.error_msg ?? "",
          getInvokerLabel(row),
          getStatusMeta(row).label,
        ]
          .join(" ")
          .trim(),
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
      accessorKey: "created_at",
      sortingFn: (a, b) => {
        const aValue = new Date(String(a.getValue("created_at") ?? "")).getTime();
        const bValue = new Date(String(b.getValue("created_at") ?? "")).getTime();
        return aValue - bValue;
      },
      header: ({ column }) => (
        <button className="inline-flex items-center gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Tidspunkt <ArrowUpDown className="h-3.5 w-3.5" />
        </button>
      ),
      cell: ({ row }) => <span>{formatDate(row.original.created_at)}</span>,
    },
    {
      id: "name",
      accessorFn: (row: PrinterLogRow) => `${row.firstname ?? ""} ${row.lastname ?? ""}`.trim(),
      header: ({ column }) => (
        <button className="inline-flex items-center gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Navn <ArrowUpDown className="h-3.5 w-3.5" />
        </button>
      ),
      cell: ({ row }) => <span>{(row.getValue("name") as string) || "-"}</span>,
    },
    {
      accessorKey: "email",
      header: ({ column }) => (
        <button className="inline-flex items-center gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          E-post <ArrowUpDown className="h-3.5 w-3.5" />
        </button>
      ),
      cell: ({ row }) => <span>{String(row.getValue("email") ?? "-")}</span>,
    },
    {
      id: "status",
      accessorFn: (row: PrinterLogRow) => getStatusMeta(row).sortValue,
      header: ({ column }) => (
        <button className="inline-flex items-center gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Status <ArrowUpDown className="h-3.5 w-3.5" />
        </button>
      ),
      cell: ({ row }) => {
        const status = getStatusMeta(row.original);
        return (
          <Badge variant="outline" className={status.className}>
            {status.label}
          </Badge>
        );
      },
    },
    {
      id: "invoker",
      accessorFn: (row: PrinterLogRow) => getInvokerLabel(row),
      header: ({ column }) => (
        <button className="inline-flex items-center gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Kjørt av <ArrowUpDown className="h-3.5 w-3.5" />
        </button>
      ),
      cell: ({ row }) => <span>{String(row.getValue("invoker") ?? "Ukjent")}</span>,
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: () => null,
      enableHiding: false,
    },
  ];
}

export function PrinterQueueDataTable({
  data,
  defaultPageSize,
  onRefresh,
  onRowClick,
}: {
  data: PrinterLogRow[];
  defaultPageSize: number;
  onRefresh: () => void;
  onRowClick?: (row: PrinterLogRow) => void;
}) {
  const columns = React.useMemo(() => buildColumns(), []);
  const [sorting, setSorting] = React.useState<SortingState>(DEFAULT_QUEUE_SORT);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({ search: false });
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: defaultPageSize });
  const [activeQuickFilter, setActiveQuickFilter] = React.useState<string | null>(null);

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

  const hasSearchFilter = Boolean(table.getColumn("search")?.getFilterValue());
  const isDefaultSort =
    sorting.length === 1 &&
    sorting[0]?.id === DEFAULT_QUEUE_SORT[0].id &&
    sorting[0]?.desc === DEFAULT_QUEUE_SORT[0].desc;
  const applyQuickFilter = (preset: "latest" | "oldest" | "status" | "name" | "invoker" | "reset") => {
    switch (preset) {
      case "latest":
        setSorting(DEFAULT_QUEUE_SORT);
        setActiveQuickFilter(null);
        break;
      case "oldest":
        setSorting([{ id: "created_at", desc: false }]);
        setActiveQuickFilter("Eldste oppføring først");
        break;
      case "status":
        setSorting([{ id: "status", desc: true }]);
        setActiveQuickFilter("Feilet først");
        break;
      case "name":
        setSorting([{ id: "name", desc: false }]);
        setActiveQuickFilter("Navn A-Å");
        break;
      case "invoker":
        setSorting([{ id: "invoker", desc: false }]);
        setActiveQuickFilter("Kjørt av A-Å");
        break;
      default:
        setSorting(DEFAULT_QUEUE_SORT);
        table.getColumn("search")?.setFilterValue("");
        setActiveQuickFilter(null);
        break;
    }
    table.setPageIndex(0);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative w-full max-w-xs">
            <Input
              placeholder="Søk navn, e-post, invoker eller ref..."
              value={(table.getColumn("search")?.getFilterValue() as string) ?? ""}
              onChange={(event) => table.getColumn("search")?.setFilterValue(event.target.value)}
              className="rounded-xl bg-background/60 pr-10"
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 transition-colors",
                    "hover:bg-muted/50",
                    !isDefaultSort && "text-primary",
                  )}
                  aria-label="Filteranbefalinger"
                >
                  <Filter className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[14rem]">
                <DropdownMenuItem onSelect={(event) => { event.preventDefault(); applyQuickFilter("latest"); }}>
                  Nyeste oppføring først
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={(event) => { event.preventDefault(); applyQuickFilter("oldest"); }}>
                  Eldste oppføring først
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={(event) => { event.preventDefault(); applyQuickFilter("status"); }}>
                  Feilet først
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={(event) => { event.preventDefault(); applyQuickFilter("name"); }}>
                  Navn A-Å
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={(event) => { event.preventDefault(); applyQuickFilter("invoker"); }}>
                  Kjørt av A-Å
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={(event) => { event.preventDefault(); applyQuickFilter("reset"); }}>
                  Nullstill anbefaling
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {hasSearchFilter ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/70 px-2.5 py-1 text-xs">
              Søk: {(table.getColumn("search")?.getFilterValue() as string) ?? ""}
              <button
                type="button"
                className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Fjern søkefilter"
                onClick={() => {
                  table.getColumn("search")?.setFilterValue("");
                  table.setPageIndex(0);
                }}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ) : null}
          {activeQuickFilter ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/70 px-2.5 py-1 text-xs">
              {activeQuickFilter}
              <button
                type="button"
                className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Fjern hurtigfilter"
                onClick={() => applyQuickFilter("reset")}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ) : null}
          <Button size="sm" variant="outline" className="rounded-xl" onClick={onRefresh}>
            Oppdater
          </Button>
        </div>
      </div>

      <GlassPanel>
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
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => {
                  const log = row.original;
                  return (
                    <TableRow
                      key={row.id}
                      onClick={() => onRowClick?.(log)}
                      onKeyDown={(event) => {
                        if (!onRowClick) {
                          return;
                        }
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onRowClick(log);
                        }
                      }}
                      tabIndex={onRowClick ? 0 : undefined}
                      aria-label={onRowClick ? `Vis detaljer for ${log.firstname} ${log.lastname}` : undefined}
                      className={cn(
                        onRowClick &&
                          "cursor-pointer hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      )}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="align-middle">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    <div className="space-y-2">
                      <div>Ingen resultater.</div>
                      {hasSearchFilter ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl"
                          onClick={() => table.getColumn("search")?.setFilterValue("")}
                        >
                          Nullstill filter
                        </Button>
                      ) : null}
                    </div>
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
        pageSize={table.getState().pagination.pageSize}
        pageSizeOptions={MEMBER_PAGE_SIZES}
        onPageSizeChange={(nextPageSize) => {
          table.setPageSize(nextPageSize);
          table.setPageIndex(0);
        }}
      />
    </div>
  );
}
