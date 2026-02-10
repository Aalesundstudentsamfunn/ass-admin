import type { ReactNode } from "react";

import DashboardShell from "./dashboard-shell";
import { createClient } from "@/lib/supabase/server";

type CurrentUser = {
  name?: string | null;
  email?: string | null;
};

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  let currentUser: CurrentUser | null = null;
  const authUser = authData?.user;
  if (authUser) {
    const { data: profile } = await supabase.from("profiles").select("firstname, lastname, email").eq("id", authUser.id).single<{ firstname?: string | null; lastname?: string | null; email?: string | null }>();

    const name = [profile?.firstname ?? "", profile?.lastname ?? ""].join(" ").trim();
    const email = profile?.email ?? authUser.email ?? "";

    currentUser = {
      name: name || email || "Fant ikke bruker",
      email,
    };
  }

  return <DashboardShell currentUser={currentUser}>{children}</DashboardShell>;
}
