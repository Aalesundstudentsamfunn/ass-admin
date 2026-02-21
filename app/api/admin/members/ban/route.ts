/**
 * POST /api/admin/members/ban
 * Sets ban status for a member in Supabase Auth and mirrors to public.members.is_banned.
 * Access is restricted by shared assertPermission guard (requirement: banMembers).
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertPermission } from "@/lib/server/assert-permission";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const memberId = String(body?.member_id ?? "").trim();
    const nextBanned = body?.is_banned === false ? false : true;
    if (!memberId) {
      return NextResponse.json({ error: "Medlems-ID mangler." }, { status: 400 });
    }

    const permission = await assertPermission({ requirement: "banMembers" });
    if (!permission.ok) {
      return permission.response;
    }
    const { supabase, userId } = permission;

    if (nextBanned && userId === memberId) {
      return NextResponse.json({ error: "Du kan ikke utestenge deg selv." }, { status: 400 });
    }

    const { data: targetMember, error: targetError } = await supabase
      .from("members")
      .select("id, is_banned, is_membership_active")
      .eq("id", memberId)
      .single();

    if (targetError || !targetMember) {
      return NextResponse.json({ error: "Fant ikke medlem." }, { status: 404 });
    }

    if (targetMember.is_banned === nextBanned) {
      return NextResponse.json({ ok: true, unchanged: true });
    }

    const admin = createAdminClient();
    const { data: authUserData, error: authUserError } = await admin.auth.admin.getUserById(memberId);
    if (authUserError || !authUserData?.user) {
      return NextResponse.json({ error: authUserError?.message ?? "Fant ikke auth-bruker." }, { status: 404 });
    }

    const existingAppMetadata = authUserData.user.app_metadata ?? {};
    const { error: authUpdateError } = await admin.auth.admin.updateUserById(memberId, {
      // effectively permanent ban when true
      ban_duration: nextBanned ? "876000h" : "none",
      app_metadata: {
        ...existingAppMetadata,
        is_banned: nextBanned,
      },
    });

    if (authUpdateError) {
      return NextResponse.json({ error: authUpdateError.message }, { status: 400 });
    }

    const { error: memberUpdateError } = await supabase
      .from("members")
      .update({
        is_banned: nextBanned,
        ...(nextBanned ? { is_membership_active: false } : {}),
      })
      .eq("id", memberId);

    if (memberUpdateError) {
      // best-effort rollback in auth if DB update fails
      await admin.auth.admin.updateUserById(memberId, {
        ban_duration: targetMember.is_banned ? "876000h" : "none",
        app_metadata: existingAppMetadata,
      });
      await supabase
        .from("members")
        .update({
          is_banned: targetMember.is_banned ?? false,
          is_membership_active: targetMember.is_membership_active ?? true,
        })
        .eq("id", memberId);
      return NextResponse.json({ error: memberUpdateError.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, is_banned: nextBanned });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Ukjent feil" }, { status: 500 });
  }
}
