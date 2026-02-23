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
  | "latest"
  | "oldest"
  | "event_asc"
  | "event_desc"
  | "target_asc"
  | "target_desc"
  | "status_error"
  | "status_ok"
  | "reset";

/**
 * Maps current audit sorting to a readable label.
 *
 * How: Uses first sorting rule and keeps default newest-first without pill.
 * @returns string | null
 */
function getAuditSortLabel(sorting: SortingState): string | null {
  if (sorting.length > 1) {
    return `${sorting.length} sorteringer`;
  }
  if (sorting.length !== 1) {
    return null;
  }
  const sort = sorting[0];
  if (!sort) {
    return null;
  }
  if (sort.id === "created_at") {
    return sort.desc ? null : "Eldste oppføring først";
  }
  if (sort.id === "event") {
    return sort.desc ? "Hendelse Å-A" : "Hendelse A-Å";
  }
  if (sort.id === "target_name") {
    return sort.desc ? "Mål Å-A" : "Mål A-Å";
  }
  if (sort.id === "change") {
    return sort.desc ? "Endring Å-A" : "Endring A-Å";
  }
  if (sort.id === "status") {
    return sort.desc ? "Status høyest først" : "Status lavest først";
  }
  return sort.desc ? `Sortering: ${sort.id} Å-A` : `Sortering: ${sort.id} A-Å`;
}

/**
 * Maps sorting state to quick-filter keys used in the dropdown checkmarks.
 */
function getAuditSortQuickFilterKeys(sorting: SortingState): string[] {
  return sorting.flatMap((sort) => {
    if (sort.id === "created_at") {
      return [sort.desc ? "latest" : "oldest"];
    }
    if (sort.id === "event") {
      return [sort.desc ? "event_desc" : "event_asc"];
    }
    if (sort.id === "target_name") {
      return [sort.desc ? "target_desc" : "target_asc"];
    }
    return [];
  });
}

/**
 * Maps active sort keys to explicit priority labels shown in filter dropdown.
 */
function getAuditSortPriorityByKey(sorting: SortingState): Record<string, number> {
  const keys = getAuditSortQuickFilterKeys(sorting);
  const priorityByKey: Record<string, number> = {};
  keys.forEach((key, index) => {
    priorityByKey[key] = index + 1;
  });
  return priorityByKey;
}

/**
 * Keeps default newest-first sort as fallback when no custom sort rules remain.
 */
function normalizeAuditSorting(next: SortingState): SortingState {
  if (!next.length) {
    return DEFAULT_AUDIT_SORT;
  }
  return next;
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
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc", true)}
        >
          Tidspunkt <ArrowUpDown className="h-3.5 w-3.5" />
        </button>
      ),
      cell: ({ row }) => <span>{formatAuditDate(row.original.created_at)}</span>,
    },
    {
      accessorKey: "event",
      header: ({ column }) => (
        <button
          className="inline-flex items-center gap-1"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc", true)}
        >
          Hendelse <ArrowUpDown className="h-3.5 w-3.5" />
        </button>
      ),
      cell: ({ row }) => <span>{String(row.getValue("event") || "-")}</span>,
    },
    {
      accessorKey: "target_name",
      header: ({ column }) => (
        <button
          className="inline-flex items-center gap-1"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc", true)}
        >
          Mål <ArrowUpDown className="h-3.5 w-3.5" />
        </button>
      ),
      cell: ({ row }) => <span>{String(row.getValue("target_name") || "-")}</span>,
    },
    {
      accessorKey: "change",
      header: ({ column }) => (
        <button
          className="inline-flex items-center gap-1"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc", true)}
        >
          Endring <ArrowUpDown className="h-3.5 w-3.5" />
        </button>
      ),
      cell: ({ row }) => (
        <span className="line-clamp-1 max-w-[22rem] break-all">
          {String(row.getValue("change") || "-")}
        </span>
      ),
    },
    {
      id: "status",
      accessorFn: (row: AuditLogRow) => getAuditStatusMeta(row.status).sortValue,
      header: ({ column }) => (
        <button
          className="inline-flex items-center gap-1"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc", true)}
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
  const [statusFilter, setStatusFilter] = React.useState<"all" | "ok" | "error">("all");
  const onSortingChange = React.useCallback((updater: React.SetStateAction<SortingState>) => {
    setSorting((previous) => {
      const next = typeof updater === "function" ? updater(previous) : updater;
      return normalizeAuditSorting(next);
    });
  }, []);
  const currentSortLabel = React.useMemo(() => getAuditSortLabel(sorting), [sorting]);
  const activeSortKeys = React.useMemo(() => getAuditSortQuickFilterKeys(sorting), [sorting]);
  const sortPriorityByKey = React.useMemo(() => getAuditSortPriorityByKey(sorting), [sorting]);
  const filteredData = React.useMemo(
    () =>
      data.filter((row) =>
        statusFilter === "all" ? true : row.status === statusFilter,
      ),
    [data, statusFilter],
  );
  const activeQuickFilters = React.useMemo(() => {
    const pills: Array<{ key: string; label: string }> = [];
    if (currentSortLabel) {
      pills.push({ key: "sort", label: currentSortLabel });
    }
    if (statusFilter === "error") {
      pills.push({ key: "status_error", label: "Kun feilet" });
    } else if (statusFilter === "ok") {
      pills.push({ key: "status_ok", label: "Kun OK" });
    }
    return pills;
  }, [currentSortLabel, statusFilter]);
  const activeQuickFilterKeys = React.useMemo(() => {
    const keys = [...activeSortKeys];
    if (statusFilter === "error") {
      keys.push("status_error");
    } else if (statusFilter === "ok") {
      keys.push("status_ok");
    }
    return keys;
  }, [activeSortKeys, statusFilter]);

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
    const toggleSort = (id: string, desc: boolean) => {
      setSorting((previous) => {
        const normalized = normalizeAuditSorting(previous);
        const existingIndex = normalized.findIndex((item) => item.id === id);
        if (existingIndex >= 0) {
          const existing = normalized[existingIndex];
          if (existing?.desc === desc) {
            const removed = normalized.filter((item) => item.id !== id);
            return normalizeAuditSorting(removed);
          }
          return normalized.map((item) => (item.id === id ? { id, desc } : item));
        }
        return normalizeAuditSorting([...normalized, { id, desc }]);
      });
    };

    switch (preset) {
      case "latest":
        toggleSort("created_at", true);
        break;
      case "oldest":
        toggleSort("created_at", false);
        break;
      case "event_asc":
        toggleSort("event", false);
        break;
      case "event_desc":
        toggleSort("event", true);
        break;
      case "target_asc":
        toggleSort("target_name", false);
        break;
      case "target_desc":
        toggleSort("target_name", true);
        break;
      case "status_error":
        setStatusFilter((previous) => (previous === "error" ? "all" : "error"));
        break;
      case "status_ok":
        setStatusFilter((previous) => (previous === "ok" ? "all" : "ok"));
        break;
      default:
        setSorting(DEFAULT_AUDIT_SORT);
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
    if (key === "sort") {
      setSorting(DEFAULT_AUDIT_SORT);
    } else if (key === "status_ok" || key === "status_error") {
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
          { key: "latest", label: "Nyeste oppføring først" },
          { key: "oldest", label: "Eldste oppføring først" },
          { key: "event_asc", label: "Hendelse A-Å" },
          { key: "event_desc", label: "Hendelse Å-A" },
          { key: "target_asc", label: "Mål A-Å" },
          { key: "target_desc", label: "Mål Å-A" },
          { key: "status_error", label: "Kun feilet" },
          { key: "status_ok", label: "Kun OK" },
          { key: "reset", label: "Nullstill hurtigfiltre" },
        ]}
        onQuickFilterSelect={(key) => applyQuickFilter(key as AuditQuickFilterPreset)}
        activeQuickFilter={null}
        activeQuickFilters={activeQuickFilters}
        activeQuickFilterKeys={activeQuickFilterKeys}
        sortPriorityByKey={sortPriorityByKey}
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
