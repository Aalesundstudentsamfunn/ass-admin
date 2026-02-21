/**
 * POST /api/admin/members/update-name
 * Updates a member's firstname/lastname in public.members and syncs auth user metadata.
 * Access is restricted by shared assertPermission guard (requirement: manageMembers).
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertPermission } from "@/lib/server/assert-permission";

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
    const { supabase } = permission;

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
      return NextResponse.json({ error: authUpdateError.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Ukjent feil" }, { status: 500 });
  }
}
