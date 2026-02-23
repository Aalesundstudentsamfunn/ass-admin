"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * Updates privilege_type for a single member row.
 */
export async function updateMemberPrivilege(memberId: string, nextPrivilege: number) {
  const supabase = createClient();
  return supabase
    .from("members")
    .update({ privilege_type: nextPrivilege })
    .eq("id", memberId);
}

/**
 * Updates privilege_type for many members in one query.
 */
export async function bulkUpdateMemberPrivilege(
  memberIds: string[],
  nextPrivilege: number,
) {
  const supabase = createClient();
  return supabase
    .from("members")
    .update({ privilege_type: nextPrivilege })
    .in("id", memberIds);
}

/**
 * Calls admin API to set active/inactive membership for multiple members.
 */
export async function updateMembershipStatus(
  memberIds: string[],
  isActive: boolean,
) {
  const response = await fetch("/api/admin/members/membership-status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ member_ids: memberIds, is_active: isActive }),
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

/**
 * Calls admin API to delete one or multiple members.
 */
export async function deleteMembers(memberIds: string[]) {
  const body =
    memberIds.length === 1
      ? { member_id: memberIds[0] }
      : { member_ids: memberIds };

  const response = await fetch("/api/admin/members/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

/**
 * Sends password reset link to one member email.
 */
export async function sendMemberPasswordReset(email: string) {
  return fetch("/api/admin/members/password-reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
}
