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

/**
 * Converts unknown values to non-empty strings.
 *
 * How: Trims whitespace and returns `null` for non-strings/empty strings.
 * @returns string | null
 */
function asString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * Extracts unique `ref_invoker` ids from raw queue rows.
 *
 * How: Normalizes each id with `asString` and deduplicates with `Set`.
 * @returns string[]
 */
function extractInvokerIds(rows: PrinterQueueDbRow[]): string[] {
  return Array.from(
    new Set(
      rows
        .map((row) => asString(row.ref_invoker))
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

/**
 * Builds a lookup map from member id -> display label for queue table rendering.
 *
 * How: Prefers full name, then falls back to email, then "Ukjent".
 * @returns Map<string, string>
 */
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

/**
 * Normalizes one raw `printer_queue` row to UI shape.
 *
 * How: Converts nullable DB fields and resolves invoker display names via lookup map.
 * @returns PrinterLogRow
 */
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

/**
 * Loads queue entries, enriches invoker names, and renders the queue table page.
 *
 * How: Fetches `printer_queue`, joins invokers from `members`, then passes mapped rows to client table.
 */
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
