"use client";

type ClientActionError = {
  message: string;
};

/**
 * Normalizes API error payloads to a shape compatible with existing callers.
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
 * Updates privilege_type for a single member row.
 */
export async function updateMemberPrivilege(memberId: string, nextPrivilege: number) {
  const response = await fetch("/api/admin/members/privilege", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ member_id: memberId, privilege_type: nextPrivilege }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { data: null, error: toClientActionError(payload, "Kunne ikke oppdatere tilgangsnivå.") };
  }
  return { data: payload, error: null };
}

/**
 * Updates privilege_type for many members in one query.
 */
export async function bulkUpdateMemberPrivilege(
  memberIds: string[],
  nextPrivilege: number,
) {
  const response = await fetch("/api/admin/members/privilege", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ member_ids: memberIds, privilege_type: nextPrivilege }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { data: null, error: toClientActionError(payload, "Kunne ikke oppdatere tilgangsnivå.") };
  }
  return { data: payload, error: null };
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

/**
 * Generates and sends one-time passwords for selected members.
 */
export async function sendBulkTemporaryPasswords(memberIds: string[]) {
  const response = await fetch("/api/admin/members/password-bootstrap", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ member_ids: memberIds }),
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}
