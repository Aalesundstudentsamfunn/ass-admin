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
import { isMembershipActive, isVoluntaryOrHigher } from "@/lib/privilege-checks";
import type { MemberRow, PrivilegeOption } from "./shared";
import {
  filterMembersBySelectionPreset,
  getMemberQuickFilterState,
  MEMBER_QUICK_FILTERS,
  MemberBulkActionsBar,
  MemberQuickSelectionBar,
  isMemberRowFilterPreset,
  isMemberSortPreset,
  type MemberQuickFilterPreset,
} from "./member-data-table-controls";

const DEFAULT_MEMBER_SORT: SortingState = [{ id: "created_at_sort", desc: true }];

/**
 * Maps current TanStack sorting state to a readable quick-filter label.
 *
 * How: Reads first active sort only (single-column sorting in this table).
 * @returns string | null
 */
function getMemberSortLabel(sorting: SortingState): string | null {
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
  if (sort.id === "created_at_sort") {
    return sort.desc ? null : "Eldste oppføring først";
  }
  if (sort.id === "lastname") {
    return sort.desc ? "Etternavn Å-A" : "Etternavn A-Å";
  }
  if (sort.id === "email") {
    return sort.desc ? "E-post Å-A" : "E-post A-Å";
  }
  if (sort.id === "firstname") {
    return sort.desc ? "Fornavn Å-A" : "Fornavn A-Å";
  }
  if (sort.id === "privilege_type") {
    return sort.desc ? "Høyeste tilgang først" : "Laveste tilgang først";
  }
  return sort.desc ? `Sortering: ${sort.id} Å-A` : `Sortering: ${sort.id} A-Å`;
}

/**
 * Converts sorting state into quick-filter keys to show checked states in dropdown.
 *
 * How: Maps known sort ids/directions to existing quick-filter option keys.
 * @returns string[]
 */
function getMemberSortQuickFilterKeys(sorting: SortingState): string[] {
  return sorting.flatMap((sort) => {
    if (sort.id === "created_at_sort") {
      return [sort.desc ? "latest" : "oldest"];
    }
    if (sort.id === "lastname") {
      return [sort.desc ? "lastname_desc" : "lastname_asc"];
    }
    if (sort.id === "email") {
      return [sort.desc ? "email_desc" : "email_asc"];
    }
    if (sort.id === "privilege_type") {
      return [sort.desc ? "privilege_desc" : "privilege_asc"];
    }
    return [];
  });
}

/**
 * Maps active sorting rules to dropdown keys with priority order.
 *
 * How: Priority value equals sort index + 1 from TanStack sorting state.
 * @returns Record<string, number>
 */
function getMemberSortPriorityByKey(sorting: SortingState): Record<string, number> {
  const keys = getMemberSortQuickFilterKeys(sorting);
  const priorityByKey: Record<string, number> = {};
  keys.forEach((key, index) => {
    priorityByKey[key] = index + 1;
  });
  return priorityByKey;
}

/**
 * Returns true when sorting state is exactly the default table sort.
 */
function isDefaultMemberSort(sorting: SortingState): boolean {
  return sorting.length === 1 && sorting[0]?.id === "created_at_sort" && sorting[0]?.desc === true;
}

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
  const [sorting, setSorting] = React.useState<SortingState>(DEFAULT_MEMBER_SORT);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({ search: false, created_at_sort: false });
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: defaultPageSize });
  const [rowSelection, setRowSelection] = React.useState<Record<string, boolean>>({});
  const [selectionMode, setSelectionMode] = React.useState(false);
  const [bulkPrivilege, setBulkPrivilege] = React.useState<string>("");
  const [roleFilter, setRoleFilter] = React.useState<"all" | "voluntary" | "member">("all");
  const [membershipFilter, setMembershipFilter] = React.useState<"all" | "active" | "inactive">("all");
  const pageSizeOptions = MEMBER_PAGE_SIZES;
  const searchParams = useSearchParams();
  const initializedFilter = React.useRef(false);
  const onSortingChange = React.useCallback((updater: React.SetStateAction<SortingState>) => {
    setSorting((previous) => {
      const next = typeof updater === "function" ? updater(previous) : updater;
      if (!next.length) {
        return DEFAULT_MEMBER_SORT;
      }
      return next;
    });
  }, []);
  const filteredData = React.useMemo(
    () =>
      data.filter((member) => {
        if (roleFilter === "voluntary" && !isVoluntaryOrHigher(member.privilege_type)) {
          return false;
        }
        if (roleFilter === "member" && isVoluntaryOrHigher(member.privilege_type)) {
          return false;
        }
        if (membershipFilter === "active" && !isMembershipActive(member.is_membership_active)) {
          return false;
        }
        if (membershipFilter === "inactive" && isMembershipActive(member.is_membership_active)) {
          return false;
        }
        return true;
      }),
    [data, membershipFilter, roleFilter],
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting, columnFilters, columnVisibility, pagination, rowSelection },
    onSortingChange,
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
  const hasDefaultSort = isDefaultMemberSort(sorting);
  const isDefaultSort = hasDefaultSort && roleFilter === "all" && membershipFilter === "all";
  const searchValue = (table.getColumn("search")?.getFilterValue() as string) ?? "";
  const currentSortLabel = React.useMemo(() => getMemberSortLabel(sorting), [sorting]);
  const activeSortKeys = React.useMemo(() => getMemberSortQuickFilterKeys(sorting), [sorting]);
  const sortPriorityByKey = React.useMemo(() => getMemberSortPriorityByKey(sorting), [sorting]);
  const activeQuickFilters = React.useMemo(() => {
    const pills: Array<{ key: string; label: string }> = [];
    if (currentSortLabel) {
      pills.push({ key: "sort", label: currentSortLabel });
    }
    if (roleFilter === "voluntary") {
      pills.push({ key: "role_voluntary", label: "Kun frivillige" });
    } else if (roleFilter === "member") {
      pills.push({ key: "role_member", label: "Kun medlemmer" });
    }
    if (membershipFilter === "active") {
      pills.push({ key: "membership_active", label: "Kun aktive medlemskap" });
    } else if (membershipFilter === "inactive") {
      pills.push({ key: "membership_inactive", label: "Kun inaktive medlemskap" });
    }
    return pills;
  }, [currentSortLabel, membershipFilter, roleFilter]);
  const activeQuickFilterKeys = React.useMemo(() => {
    const keys = [...activeSortKeys];
    if (roleFilter === "voluntary") {
      keys.push("role_voluntary");
    } else if (roleFilter === "member") {
      keys.push("role_member");
    }
    if (membershipFilter === "active") {
      keys.push("membership_active");
    } else if (membershipFilter === "inactive") {
      keys.push("membership_inactive");
    }
    return keys;
  }, [activeSortKeys, membershipFilter, roleFilter]);
  const activeFilterCount =
    new Set([
      ...activeQuickFilterKeys,
      ...(searchValue ? ["__search"] : []),
    ]).size;

  /**
   * Applies one of the recommended quick-filter presets from the toolbar menu.
   */
  const applyQuickFilter = (preset: MemberQuickFilterPreset) => {
    if (preset === "reset") {
      setSorting(DEFAULT_MEMBER_SORT);
      setRoleFilter("all");
      setMembershipFilter("all");
      table.getColumn("search")?.setFilterValue("");
      table.setPageIndex(0);
      return;
    }

    if (isMemberSortPreset(preset)) {
      const next = getMemberQuickFilterState(preset);
      setSorting((previous) => {
        if (!next.sorting.length) {
          return previous;
        }
        const nextSort = next.sorting[0];
        if (!nextSort) {
          return previous;
        }
        const existingIndex = previous.findIndex((item) => item.id === nextSort.id);
        if (existingIndex >= 0) {
          const existing = previous[existingIndex];
          if (existing?.desc === nextSort.desc) {
            const removed = previous.filter((item) => item.id !== nextSort.id);
            return removed.length ? removed : DEFAULT_MEMBER_SORT;
          }
          return previous.map((item) =>
            item.id === nextSort.id ? nextSort : item,
          );
        }
        return [...previous, nextSort];
      });
      table.setPageIndex(0);
      return;
    }

    if (isMemberRowFilterPreset(preset)) {
      if (preset === "role_voluntary") {
        setRoleFilter((previous) => (previous === "voluntary" ? "all" : "voluntary"));
      } else if (preset === "role_member") {
        setRoleFilter((previous) => (previous === "member" ? "all" : "member"));
      } else if (preset === "membership_active") {
        setMembershipFilter((previous) => (previous === "active" ? "all" : "active"));
      } else if (preset === "membership_inactive") {
        setMembershipFilter((previous) => (previous === "inactive" ? "all" : "inactive"));
      }
      table.setPageIndex(0);
    }
  };

  /**
   * Clears one active quick-filter pill without resetting all other active filters.
   */
  const clearQuickFilter = (key?: string) => {
    if (!key || key === "__single") {
      applyQuickFilter("reset");
      return;
    }
    if (key === "sort") {
      setSorting(DEFAULT_MEMBER_SORT);
    } else if (key === "role_voluntary" || key === "role_member") {
      setRoleFilter("all");
    } else if (key === "membership_active" || key === "membership_inactive") {
      setMembershipFilter("all");
    } else {
      applyQuickFilter("reset");
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
