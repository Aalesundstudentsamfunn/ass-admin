/**
 * POST /api/auth/password-initialized
 * Marks the logged-in member as having initialized a password by
 * setting members.password_set_at to the current timestamp.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Mangler tilgang." }, { status: 401 });
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from("members")
      .update({ password_set_at: new Date().toISOString() })
      .eq("id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ukjent feil" },
      { status: 500 },
    );
  }
}
