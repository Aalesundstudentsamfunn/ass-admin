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
    .select("voluntary, firstname, lastname")
    .eq("id", user.id)
    .single()

  if (!profile?.voluntary) {
    redirect("/not-volunteer")
  }

  const fullName = `${profile?.firstname ?? ""} ${profile?.lastname ?? ""}`.trim()
  const metaName = (user.user_metadata?.full_name ?? user.user_metadata?.name ?? "").trim()

  return (
    <DashboardShell
      currentUser={{
        name: fullName || metaName || null,
        email: user.email,
      }}
    >
      {children}
    </DashboardShell>
  )
}
