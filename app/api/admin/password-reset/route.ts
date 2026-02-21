/**
 * POST /api/admin/password-reset
 * Sends a Supabase password reset email for the target member email.
 * Access is restricted by shared assertPermission guard (requirement: resetPasswords).
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertPermission } from "@/lib/server/assert-permission";

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
