// app/dashboard/layout.tsx (SERVER)
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import DashboardShell from "./DashboardShell"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user?.id) redirect("/")

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("voluntary")
    .eq("id", session.user.id)
    .single()

  if (error || !profile?.voluntary) redirect("/")

  return <DashboardShell>{children}</DashboardShell>
}