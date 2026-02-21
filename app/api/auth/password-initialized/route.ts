/**
 * POST /api/auth/password-initialized
 * Marks the logged-in member as having initialized a password by
 * setting members.password_set_at to the current timestamp.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertPermission } from "@/lib/server/assert-permission";

export async function POST() {
  try {
    const permission = await assertPermission();
    if (!permission.ok) {
      return permission.response;
    }
    const { userId } = permission;

    const admin = createAdminClient();
    const { error } = await admin
      .from("members")
      .update({ password_set_at: new Date().toISOString() })
      .eq("id", userId);

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
