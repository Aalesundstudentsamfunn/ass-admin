"use client"

import * as React from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
import { SupabaseClient } from "@supabase/supabase-js"
import { useEffect, useState } from "react"

type CertificateRow = {
  id: number
  created_at: string
  application_id: number | null
  holder: string | null
  type: { id: number; type: string } | null
  profiles: { id: string; firstname: string; lastname: string; email: string } | null
}

async function getCertificates(client: SupabaseClient) {
  const { data: rows, error } = await client
    .from("certificate")
    .select(`
      id,
      created_at,
      application_id,
      holder:profiles!holder ( id, firstname, lastname, email ),
      type:certificate_type!type ( id, type )
    `)
    .order("created_at", { ascending: true })

  if (error) {
    console.error("Supabase error:", error)
    return [] as CertificateRow[]
  }

  // Supabase may return relation fields as arrays; normalize them to single objects or null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- backend rows are untyped here; mapping to CertificateRow
  const normalized: CertificateRow[] = (rows || []).map((r: any) => ({
    id: r.id,
    created_at: r.created_at,
    application_id: r.application_id ?? null,
    holder: r.holder ?? null,
    profiles: Array.isArray(r.holder) ? (r.holder[0] ?? null) : (r.holder ?? null),
    type: Array.isArray(r.type) ? (r.type[0] ?? null) : (r.type ?? null),
  }))

  return normalized
}

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

function ActionsCell({ cert, table }: { cert: CertificateRow; table: unknown }) {
  const [open, setOpen] = useState(false)
  // Safely narrow the table.options.meta shape without using `any`
  const meta = (table as { options?: { meta?: { onDelete?: (id: number) => Promise<void> } } })?.options?.meta
  const onDelete = meta?.onDelete

  return (
    <div className="flex items-center justify-end gap-2">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="destructive" size="sm" className="rounded-lg">Slett</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bekreft sletting</DialogTitle>
            <DialogDescription>Er du sikker på at du vil slette sertifikat #{cert.id}? Dette kan ikke angres.</DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Avbryt</Button>
            <Button variant="destructive" size="sm" onClick={async () => { setOpen(false); if (onDelete) await onDelete(cert.id) }}>Slett</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

const Columns: ColumnDef<CertificateRow>[] = [
  {
    accessorKey: "id",
    header: () => <span>ID</span>,
    cell: ({ row }) => <span className="font-medium">{row.getValue("id")}</span>,
    enableHiding: false,
    size: 80,
  },
  {
    accessorKey: "profiles",
    header: () => <span>Holder</span>,
    cell: ({ row }) => {
      const p = row.getValue("profiles") as CertificateRow["profiles"]
      if (!p) return <span>—</span>
      return <span>{p.firstname} {p.lastname}</span>
    }
  },
  {
    accessorKey: "profiles",
    id: "email",
    header: () => <span>Email</span>,
    cell: ({ row }) => {
      const p = row.getValue("profiles") as CertificateRow["profiles"]
      if (!p || !p.email) return <span>—</span>
      return <a className="underline-offset-2 hover:underline" href={`mailto:${p.email}`}>{p.email}</a>
    }
  },
  {
    accessorKey: "type",
    header: () => <span>Type</span>,
    cell: ({ row }) => {
      const t = row.getValue("type") as CertificateRow["type"]
      return <span>{t?.type ?? "—"}</span>
    }
  },
  {
    accessorKey: "application_id",
    header: () => <span>Application</span>,
    cell: ({ row }) => {
      const appId = row.getValue("application_id") as number | null
      if (!appId) return <span>—</span>
      return (
        <a href={`/dashboard/certification-application#app-${appId}`} className="underline text-primary">
          {appId}
        </a>
      )
    }
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row, table }) => <ActionsCell cert={row.original} table={table} />
  }
]

function DataTable({ columns, data, onDelete }: { columns: ColumnDef<CertificateRow, CertificateRow>[]; data: CertificateRow[]; onDelete?: (id: number) => Promise<void> }) {
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
    meta: { onDelete },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  return (
    <div className="space-y-3">
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

export default function CertificationPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<CertificateRow[]>([])
  const [search, setSearch] = useState<string>("")

  useEffect(() => {
    let mounted = true
    const fetch = async () => {
      const data = await getCertificates(supabase)
      if (mounted) setRows(data)
    }
    fetch()
    return () => { mounted = false }
  }, [supabase])

  // client-side filter by firstname, lastname or email
  const filtered = React.useMemo(() => {
    const q = (search || "").trim().toLowerCase()
    if (!q) return rows
    return rows.filter(r => {
      const p = r.profiles
      if (!p) return false
      return (
        (p.firstname || "").toLowerCase().includes(q) ||
        (p.lastname || "").toLowerCase().includes(q) ||
        (p.email || "").toLowerCase().includes(q) ||
        (p.firstname + " " + p.lastname).toLowerCase().includes(q)
      )
    })
  }, [rows, search])

  async function handleDelete(id: number) {
    const applicationId = filtered.find(r => r.id === id)?.application_id || null
    let appError = null;
    if (applicationId !== null) {
      const { error: _error } = await supabase
        .from("certification_application")
        .delete()
        .eq("id", applicationId)
      if (_error) {
        appError = _error
      }
    }
    const { error } = await supabase
      .from("certificate")
      .delete()
      .eq("id", id)

    if (error) {
      console.error("Failed to delete certificate", error)
      return
    }

    if (appError) {
      console.error("Failed to delete søknad, må slettes manuelt!", appError)
    }

    setRows(prev => prev.filter(r => r.id !== id))
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Sertifikater</h1>
      <p className="text-sm text-muted-foreground mb-4">Oversikt over alle utstedte sertifikater. Klikk på Application for å gå til søknaden.</p>
      <Card className="border-0 bg-transparent shadow-none">
        <CardHeader className="px-0 pt-0">
          <CardTitle>Oversikt</CardTitle>
          <CardDescription>Sorter, søk og se sertifikater.</CardDescription>
          <div className="mb-4 max-w-sm">
            <Input placeholder="Søk navn eller e-post…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="px-0">
          <DataTable columns={Columns} data={filtered} onDelete={handleDelete} />
        </CardContent>
      </Card>
    </div>
  )
}
