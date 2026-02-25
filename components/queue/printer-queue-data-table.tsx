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
import { ArrowUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/ui/glass-panel";
import { SearchFilterToolbar } from "@/components/table/search-filter-toolbar";
import { TablePaginationControls } from "@/components/ui/table-pagination-controls";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { MEMBER_PAGE_SIZES } from "@/lib/table-settings";
import {
  buildSearchHaystack,
  containsTextFilter,
  sortByDateValue,
} from "@/lib/table/column-helpers";
import { formatDate, getInvokerLabel, getStatusMeta, PrinterLogRow } from "./shared";

const DEFAULT_QUEUE_SORT: SortingState = [{ id: "created_at", desc: true }];

type QueueQuickFilterPreset =
  | "status_failed"
  | "status_pending"
  | "status_done"
  | "reset";

function getQueueStatusKey(row: PrinterLogRow): "failed" | "pending" | "done" {
  if (row.error_msg) {
    return "failed";
  }
  if (row.completed) {
    return "done";
  }
  return "pending";
}

/**
 * Keeps default sort as fallback whenever no custom sorting is active.
 */
function normalizeQueueSorting(next: SortingState): SortingState {
  if (!next.length) {
    return DEFAULT_QUEUE_SORT;
  }
  const seen = new Set<string>();
  const deduped: SortingState = [];
  next.forEach((item) => {
    if (seen.has(item.id)) {
      return;
    }
    seen.add(item.id);
    deduped.push(item);
  });
  return deduped.length ? deduped : DEFAULT_QUEUE_SORT;
}

/**
 * Builds queue table columns for logs, status, and invoker.
 *
 * How: Uses hidden search/status sort columns plus formatted display cells for timestamps and badges.
 * @returns ColumnDef<PrinterLogRow, unknown>[]
 */
function buildColumns(): ColumnDef<PrinterLogRow, unknown>[] {
  return [
    {
      id: "search",
      accessorFn: (row: PrinterLogRow) =>
        buildSearchHaystack([
          row.firstname,
          row.lastname,
          row.email,
          row.ref ?? "",
          row.error_msg ?? "",
          getInvokerLabel(row),
          getStatusMeta(row).label,
        ]),
      filterFn: containsTextFilter,
      enableSorting: false,
      enableHiding: true,
    },
    {
      accessorKey: "created_at",
      sortingFn: sortByDateValue,
      header: ({ column }) => (
        <button className="inline-flex items-center gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc", true)}>
          Tidspunkt <ArrowUpDown className="h-3.5 w-3.5" />
        </button>
      ),
      cell: ({ row }) => <span>{formatDate(row.original.created_at)}</span>,
    },
    {
      id: "name",
      accessorFn: (row: PrinterLogRow) => `${row.firstname ?? ""} ${row.lastname ?? ""}`.trim(),
      header: ({ column }) => (
        <button className="inline-flex items-center gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc", true)}>
          Navn <ArrowUpDown className="h-3.5 w-3.5" />
        </button>
      ),
      cell: ({ row }) => <span>{(row.getValue("name") as string) || "-"}</span>,
    },
    {
      accessorKey: "email",
      header: ({ column }) => (
        <button className="inline-flex items-center gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc", true)}>
          E-post <ArrowUpDown className="h-3.5 w-3.5" />
        </button>
      ),
      cell: ({ row }) => <span>{String(row.getValue("email") ?? "-")}</span>,
    },
    {
      id: "status",
      accessorFn: (row: PrinterLogRow) => getStatusMeta(row).sortValue,
      header: ({ column }) => (
        <button className="inline-flex items-center gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc", true)}>
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
        <button className="inline-flex items-center gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc", true)}>
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

/**
 * Interactive printer queue table with search, quick filters, sorting, pagination, and row details trigger.
 *
 * How: Uses TanStack table state for filtering/sorting and delegates details opening through `onRowClick`.
 */
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
  const [statusFilter, setStatusFilter] = React.useState<"all" | "failed" | "pending" | "done">("all");
  const onSortingChange = React.useCallback((updater: React.SetStateAction<SortingState>) => {
    setSorting((previous) => {
      const raw = typeof updater === "function" ? updater(previous) : updater;
      return normalizeQueueSorting(raw);
    });
  }, []);
  const filteredData = React.useMemo(
    () =>
      data.filter((row) =>
        statusFilter === "all" ? true : getQueueStatusKey(row) === statusFilter,
      ),
    [data, statusFilter],
  );
  const activeQuickFilters = React.useMemo(() => {
    const pills: Array<{ key: string; label: string }> = [];
    if (statusFilter === "failed") {
      pills.push({ key: "status_failed", label: "Kun feilet" });
    } else if (statusFilter === "pending") {
      pills.push({ key: "status_pending", label: "Kun pending" });
    } else if (statusFilter === "done") {
      pills.push({ key: "status_done", label: "Kun ferdig" });
    }
    return pills;
  }, [statusFilter]);
  const activeQuickFilterKeys = React.useMemo(() => {
    const keys: string[] = [];
    if (statusFilter === "failed") {
      keys.push("status_failed");
    } else if (statusFilter === "pending") {
      keys.push("status_pending");
    } else if (statusFilter === "done") {
      keys.push("status_done");
    }
    return keys;
  }, [statusFilter]);

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting, columnFilters, columnVisibility, pagination },
    onSortingChange,
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
    sorting[0]?.desc === DEFAULT_QUEUE_SORT[0].desc &&
    statusFilter === "all";
  const searchValue = (table.getColumn("search")?.getFilterValue() as string) ?? "";
  const activeFilterCount =
    new Set([
      ...activeQuickFilterKeys,
      ...(searchValue ? ["__search"] : []),
    ]).size;
  const applyQuickFilter = (preset: QueueQuickFilterPreset) => {
    switch (preset) {
      case "status_failed":
        setStatusFilter((prev) => (prev === "failed" ? "all" : "failed"));
        break;
      case "status_pending":
        setStatusFilter((prev) => (prev === "pending" ? "all" : "pending"));
        break;
      case "status_done":
        setStatusFilter((prev) => (prev === "done" ? "all" : "done"));
        break;
      default:
        setStatusFilter("all");
        table.getColumn("search")?.setFilterValue("");
        break;
    }
    table.setPageIndex(0);
  };

  const clearQuickFilter = (key?: string) => {
    if (!key || key === "__single") {
      applyQuickFilter("reset");
      return;
    }
    if (key === "status_failed" || key === "status_pending" || key === "status_done") {
      setStatusFilter("all");
    } else {
      applyQuickFilter("reset");
    }
    table.setPageIndex(0);
  };

  return (
    <div className="space-y-3">
      <SearchFilterToolbar
        searchValue={searchValue}
        onSearchChange={(value) => table.getColumn("search")?.setFilterValue(value)}
        searchPlaceholder="Søk navn, e-post, invoker eller ref..."
        isDefaultSort={isDefaultSort}
        quickFilters={[
          { key: "status_failed", label: "Kun feilet" },
          { key: "status_pending", label: "Kun pending" },
          { key: "status_done", label: "Kun ferdig" },
          { key: "reset", label: "Nullstill hurtigfiltre" },
        ]}
        onQuickFilterSelect={(key) => applyQuickFilter(key as QueueQuickFilterPreset)}
        activeQuickFilter={null}
        activeQuickFilters={activeQuickFilters}
        activeQuickFilterKeys={activeQuickFilterKeys}
        activeFilterCount={activeFilterCount}
        showActivePills={false}
        onClearQuickFilter={clearQuickFilter}
        onClearSearch={() => {
          table.getColumn("search")?.setFilterValue("");
          table.setPageIndex(0);
        }}
        onRefresh={onRefresh}
      />

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
