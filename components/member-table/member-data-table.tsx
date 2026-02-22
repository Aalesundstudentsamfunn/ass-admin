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
import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { GlassPanel } from "@/components/ui/glass-panel";
import { TablePaginationControls } from "@/components/ui/table-pagination-controls";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { MEMBER_PAGE_SIZES } from "@/lib/table-settings";
import { isVoluntaryOrHigher } from "@/lib/privilege-checks";
import type { MemberRow, PrivilegeOption } from "./shared";

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

  /**
   * Applies predefined sorting/filter presets used by the funnel icon menu.
   */
  const applyQuickFilter = (preset: "latest" | "oldest" | "lastname" | "email" | "privilege" | "reset") => {
    switch (preset) {
      case "latest":
        setSorting([{ id: "created_at_sort", desc: true }]);
        setActiveQuickFilter(null);
        break;
      case "oldest":
        setSorting([{ id: "created_at_sort", desc: false }]);
        setActiveQuickFilter("Eldste oppføring først");
        break;
      case "lastname":
        setSorting([{ id: "lastname", desc: false }]);
        setActiveQuickFilter("Etternavn A-Å");
        break;
      case "email":
        setSorting([{ id: "email", desc: false }]);
        setActiveQuickFilter("E-post A-Å");
        break;
      case "privilege":
        setSorting([{ id: "privilege_type", desc: true }]);
        setActiveQuickFilter("Høyeste tilgang først");
        break;
      default:
        setSorting([{ id: "created_at_sort", desc: true }]);
        table.getColumn("search")?.setFilterValue("");
        setActiveQuickFilter(null);
        break;
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
      if (preset === "visible") {
        setSelectionByRows(table.getRowModel().rows);
        return;
      }
      if (preset === "everyone") {
        setSelectionByRows(table.getPreFilteredRowModel().rows);
        return;
      }
      const sourceRows = table.getPreFilteredRowModel().rows;
      if (preset === "voluntary") {
        setSelectionByRows(
          sourceRows.filter((row) => isVoluntaryOrHigher(row.original.privilege_type)),
        );
        return;
      }
      setSelectionByRows(
        sourceRows.filter((row) => !isVoluntaryOrHigher(row.original.privilege_type)),
      );
    },
    [setSelectionByRows, table],
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative w-full max-w-xs">
            <Input
              placeholder={searchPlaceholder}
              value={(table.getColumn("search")?.getFilterValue() as string) ?? ""}
              onChange={(e) => table.getColumn("search")?.setFilterValue(e.target.value)}
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
                <DropdownMenuItem onSelect={(event) => { event.preventDefault(); applyQuickFilter("privilege"); }}>
                  Høyeste tilgang først
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={(event) => { event.preventDefault(); applyQuickFilter("lastname"); }}>
                  Etternavn A-Å
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={(event) => { event.preventDefault(); applyQuickFilter("email"); }}>
                  E-post A-Å
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
          {onRefresh ? (
            <Button size="sm" variant="outline" className="rounded-xl" onClick={onRefresh}>
              Oppdater
            </Button>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={selectionMode ? "secondary" : "outline"}
            className="rounded-xl"
            onClick={() => setSelectionMode((prev) => !prev)}
          >
            {selectionMode ? "Avslutt valg" : "Velg rader"}
          </Button>
          {toolbarActions}
        </div>
      </div>

      {hasSelection ? (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-background/60 px-3 py-2 text-sm">
          <span className="font-medium">{selectedMembers.length} valgt</span>
          {canEditPrivileges && onBulkPrivilege && bulkOptions && bulkOptions.length > 0 ? (
            <div className="flex items-center gap-2">
              <select
                className="h-8 rounded-xl border border-border/60 bg-background/60 px-2 text-xs"
                value={bulkPrivilege}
                onChange={(event) => setBulkPrivilege(event.target.value)}
              >
                {bulkOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl"
                disabled={!bulkPrivilege}
                onClick={async () => {
                  const next = Number(bulkPrivilege);
                  await onBulkPrivilege(selectedMembers, next);
                  table.resetRowSelection();
                }}
              >
                Oppdater tilgang
              </Button>
            </div>
          ) : null}
          {canManageMembership && onBulkMembershipStatus ? (
            <>
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl"
                onClick={async () => {
                  await onBulkMembershipStatus(selectedMembers, true);
                  table.resetRowSelection();
                }}
              >
                Sett aktiv
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl"
                onClick={async () => {
                  await onBulkMembershipStatus(selectedMembers, false);
                  table.resetRowSelection();
                }}
              >
                Sett inaktiv
              </Button>
            </>
          ) : null}
          {canResetPasswords && onBulkPasswordReset ? (
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl"
              onClick={async () => {
                await onBulkPasswordReset(selectedMembers);
                table.resetRowSelection();
              }}
            >
              Send passordlenke
            </Button>
          ) : null}
          {onBulkPrint ? (
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl"
              onClick={async () => {
                await onBulkPrint(selectedMembers);
                table.resetRowSelection();
              }}
            >
              Print kort
            </Button>
          ) : null}
          {canDelete && onBulkDelete ? (
            <Button
              size="sm"
              variant="destructive"
              className="rounded-xl"
              onClick={async () => {
                await onBulkDelete(selectedMembers);
                table.resetRowSelection();
              }}
            >
              Slett
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" className="rounded-xl" onClick={() => table.resetRowSelection()}>
            Nullstill valg
          </Button>
        </div>
      ) : null}
      {selectionMode && showSelectionQuickActions ? (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-background/40 px-3 py-2 text-xs">
          <span className="font-medium text-muted-foreground">Hurtigvalg</span>
          <Button size="sm" variant="outline" className="rounded-xl" onClick={() => quickSelect("voluntary")}>
            Velg alle frivillige
          </Button>
          <Button size="sm" variant="outline" className="rounded-xl" onClick={() => quickSelect("members")}>
            Velg alle medlemmer
          </Button>
          <Button size="sm" variant="outline" className="rounded-xl" onClick={() => quickSelect("visible")}>
            Velg synlige
          </Button>
          <Button size="sm" variant="outline" className="rounded-xl" onClick={() => quickSelect("everyone")}>
            Velg alle
          </Button>
        </div>
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
