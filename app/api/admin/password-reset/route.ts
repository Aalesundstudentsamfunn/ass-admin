/**
 * POST /api/admin/password-reset
 * Sends a Supabase password reset email for the target member email.
 * Access is restricted to authenticated members with privilege_type >= 3.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canResetPasswords } from "@/lib/privilege-checks";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body?.email ?? "").trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ error: "E-post mangler." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return NextResponse.json({ error: "Mangler tilgang." }, { status: 401 });
    }

    const { data: me } = await supabase
      .from("members")
      .select("privilege_type")
      .eq("id", authData.user.id)
      .single();

    if (!canResetPasswords(me?.privilege_type)) {
      return NextResponse.json({ error: "Mangler tilgang." }, { status: 403 });
    }

    const admin = createAdminClient();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    const redirectTo = siteUrl ? `${siteUrl.replace(/\/$/, "")}/auth/callback?next=/auth/update-password` : undefined;

    const { error } = await admin.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Ukjent feil" }, { status: 500 });
  }
}
