import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("privilege_type")
    .eq("id", authData.user.id)
    .single();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({ privilege_type: profileData?.privilege_type ?? null });
}
