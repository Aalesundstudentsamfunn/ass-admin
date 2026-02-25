"use client";

type ClientActionError = {
  message: string;
};

/**
 * Normalizes API error payloads to a stable `{ message }` shape.
 */
function toClientActionError(payload: unknown, fallback: string): ClientActionError {
  const maybePayload = payload as { error?: unknown } | null | undefined;
  const message =
    typeof maybePayload?.error === "string" && maybePayload.error.trim()
      ? maybePayload.error
      : fallback;
  return { message };
}

/**
 * Updates one member's privilege in `members`.
 */
export async function updateMemberPrivilege(memberId: string | number, nextPrivilege: number) {
  const response = await fetch("/api/admin/members/privilege", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ member_id: String(memberId), privilege_type: nextPrivilege }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      data: null,
      error: toClientActionError(payload, "Kunne ikke oppdatere tilgangsnivå."),
    };
  }
  return { data: payload, error: null };
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
