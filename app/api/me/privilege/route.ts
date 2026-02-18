/**
 * GET /api/me/privilege
 * Returns the logged-in member's privilege_type from public.members.
 * Used by client-side permission gating in the dashboard.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const { data: memberData, error: memberError } = await supabase
    .from("members")
    .select("privilege_type")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  return NextResponse.json({ privilege_type: memberData?.privilege_type ?? null });
}
