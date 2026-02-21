/**
 * POST /api/admin/members/membership-status
 * Updates is_membership_active for one or more members.
 * Access is restricted by shared assertPermission guard (requirement: manageMembershipStatus).
 */
import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/server/assert-permission";

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

    const permission = await assertPermission({ requirement: "manageMembershipStatus" });
    if (!permission.ok) {
      return permission.response;
    }
    const { supabase } = permission;

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
