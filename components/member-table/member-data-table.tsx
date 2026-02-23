"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
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
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/ui/glass-panel";
import { SearchFilterToolbar } from "@/components/table/search-filter-toolbar";
import { TablePaginationControls } from "@/components/ui/table-pagination-controls";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { MEMBER_PAGE_SIZES } from "@/lib/table-settings";
import type { MemberRow, PrivilegeOption } from "./shared";
import {
  filterMembersBySelectionPreset,
  getMemberQuickFilterState,
  MEMBER_QUICK_FILTERS,
  MemberBulkActionsBar,
  MemberQuickSelectionBar,
  type MemberQuickFilterPreset,
} from "./member-data-table-controls";

/**
 * Shared table shell used by members/frivillige pages.
 *
 * It centralizes:
 * - search + quick filters
 * - sorting/pagination
 * - optional row-selection mode with bulk actions
 * - responsive table rendering with shared styles
 */
export function MemberDataTable({
  columns,
  data,
  defaultPageSize,
  onRowClick,
  onBulkPrivilege,
  onBulkMembershipStatus,
  onBulkPasswordReset,
  onBulkPrint,
  onBulkDelete,
  canDelete,
  canManageMembership,
  canResetPasswords,
  canEditPrivileges,
  bulkOptions,
  onRefresh,
  showSelectionQuickActions = false,
  toolbarActions,
  searchParamKey,
  searchPlaceholder = "Søk navn eller e-post…",
}: {
  columns: ColumnDef<MemberRow, unknown>[];
  data: MemberRow[];
  defaultPageSize: number;
  onRowClick?: (member: MemberRow) => void;
  onBulkPrivilege?: (members: MemberRow[], next: number) => Promise<void>;
  onBulkMembershipStatus?: (members: MemberRow[], isActive: boolean) => Promise<void>;
  onBulkPasswordReset?: (members: MemberRow[]) => Promise<void>;
  onBulkPrint?: (members: MemberRow[]) => Promise<void>;
  onBulkDelete?: (members: MemberRow[]) => Promise<void>;
  canDelete?: boolean;
  canManageMembership?: boolean;
  canResetPasswords?: boolean;
  canEditPrivileges?: boolean;
  bulkOptions?: PrivilegeOption[];
  onRefresh?: () => void;
  showSelectionQuickActions?: boolean;
  toolbarActions?: React.ReactNode;
  searchParamKey?: string;
  searchPlaceholder?: string;
}) {
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "created_at_sort", desc: true }]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({ search: false, created_at_sort: false });
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: defaultPageSize });
  const [rowSelection, setRowSelection] = React.useState<Record<string, boolean>>({});
  const [selectionMode, setSelectionMode] = React.useState(false);
  const [bulkPrivilege, setBulkPrivilege] = React.useState<string>("");
  const [activeQuickFilter, setActiveQuickFilter] = React.useState<string | null>(null);
  const pageSizeOptions = MEMBER_PAGE_SIZES;
  const searchParams = useSearchParams();
  const initializedFilter = React.useRef(false);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, columnVisibility, pagination, rowSelection },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableRowSelection: true,
  });

  React.useEffect(() => {
    if (initializedFilter.current || !searchParamKey) {
      return;
    }
    const queryValue = searchParams.get(searchParamKey);
    if (queryValue) {
      table.getColumn("search")?.setFilterValue(queryValue);
    }
    initializedFilter.current = true;
  }, [searchParamKey, searchParams, table]);

  React.useEffect(() => {
    setPagination((prev) => ({ ...prev, pageSize: defaultPageSize, pageIndex: 0 }));
  }, [defaultPageSize]);

  React.useEffect(() => {
    if (!selectionMode) {
      table.resetRowSelection();
    }
  }, [selectionMode, table]);

  React.useEffect(() => {
    if (!bulkPrivilege && bulkOptions && bulkOptions.length > 0) {
      setBulkPrivilege(String(bulkOptions[0].value));
    }
  }, [bulkOptions, bulkPrivilege]);

  const selectedRows = table.getSelectedRowModel().rows;
  const selectedMembers = selectedRows.map((row) => row.original as MemberRow);
  const hasSelection = selectedMembers.length > 0;
  const hasSearchFilter = Boolean(table.getColumn("search")?.getFilterValue());
  const isDefaultSort = sorting.length === 1 && sorting[0]?.id === "created_at_sort" && sorting[0]?.desc === true;
  const searchValue = (table.getColumn("search")?.getFilterValue() as string) ?? "";

  /**
   * Applies one of the recommended quick-filter presets from the toolbar menu.
   */
  const applyQuickFilter = (preset: MemberQuickFilterPreset) => {
    const next = getMemberQuickFilterState(preset);
    setSorting(next.sorting);
    setActiveQuickFilter(next.activeQuickFilter);
    if (next.clearSearch) {
      table.getColumn("search")?.setFilterValue("");
    }
    table.setPageIndex(0);
  };

  const setSelectionByRows = React.useCallback(
    (rowsToSelect: ReturnType<typeof table.getPreFilteredRowModel>["rows"]) => {
      const next: Record<string, boolean> = {};
      rowsToSelect.forEach((row) => {
        next[row.id] = true;
      });
      setRowSelection(next);
    },
    [table],
  );

  /**
   * Fast bulk selection presets for selection mode.
   */
  const quickSelect = React.useCallback(
    (preset: "voluntary" | "members" | "visible" | "everyone") => {
      const sourceRows =
        preset === "visible" ? table.getRowModel().rows : table.getPreFilteredRowModel().rows;
      const selectedRows = filterMembersBySelectionPreset(
        sourceRows.map((row) => row.original as MemberRow),
        preset,
      );
      const selectedIds = new Set(selectedRows.map((row) => String(row.id)));
      setSelectionByRows(
        sourceRows.filter((row) => selectedIds.has(String((row.original as MemberRow).id))),
      );
    },
    [setSelectionByRows, table],
  );

  return (
    <div className="space-y-3">
      <SearchFilterToolbar
        searchValue={searchValue}
        onSearchChange={(value) => table.getColumn("search")?.setFilterValue(value)}
        searchPlaceholder={searchPlaceholder}
        isDefaultSort={isDefaultSort}
        quickFilters={[...MEMBER_QUICK_FILTERS]}
        onQuickFilterSelect={(key) => applyQuickFilter(key as MemberQuickFilterPreset)}
        activeQuickFilter={activeQuickFilter}
        onClearQuickFilter={() => applyQuickFilter("reset")}
        onClearSearch={() => {
          table.getColumn("search")?.setFilterValue("");
          table.setPageIndex(0);
        }}
        onRefresh={onRefresh}
        rightSlot={
          <>
            <Button
              size="sm"
              variant={selectionMode ? "secondary" : "outline"}
              className="rounded-xl"
              onClick={() => setSelectionMode((prev) => !prev)}
            >
              {selectionMode ? "Avslutt valg" : "Velg rader"}
            </Button>
            {toolbarActions}
          </>
        }
      />

      {hasSelection ? (
        <MemberBulkActionsBar
          selectedCount={selectedMembers.length}
          selectedMembers={selectedMembers}
          canDelete={canDelete}
          canManageMembership={canManageMembership}
          canResetPasswords={canResetPasswords}
          canEditPrivileges={canEditPrivileges}
          bulkOptions={bulkOptions}
          bulkPrivilege={bulkPrivilege}
          onBulkPrivilegeValueChange={setBulkPrivilege}
          onBulkPrivilege={onBulkPrivilege}
          onBulkMembershipStatus={onBulkMembershipStatus}
          onBulkPasswordReset={onBulkPasswordReset}
          onBulkPrint={onBulkPrint}
          onBulkDelete={onBulkDelete}
          onResetSelection={() => table.resetRowSelection()}
        />
      ) : null}
      {selectionMode && showSelectionQuickActions ? (
        <MemberQuickSelectionBar onSelectPreset={quickSelect} />
      ) : null}

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
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => {
                  const member = row.original as MemberRow;
                  return (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
                      onClick={() => {
                        if (selectionMode) {
                          row.toggleSelected();
                          return;
                        }
                        onRowClick?.(member);
                      }}
                      onKeyDown={(event) => {
                        if (!selectionMode && !onRowClick) {
                          return;
                        }
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          if (selectionMode) {
                            row.toggleSelected();
                          } else {
                            onRowClick?.(member);
                          }
                        }
                      }}
                      tabIndex={selectionMode || onRowClick ? 0 : undefined}
                      aria-label={
                        selectionMode
                          ? `Velg ${member.firstname} ${member.lastname}`
                          : onRowClick
                            ? `Vis detaljer for ${member.firstname} ${member.lastname}`
                            : undefined
                      }
                      className={cn(
                        (selectionMode || onRowClick) &&
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
        pageSizeOptions={pageSizeOptions}
        onPageSizeChange={(nextPageSize) => {
          table.setPageSize(nextPageSize);
          table.setPageIndex(0);
        }}
      />
    </div>
  );
}
