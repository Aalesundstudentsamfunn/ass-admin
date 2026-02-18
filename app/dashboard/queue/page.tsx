import { createClient } from "@/lib/supabase/server"
import DataTable from "./_wrapped_page"
import type { PrinterLogRow } from "./_wrapped_page"

export default async function QueuePage() {
  const supabase = await createClient()
  const { data: rows, error } = await supabase
    .from("printer_queue")
    .select("*")
    .order("id", { ascending: false })
    .limit(1000)

  if (error) {
    return <div>Error: {error?.message}</div>
  }

  const invokerIds = Array.from(
    new Set(
      (rows ?? [])
        .map((row: Record<string, unknown>) => {
          const value = row.ref_invoker
          return typeof value === "string" && value.trim() ? value.trim() : null
        })
        .filter((value): value is string => Boolean(value)),
    ),
  )

  const invokerNameMap = new Map<string, string>()
  if (invokerIds.length > 0) {
    const { data: invokers } = await supabase
      .from("members")
      .select("id, firstname, lastname, email")
      .in("id", invokerIds)

    for (const invoker of invokers ?? []) {
      const name = `${invoker.firstname ?? ""} ${invoker.lastname ?? ""}`.trim()
      invokerNameMap.set(invoker.id, name || invoker.email || "Ukjent")
    }
  }

  const initialData: PrinterLogRow[] = (rows ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.id ?? ""),
    created_at: typeof row.created_at === "string" ? row.created_at : null,
    firstname: typeof row.firstname === "string" ? row.firstname : "",
    lastname: typeof row.lastname === "string" ? row.lastname : "",
    email: typeof row.email === "string" ? row.email : "",
    completed: Boolean(row.completed),
    error_msg: typeof row.error_msg === "string" ? row.error_msg : null,
    ref: row.ref !== undefined && row.ref !== null ? String(row.ref) : null,
    ref_invoker: typeof row.ref_invoker === "string" ? row.ref_invoker : null,
    ref_invoker_name:
      typeof row.ref_invoker === "string" ? (invokerNameMap.get(row.ref_invoker) ?? null) : null,
  }))

  return <DataTable initialData={initialData} />
}
