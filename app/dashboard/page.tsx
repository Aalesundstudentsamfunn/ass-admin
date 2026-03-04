/**
 * Dashboard landing route that loads overview statistics and renders the home view.
 */
import { createClient } from "@/lib/supabase/server";
import Landing from "./_wrapped_page";
import { withDerivedPrinterHealth, type PrinterHealthRow } from "@/components/queue/shared";
import { ActionsProvider } from "@/app/dashboard/members/providers";
import {
  addNewMember,
  activateMember,
  checkMemberEmail,
} from "@/app/dashboard/members/server/actions";

export default async function Page() {
  const supabase = await createClient();
  const { data: rows, error } = await supabase.rpc("volunteer_stats");
  if (error) {
    return <div>Error: {error?.message}</div>;
  }

  const { data: healthData } = await supabase
    .from("printer_status")
    .select(
      "id, last_heartbeat, status, realtime_connected, mode, printer_connected, printer_state_reason, last_error",
    )
    .eq("id", "printer")
    .maybeSingle();

  const rawPrinterHealth: PrinterHealthRow | null = healthData
    ? {
        id: String(healthData.id ?? "printer"),
        last_heartbeat:
          typeof healthData.last_heartbeat === "string"
            ? healthData.last_heartbeat
            : null,
        status: typeof healthData.status === "string" ? healthData.status : null,
        realtime_connected: healthData.realtime_connected === true,
        mode: typeof healthData.mode === "string" ? healthData.mode : null,
        printer_connected:
          typeof healthData.printer_connected === "boolean"
            ? healthData.printer_connected
            : null,
        printer_state_reason:
          typeof healthData.printer_state_reason === "string"
            ? healthData.printer_state_reason
            : null,
        last_error:
          typeof healthData.last_error === "string" ? healthData.last_error : null,
      }
    : null;
  const printerHealth = withDerivedPrinterHealth(rawPrinterHealth);

  return (
    <ActionsProvider
      addNewMember={addNewMember}
      checkMemberEmail={checkMemberEmail}
      activateMember={activateMember}
    >
      <Landing
        initialData={rows ?? []}
        printerHealth={printerHealth}
      />
    </ActionsProvider>
  );
}
