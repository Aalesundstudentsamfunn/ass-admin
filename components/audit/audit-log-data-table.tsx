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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MEMBER_PAGE_SIZES } from "@/lib/table-settings";
import {
  buildSearchHaystack,
  containsTextFilter,
  sortByDateValue,
} from "@/lib/table/column-helpers";
import { cn } from "@/lib/utils";
import {
  AuditLogRow,
  formatAuditDate,
  getAuditStatusMeta,
} from "./shared";

const DEFAULT_AUDIT_SORT: SortingState = [{ id: "created_at", desc: true }];

type AuditQuickFilterPreset =
  | "status_error"
  | "status_ok"
  | "status_partial"
  | "reset";

/**
 * Compacts change summary for table view.
 *
 * How: If change string contains `old → new`, table shows only `new`.
 * Full before/after remains available in details dialog/raw data.
 * @returns string
 */
function compactChangeForTable(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return "-";
  }
  const arrowMatch = raw.match(/(->|→|=>)/);
  if (!arrowMatch) {
    return raw;
  }
  const arrow = arrowMatch[0];
  const [labelPart, rightPart] = raw.split(arrow);
  const label = labelPart?.includes(":")
    ? `${labelPart.split(":")[0]?.trim()}: `
    : "";
  const nextValue = rightPart?.trim() ?? "";
  return `${label}${nextValue}`.trim();
}

/**
 * Keeps default newest-first sort as fallback when no custom sort rules remain.
 */
function normalizeAuditSorting(next: SortingState): SortingState {
  if (!next.length) {
    return DEFAULT_AUDIT_SORT;
  }
  const first = next[0];
  return first ? [{ id: first.id, desc: first.desc }] : DEFAULT_AUDIT_SORT;
}

/**
 * Column configuration for audit table.
 * Search is implemented via a hidden aggregated `search` column.
 */
function buildColumns(): ColumnDef<AuditLogRow, unknown>[] {
  return [
    {
      id: "search",
      accessorFn: (row: AuditLogRow) =>
        buildSearchHaystack([
          row.event,
          row.target ?? "",
          row.target_name ?? "",
          row.target_uuid ?? "",
          row.target_email ?? "",
          row.change ?? "",
          row.actor_label,
          row.actor_id ?? "",
          row.actor_email ?? "",
          row.error_message ?? "",
          row.source,
        ]),
      filterFn: containsTextFilter,
      enableSorting: false,
      enableHiding: true,
    },
    {
      accessorKey: "created_at",
      sortingFn: sortByDateValue,
      header: ({ column }) => (
        <button
          className="inline-flex items-center gap-1"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Tidspunkt <ArrowUpDown className="h-3.5 w-3.5" />
        </button>
      ),
      cell: ({ row }) => (
        <span className="block truncate">
          {formatAuditDate(row.original.created_at)}
        </span>
      ),
    },
    {
      accessorKey: "event",
      header: ({ column }) => (
        <button
          className="inline-flex items-center gap-1"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Hendelse <ArrowUpDown className="h-3.5 w-3.5" />
        </button>
      ),
      cell: ({ row }) => (
        <span className="block truncate">{String(row.getValue("event") || "-")}</span>
      ),
    },
    {
      accessorKey: "target_name",
      header: ({ column }) => (
        <button
          className="inline-flex items-center gap-1"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Mål <ArrowUpDown className="h-3.5 w-3.5" />
        </button>
      ),
      cell: ({ row }) => (
        <span className="block truncate">{String(row.getValue("target_name") || "-")}</span>
      ),
    },
    {
      accessorKey: "change",
      header: ({ column }) => (
        <button
          className="inline-flex items-center gap-1"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Endring <ArrowUpDown className="h-3.5 w-3.5" />
        </button>
      ),
      cell: ({ row }) => (
        <span className="block truncate">
          {compactChangeForTable(String(row.getValue("change") || "-"))}
        </span>
      ),
    },
    {
      id: "status",
      accessorFn: (row: AuditLogRow) => getAuditStatusMeta(row.status).sortValue,
      header: ({ column }) => (
        <button
          className="inline-flex items-center gap-1"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Status <ArrowUpDown className="h-3.5 w-3.5" />
        </button>
      ),
      cell: ({ row }) => {
        const status = getAuditStatusMeta(row.original.status);
        return (
          <Badge variant="outline" className={status.className}>
            {status.label}
          </Badge>
        );
      },
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
 * Renders audit log data table.
 *
 */
export function AuditLogDataTable({
  data,
  defaultPageSize,
  onRefresh,
  onRowClick,
}: {
  data: AuditLogRow[];
  defaultPageSize: number;
  onRefresh: () => void;
  onRowClick?: (row: AuditLogRow) => void;
}) {
  /**
   * Audit list table state:
   * - controlled sorting/filtering/pagination
   * - quick-filter presets from funnel menu
   * - row click delegated to parent for opening details dialog
   */
  const columns = React.useMemo(() => buildColumns(), []);
  const [sorting, setSorting] = React.useState<SortingState>(DEFAULT_AUDIT_SORT);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(
    { search: false }
  );
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: defaultPageSize,
  });
  const [statusFilter, setStatusFilter] = React.useState<"all" | "ok" | "error" | "partial">("all");
  const onSortingChange = React.useCallback((updater: React.SetStateAction<SortingState>) => {
    setSorting((previous) => {
      const raw = typeof updater === "function" ? updater(previous) : updater;
      return normalizeAuditSorting(raw);
    });
  }, []);
  const filteredData = React.useMemo(
    () =>
      data.filter((row) =>
        statusFilter === "all" ? true : row.status === statusFilter,
      ),
    [data, statusFilter],
  );
  const activeQuickFilters = React.useMemo(() => {
    const pills: Array<{ key: string; label: string }> = [];
    if (statusFilter === "error") {
      pills.push({ key: "status_error", label: "Kun feilet" });
    } else if (statusFilter === "ok") {
      pills.push({ key: "status_ok", label: "Kun OK" });
    } else if (statusFilter === "partial") {
      pills.push({ key: "status_partial", label: "Kun Delvis" });
    }
    return pills;
  }, [statusFilter]);
  const activeQuickFilterKeys = React.useMemo(() => {
    const keys: string[] = [];
    if (statusFilter === "error") {
      keys.push("status_error");
    } else if (statusFilter === "ok") {
      keys.push("status_ok");
    } else if (statusFilter === "partial") {
      keys.push("status_partial");
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
    enableMultiSort: false,
    enableSortingRemoval: false,
  });

  React.useEffect(() => {
    setPagination((prev) => ({ ...prev, pageSize: defaultPageSize, pageIndex: 0 }));
  }, [defaultPageSize]);

  const hasSearchFilter = Boolean(table.getColumn("search")?.getFilterValue());
  const isDefaultSort =
    sorting.length === 1 &&
    sorting[0]?.id === DEFAULT_AUDIT_SORT[0].id &&
    sorting[0]?.desc === DEFAULT_AUDIT_SORT[0].desc &&
    statusFilter === "all";
  const searchValue = (table.getColumn("search")?.getFilterValue() as string) ?? "";
  const activeFilterCount =
    new Set([
      ...activeQuickFilterKeys,
      ...(searchValue ? ["__search"] : []),
    ]).size;

  const applyQuickFilter = (
    preset: AuditQuickFilterPreset
  ) => {
    switch (preset) {
      case "status_error":
        setStatusFilter((previous) => (previous === "error" ? "all" : "error"));
        break;
      case "status_ok":
        setStatusFilter((previous) => (previous === "ok" ? "all" : "ok"));
        break;
      case "status_partial":
        setStatusFilter((previous) => (previous === "partial" ? "all" : "partial"));
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
    if (key === "status_ok" || key === "status_error" || key === "status_partial") {
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
        searchPlaceholder="Søk hendelse, bruker eller e-post..."
        isDefaultSort={isDefaultSort}
        quickFilters={[
          { key: "status_error", label: "Kun feilet" },
          { key: "status_ok", label: "Kun OK" },
          { key: "status_partial", label: "Kun Delvis" },
          { key: "reset", label: "Nullstill hurtigfiltre" },
        ]}
        onQuickFilterSelect={(key) => applyQuickFilter(key as AuditQuickFilterPreset)}
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
        <div className="min-w-0 overflow-hidden rounded-2xl">
          <Table className="table-fixed">
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className={cn(
                        "whitespace-nowrap",
                        header.column.id === "created_at" && "w-[11.75rem]",
                        header.column.id === "event" && "w-[12.5rem]",
                        header.column.id === "target_name" && "w-[12.5rem]",
                        header.column.id === "change" && "w-[13rem]",
                        header.column.id === "status" && "w-[7rem]",
                      )}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
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
                      className={cn(
                        onRowClick &&
                          "cursor-pointer hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      )}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          className={cn(
                            "align-middle",
                            cell.column.id === "status"
                              ? "whitespace-nowrap text-right"
                              : "whitespace-normal overflow-hidden",
                          )}
                        >
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
                      <div>Ingen auditlogger funnet.</div>
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
