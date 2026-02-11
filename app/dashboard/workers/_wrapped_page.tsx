"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ArrowUpDown, Info, Filter } from "lucide-react"
import { cn } from "@/lib/utils"
import { MEMBER_PAGE_SIZES, useMemberPageSizeDefault } from "@/lib/table-settings"
import { createClient } from "@/lib/supabase/client"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { useCurrentPrivilege } from "@/lib/use-current-privilege"
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  ColumnFiltersState,
  VisibilityState,
} from "@tanstack/react-table"

/**
 * Liquid Glass Users Page
 * - Uses shadcn/ui + TanStack Table
 * - Columns: id, firstname, lastname, email
 * - Row actions: "Mer info" and Delete (red)
 * - Responsive + dark/light aware + liquid glass aesthetic
 */

// ----- Types -----------------------------------------------------------------
export type UserRow = {
  id: string | number
  firstname: string
  lastname: string
  email: string
  is_voluntary?: boolean | null
  privilege_type?: number | null
  added_by?: string | null
  created_at?: string | null
  profile_id?: string | null
}

const PILL_CLASS = "rounded-full px-2.5 py-0.5 text-xs font-medium"

async function copyToClipboard(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.success(`${label} kopiert.`)
  } catch {
    toast.error(`Kunne ikke kopiere ${label.toLowerCase()}.`)
  }
}

type AddedByProfile = {
  firstname?: string | null
  lastname?: string | null
  email?: string | null
}

function UserInfoDialog({
  user,
}: {
  user: UserRow
}) {
  const fullName = `${user.firstname ?? ""} ${user.lastname ?? ""}`.trim()
  const email = user.email ?? ""
  const [open, setOpen] = React.useState(false)
  const [addedByProfile, setAddedByProfile] = React.useState<AddedByProfile | null>(null)
  const [loadingAddedBy, setLoadingAddedBy] = React.useState(false)

  React.useEffect(() => {
    let active = true
    const load = async () => {
      if (!open || !user.added_by) {
        setAddedByProfile(null)
        return
      }
      setLoadingAddedBy(true)
      const supabase = createClient()
      const { data: profile } = await supabase
        .from("profiles")
        .select("firstname, lastname, email")
        .eq("id", user.added_by)
        .single<AddedByProfile>()
      if (!active) {
        return
      }
      setAddedByProfile(profile ?? null)
      setLoadingAddedBy(false)
    }

    load()

    return () => {
      active = false
    }
  }, [open, user.added_by])

  const addedByName = addedByProfile
    ? [addedByProfile.firstname ?? "", addedByProfile.lastname ?? ""].join(" ").trim()
    : ""
  const addedByLabel = addedByName || addedByProfile?.email || user.added_by || "—"
  const createdAtLabel = user.created_at ? new Date(user.created_at).toLocaleString() : "—"
  const profileLink = user.profile_id && email ? `/dashboard/users?email=${encodeURIComponent(email)}` : null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm" className="rounded-lg" onClick={(event) => event.stopPropagation()}>
          <Info className="mr-1 h-4 w-4" /> Mer info
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Detaljer</DialogTitle>
          <DialogDescription>Informasjon om frivillig.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">ID</span>
            <span className="font-medium">
              <span className="relative inline-flex items-center group">
                <button
                  type="button"
                  className="underline-offset-2 hover:underline"
                  onClick={(event) => {
                    event.stopPropagation()
                    copyToClipboard(String(user.id), "ID")
                  }}
                >
                  {user.id}
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
            {email ? (
              <span className="font-medium">
                <span className="relative inline-flex items-center group">
                  <button
                    type="button"
                    className="underline-offset-2 hover:underline"
                    onClick={(event) => {
                      event.stopPropagation()
                      copyToClipboard(email, "E-post")
                    }}
                  >
                    {email}
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
            <span className="text-muted-foreground">Lagt til av</span>
            <span className="font-medium">
              {loadingAddedBy
                ? "Laster..."
                : addedByLabel}
            </span>
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
            <span className="text-muted-foreground">Frivillig</span>
            <span className="font-medium">{user.is_voluntary ? "Ja" : "Nei"}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Opprettet</span>
            <span className="font-medium">{createdAtLabel}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function MemberDetailsDialog({
  open,
  onOpenChange,
  member,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: UserRow | null;
}) {
  const [addedByProfile, setAddedByProfile] = React.useState<AddedByProfile | null>(null)
  const [loadingAddedBy, setLoadingAddedBy] = React.useState(false)

  React.useEffect(() => {
    let active = true
    const load = async () => {
      if (!open || !member?.added_by) {
        setAddedByProfile(null)
        return
      }
      setLoadingAddedBy(true)
      const supabase = createClient()
      const { data: profile } = await supabase
        .from("profiles")
        .select("firstname, lastname, email")
        .eq("id", member.added_by)
        .single<AddedByProfile>()
      if (!active) {
        return
      }
      setAddedByProfile(profile ?? null)
      setLoadingAddedBy(false)
    }

    load()

    return () => {
      active = false
    }
  }, [open, member?.added_by])

  const fullName = member ? `${member.firstname ?? ""} ${member.lastname ?? ""}`.trim() : ""
  const addedByName = addedByProfile
    ? [addedByProfile.firstname ?? "", addedByProfile.lastname ?? ""].join(" ").trim()
    : ""
  const addedByLabel = addedByName || addedByProfile?.email || member?.added_by || "—"
  const createdAtLabel = member?.created_at ? new Date(member.created_at).toLocaleString() : "—"
  const profileLink = member?.profile_id && member?.email ? `/dashboard/users?email=${encodeURIComponent(member.email)}` : null

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
              <span className="font-medium">
                <span className="relative inline-flex items-center group">
                  <button
                    type="button"
                    className="underline-offset-2 hover:underline"
                    onClick={(event) => {
                      event.stopPropagation()
                      copyToClipboard(String(member.id), "ID")
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
                        event.stopPropagation()
                        copyToClipboard(member.email ?? "", "E-post")
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
  )
}

// ----- Liquid Glass primitives ----------------------------------------------
function Glass({ className = "", children }: React.PropsWithChildren<{ className?: string }>) {
  return (
    <div
      className={cn(
        "relative rounded-2xl border backdrop-blur-xl",
        "bg-white/65 border-white/50 shadow-[0_1px_0_rgba(255,255,255,0.6),0_10px_30px_-10px_rgba(16,24,40,0.25)]",
        "dark:bg-white/5 dark:border-white/10 dark:shadow-[0_1px_0_rgba(255,255,255,0.07),0_20px_60px_-20px_rgba(0,0,0,0.6)]",
        className,
      )}
    >
      {children}
    </div>
  )
}

// ----- Columns ---------------------------------------------------------------
function buildColumns(
): ColumnDef<UserRow, unknown>[] {
  return [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Velg alle"
        onClick={(event) => event.stopPropagation()}
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Velg rad"
        onClick={(event) => event.stopPropagation()}
      />
    ),
    enableSorting: false,
    enableHiding: false,
    size: 40,
  },
  {
    id: "search",
    accessorFn: (row: UserRow) => `${row.firstname ?? ""} ${row.lastname ?? ""} ${row.email ?? ""}`.trim(),
    filterFn: (row, columnId, value) => {
      const query = String(value ?? "").trim().toLowerCase()
      if (!query) {
        return true
      }
      const haystack = String(row.getValue(columnId) ?? "").toLowerCase()
      return haystack.includes(query)
    },
    enableSorting: false,
    enableHiding: true,
  },
  {
    accessorKey: "email",
    header: ({ column }) => (
      <button
        className="inline-flex items-center gap-1"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Email <ArrowUpDown className="h-3.5 w-3.5" />
      </button>
    ),
    cell: ({ row }) => (
      <span className="relative inline-flex items-center group">
        <button
          type="button"
          className="underline-offset-2 hover:underline"
          onClick={(event) => {
            event.stopPropagation()
            copyToClipboard(String(row.getValue("email") ?? ""), "E-post")
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
      <button
        className="inline-flex items-center gap-1"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        First name <ArrowUpDown className="h-3.5 w-3.5" />
      </button>
    ),
    cell: ({ row }) => <span>{row.getValue("firstname")}</span>,
  },
  {
    accessorKey: "lastname",
    header: ({ column }) => (
      <button
        className="inline-flex items-center gap-1"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Last name <ArrowUpDown className="h-3.5 w-3.5" />
      </button>
    ),
    cell: ({ row }) => <span>{row.getValue("lastname")}</span>,
  },
  {
    accessorKey: "is_voluntary",
    header: ({ column }) => (
      <button
        className="inline-flex items-center gap-1"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Frivillig <ArrowUpDown className="h-3.5 w-3.5" />
      </button>
    ),
    cell: ({ row }) => (
      <Badge variant="secondary" className={PILL_CLASS}>
        {row.getValue("is_voluntary") ? "Frivillig" : "Medlem"}
      </Badge>
    ),
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => {
      const user = row.original as UserRow
      return (
        <div className="flex items-center gap-2 justify-end">
          <UserInfoDialog user={user} />
        </div>
      )
    },
    enableHiding: false,
  },
  ]
}

// ----- DataTable -------------------------------------------------------------
function DataTable({
  columns,
  data,
  defaultPageSize,
  onRowClick,
  onBulkVoluntary,
}: {
  columns: ColumnDef<UserRow, unknown>[];
  data: UserRow[];
  defaultPageSize: number;
  onRowClick?: (member: UserRow) => void;
  onBulkVoluntary: (members: UserRow[], next: boolean) => Promise<void>;
}) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({ search: false })
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: defaultPageSize })
  const [rowSelection, setRowSelection] = React.useState<Record<string, boolean>>({})
  const pageSizeOptions = MEMBER_PAGE_SIZES

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
  })

  React.useEffect(() => {
    setPagination((prev) => ({ ...prev, pageSize: defaultPageSize, pageIndex: 0 }))
  }, [defaultPageSize])

  const selectedRows = table.getSelectedRowModel().rows
  const selectedMembers = selectedRows.map((row) => row.original as UserRow)
  const hasSelection = selectedMembers.length > 0
  const hasSearchFilter = Boolean(table.getColumn("search")?.getFilterValue())

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
        </div>
      </div>
      {hasSelection ? (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-background/60 px-3 py-2 text-sm">
          <span className="font-medium">{selectedMembers.length} valgt</span>
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl"
            onClick={async () => {
              await onBulkVoluntary(selectedMembers, false)
              table.resetRowSelection()
            }}
          >
            Fjern frivillig
          </Button>
          <Button size="sm" variant="ghost" className="rounded-xl" onClick={() => table.resetRowSelection()}>
            Nullstill valg
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
              const next = Number(e.target.value)
              if (Number.isNaN(next)) {
                return
              }
              table.setPageSize(next)
              table.setPageIndex(0)
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
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Forrige
          </Button>
          {/* Go to page input */}
          <span className="text-xs">Gå til side</span>
          <Input
            type="number"
            min={1}
            max={table.getPageCount()}
            value={table.getState().pagination.pageIndex + 1}
            onChange={e => {
              let page = Number(e.target.value) - 1;
              if (!isNaN(page)) {
                page = Math.max(0, Math.min(page, table.getPageCount() - 1));
                table.setPageIndex(page);
              }
            }}
            className="w-16 h-8 px-2 py-1 text-xs"
            style={{ fontVariantNumeric: "tabular-nums" }}
          />
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Neste
          </Button>
        </div>
      </div>
    </div>
  )
}


// ----- Page ------------------------------------------------------------------
export default function UsersPage({ initialData }: { initialData: UserRow[] }) {

  // If no data is provided, show a tiny demo set for layout/dev
  //get data from supabase
  const defaultPageSize = useMemberPageSizeDefault()
  const [rows] = React.useState<UserRow[]>(initialData)
  const [selectedMember, setSelectedMember] = React.useState<UserRow | null>(null)
  const [detailsOpen, setDetailsOpen] = React.useState(false)
  const currentPrivilege = useCurrentPrivilege()
  const canManageVoluntary = (currentPrivilege ?? 0) >= 2
  const columns = React.useMemo(
    () => buildColumns(),
    [],
  )
  const handleBulkVoluntary = React.useCallback(
    async (members: UserRow[], next: boolean) => {
      if (!members.length) {
        return
      }
      if (!canManageVoluntary) {
        toast.error("Du har ikke tilgang til å endre frivillig-status.")
        return
      }
      const toastId = toast.loading("Fjerner frivillige...", { duration: 10000 })
      const supabaseClient = createClient()
      let successCount = 0
      let errorCount = 0
      for (const member of members) {
        const { error } = await supabaseClient.rpc("set_user_voluntary", {
          p_user_id: null,
          p_email: member.email ?? null,
          p_voluntary: next,
        })
        if (error) {
          errorCount += 1
        } else {
          successCount += 1
        }
      }
      if (errorCount > 0) {
        toast.error("Kunne ikke oppdatere alle frivillige.", { id: toastId, duration: Infinity })
      } else {
        toast.success(`Oppdatert ${successCount} frivillige.`, { id: toastId, duration: 6000 })
      }
    },
    [canManageVoluntary],
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-balance">Frivillige i ÅSS</h1>
        <p className="text-muted-foreground text-pretty">Administrer aktive frivillige</p>
      </div>

      <Card className="border-0 bg-transparent shadow-none">
        <CardHeader className="px-0 pt-0">
          <CardTitle>Oversikt</CardTitle>
          <CardDescription>Sorter, filtrer og håndter frivillige</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <DataTable
            columns={columns}
            data={rows}
            defaultPageSize={defaultPageSize}
            onBulkVoluntary={handleBulkVoluntary}
            onRowClick={(member) => {
              setSelectedMember(member)
              setDetailsOpen(true)
            }}
          />
        </CardContent>
      </Card>
      <MemberDetailsDialog
        open={detailsOpen}
        onOpenChange={(open) => {
          setDetailsOpen(open)
          if (!open) {
            setSelectedMember(null)
          }
        }}
        member={selectedMember}
      />
    </div>
  )
}
