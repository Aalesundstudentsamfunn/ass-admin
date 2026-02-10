"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowUpDown, Heart, Info, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { MEMBER_PAGE_SIZES, useMemberPageSizeDefault } from "@/lib/table-settings";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { ColumnDef, flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, SortingState, useReactTable, ColumnFiltersState, VisibilityState } from "@tanstack/react-table";

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
  is_voluntary?: boolean | null;
  privilege_type?: number | null;
};

const PRIVILEGE_OPTIONS = [
  { value: 1, label: "Medlem" },
  { value: 2, label: "Frivillig" },
  { value: 3, label: "Gruppeleder" },
  { value: 4, label: "Stortinget" },
  { value: 5, label: "IT" },
];

function formatSupabaseError(error: { message?: string; details?: string | null; hint?: string | null; code?: string | null } | null) {
  if (!error) {
    return "Ukjent feil.";
  }
  const parts = [error.message];
  if (error.code) {
    parts.push(`code=${error.code}`);
  }
  if (error.details) {
    parts.push(`details=${error.details}`);
  }
  if (error.hint) {
    parts.push(`hint=${error.hint}`);
  }
  return parts.filter(Boolean).join(" | ");
}

async function updateVoluntaryStatus(user: UserRow, next: boolean) {
  const email = String(user.email ?? "").trim();
  const supabase = createClient();
  const idValue = typeof user.id === "string" && user.id !== "" ? user.id : null;

  const { data, error } = await supabase.rpc("set_user_voluntary", {
    p_user_id: idValue,
    p_email: email || null,
    p_voluntary: next,
  });

  if (error) {
    return { ok: false, errorMessage: formatSupabaseError(error) };
  }

  const membersUpdated = typeof data?.members_updated === "number" ? data.members_updated : null;
  const warningMessage =
    membersUpdated === 0 ? "ass_members update affected 0 rows." : null;

  return { ok: true, warningMessage };
}

function VoluntaryHeartButton({ user, onVoluntaryUpdated }: { user: UserRow; onVoluntaryUpdated: (next: boolean) => void }) {
  const isVoluntary = Boolean(user.is_voluntary);
  const [isSaving, setIsSaving] = React.useState(false);
  const canToggle = Boolean(user.email);

  const handleToggle = async () => {
    if (isSaving || !canToggle) {
      return;
    }
    const next = !isVoluntary;
    const toastId = toast.loading(next ? "Setter som frivillig..." : "Fjerner frivillig...", { duration: 10000 });
    setIsSaving(true);

    const result = await updateVoluntaryStatus(user, next);
    if (!result.ok) {
      toast.error("Kunne ikke oppdatere frivillig-status.", { id: toastId, description: result.errorMessage, duration: Infinity });
      setIsSaving(false);
      return;
    }

    onVoluntaryUpdated(next);
    toast.success(next ? "Satt som frivillig." : "Fjernet som frivillig.", { id: toastId, duration: 6000 });
    if (result.warningMessage) {
      toast.error("Kunne ikke oppdatere ass_members.", { description: result.warningMessage, duration: 10000 });
    }
    setIsSaving(false);
  };

  return (
    <Button variant="ghost" size="icon" className="rounded-full" onClick={handleToggle} disabled={isSaving || !canToggle} aria-pressed={isVoluntary} title={isVoluntary ? "Fjern frivillig" : "Gjør frivillig"}>
      <Heart className={cn("h-4 w-4", isVoluntary ? "fill-rose-500 text-rose-500" : "text-muted-foreground")} />
    </Button>
  );
}

function UserInfoDialog({ user, onVoluntaryUpdated, onPrivilegeUpdated }: { user: UserRow; onVoluntaryUpdated: (next: boolean) => void; onPrivilegeUpdated: (next: number) => void }) {
  const fullName = `${user.firstname ?? ""} ${user.lastname ?? ""}`.trim();
  const email = user.email ?? "";
  const canToggle = Boolean(email);
  const hasIdentifier = Boolean(email || user.id);
  const [isSaving, setIsSaving] = React.useState(false);
  const [privilegeType, setPrivilegeType] = React.useState<number>(typeof user.privilege_type === "number" ? user.privilege_type : 1);

  React.useEffect(() => {
    if (typeof user.privilege_type === "number") {
      setPrivilegeType(user.privilege_type);
    }
  }, [user.privilege_type]);

  const handleToggleVoluntary = async (checked: boolean) => {
    const isVoluntary = Boolean(user.is_voluntary);
    if (isSaving || checked === isVoluntary) {
      return;
    }
    if (!canToggle) {
      toast.error("Mangler e-post for å oppdatere frivillig-status.");
      return;
    }

    const next = checked;
    const toastId = toast.loading(next ? "Setter som frivillig..." : "Fjerner frivillig...", { duration: 10000 });
    setIsSaving(true);

    const result = await updateVoluntaryStatus(user, next);
    if (!result.ok) {
      toast.error("Kunne ikke oppdatere frivillig-status.", { id: toastId, description: result.errorMessage, duration: Infinity });
      setIsSaving(false);
      return;
    }

    onVoluntaryUpdated(next);
    toast.success(next ? "Satt som frivillig." : "Fjernet som frivillig.", { id: toastId, duration: 6000 });
    if (result.warningMessage) {
      toast.error("Kunne ikke oppdatere ass_members.", { description: result.warningMessage, duration: 10000 });
    }
    setIsSaving(false);
  };

  const updatePrivilegeInTable = async (table: "profiles" | "ass_members", next: number) => {
    const supabase = createClient();
    const idValue = typeof user.id === "number" ? user.id : typeof user.id === "string" && user.id !== "" ? user.id : null;

    let result = null;
    let error = null;

    if (idValue !== null) {
      result = await supabase.from(table).update({ privilege_type: next }).eq("id", idValue).select("id, privilege_type");
      if (result.error) {
        error = result.error;
      } else if (result.data && result.data.length > 0) {
        return { ok: true };
      }
    }

    if (email) {
      result = await supabase.from(table).update({ privilege_type: next }).eq("email", email).select("id, privilege_type");
      if (result.error) {
        error = result.error;
      } else if (result.data && result.data.length > 0) {
        return { ok: true };
      }
    }

    return { ok: false, error };
  };

  const handlePrivilegeChange = async (value: string) => {
    const next = Number(value);
    if (!Number.isFinite(next) || next === privilegeType) {
      return;
    }
    if (!hasIdentifier) {
      toast.error("Mangler identifikator for å oppdatere tilgangsnivå.");
      return;
    }

    const toastId = toast.loading("Oppdaterer tilgangsnivå...", { duration: 10000 });
    setIsSaving(true);

    const profileUpdate = await updatePrivilegeInTable("profiles", next);
    const memberUpdate = await updatePrivilegeInTable("ass_members", next);
    const success = profileUpdate.ok || memberUpdate.ok;
    const errorMessage = profileUpdate.error?.message ?? memberUpdate.error?.message ?? "Kunne ikke oppdatere tilgangsnivå.";

    if (!success) {
      toast.error("Kunne ikke oppdatere tilgangsnivå.", { id: toastId, description: errorMessage, duration: Infinity });
      setIsSaving(false);
      return;
    }

    setPrivilegeType(next);
    onPrivilegeUpdated(next);
    toast.success("Tilgangsnivå oppdatert.", { id: toastId, duration: 6000 });
    setIsSaving(false);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm" className="rounded-lg">
          <Info className="mr-1 h-4 w-4" /> Mer info
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Detaljer</DialogTitle>
          <DialogDescription>Informasjon om brukeren.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">ID</span>
            <span className="font-medium">{user.id}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Navn</span>
            <span className="font-medium">{fullName || "—"}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">E-post</span>
            {email ? (
              <a href={`mailto:${email}`} className="font-medium underline-offset-2 hover:underline">
                {email}
              </a>
            ) : (
              <span className="font-medium">—</span>
            )}
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label className="text-muted-foreground" htmlFor={`privilege-${user.id}`}>
              Tilgangsnivå
            </Label>
            <select id={`privilege-${user.id}`} value={privilegeType} disabled={isSaving || !hasIdentifier} onChange={(event) => handlePrivilegeChange(event.target.value)} className="h-8 w-40 rounded-xl border border-border/60 bg-background/60 px-2 text-xs" style={{ fontVariantNumeric: "tabular-nums" }}>
              {PRIVILEGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label className="text-muted-foreground" htmlFor={`voluntary-${user.id}`}>
              Frivillig
            </Label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{Boolean(user.is_voluntary) ? "Ja" : "Nei"}</span>
              <Checkbox
                id={`voluntary-${user.id}`}
                checked={Boolean(user.is_voluntary)}
                disabled={isSaving || !canToggle}
                onCheckedChange={(checked) => {
                  if (checked === "indeterminate") {
                    return;
                  }
                  handleToggleVoluntary(Boolean(checked));
                }}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          {email ? (
            <Button asChild variant="secondary">
              <a href={`mailto:${email}`}>Send e-post</a>
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ----- Liquid Glass primitives ----------------------------------------------
function Glass({ className = "", children }: React.PropsWithChildren<{ className?: string }>) {
  return <div className={cn("relative rounded-2xl border backdrop-blur-xl", "bg-white/65 border-white/50 shadow-[0_1px_0_rgba(255,255,255,0.6),0_10px_30px_-10px_rgba(16,24,40,0.25)]", "dark:bg-white/5 dark:border-white/10 dark:shadow-[0_1px_0_rgba(255,255,255,0.07),0_20px_60px_-20px_rgba(0,0,0,0.6)]", className)}>{children}</div>;
}

// ----- Columns ---------------------------------------------------------------
function buildColumns(onVoluntaryUpdated: (user: UserRow, next: boolean) => void, onPrivilegeUpdated: (user: UserRow, next: number) => void): ColumnDef<UserRow, unknown>[] {
  return [
    {
      accessorKey: "email",
      header: ({ column }) => (
        <button className="inline-flex items-center gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Email <ArrowUpDown className="h-3.5 w-3.5" />
        </button>
      ),
      cell: ({ row }) => (
        <a href={`mailto:${row.getValue("email")}`} className="underline-offset-2 hover:underline">
          {row.getValue("email")}
        </a>
      ),
    },
    {
      accessorKey: "firstname",
      header: ({ column }) => (
        <button className="inline-flex items-center gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          First name <ArrowUpDown className="h-3.5 w-3.5" />
        </button>
      ),
      cell: ({ row }) => <span>{row.getValue("firstname")}</span>,
    },
    {
      accessorKey: "lastname",
      header: ({ column }) => (
        <button className="inline-flex items-center gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Last name <ArrowUpDown className="h-3.5 w-3.5" />
        </button>
      ),
      cell: ({ row }) => <span>{row.getValue("lastname")}</span>,
    },
    {
      accessorKey: "is_voluntary",
      header: ({ column }) => (
        <button className="inline-flex items-center gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Frivillig <ArrowUpDown className="h-3.5 w-3.5" />
        </button>
      ),
      cell: ({ row }) => {
        const user = row.original as UserRow;
        return <VoluntaryHeartButton user={user} onVoluntaryUpdated={(next) => onVoluntaryUpdated(user, next)} />;
      },
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const user = row.original as UserRow;
        return (
          <div className="flex items-center gap-2 justify-end">
            <UserInfoDialog user={user} onVoluntaryUpdated={(next) => onVoluntaryUpdated(user, next)} onPrivilegeUpdated={(next) => onPrivilegeUpdated(user, next)} />
          </div>
        );
      },
      enableHiding: false,
    },
  ];
}

// ----- DataTable -------------------------------------------------------------
function DataTable({ columns, data, defaultPageSize }: { columns: ColumnDef<UserRow, unknown>[]; data: UserRow[]; defaultPageSize: number }) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: defaultPageSize });
  const pageSizeOptions = MEMBER_PAGE_SIZES;

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

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative w-full max-w-xs">
            <Input placeholder="Søk e-post…" value={(table.getColumn("email")?.getFilterValue() as string) ?? ""} onChange={(e) => table.getColumn("email")?.setFilterValue(e.target.value)} className="rounded-xl bg-background/60" />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              <Filter className="h-4 w-4" />
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs">For å legge til bruker, be dem registrere seg i app eller på side.</span>
        </div>
      </div>

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
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="align-middle">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    Ingen resultater.
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
            style={{ fontVariantNumeric: "tabular-nums" }}>
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

// ----- Page ------------------------------------------------------------------
export default function UsersPage({ initialData }: { initialData: UserRow[] }) {
  // If no data is provided, show a tiny demo set for layout/dev
  //get data from supabase
  const defaultPageSize = useMemberPageSizeDefault();
  const [rows, setRows] = React.useState<UserRow[]>(initialData);
  const handleVoluntaryUpdated = React.useCallback((user: UserRow, next: boolean) => {
    setRows((prev) => prev.map((row) => (String(row.id) === String(user.id) ? { ...row, is_voluntary: next } : row)));
  }, []);
  const handlePrivilegeUpdated = React.useCallback((user: UserRow, next: number) => {
    setRows((prev) => prev.map((row) => (String(row.id) === String(user.id) ? { ...row, privilege_type: next } : row)));
  }, []);
  const columns = React.useMemo(() => buildColumns(handleVoluntaryUpdated, handlePrivilegeUpdated), [handleVoluntaryUpdated, handlePrivilegeUpdated]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-balance">Registrerte Brukere</h1>
        <p className="text-muted-foreground text-pretty">Administrer aktive brukere</p>
      </div>

      <Card className="border-0 bg-transparent shadow-none">
        <CardHeader className="px-0 pt-0">
          <CardTitle>Oversikt</CardTitle>
          <CardDescription>Sorter, filtrer og håndter brukere</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <DataTable columns={columns} data={rows} defaultPageSize={defaultPageSize} />
        </CardContent>
      </Card>
    </div>
  );
}
