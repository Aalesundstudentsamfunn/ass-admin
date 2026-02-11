"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowUpDown, Trash2, Filter, Printer, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { enqueuePrinterQueue, watchPrinterQueueStatus } from "@/lib/printer-queue";
import { MEMBER_PAGE_SIZES, useMemberPageSizeDefault } from "@/lib/table-settings";
import { useCurrentPrivilege } from "@/lib/use-current-privilege";
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
  is_voluntary: boolean;
  added_by?: string | null;
  created_at?: string | null;
  profile_id?: string | null;
};

// ----- Liquid Glass primitives ----------------------------------------------
function Glass({ className = "", children }: React.PropsWithChildren<{ className?: string }>) {
  return <div className={cn("relative rounded-2xl border backdrop-blur-xl", "bg-white/65 border-white/50 shadow-[0_1px_0_rgba(255,255,255,0.6),0_10px_30px_-10px_rgba(16,24,40,0.25)]", "dark:bg-white/5 dark:border-white/10 dark:shadow-[0_1px_0_rgba(255,255,255,0.07),0_20px_60px_-20px_rgba(0,0,0,0.6)]", className)}>{children}</div>;
}

// ----- Columns ---------------------------------------------------------------
function buildColumns(
  onDelete: (id: string | number) => Promise<void>,
  isDeleting: boolean,
  onVoluntaryUpdated: (member: UserRow, next: boolean) => void,
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
      accessorKey: "id",
      header: ({ column }) => (
        <button className="inline-flex items-center gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          ID <ArrowUpDown className="h-3.5 w-3.5" />
        </button>
      ),
      cell: ({ row }) => <span className="font-medium">{row.getValue("id")}</span>,
      enableHiding: false,
      size: 80,
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
      accessorKey: "email",
      header: ({ column }) => (
        <button className="inline-flex items-center gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Email <ArrowUpDown className="h-3.5 w-3.5" />
        </button>
      ),
      cell: ({ row }) => (
        <a
          href={`mailto:${row.getValue("email")}`}
          className="underline-offset-2 hover:underline"
          onClick={(event) => event.stopPropagation()}
        >
          {row.getValue("email")}
        </a>
      ),
    },
    {
      accessorKey: "is_voluntary",
      header: ({ column }) => (
        <button className="inline-flex items-center gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Frivillig <ArrowUpDown className="h-3.5 w-3.5" />
        </button>
      ),
      cell: ({ row }) => {
        const member = row.original as UserRow;
        const isVoluntary = Boolean(member.is_voluntary);
        return (
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={async (event) => {
              event.stopPropagation();
              const supabase = createClient();
              const next = !isVoluntary;
              const toastId = toast.loading(next ? "Setter som frivillig..." : "Fjerner frivillig...", { duration: 10000 });
              const { data, error } = await supabase.rpc("set_user_voluntary", {
                p_user_id: null,
                p_email: member.email ?? null,
                p_voluntary: next,
              });

              if (error) {
                toast.error("Kunne ikke oppdatere frivillig-status.", {
                  id: toastId,
                  description: error.message,
                  duration: Infinity,
                });
                return;
              }

              if (data?.members_updated === 0) {
                toast.error("Kunne ikke oppdatere ass_members.", {
                  id: toastId,
                  description: "ass_members update affected 0 rows.",
                  duration: 10000,
                });
              } else {
                toast.success(next ? "Satt som frivillig." : "Fjernet som frivillig.", { id: toastId, duration: 6000 });
              }

              onVoluntaryUpdated(member, next);
            }}
            aria-pressed={isVoluntary}
            title={isVoluntary ? "Fjern frivillig" : "Gjør frivillig"}
          >
            <Heart className={cn("h-4 w-4", isVoluntary ? "fill-rose-500 text-rose-500" : "text-muted-foreground")} />
          </Button>
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
                  is_voluntary: user.is_voluntary,
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
}: {
  columns: ColumnDef<UserRow, unknown>[];
  data: UserRow[];
  defaultPageSize: number;
  onRowClick?: (member: UserRow) => void;
}) {
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "id", desc: true }]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({ search: false });
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
              className="rounded-xl bg-background/60"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              <Filter className="h-4 w-4" />
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CreateUserDialog />
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
                table.getRowModel().rows.map((row) => {
                  const member = row.original as UserRow;
                  return (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
                      onClick={() => onRowClick?.(member)}
                      onKeyDown={(event) => {
                        if (!onRowClick) {
                          return;
                        }
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onRowClick(member);
                        }
                      }}
                      tabIndex={onRowClick ? 0 : undefined}
                      aria-label={onRowClick ? `Vis detaljer for ${member.firstname} ${member.lastname}` : undefined}
                      className={cn(
                        onRowClick && "cursor-pointer hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: UserRow | null;
}) {
  const [addedByProfile, setAddedByProfile] = React.useState<AddedByProfile | null>(null);
  const [loadingAddedBy, setLoadingAddedBy] = React.useState(false);

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
        .from("profiles")
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
  const profileLink = member?.profile_id && member?.email ? `/dashboard/users?email=${encodeURIComponent(member.email)}` : null;

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
              <span className="text-muted-foreground">ID</span>
              <span className="font-medium">{member.id}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Navn</span>
              <span className="font-medium">{fullName || "—"}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">E-post</span>
              {member.email ? (
                <a href={`mailto:${member.email}`} className="font-medium underline-offset-2 hover:underline">
                  {member.email}
                </a>
              ) : (
                <span className="font-medium">—</span>
              )}
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Frivillig</span>
              <span className="font-medium">{member.is_voluntary ? "Ja" : "Nei"}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Registrert</span>
              <span className="font-medium">
                {profileLink ? (
                  <a href={profileLink} className="text-xs underline-offset-2 hover:underline">
                    Se profil
                  </a>
                ) : (
                  "Nei"
                )}
              </span>
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
  const currentPrivilege = useCurrentPrivilege();
  const canDeleteMembers = (currentPrivilege ?? 0) >= 4;

  // Update rows when initialData changes (after router.refresh())
  React.useEffect(() => {
    setRows(initialData);
  }, [initialData]);

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
            console.log("deleting..");
            console.log((await supabase.auth.getUser()).data.user?.email);
            const targetId = typeof id === "string" ? Number(id) : id;
            if (Number.isNaN(targetId)) {
              throw new Error("Invalid member id");
            }

            // Optimistically remove from UI
            setRows((prev) => prev.filter((row) => row.id !== id));

            const { error: deleteError, data } = await supabase.from("ass_members").delete().eq("id", targetId);
            if (deleteError) {
              throw new Error(deleteError.message);
            }
            console.log(data);
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
        (member, next) => {
          setRows((prev) =>
            prev.map((row) => (String(row.id) === String(member.id) ? { ...row, is_voluntary: next } : row)),
          );
          if (selectedMember && String(selectedMember.id) === String(member.id)) {
            setSelectedMember((prev) => (prev ? { ...prev, is_voluntary: next } : prev));
          }
        },
        canDeleteMembers,
      ),
    [supabase, isDeleting, router, initialData, selectedMember, canDeleteMembers],
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
      />
    </div>
  );
}
