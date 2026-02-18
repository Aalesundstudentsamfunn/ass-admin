/**
 * POST /api/admin/members/membership-status
 * Updates is_membership_active for one or more members.
 * Access is restricted to authenticated members with privilege_type >= 4.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canManageMembershipStatus } from "@/lib/privilege-checks";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const isActive = Boolean(body?.is_active);
    const idsFromArray = Array.isArray(body?.member_ids)
      ? body.member_ids.map((value: unknown) => String(value ?? "").trim()).filter(Boolean)
      : [];
    const singleId = String(body?.member_id ?? "").trim();
    const memberIds = Array.from(new Set(singleId ? [singleId, ...idsFromArray] : idsFromArray));

    if (!memberIds.length) {
      return NextResponse.json({ error: "Medlems-ID mangler." }, { status: 400 });
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

    if (!canManageMembershipStatus(me?.privilege_type)) {
      return NextResponse.json({ error: "Mangler tilgang." }, { status: 403 });
    }

    const { error } = await supabase
      .from("members")
      .update({ is_membership_active: isActive })
      .in("id", memberIds);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, updated: memberIds.length });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Ukjent feil" }, { status: 500 });
  }
}
