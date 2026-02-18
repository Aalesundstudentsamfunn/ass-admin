/**
 * POST /api/admin/members/ban
 * Bans a member in Supabase Auth and mirrors status to public.members.is_banned.
 * Access is restricted to authenticated members with privilege_type >= 4.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canBanMembers } from "@/lib/privilege-checks";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const memberId = String(body?.member_id ?? "").trim();
    if (!memberId) {
      return NextResponse.json({ error: "Medlems-ID mangler." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return NextResponse.json({ error: "Mangler tilgang." }, { status: 401 });
    }

    if (authData.user.id === memberId) {
      return NextResponse.json({ error: "Du kan ikke banne deg selv." }, { status: 400 });
    }

    const { data: me } = await supabase
      .from("members")
      .select("privilege_type")
      .eq("id", authData.user.id)
      .single();

    if (!canBanMembers(me?.privilege_type)) {
      return NextResponse.json({ error: "Mangler tilgang." }, { status: 403 });
    }

    const { data: targetMember, error: targetError } = await supabase
      .from("members")
      .select("id, is_banned, is_membership_active")
      .eq("id", memberId)
      .single();

    if (targetError || !targetMember) {
      return NextResponse.json({ error: "Fant ikke medlem." }, { status: 404 });
    }

    if (targetMember.is_banned === true) {
      return NextResponse.json({ ok: true, already_banned: true });
    }

    const admin = createAdminClient();
    const { data: authUserData, error: authUserError } = await admin.auth.admin.getUserById(memberId);
    if (authUserError || !authUserData?.user) {
      return NextResponse.json({ error: authUserError?.message ?? "Fant ikke auth-bruker." }, { status: 404 });
    }

    const existingAppMetadata = authUserData.user.app_metadata ?? {};
    const { error: authUpdateError } = await admin.auth.admin.updateUserById(memberId, {
      // effectively permanent ban; adjust if you want timed bans later
      ban_duration: "876000h",
      app_metadata: {
        ...existingAppMetadata,
        is_banned: true,
      },
    });

    if (authUpdateError) {
      return NextResponse.json({ error: authUpdateError.message }, { status: 400 });
    }

    const { error: memberUpdateError } = await supabase
      .from("members")
      .update({ is_banned: true, is_membership_active: false })
      .eq("id", memberId);

    if (memberUpdateError) {
      // best-effort rollback in auth if DB update fails
      await admin.auth.admin.updateUserById(memberId, {
        ban_duration: "none",
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

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Ukjent feil" }, { status: 500 });
  }
}
