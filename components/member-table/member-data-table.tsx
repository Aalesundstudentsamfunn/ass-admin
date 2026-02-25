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
import { isMembershipActive, isVoluntaryOrHigher, memberPrivilege } from "@/lib/privilege-checks";
import type { MemberRow, PrivilegeOption } from "./shared";
import {
  filterMembersBySelectionPreset,
  MEMBER_QUICK_FILTERS,
  VOLUNTARY_ROLE_QUICK_FILTERS,
  MemberBulkActionsBar,
  MemberQuickSelectionBar,
  isMemberRowFilterPreset,
  isVoluntaryRoleFilterPreset,
  type MemberQuickFilterPreset,
} from "./member-data-table-controls";

const DEFAULT_MEMBER_SORT: SortingState = [{ id: "created_at_sort", desc: true }];

/**
 * Returns true when sorting state is exactly the default table sort.
 */
function isDefaultMemberSort(sorting: SortingState, defaultSorting: SortingState): boolean {
  if (sorting.length !== defaultSorting.length) {
    return false;
  }
  return sorting.every(
    (item, index) =>
      item.id === defaultSorting[index]?.id &&
      item.desc === defaultSorting[index]?.desc,
  );
}

/**
 * Normalizes member sorting payload.
 *
 * How: Keeps one active sort rule and falls back to default when empty.
 */
function normalizeMemberSorting(
  next: SortingState,
  fallback: SortingState = DEFAULT_MEMBER_SORT,
): SortingState {
  if (!next.length) {
    return fallback;
  }
  const first = next[0];
  return first ? [{ id: first.id, desc: first.desc }] : fallback;
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
  onBulkTemporaryPasswords,
  onBulkPrint,
  onBulkDelete,
  canDelete,
  canManageMembership,
  canResetPasswords,
  canBulkTemporaryPasswords,
  canEditPrivileges,
  bulkOptions,
  onRefresh,
  showSelectionQuickActions = false,
  toolbarActions,
  searchParamKey,
  searchPlaceholder = "Søk navn eller e-post…",
  defaultSorting,
  filterMode = "member-default",
}: {
  columns: ColumnDef<MemberRow, unknown>[];
  data: MemberRow[];
  defaultPageSize: number;
  onRowClick?: (member: MemberRow) => void;
  onBulkPrivilege?: (members: MemberRow[], next: number) => Promise<void>;
  onBulkMembershipStatus?: (members: MemberRow[], isActive: boolean) => Promise<void>;
  onBulkPasswordReset?: (members: MemberRow[]) => Promise<void>;
  onBulkTemporaryPasswords?: (members: MemberRow[]) => Promise<void>;
  onBulkPrint?: (members: MemberRow[]) => Promise<void>;
  onBulkDelete?: (members: MemberRow[]) => Promise<void>;
  canDelete?: boolean;
  canManageMembership?: boolean;
  canResetPasswords?: boolean;
  canBulkTemporaryPasswords?: boolean;
  canEditPrivileges?: boolean;
  bulkOptions?: PrivilegeOption[];
  onRefresh?: () => void;
  showSelectionQuickActions?: boolean;
  toolbarActions?: React.ReactNode;
  searchParamKey?: string;
  searchPlaceholder?: string;
  defaultSorting?: SortingState;
  filterMode?: "member-default" | "voluntary-roles";
}) {
  const resolvedDefaultSorting = React.useMemo(
    () =>
      normalizeMemberSorting(
        defaultSorting?.length ? defaultSorting : DEFAULT_MEMBER_SORT,
        DEFAULT_MEMBER_SORT,
      ),
    [defaultSorting],
  );
  const [sorting, setSorting] = React.useState<SortingState>(resolvedDefaultSorting);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({ search: false, created_at_sort: false });
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: defaultPageSize });
  const [rowSelection, setRowSelection] = React.useState<Record<string, boolean>>({});
  const [selectionMode, setSelectionMode] = React.useState(false);
  const [bulkPrivilege, setBulkPrivilege] = React.useState<string>("");
  const [roleFilter, setRoleFilter] = React.useState<"all" | "voluntary" | "member">("all");
  const [voluntaryRoleFilter, setVoluntaryRoleFilter] = React.useState<"all" | 2 | 3 | 4 | 5>("all");
  const [membershipFilter, setMembershipFilter] = React.useState<"all" | "active" | "inactive">("all");
  const pageSizeOptions = MEMBER_PAGE_SIZES;
  const searchParams = useSearchParams();
  const initializedFilter = React.useRef(false);
  const onSortingChange = React.useCallback((updater: React.SetStateAction<SortingState>) => {
    setSorting((previous) => {
      const raw = typeof updater === "function" ? updater(previous) : updater;
      return normalizeMemberSorting(raw, resolvedDefaultSorting);
    });
  }, [resolvedDefaultSorting]);
  const filteredData = React.useMemo(
    () =>
      data.filter((member) => {
        if (filterMode === "voluntary-roles") {
          if (
            voluntaryRoleFilter !== "all" &&
            memberPrivilege(member.privilege_type) !== voluntaryRoleFilter
          ) {
            return false;
          }
        } else {
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
        }
        return true;
      }),
    [data, filterMode, membershipFilter, roleFilter, voluntaryRoleFilter],
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
    enableMultiSort: false,
    enableSortingRemoval: false,
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
  const hasDefaultSort = isDefaultMemberSort(sorting, resolvedDefaultSorting);
  const isDefaultSort =
    filterMode === "voluntary-roles"
      ? hasDefaultSort && voluntaryRoleFilter === "all"
      : hasDefaultSort && roleFilter === "all" && membershipFilter === "all";
  const searchValue = (table.getColumn("search")?.getFilterValue() as string) ?? "";
  const quickFilterOptions = React.useMemo(
    () =>
      filterMode === "voluntary-roles"
        ? [...VOLUNTARY_ROLE_QUICK_FILTERS]
        : [...MEMBER_QUICK_FILTERS],
    [filterMode],
  );
  const activeQuickFilters = React.useMemo(() => {
    const pills: Array<{ key: string; label: string }> = [];
    if (filterMode === "voluntary-roles") {
      if (voluntaryRoleFilter === 2) {
        pills.push({ key: "role_level_2", label: "Kun Frivillig" });
      } else if (voluntaryRoleFilter === 3) {
        pills.push({ key: "role_level_3", label: "Kun Gruppeleder" });
      } else if (voluntaryRoleFilter === 4) {
        pills.push({ key: "role_level_4", label: "Kun Stortinget" });
      } else if (voluntaryRoleFilter === 5) {
        pills.push({ key: "role_level_5", label: "Kun IT" });
      }
    } else {
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
    }
    return pills;
  }, [filterMode, membershipFilter, roleFilter, voluntaryRoleFilter]);
  const activeQuickFilterKeys = React.useMemo(() => {
    const keys: string[] = [];
    if (filterMode === "voluntary-roles") {
      if (voluntaryRoleFilter === 2) {
        keys.push("role_level_2");
      } else if (voluntaryRoleFilter === 3) {
        keys.push("role_level_3");
      } else if (voluntaryRoleFilter === 4) {
        keys.push("role_level_4");
      } else if (voluntaryRoleFilter === 5) {
        keys.push("role_level_5");
      }
    } else {
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
    }
    return keys;
  }, [filterMode, membershipFilter, roleFilter, voluntaryRoleFilter]);
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
      setRoleFilter("all");
      setVoluntaryRoleFilter("all");
      setMembershipFilter("all");
      table.getColumn("search")?.setFilterValue("");
      table.setPageIndex(0);
      return;
    }

    if (isVoluntaryRoleFilterPreset(preset)) {
      if (filterMode !== "voluntary-roles") {
        table.setPageIndex(0);
        return;
      }
      if (preset === "role_level_2") {
        setVoluntaryRoleFilter((previous) => (previous === 2 ? "all" : 2));
      } else if (preset === "role_level_3") {
        setVoluntaryRoleFilter((previous) => (previous === 3 ? "all" : 3));
      } else if (preset === "role_level_4") {
        setVoluntaryRoleFilter((previous) => (previous === 4 ? "all" : 4));
      } else if (preset === "role_level_5") {
        setVoluntaryRoleFilter((previous) => (previous === 5 ? "all" : 5));
      }
      table.setPageIndex(0);
      return;
    }

    if (isMemberRowFilterPreset(preset)) {
      if (filterMode === "voluntary-roles") {
        table.setPageIndex(0);
        return;
      }
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
    if (key === "role_voluntary" || key === "role_member") {
      setRoleFilter("all");
    } else if (
      key === "role_level_2" ||
      key === "role_level_3" ||
      key === "role_level_4" ||
      key === "role_level_5"
    ) {
      setVoluntaryRoleFilter("all");
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
        quickFilters={quickFilterOptions}
        onQuickFilterSelect={(key) => applyQuickFilter(key as MemberQuickFilterPreset)}
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
          canBulkTemporaryPasswords={canBulkTemporaryPasswords}
          canEditPrivileges={canEditPrivileges}
          bulkOptions={bulkOptions}
          bulkPrivilege={bulkPrivilege}
          onBulkPrivilegeValueChange={setBulkPrivilege}
          onBulkPrivilege={onBulkPrivilege}
          onBulkMembershipStatus={onBulkMembershipStatus}
          onBulkPasswordReset={onBulkPasswordReset}
          onBulkTemporaryPasswords={onBulkTemporaryPasswords}
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
