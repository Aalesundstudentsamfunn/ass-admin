/**
 * POST /api/admin/password-reset
 * Sends a Supabase password reset email for the target member email.
 * Access is restricted by shared assertPermission guard (requirement: resetPasswords).
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertPermission } from "@/lib/server/assert-permission";
import { logAdminAction } from "@/lib/server/admin-audit-log";
import { getPasswordResetRedirectUrl } from "@/lib/auth/urls";

/**
 * Sends password reset emails for existing member accounts.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body?.email ?? "").trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ error: "E-post mangler." }, { status: 400 });
    }

    const permission = await assertPermission({ requirement: "resetPasswords" });
    if (!permission.ok) {
      return permission.response;
    }
    const { supabase, userId } = permission;

    const admin = createAdminClient();
    const redirectTo = getPasswordResetRedirectUrl();

    const { error } = await admin.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) {
      await logAdminAction(supabase, {
        actorId: userId,
        action: "member.password_reset.send",
        targetTable: "members",
        targetId: email,
        status: "error",
        errorMessage: error.message,
        details: { email },
      });
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    await logAdminAction(supabase, {
      actorId: userId,
      action: "member.password_reset.send",
      targetTable: "members",
      targetId: email,
      status: "ok",
      details: { email },
    });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Ukjent feil" }, { status: 500 });
  }
}
