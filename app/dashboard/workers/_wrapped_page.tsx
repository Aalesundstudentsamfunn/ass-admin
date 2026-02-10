"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ArrowUpDown, Info, Filter } from "lucide-react"
import { cn } from "@/lib/utils"
import { MEMBER_PAGE_SIZES, useMemberPageSizeDefault } from "@/lib/table-settings"
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
}

function UserInfoDialog({ user }: { user: UserRow }) {
  const fullName = `${user.firstname ?? ""} ${user.lastname ?? ""}`.trim()
  const email = user.email ?? ""

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
          <DialogDescription>Informasjon om frivillig.</DialogDescription>
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
export const columns: ColumnDef<UserRow>[] = [
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
      <a href={`mailto:${row.getValue("email")}`} className="underline-offset-2 hover:underline">
        {row.getValue("email")}
      </a>
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

// ----- DataTable -------------------------------------------------------------
function DataTable({ columns, data, defaultPageSize }: { columns: ColumnDef<UserRow, UserRow>[]; data: UserRow[]; defaultPageSize: number }) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: defaultPageSize })
  const pageSizeOptions = MEMBER_PAGE_SIZES

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
    getPaginationRowModel: getPaginationRowModel()
  })

  React.useEffect(() => {
    setPagination((prev) => ({ ...prev, pageSize: defaultPageSize, pageIndex: 0 }))
  }, [defaultPageSize])

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative w-full max-w-xs">
            <Input
              placeholder="Søk e-post…"
              value={(table.getColumn("email")?.getFilterValue() as string) ?? ""}
              onChange={(e) => table.getColumn("email")?.setFilterValue(e.target.value)}
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
          <DataTable columns={columns} data={rows} defaultPageSize={defaultPageSize} />
        </CardContent>
      </Card>
    </div>
  )
}
