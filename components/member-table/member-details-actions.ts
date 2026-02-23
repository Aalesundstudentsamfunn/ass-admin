"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * Updates one member's privilege in `members`.
 */
export async function updateMemberPrivilege(memberId: string | number, nextPrivilege: number) {
  const supabase = createClient();
  return supabase.from("members").update({ privilege_type: nextPrivilege }).eq("id", memberId);
}

/**
 * Calls API endpoint to update membership active status.
 */
export async function updateMemberMembershipStatus(
  memberId: string | number,
  isActive: boolean,
) {
  const response = await fetch("/api/admin/members/membership-status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ member_id: memberId, is_active: isActive }),
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

/**
 * Calls API endpoint to update member first/last name.
 */
export async function updateMemberName(
  memberId: string | number,
  firstname: string,
  lastname: string,
) {
  const response = await fetch("/api/admin/members/update-name", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: memberId, firstname, lastname }),
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

/**
 * Sends password reset link for a member email.
 */
export async function sendMemberPasswordReset(email: string) {
  const response = await fetch("/api/admin/members/password-reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

/**
 * Calls API endpoint to ban/unban member account.
 */
export async function updateMemberBanStatus(
  memberId: string | number,
  isBanned: boolean,
) {
  const response = await fetch("/api/admin/members/ban", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ member_id: memberId, is_banned: isBanned }),
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

