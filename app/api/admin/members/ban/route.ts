/**
 * POST /api/admin/members/ban
 * Sets ban status for a member in Supabase Auth.
 * public.members.is_banned must be synced by DB trigger on auth.users.
 * Access is restricted by shared assertPermission guard (requirement: banMembers).
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertPermission } from "@/lib/server/assert-permission";
import { logAdminAction } from "@/lib/server/admin-audit-log";

/**
 * Applies ban/unban in Supabase Auth and verifies members-sync trigger output.
 */
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
      await logAdminAction(supabase, {
        actorId: userId,
        action: nextBanned ? "member.ban" : "member.unban",
        targetTable: "members",
        targetId: memberId,
        status: "error",
        errorMessage: authUpdateError.message,
        details: { member_id: memberId, next_banned: nextBanned },
      });
      return NextResponse.json({ error: authUpdateError.message }, { status: 400 });
    }

    const { data: syncedMember, error: syncedError } = await supabase
      .from("members")
      .select("is_banned, is_membership_active")
      .eq("id", memberId)
      .single();

    if (syncedError || !syncedMember) {
      await logAdminAction(supabase, {
        actorId: userId,
        action: nextBanned ? "member.ban" : "member.unban",
        targetTable: "members",
        targetId: memberId,
        status: "error",
        errorMessage:
          syncedError?.message ?? "Kunne ikke lese medlem etter auth-oppdatering.",
        details: { member_id: memberId, next_banned: nextBanned },
      });
      return NextResponse.json(
        { error: syncedError?.message ?? "Kunne ikke lese medlem etter auth-oppdatering." },
        { status: 500 },
      );
    }

    if (syncedMember.is_banned !== nextBanned) {
      await logAdminAction(supabase, {
        actorId: userId,
        action: nextBanned ? "member.ban" : "member.unban",
        targetTable: "members",
        targetId: memberId,
        status: "error",
        errorMessage:
          "Ban-status ble oppdatert i auth, men ikke synket til members. Sjekk triggeren på auth.users.",
        details: { member_id: memberId, next_banned: nextBanned },
      });
      return NextResponse.json(
        {
          error:
            "Ban-status ble oppdatert i auth, men ikke synket til members. Sjekk triggeren på auth.users.",
        },
        { status: 500 },
      );
    }

    await logAdminAction(supabase, {
      actorId: userId,
      action: nextBanned ? "member.ban" : "member.unban",
      targetTable: "members",
      targetId: memberId,
      status: "ok",
      details: {
        member_id: memberId,
        is_banned: syncedMember.is_banned === true,
        is_membership_active: syncedMember.is_membership_active,
      },
    });

    return NextResponse.json({
      ok: true,
      is_banned: syncedMember.is_banned === true,
      is_membership_active: syncedMember.is_membership_active,
      changed_from: {
        is_banned: targetMember.is_banned ?? false,
        is_membership_active: targetMember.is_membership_active ?? true,
      },
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Ukjent feil" }, { status: 500 });
  }
}
