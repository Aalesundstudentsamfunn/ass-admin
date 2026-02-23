import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { canViewAuditLogs } from "@/lib/privilege-checks";
import { fetchAuditRows } from "@/lib/audit/rows";
import AuditLogsPage from "./_wrapped_page";

/**
 * Server route for the audit dashboard.
 *
 * Responsibilities:
 * - validate session and route-level access
 * - delegate audit data loading/mapping to shared audit domain helpers
 * - render the client table wrapper with preloaded rows
 */
export default async function AuditPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { data: me } = await supabase
    .from("members")
    .select("privilege_type")
    .eq("id", user.id)
    .maybeSingle();

  if (!canViewAuditLogs(me?.privilege_type)) {
    redirect("/dashboard/members");
  }

  const adminSupabase = createAdminClient();
  const { rows, errorMessage } = await fetchAuditRows(adminSupabase);
  if (errorMessage) {
    return <div>Error: {errorMessage}</div>;
  }

  return <AuditLogsPage initialData={rows} />;
}
