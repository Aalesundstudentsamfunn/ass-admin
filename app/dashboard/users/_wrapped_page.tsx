"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowUpDown, Info, Trash2, Plus, Filter } from "lucide-react"
import { cn } from "@/lib/utils"
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
      const user = row.original
      return (
        <div className="flex items-center gap-2 justify-end">
          <Button variant="secondary" size="sm" className="rounded-lg">
            <Info className="mr-1 h-4 w-4" /> Mer info
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="rounded-lg"
            onClick={() => confirm(`Slette ${user.firstname} ${user.lastname}?`)}
          >
            <Trash2 className="mr-1 h-4 w-4" /> Delete
          </Button>
        </div>
      )
    },
    enableHiding: false,
  },
]

// ----- DataTable -------------------------------------------------------------
function DataTable({ columns, data }: { columns: ColumnDef<UserRow, UserRow>[]; data: UserRow[] }) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, columnVisibility },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel()
  })

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
          <Button className="rounded-xl">
            <Plus className="mr-1 h-4 w-4" /> Ny bruker
          </Button>
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
  const [rows] = React.useState<UserRow[]>(initialData)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-balance">Brukere de som har registrert seg på siden / aktive brukere</h1>
        <p className="text-muted-foreground text-pretty">Administrer aktive medlemmer i systemet.</p>
      </div>

      <Card className="border-0 bg-transparent shadow-none">
        <CardHeader className="px-0 pt-0">
          <CardTitle>Oversikt</CardTitle>
          <CardDescription>Sorter, filtrer og håndter brukere (de som har registrert seg på siden / aktive brukere).</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <DataTable columns={columns} data={rows} />
        </CardContent>
      </Card>
    </div>
  )
}
