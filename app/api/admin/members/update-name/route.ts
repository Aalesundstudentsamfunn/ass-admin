/**
 * POST /api/admin/members/update-name
 * Updates a member's firstname/lastname in public.members and syncs auth user metadata.
 * Access is restricted by shared assertPermission guard (requirement: manageMembers).
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertPermission } from "@/lib/server/assert-permission";
import { logAdminAction } from "@/lib/server/admin-audit-log";

/**
 * Updates member name in `members` and mirrors metadata to the auth user.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const memberId = String(body?.id ?? "").trim();
    const firstname = String(body?.firstname ?? "").trim();
    const lastname = String(body?.lastname ?? "").trim();

    if (!memberId) {
      return NextResponse.json({ error: "Medlems-ID mangler." }, { status: 400 });
    }
    if (!firstname || !lastname) {
      return NextResponse.json({ error: "Fornavn og etternavn er påkrevd." }, { status: 400 });
    }

    const permission = await assertPermission({ requirement: "manageMembers" });
    if (!permission.ok) {
      return permission.response;
    }
    const { supabase, userId } = permission;

    const { data: existingMember, error: existingError } = await supabase
      .from("members")
      .select("id, firstname, lastname")
      .eq("id", memberId)
      .single();

    if (existingError || !existingMember) {
      return NextResponse.json({ error: "Fant ikke medlem." }, { status: 404 });
    }

    const { error: memberUpdateError } = await supabase
      .from("members")
      .update({ firstname, lastname })
      .eq("id", memberId);

    if (memberUpdateError) {
      await logAdminAction(supabase, {
        actorId: userId,
        action: "member.rename",
        targetTable: "members",
        targetId: memberId,
        status: "error",
        errorMessage: memberUpdateError.message,
        details: { firstname, lastname },
      });
      return NextResponse.json({ error: memberUpdateError.message }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: authUserData, error: authUserError } = await admin.auth.admin.getUserById(memberId);
    const existingMetadata = authUserData?.user?.user_metadata ?? {};
    const fullName = `${firstname} ${lastname}`.trim();

    if (authUserError) {
      await supabase
        .from("members")
        .update({
          firstname: existingMember.firstname,
          lastname: existingMember.lastname,
        })
        .eq("id", memberId);
      await logAdminAction(supabase, {
        actorId: userId,
        action: "member.rename",
        targetTable: "members",
        targetId: memberId,
        status: "error",
        errorMessage: authUserError.message,
        details: {
          firstname,
          lastname,
          rollback: "members.firstname/lastname restored",
        },
      });
      return NextResponse.json({ error: authUserError.message }, { status: 400 });
    }

    const { error: authUpdateError } = await admin.auth.admin.updateUserById(memberId, {
      user_metadata: {
        ...existingMetadata,
        firstname,
        lastname,
        full_name: fullName,
        display_name: fullName,
      },
    });

    if (authUpdateError) {
      await supabase
        .from("members")
        .update({
          firstname: existingMember.firstname,
          lastname: existingMember.lastname,
        })
        .eq("id", memberId);
      await logAdminAction(supabase, {
        actorId: userId,
        action: "member.rename",
        targetTable: "members",
        targetId: memberId,
        status: "error",
        errorMessage: authUpdateError.message,
        details: {
          firstname,
          lastname,
          rollback: "members.firstname/lastname restored",
        },
      });
      return NextResponse.json({ error: authUpdateError.message }, { status: 400 });
    }

    await logAdminAction(supabase, {
      actorId: userId,
      action: "member.rename",
      targetTable: "members",
      targetId: memberId,
      status: "ok",
      details: {
        previous_firstname: existingMember.firstname,
        previous_lastname: existingMember.lastname,
        firstname,
        lastname,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Ukjent feil" }, { status: 500 });
  }
}
