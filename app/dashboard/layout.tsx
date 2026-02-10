import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import DashboardShell from "./DashboardShell"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect("/")
  }


  const { data: profile } = await supabase
    .from("profiles")
    .select("voluntary")
    .eq("id", user.id)
    .single()

  if (!profile?.voluntary) {
    redirect("/not-volunteer")
  }

  return <DashboardShell>{children}</DashboardShell>
}