/**
 * Shared privilege helpers for client UX checks and lightweight API guards.
 * Note: DB RLS policies are still the source of truth, this is just UX feedback.
 */

// TODO: Add RLS policies to the new member table.

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
 * Membership active/inactive toggle is admin-only (4+).
 */
export function canManageMembershipStatus(value: number | null | undefined) {
  return normalizePrivilege(value) >= 4;
}

/**
 * Banning users is admin-only (4+).
 */
export function canBanMembers(value: number | null | undefined) {
  return normalizePrivilege(value) >= 4;
}

/**
 * Membership status helper.
 * - Prefers explicit boolean flag when available (`is_membership_active`).
 * - Falls back to legacy privilege-based check (1+ => active).
 */
export function isMembershipActive(
  activeFlag: boolean | null | undefined,
  privilegeValue?: number | null | undefined,
) {
  if (typeof activeFlag === "boolean") {
    return activeFlag;
  }
  return normalizePrivilege(privilegeValue) >= 1;
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
 * Per-target edit check:
 * - 4+ can edit anyone
 * - 2 can only promote users below 2 up to 2
 */
export function canEditPrivilegeForTarget(
  currentPrivilege: number | null | undefined,
  targetPrivilege: number | null | undefined,
) {
  const current = normalizePrivilege(currentPrivilege);
  if (current >= 4) {
    return true;
  }
  if (current === 2) {
    return normalizePrivilege(targetPrivilege) < 2;
  }
  return false;
}

/**
 * Checks whether a specific target privilege can be assigned by current user.
 */
export function canAssignPrivilege(
  currentPrivilege: number | null | undefined,
  nextPrivilege: number,
  targetPrivilege?: number | null | undefined,
) {
  const current = normalizePrivilege(currentPrivilege);
  const maxAllowed = getMaxAssignablePrivilege(currentPrivilege);
  if (maxAllowed === null || nextPrivilege > maxAllowed) {
    return false;
  }
  if (current === 2) {
    return normalizePrivilege(targetPrivilege) < 2 && nextPrivilege === 2;
  }
  return true;
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
