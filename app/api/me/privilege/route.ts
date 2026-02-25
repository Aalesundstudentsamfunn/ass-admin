/**
 * GET /api/me/privilege
 * Returns the logged-in member's privilege_type from public.members.
 * Used by client-side permission gating in the dashboard.
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/server/assert-permission";

/**
 * Resolves the caller's privilege level used by client-side UX guards.
 */
export async function GET() {
  const permission = await assertPermission();
  if (!permission.ok) {
    const status = permission.response.status === 401 ? 401 : 500;
    return NextResponse.json(
      { error: status === 401 ? "not_authenticated" : "failed_to_load_privilege" },
      { status },
    );
  }
  return NextResponse.json({ privilege_type: permission.privilege });
}
