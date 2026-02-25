import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashboardShell from "./DashboardShell";
import { canAccessDashboard } from "@/lib/privilege-checks";
import { PRIVILEGE_LEVELS } from "@/lib/privilege-config";

/**
 * Renders dashboard layout.
 *
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/");
  }

  const { data: member } = await supabase
    .from("members")
    .select("privilege_type, firstname, lastname, password_set_at")
    .eq("id", user.id)
    .single();

  if (!member?.password_set_at) {
    redirect("/auth/update-password");
  }

  const privilegeType = member?.privilege_type ?? PRIVILEGE_LEVELS.NONE;
  if (!canAccessDashboard(privilegeType)) {
    redirect("/utstyr");
  }

  const fullName = `${member?.firstname ?? ""} ${member?.lastname ?? ""}`.trim();
  const metaName = (user.user_metadata?.full_name ?? user.user_metadata?.name ?? "").trim();

  return (
    <DashboardShell
      dashboardSession={{
        userId: user.id,
        privilegeType,
        name: fullName || metaName || null,
        email: user.email,
      }}
    >
      {children}
    </DashboardShell>
  );
}
