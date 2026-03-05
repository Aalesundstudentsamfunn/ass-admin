import { createClient } from "@/lib/supabase/server";
import DataTable from "./_wrapped_page";
import type { PrinterHealthRow, PrinterLogRow } from "./_wrapped_page";
import { normalizePrinterStatus, withDerivedPrinterHealth } from "@/components/queue/shared";
import { canManageMembers } from "@/lib/privilege-checks";

type PrinterQueueDbRow = {
  id: string | number | null;
  created_at: string | null;
  firstname: string | null;
  lastname: string | null;
  email: string | null;
  status: string | null;
  status_updated_at: string | null;
  attempt_count: number | null;
  printer_id: string | null;
  claimed_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  user_message_no: string | null;
  error_code: string | null;
  technical_error: string | null;
  ref: string | number | null;
  ref_invoker: string | null;
};

type PrinterStatusDbRow = {
  id: string | null;
  last_heartbeat: string | null;
  status: string | null;
  realtime_connected: boolean | null;
  mode: string | null;
  printer_connected: boolean | null;
  printer_state_reason: string | null;
  last_error: string | null;
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
  const normalizedStatus = normalizePrinterStatus(row.status);
  return {
    id: String(row.id ?? ""),
    created_at: typeof row.created_at === "string" ? row.created_at : null,
    firstname: row.firstname ?? "",
    lastname: row.lastname ?? "",
    email: row.email ?? "",
    status: normalizedStatus === "unknown" ? "queued" : normalizedStatus,
    status_updated_at:
      typeof row.status_updated_at === "string" ? row.status_updated_at : null,
    attempt_count:
      typeof row.attempt_count === "number" && Number.isFinite(row.attempt_count)
        ? row.attempt_count
        : 0,
    printer_id: typeof row.printer_id === "string" ? row.printer_id : null,
    claimed_at: typeof row.claimed_at === "string" ? row.claimed_at : null,
    started_at: typeof row.started_at === "string" ? row.started_at : null,
    finished_at: typeof row.finished_at === "string" ? row.finished_at : null,
    user_message_no: typeof row.user_message_no === "string" ? row.user_message_no : null,
    error_code: typeof row.error_code === "string" ? row.error_code : null,
    technical_error:
      typeof row.technical_error === "string" ? row.technical_error : null,
    ref: row.ref !== undefined && row.ref !== null ? String(row.ref) : null,
    ref_invoker: invokerId,
    ref_invoker_name: invokerId ? (invokerNameMap.get(invokerId) ?? null) : null,
  };
}

function normalizePrinterHealthRow(row: PrinterStatusDbRow | null): PrinterHealthRow | null {
  if (!row) {
    return null;
  }
  const mapped: PrinterHealthRow = {
    id: row.id ? String(row.id) : "printer",
    last_heartbeat:
      typeof row.last_heartbeat === "string" ? row.last_heartbeat : null,
    status: typeof row.status === "string" ? row.status : null,
    realtime_connected: row.realtime_connected === true,
    mode: typeof row.mode === "string" ? row.mode : null,
    printer_connected:
      typeof row.printer_connected === "boolean" ? row.printer_connected : null,
    printer_state_reason:
      typeof row.printer_state_reason === "string" ? row.printer_state_reason : null,
    last_error: typeof row.last_error === "string" ? row.last_error : null,
  };
  return withDerivedPrinterHealth(mapped);
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
    .select(
      [
        "id",
        "created_at",
        "firstname",
        "lastname",
        "email",
        "status",
        "status_updated_at",
        "attempt_count",
        "printer_id",
        "claimed_at",
        "started_at",
        "finished_at",
        "user_message_no",
        "error_code",
        "technical_error",
        "ref",
        "ref_invoker",
      ].join(", "),
    )
    .order("id", { ascending: false })
    .limit(1000);

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  const { data: healthData } = await supabase
    .from("printer_status")
    .select(
      "id, last_heartbeat, status, realtime_connected, mode, printer_connected, printer_state_reason, last_error",
    )
    .eq("id", "printer")
    .maybeSingle();

  const rows = ((data ?? []) as unknown) as PrinterQueueDbRow[];
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
  const printerHealth = normalizePrinterHealthRow(
    (healthData ?? null) as PrinterStatusDbRow | null,
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let canManageQueue = false;
  if (user?.id) {
    const { data: memberRow } = await supabase
      .from("members")
      .select("privilege_type")
      .eq("id", user.id)
      .maybeSingle();
    canManageQueue = canManageMembers(memberRow?.privilege_type);
  }

  return (
    <DataTable
      initialData={initialData}
      printerHealth={printerHealth}
      canManageQueue={canManageQueue}
    />
  );
}
