import { createClient } from "@/lib/supabase/server";
import DataTable from "./_wrapped_page";
import type { PrinterLogRow } from "./_wrapped_page";

type PrinterQueueDbRow = {
  id: string | number | null;
  created_at: string | null;
  firstname: string | null;
  lastname: string | null;
  email: string | null;
  completed: boolean | null;
  error_msg: string | null;
  ref: string | number | null;
  ref_invoker: string | null;
};

function asString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function extractInvokerIds(rows: PrinterQueueDbRow[]): string[] {
  return Array.from(
    new Set(
      rows
        .map((row) => asString(row.ref_invoker))
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

function buildInvokerNameMap(
  invokers: Array<{
    id: string;
    firstname: string | null;
    lastname: string | null;
    email: string | null;
  }>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const invoker of invokers) {
    const name = `${invoker.firstname ?? ""} ${invoker.lastname ?? ""}`.trim();
    map.set(invoker.id, name || invoker.email || "Ukjent");
  }
  return map;
}

function normalizePrinterQueueRow(
  row: PrinterQueueDbRow,
  invokerNameMap: Map<string, string>,
): PrinterLogRow {
  const invokerId = asString(row.ref_invoker);
  return {
    id: String(row.id ?? ""),
    created_at: typeof row.created_at === "string" ? row.created_at : null,
    firstname: row.firstname ?? "",
    lastname: row.lastname ?? "",
    email: row.email ?? "",
    completed: row.completed === true,
    error_msg: row.error_msg,
    ref: row.ref !== undefined && row.ref !== null ? String(row.ref) : null,
    ref_invoker: invokerId,
    ref_invoker_name: invokerId ? (invokerNameMap.get(invokerId) ?? null) : null,
  };
}

export default async function QueuePage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("printer_queue")
    .select("*")
    .order("id", { ascending: false })
    .limit(1000);

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  const rows = (data ?? []) as PrinterQueueDbRow[];
  const invokerIds = extractInvokerIds(rows);

  let invokerNameMap = new Map<string, string>();
  if (invokerIds.length > 0) {
    const { data: invokers } = await supabase
      .from("members")
      .select("id, firstname, lastname, email")
      .in("id", invokerIds);
    invokerNameMap = buildInvokerNameMap(invokers ?? []);
  }

  const initialData: PrinterLogRow[] = rows.map((row) =>
    normalizePrinterQueueRow(row, invokerNameMap),
  );

  return <DataTable initialData={initialData} />;
}
