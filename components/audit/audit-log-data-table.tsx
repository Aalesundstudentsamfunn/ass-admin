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
      cell: ({ row }) => <span>{formatAuditDate(row.original.created_at)}</span>,
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
      cell: ({ row }) => <span>{String(row.getValue("event") || "-")}</span>,
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
      cell: ({ row }) => <span>{String(row.getValue("target_name") || "-")}</span>,
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
  const [activeQuickFilter, setActiveQuickFilter] = React.useState<string | null>(
    null
  );

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
    sorting[0]?.id === DEFAULT_AUDIT_SORT[0].id &&
    sorting[0]?.desc === DEFAULT_AUDIT_SORT[0].desc;
  const searchValue = (table.getColumn("search")?.getFilterValue() as string) ?? "";

  const applyQuickFilter = (
    preset: "latest" | "oldest" | "status" | "event" | "actor" | "reset"
  ) => {
    switch (preset) {
      case "latest":
        setSorting(DEFAULT_AUDIT_SORT);
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
      case "event":
        setSorting([{ id: "event", desc: false }]);
        setActiveQuickFilter("Hendelse A-Å");
        break;
      case "actor":
        setSorting([{ id: "target_name", desc: false }]);
        setActiveQuickFilter("Mål A-Å");
        break;
      default:
        setSorting(DEFAULT_AUDIT_SORT);
        table.getColumn("search")?.setFilterValue("");
        setActiveQuickFilter(null);
        break;
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
          { key: "status", label: "Feilet først" },
          { key: "event", label: "Hendelse A-Å" },
          { key: "actor", label: "Mål A-Å" },
          { key: "reset", label: "Nullstill anbefaling" },
        ]}
        onQuickFilterSelect={(key) =>
          applyQuickFilter(key as "latest" | "oldest" | "status" | "event" | "actor" | "reset")
        }
        activeQuickFilter={activeQuickFilter}
        onClearQuickFilter={() => applyQuickFilter("reset")}
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
