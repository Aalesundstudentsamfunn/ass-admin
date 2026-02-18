/**
 * Shared privilege helpers for client UX checks and lightweight API guards.
 * Note: DB RLS policies are still the source of truth, this is just UX feedback.
 */

/**
 * Normalizes nullable/invalid privilege values to a safe integer baseline (0).
 */
export function normalizePrivilege(value: number | null | undefined) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

/**
 * Dashboard entry requires at least frivillig-level access.
 */
export function canAccessDashboard(value: number | null | undefined) {
  return normalizePrivilege(value) >= 2;
}

/**
 * Member management (create/activate) requires frivillig or higher.
 */
export function canManageMembers(value: number | null | undefined) {
  return normalizePrivilege(value) >= 2;
}

/**
 * Certificate management requires group leader or higher.
 */
export function canManageCertificates(value: number | null | undefined) {
  return normalizePrivilege(value) >= 3;
}

/**
 * Password reset action for other users is restricted to 3+.
 */
export function canResetPasswords(value: number | null | undefined) {
  return normalizePrivilege(value) >= 3;
}

/**
 * Member deletion is restricted to top-level admin roles.
 */
export function canDeleteMembers(value: number | null | undefined) {
  return normalizePrivilege(value) >= 4;
}

/**
 * Membership is considered active when privilege is set to 1+.
 * (0/null means registered row exists but membership is inactive.)
 */
export function isMembershipActive(value: number | null | undefined) {
  return normalizePrivilege(value) >= 1;
}

/**
 * Returns the highest privilege value the current user is allowed to assign.
 * - 4+ can assign up to 5
 * - 2 can assign up to 2
 * - others cannot assign any privilege
 */
export function getMaxAssignablePrivilege(value: number | null | undefined) {
  const privilege = normalizePrivilege(value);
  if (privilege >= 4) {
    return 5;
  }
  if (privilege === 2) {
    return 2;
  }
  return null;
}

/**
 * Convenience check: true when user can edit privilege levels at all.
 */
export function canEditMemberPrivileges(value: number | null | undefined) {
  return getMaxAssignablePrivilege(value) !== null;
}

/**
 * Checks whether a specific target privilege can be assigned by current user.
 */
export function canAssignPrivilege(
  currentPrivilege: number | null | undefined,
  nextPrivilege: number,
) {
  const maxAllowed = getMaxAssignablePrivilege(currentPrivilege);
  return maxAllowed !== null && nextPrivilege <= maxAllowed;
}

/**
 * Users may only set their own privilege to <= current.
 */
export function canSetOwnPrivilege(
  currentPrivilege: number | null | undefined,
  nextPrivilege: number,
) {
  return nextPrivilege <= normalizePrivilege(currentPrivilege);
}
