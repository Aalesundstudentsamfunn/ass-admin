"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ArrowUpDown, Trash2, Filter, Printer, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { enqueuePrinterQueue, watchPrinterQueueStatus } from "@/lib/printer-queue";
import { MEMBER_PAGE_SIZES, useMemberPageSizeDefault } from "@/lib/table-settings";
import { useCurrentPrivilege } from "@/lib/use-current-privilege";
import {
  canAssignPrivilege,
  canDeleteMembers as canDeleteMembersByPrivilege,
  canEditMemberPrivileges,
  canManageMembers,
  canResetPasswords as canResetPasswordsByPrivilege,
  canSetOwnPrivilege,
  getMaxAssignablePrivilege,
} from "@/lib/privilege-checks";
import { ColumnDef, flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, SortingState, useReactTable, ColumnFiltersState, VisibilityState } from "@tanstack/react-table";
import { CreateUserDialog } from "@/components/add-new-member";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";

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
  added_by?: string | null;
  created_at?: string | null;
  profile_id?: string | null;
  privilege_type?: number | null;
  is_membership_active?: boolean | null;
  password_set_at?: string | null;
};

const PILL_CLASS = "rounded-full px-2.5 py-0.5 text-xs font-medium";
const PRIVILEGE_OPTIONS = [
  { value: 1, label: "Medlem" },
  { value: 2, label: "Frivillig" },
  { value: 3, label: "Gruppeleder" },
  { value: 4, label: "Stortinget" },
  { value: 5, label: "IT" },
];
const PRIVILEGE_LABELS = new Map(PRIVILEGE_OPTIONS.map((option) => [option.value, option.label]));
const getPrivilegeLabel = (value: number | null | undefined) => {
  if (typeof value !== "number") {
    return "Ukjent";
  }
  return PRIVILEGE_LABELS.get(value) ?? `Nivå ${value}`;
};

async function copyToClipboard(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} kopiert.`);
  } catch {
    toast.error(`Kunne ikke kopiere ${label.toLowerCase()}.`);
  }
}

// ----- Liquid Glass primitives ----------------------------------------------
function Glass({ className = "", children }: React.PropsWithChildren<{ className?: string }>) {
  return <div className={cn("relative rounded-2xl border backdrop-blur-xl", "bg-white/65 border-white/50 shadow-[0_1px_0_rgba(255,255,255,0.6),0_10px_30px_-10px_rgba(16,24,40,0.25)]", "dark:bg-white/5 dark:border-white/10 dark:shadow-[0_1px_0_rgba(255,255,255,0.07),0_20px_60px_-20px_rgba(0,0,0,0.6)]", className)}>{children}</div>;
}

// ----- Columns ---------------------------------------------------------------
function buildColumns(
  onDelete: (id: string | number) => Promise<void>,
  isDeleting: boolean,
  canEditPrivileges: boolean,
  bulkOptions: { value: number; label: string }[],
  onPrivilegeChange: (member: UserRow, next: number) => void,
  canDelete: boolean,
) {
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
      id: "created_at_sort",
      accessorKey: "created_at",
      sortingFn: (a, b) => {
        const aValue = new Date(String(a.getValue("created_at_sort") ?? "")).getTime();
        const bValue = new Date(String(b.getValue("created_at_sort") ?? "")).getTime();
        return aValue - bValue;
      },
      header: () => null,
      cell: () => null,
      enableHiding: true,
    },
    {
      accessorKey: "email",
      header: ({ column }) => (
        <button className="inline-flex items-center gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          E-post <ArrowUpDown className="h-3.5 w-3.5" />
        </button>
      ),
      cell: ({ row }) => (
        <span className="relative inline-flex items-center group">
          <button
            type="button"
            className="underline-offset-2 hover:underline"
            onClick={(event) => {
              event.stopPropagation();
              copyToClipboard(String(row.getValue("email") ?? ""), "E-post");
            }}
          >
            {row.getValue("email")}
          </button>
          <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground/90 px-2 py-1 text-[10px] text-background opacity-0 transition-opacity group-hover:opacity-100">
            Kopier
          </span>
        </span>
      ),
    },
    {
      accessorKey: "firstname",
      header: ({ column }) => (
        <button className="inline-flex items-center gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Fornavn <ArrowUpDown className="h-3.5 w-3.5" />
        </button>
      ),
      cell: ({ row }) => <span>{row.getValue("firstname")}</span>,
    },
    {
      accessorKey: "lastname",
      header: ({ column }) => (
        <button className="inline-flex items-center gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Etternavn <ArrowUpDown className="h-3.5 w-3.5" />
        </button>
      ),
      cell: ({ row }) => <span>{row.getValue("lastname")}</span>,
    },
    {
      accessorKey: "privilege_type",
      header: ({ column }) => (
        <button className="inline-flex items-center gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Tilgang <ArrowUpDown className="h-3.5 w-3.5" />
        </button>
      ),
      cell: ({ row }) => {
        const member = row.original as UserRow;
        const label = getPrivilegeLabel(row.getValue("privilege_type") as number | null);
        if (!canEditPrivileges) {
          return (
            <Badge variant="secondary" className={PILL_CLASS}>
              {label}
            </Badge>
          );
        }
        const options = bulkOptions.length ? bulkOptions : PRIVILEGE_OPTIONS;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex"
                onClick={(event) => event.stopPropagation()}
              >
                <Badge variant="secondary" className={`${PILL_CLASS} cursor-pointer`}>
                  {label}
                </Badge>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[10rem]">
              {options.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onSelect={(event) => {
                    event.preventDefault();
                    onPrivilegeChange(member, option.value);
                  }}
                >
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
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
              onClick={async (event) => {
                event.stopPropagation();
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
                  is_voluntary: (user.privilege_type ?? 1) >= 2,
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
            {canDelete ? (
              <Button
                variant="destructive"
                size="sm"
                className="rounded-lg"
                disabled={isDeleting}
                onClick={async (event) => {
                  event.stopPropagation();
                  onDelete(user.id);
                }}>
                <Trash2 className="mr-1 h-4 w-4" /> {isDeleting ? "Sletter..." : "Delete"}
              </Button>
            ) : null}
          </div>
        );
      },
      enableHiding: false,
    },
  ] as ColumnDef<UserRow, unknown>[];
}

// ----- DataTable -------------------------------------------------------------
function DataTable({
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
}: {
  columns: ColumnDef<UserRow, unknown>[];
  data: UserRow[];
  defaultPageSize: number;
  onRowClick?: (member: UserRow) => void;
  onBulkPrivilege: (members: UserRow[], next: number) => Promise<void>;
  onBulkMembershipStatus: (members: UserRow[], isActive: boolean) => Promise<void>;
  onBulkPasswordReset: (members: UserRow[]) => Promise<void>;
  onBulkPrint: (members: UserRow[]) => Promise<void>;
  onBulkDelete: (members: UserRow[]) => Promise<void>;
  canDelete: boolean;
  canManageMembership: boolean;
  canResetPasswords: boolean;
  canEditPrivileges: boolean;
  bulkOptions: { value: number; label: string }[];
  onRefresh: () => void;
}) {
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "created_at_sort", desc: true }]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({ search: false, created_at_sort: false });
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: defaultPageSize });
  const [rowSelection, setRowSelection] = React.useState<Record<string, boolean>>({});
  const [selectionMode, setSelectionMode] = React.useState(false);
  const pageSizeOptions = MEMBER_PAGE_SIZES;
  const [bulkPrivilege, setBulkPrivilege] = React.useState<string>("");
  const [activeQuickFilter, setActiveQuickFilter] = React.useState<string | null>(null);

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

  const searchParams = useSearchParams();
  const initializedFilter = React.useRef(false);

  React.useEffect(() => {
    if (initializedFilter.current) {
      return;
    }
    const emailParam = searchParams.get("email");
    if (emailParam) {
      table.getColumn("search")?.setFilterValue(emailParam);
    }
    initializedFilter.current = true;
  }, [searchParams, table]);

  React.useEffect(() => {
    setPagination((prev) => ({ ...prev, pageSize: defaultPageSize, pageIndex: 0 }));
  }, [defaultPageSize]);

  React.useEffect(() => {
    if (!selectionMode) {
      table.resetRowSelection();
    }
  }, [selectionMode, table]);

  React.useEffect(() => {
    if (!bulkPrivilege && bulkOptions.length > 0) {
      setBulkPrivilege(String(bulkOptions[0].value));
    }
  }, [bulkOptions, bulkPrivilege]);

  const selectedRows = table.getSelectedRowModel().rows;
  const selectedMembers = selectedRows.map((row) => row.original as UserRow);
  const hasSelection = selectedMembers.length > 0;
  const hasSearchFilter = Boolean(table.getColumn("search")?.getFilterValue());
  const isDefaultSort = sorting.length === 1 && sorting[0]?.id === "created_at_sort" && sorting[0]?.desc === true;

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
        setSelectionByRows(sourceRows.filter((row) => (row.original.privilege_type ?? 1) >= 2));
        return;
      }
      setSelectionByRows(sourceRows.filter((row) => (row.original.privilege_type ?? 1) < 2));
    },
    [setSelectionByRows, table],
  );

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
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl"
            onClick={onRefresh}
          >
            Oppdater
          </Button>
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
          <CreateUserDialog />
        </div>
      </div>
      {hasSelection ? (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-background/60 px-3 py-2 text-sm">
          <span className="font-medium">{selectedMembers.length} valgt</span>
          {canEditPrivileges && bulkOptions.length > 0 ? (
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
          {canManageMembership ? (
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
          {canResetPasswords ? (
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
          {canDelete ? (
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
      {selectionMode ? (
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
                table.getRowModel().rows.map((row) => {
                  const member = row.original as UserRow;
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
                        (selectionMode || onRowClick) && "cursor-pointer hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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

type AddedByProfile = {
  firstname?: string | null;
  lastname?: string | null;
  email?: string | null;
};

function MemberDetailsDialog({
  open,
  onOpenChange,
  member,
  currentUserId,
  currentUserPrivilege,
  onPrivilegeUpdated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: UserRow | null;
  currentUserId?: string | null;
  currentUserPrivilege?: number | null;
  onPrivilegeUpdated: (next: number) => void;
}) {
  const [addedByProfile, setAddedByProfile] = React.useState<AddedByProfile | null>(null);
  const [loadingAddedBy, setLoadingAddedBy] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    const load = async () => {
      if (!open || !member?.added_by) {
        setAddedByProfile(null);
        return;
      }
      setLoadingAddedBy(true);
      const supabase = createClient();
      const { data } = await supabase
        .from("members")
        .select("firstname, lastname, email")
        .eq("id", member.added_by)
        .single<AddedByProfile>();
      if (!active) {
        return;
      }
      setAddedByProfile(data ?? null);
      setLoadingAddedBy(false);
    };

    load();

    return () => {
      active = false;
    };
  }, [open, member?.added_by]);

  const fullName = member ? `${member.firstname ?? ""} ${member.lastname ?? ""}`.trim() : "";
  const addedByName = addedByProfile
    ? [addedByProfile.firstname ?? "", addedByProfile.lastname ?? ""].join(" ").trim()
    : "";

  const addedByLabel = addedByName || addedByProfile?.email || member?.added_by || "—";
  const createdAtLabel = member?.created_at ? new Date(member.created_at).toLocaleString() : "—";
  const passwordSetLabel = member?.password_set_at ? new Date(member.password_set_at).toLocaleString() : null;
  const currentPrivilege = typeof currentUserPrivilege === "number" ? currentUserPrivilege : null;
  const targetPrivilege = typeof member?.privilege_type === "number" ? member?.privilege_type : 1;
  const isSelf = Boolean(currentUserId && member?.id && String(currentUserId) === String(member.id));
  const canEditTarget = canEditMemberPrivileges(currentPrivilege);
  const allowedMax = getMaxAssignablePrivilege(currentPrivilege);
  const selectDisabled = !canEditTarget || isSaving || !member?.id;
  const allowedOptions =
    allowedMax === null ? [] : PRIVILEGE_OPTIONS.filter((option) => option.value <= allowedMax);

  const handlePrivilegeChange = async (value: string) => {
    if (!member) {
      return;
    }
    const next = Number(value);
    if (!Number.isFinite(next) || next === targetPrivilege) {
      return;
    }
    if (isSelf && !canSetOwnPrivilege(currentPrivilege, next)) {
      toast.error("Du kan ikke gi deg selv høyere tilgangsnivå.");
      return;
    }
    if (!canAssignPrivilege(currentPrivilege, next)) {
      toast.error("Ugyldig tilgangsnivå for din rolle.");
      return;
    }
    const supabase = createClient();
    const toastId = toast.loading("Oppdaterer tilgangsnivå...", { duration: 10000 });
    setIsSaving(true);
    const { error } = await supabase
      .from("members")
      .update({ privilege_type: next })
      .eq("id", member.id);
    if (error) {
      toast.error("Kunne ikke oppdatere tilgangsnivå.", {
        id: toastId,
        description: error.message,
        duration: Infinity,
      });
      setIsSaving(false);
      return;
    }
    onPrivilegeUpdated(next);
    toast.success("Tilgangsnivå oppdatert.", { id: toastId, duration: 6000 });
    setIsSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Medlemsdetaljer</DialogTitle>
          <DialogDescription>Informasjon om valgt medlem.</DialogDescription>
        </DialogHeader>
        {member ? (
          <div className="grid gap-2 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">UUID</span>
              <span className="font-medium">
                <span className="relative inline-flex items-center group">
                  <button
                    type="button"
                    className="underline-offset-2 hover:underline"
                    onClick={(event) => {
                      event.stopPropagation();
                      copyToClipboard(String(member.id), "UUID");
                    }}
                  >
                    {member.id}
                  </button>
                  <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground/90 px-2 py-1 text-[10px] text-background opacity-0 transition-opacity group-hover:opacity-100">
                    Kopier
                  </span>
                </span>
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Navn</span>
              <span className="font-medium">{fullName || "—"}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">E-post</span>
              {member.email ? (
                <span className="font-medium">
                  <span className="relative inline-flex items-center group">
                    <button
                      type="button"
                      className="underline-offset-2 hover:underline"
                      onClick={(event) => {
                        event.stopPropagation();
                        copyToClipboard(member.email ?? "", "E-post");
                      }}
                    >
                      {member.email}
                    </button>
                    <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground/90 px-2 py-1 text-[10px] text-background opacity-0 transition-opacity group-hover:opacity-100">
                      Kopier
                    </span>
                  </span>
                </span>
              ) : (
                <span className="font-medium">—</span>
              )}
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Tilgangsnivå</span>
              <select
                value={targetPrivilege}
                disabled={selectDisabled}
                onChange={(event) => handlePrivilegeChange(event.target.value)}
                className="h-8 w-40 rounded-xl border border-border/60 bg-background/60 px-2 text-xs"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {(allowedOptions.length ? allowedOptions : PRIVILEGE_OPTIONS).map((option) => (
                  <option key={option.value} value={option.value} disabled={!canEditTarget && option.value !== targetPrivilege}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Passord</span>
              <span className="font-medium">{passwordSetLabel ? `Satt (${passwordSetLabel})` : "Ikke satt"}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Lagt til av</span>
              <span className="font-medium">
                {loadingAddedBy ? "Laster..." : addedByLabel}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Opprettet</span>
              <span className="font-medium">{createdAtLabel}</span>
            </div>
            {!member.password_set_at && member.email ? (
              <div className="flex justify-end pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl"
                  onClick={async () => {
                    const toastId = toast.loading("Sender passordlenke...", { duration: 10000 });
                    try {
                      const res = await fetch("/api/admin/members/password-reset", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ email: member.email }),
                      });
                      if (!res.ok) {
                        const payload = await res.json().catch(() => ({}));
                        toast.error("Kunne ikke sende passordlenke.", {
                          id: toastId,
                          description: payload?.error ?? "Ukjent feil.",
                          duration: Infinity,
                        });
                        return;
                      }
                      toast.success("Passordlenke sendt.", { id: toastId, duration: 6000 });
                    } catch (error: unknown) {
                      toast.error("Kunne ikke sende passordlenke.", {
                        id: toastId,
                        description: error instanceof Error ? error.message : "Ukjent feil.",
                        duration: Infinity,
                      });
                    }
                  }}
                >
                  Send passordlenke
                </Button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">Ingen medlem valgt.</div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ----- Page ------------------------------------------------------------------
export default function UsersPage({ initialData }: { initialData: UserRow[] }) {
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);
  const defaultPageSize = useMemberPageSizeDefault();
  const [rows, setRows] = React.useState<UserRow[]>(initialData);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [selectedMember, setSelectedMember] = React.useState<UserRow | null>(null);
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);
  const currentPrivilege = useCurrentPrivilege();
  const canDeleteMembers = canDeleteMembersByPrivilege(currentPrivilege);
  const canManageMembership = canManageMembers(currentPrivilege);
  const canResetPasswords = canResetPasswordsByPrivilege(currentPrivilege);
  const canEditPrivileges = canEditMemberPrivileges(currentPrivilege);
  const allowedMax = getMaxAssignablePrivilege(currentPrivilege);
  const bulkOptions = React.useMemo(
    () => (allowedMax === null ? [] : PRIVILEGE_OPTIONS.filter((option) => option.value <= allowedMax)),
    [allowedMax],
  );

  // Update rows when initialData changes (after router.refresh())
  React.useEffect(() => {
    setRows(initialData);
  }, [initialData]);

  React.useEffect(() => {
    let active = true;
    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (!active) {
        return;
      }
      setCurrentUserId(data.user?.id ?? null);
    };
    loadUser();
    return () => {
      active = false;
    };
  }, [supabase]);

  const handleRowPrivilegeChange = React.useCallback(
    async (member: UserRow, next: number) => {
      const currentValue = typeof member.privilege_type === "number" ? member.privilege_type : 1;
      if (!Number.isFinite(next) || next === currentValue) {
        return;
      }
      if (!canEditPrivileges) {
        toast.error("Du har ikke tilgang til å endre tilgangsnivå.");
        return;
      }
      if (!canAssignPrivilege(currentPrivilege, next)) {
        toast.error("Ugyldig tilgangsnivå for din rolle.");
        return;
      }
      if (currentUserId && String(currentUserId) === String(member.id) && !canSetOwnPrivilege(currentPrivilege, next)) {
        toast.error("Du kan ikke gi deg selv høyere tilgangsnivå.");
        return;
      }

      const toastId = toast.loading("Oppdaterer tilgangsnivå...", { duration: 10000 });
      const supabaseClient = createClient();
      const { error } = await supabaseClient.from("members").update({ privilege_type: next }).eq("id", member.id);
      if (error) {
        toast.error("Kunne ikke oppdatere tilgangsnivå.", { id: toastId, description: error.message, duration: Infinity });
        return;
      }
      setRows((prev) => prev.map((row) => (String(row.id) === String(member.id) ? { ...row, privilege_type: next } : row)));
      setSelectedMember((prev) => (prev && String(prev.id) === String(member.id) ? { ...prev, privilege_type: next } : prev));
      toast.success("Tilgangsnivå oppdatert.", { id: toastId, duration: 6000 });
    },
    [canEditPrivileges, currentPrivilege, currentUserId],
  );

  const columns = React.useMemo(
    () =>
      buildColumns(
        async (id: string | number) => {
          const confirmed = window.confirm("Er du sikker på at du vil slette dette medlemmet?");
          if (!confirmed) {
            toast.message("Sletting avbrutt.", { duration: 10000 });
            return;
          }

          const toastId = toast.loading("Sletter medlem...", { duration: 10000 });
          setIsDeleting(true);
          try {
            const targetId = typeof id === "string" ? Number(id) : id;
            if (Number.isNaN(targetId)) {
              throw new Error("Invalid member id");
            }

            // Optimistically remove from UI
            setRows((prev) => prev.filter((row) => row.id !== id));

            const { error: deleteError } = await supabase.from("ass_members").delete().eq("id", targetId);
            if (deleteError) {
              throw new Error(deleteError.message);
            }
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
        },
        isDeleting,
        canEditPrivileges,
        bulkOptions,
        handleRowPrivilegeChange,
        canDeleteMembers,
      ),
    [supabase, isDeleting, router, initialData, canDeleteMembers, canEditPrivileges, bulkOptions, handleRowPrivilegeChange],
  );

  const handleBulkPrivilege = React.useCallback(
    async (members: UserRow[], next: number) => {
      if (!members.length) {
        return;
      }
      if (!canEditPrivileges) {
        toast.error("Du har ikke tilgang til å endre tilgangsnivå.");
        return;
      }
      if (!canAssignPrivilege(currentPrivilege, next)) {
        toast.error("Ugyldig tilgangsnivå for din rolle.");
        return;
      }
      const label = getPrivilegeLabel(next);
      const confirmed = window.confirm(`Oppdatere ${members.length} medlemmer til ${label}?`);
      if (!confirmed) {
        return;
      }
      const toastId = toast.loading("Oppdaterer tilgangsnivå...", { duration: 10000 });
      const ids = members.map((member) => String(member.id));
      const supabaseClient = createClient();
      const { error } = await supabaseClient.from("members").update({ privilege_type: next }).in("id", ids);

      if (error) {
        toast.error("Kunne ikke oppdatere tilgangsnivå.", {
          id: toastId,
          description: error.message,
          duration: Infinity,
        });
        return;
      }

      setRows((prev) =>
        prev.map((row) => (ids.includes(String(row.id)) ? { ...row, privilege_type: next } : row)),
      );
      setSelectedMember((prev) => (prev && ids.includes(String(prev.id)) ? { ...prev, privilege_type: next } : prev));
      toast.success("Tilgangsnivå oppdatert.", { id: toastId, duration: 6000 });
    },
    [canEditPrivileges, currentPrivilege],
  );

  const handleBulkMembershipStatus = React.useCallback(
    async (members: UserRow[], isActive: boolean) => {
      if (!members.length) {
        return;
      }
      if (!canManageMembership) {
        toast.error("Du har ikke tilgang til å endre medlemsstatus.");
        return;
      }

      const confirmed = window.confirm(
        `${isActive ? "Aktivere" : "Sette inaktivt"} medlemskap for ${members.length} medlemmer?`,
      );
      if (!confirmed) {
        return;
      }

      const ids = members.map((member) => String(member.id));
      const toastId = toast.loading("Oppdaterer medlemsstatus...", { duration: 10000 });
      const supabaseClient = createClient();
      const { error } = await supabaseClient
        .from("members")
        .update({ is_membership_active: isActive })
        .in("id", ids);

      if (error) {
        toast.error("Kunne ikke oppdatere medlemsstatus.", {
          id: toastId,
          description: error.message,
          duration: Infinity,
        });
        return;
      }

      setRows((prev) =>
        prev.map((row) =>
          ids.includes(String(row.id))
            ? { ...row, is_membership_active: isActive }
            : row,
        ),
      );
      setSelectedMember((prev) =>
        prev && ids.includes(String(prev.id))
          ? { ...prev, is_membership_active: isActive }
          : prev,
      );
      toast.success("Medlemsstatus oppdatert.", { id: toastId, duration: 6000 });
    },
    [canManageMembership],
  );

  const handleBulkPrint = React.useCallback(
    async (members: UserRow[]) => {
      if (!members.length) {
        return;
      }
      const confirmed = window.confirm(`Sende ${members.length} til utskriftskø?`);
      if (!confirmed) {
        return;
      }
      const toastId = toast.loading("Sender til utskriftskø...", { duration: 10000 });
      const supabaseClient = createClient();
      const { data: authData, error: authError } = await supabaseClient.auth.getUser();
      if (authError || !authData.user) {
        toast.error("Kunne ikke legge til i utskriftskø.", { id: toastId, description: "Prøv å logge inn på nytt.", duration: Infinity });
        return;
      }
      let successCount = 0;
      let errorCount = 0;
      for (const member of members) {
        const { error } = await enqueuePrinterQueue(supabaseClient, {
          firstname: member.firstname,
          lastname: member.lastname,
          email: member.email,
          ref: member.id,
          ref_invoker: authData.user.id,
          is_voluntary: (member.privilege_type ?? 1) >= 2,
        });
        if (error) {
          errorCount += 1;
        } else {
          successCount += 1;
        }
      }

      if (errorCount > 0) {
        toast.error("Kunne ikke sende alle til utskrift.", { id: toastId, duration: Infinity });
      } else {
        toast.success(`Sendt ${successCount} til utskriftskø.`, { id: toastId, duration: 6000 });
      }
    },
    [],
  );

  const handleBulkPasswordReset = React.useCallback(
    async (members: UserRow[]) => {
      if (!members.length) {
        return;
      }
      if (!canResetPasswords) {
        toast.error("Du har ikke tilgang til å sende passordlenker.");
        return;
      }

      const emails = Array.from(
        new Set(
          members
            .map((member) => member.email?.trim().toLowerCase())
            .filter((email): email is string => Boolean(email)),
        ),
      );

      if (!emails.length) {
        toast.error("Ingen gyldige e-poster valgt.");
        return;
      }

      const confirmed = window.confirm(`Sende passordlenke til ${emails.length} medlemmer?`);
      if (!confirmed) {
        return;
      }

      const toastId = toast.loading("Sender passordlenker...", { duration: 10000 });
      let successCount = 0;
      let errorCount = 0;

      for (const email of emails) {
        try {
          const response = await fetch("/api/admin/members/password-reset", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
          });
          if (!response.ok) {
            errorCount += 1;
            continue;
          }
          successCount += 1;
        } catch {
          errorCount += 1;
        }
      }

      if (errorCount > 0) {
        toast.error("Kunne ikke sende passordlenke til alle.", {
          id: toastId,
          description: `Sendt ${successCount} av ${emails.length}.`,
          duration: Infinity,
        });
        return;
      }

      toast.success(`Passordlenke sendt til ${successCount} medlemmer.`, { id: toastId, duration: 6000 });
    },
    [canResetPasswords],
  );

  const handleBulkDelete = React.useCallback(
    async (members: UserRow[]) => {
      if (!members.length) {
        return;
      }
      if (!canDeleteMembers) {
        toast.error("Du har ikke tilgang til å slette medlemmer.");
        return;
      }
      const confirmed = window.confirm(`Er du sikker på at du vil slette ${members.length} medlemmer?`);
      if (!confirmed) {
        return;
      }
      const ids = members
        .map((member) => (typeof member.id === "string" ? Number(member.id) : member.id))
        .filter((id) => Number.isFinite(id)) as number[];
      if (!ids.length) {
        toast.error("Ingen gyldige medlemmer valgt.");
        return;
      }
      const toastId = toast.loading("Sletter medlemmer...", { duration: 10000 });
      const supabaseClient = createClient();
      const { error } = await supabaseClient.from("ass_members").delete().in("id", ids);
      if (error) {
        toast.error("Kunne ikke slette medlemmer.", { id: toastId, description: error.message, duration: Infinity });
        return;
      }
      setRows((prev) => prev.filter((row) => !ids.includes(Number(row.id))));
      toast.success("Medlemmer slettet.", { id: toastId, duration: 6000 });
      router.refresh();
    },
    [canDeleteMembers, router],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-balance">Aktive ÅSS Medlemskap</h1>
        <p className="text-muted-foreground text-pretty">Administrer aktive medlemmer</p>
      </div>

      <Card className="border-0 bg-transparent shadow-none">
        <CardHeader className="px-0 pt-0">
          <CardTitle>Oversikt</CardTitle>
          <CardDescription>Sorter, filtrer og håndter medlemmer</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <DataTable
            columns={columns}
            data={rows}
            defaultPageSize={defaultPageSize}
            onBulkPrivilege={handleBulkPrivilege}
            onBulkMembershipStatus={handleBulkMembershipStatus}
            onBulkPasswordReset={handleBulkPasswordReset}
            onBulkPrint={handleBulkPrint}
            onBulkDelete={handleBulkDelete}
            canDelete={canDeleteMembers}
            canManageMembership={canManageMembership}
            canResetPasswords={canResetPasswords}
            canEditPrivileges={canEditPrivileges}
            bulkOptions={bulkOptions}
            onRefresh={() => router.refresh()}
            onRowClick={(member) => {
              setSelectedMember(member);
              setDetailsOpen(true);
            }}
          />
        </CardContent>
      </Card>
      <MemberDetailsDialog
        open={detailsOpen}
        onOpenChange={(open) => {
          setDetailsOpen(open);
          if (!open) {
            setSelectedMember(null);
          }
        }}
        member={selectedMember}
        currentUserId={currentUserId}
        currentUserPrivilege={currentPrivilege ?? null}
        onPrivilegeUpdated={(next) => {
          if (!selectedMember) {
            return;
          }
          setRows((prev) =>
            prev.map((row) =>
              String(row.id) === String(selectedMember.id) ? { ...row, privilege_type: next } : row,
            ),
          );
          setSelectedMember((prev) => (prev ? { ...prev, privilege_type: next } : prev));
        }}
      />
    </div>
  );
}
