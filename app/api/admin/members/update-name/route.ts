/**
 * POST /api/admin/members/update-name
 * Updates a member's firstname/lastname in public.members and syncs auth user metadata.
 * Access is restricted to authenticated members with privilege_type >= 2.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageMembers } from "@/lib/privilege-checks";

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

    if (!canManageMembers(me?.privilege_type)) {
      return NextResponse.json({ error: "Mangler tilgang." }, { status: 403 });
    }

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
