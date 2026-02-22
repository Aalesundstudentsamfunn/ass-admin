/**
 * Shared privilege helpers for client UX checks and lightweight API guards.
 * Note: DB RLS policies are still the source of truth, this is just UX feedback.
 */
import { PRIVILEGE_LEVELS, PRIVILEGE_REQUIREMENTS } from "@/lib/privilege-config";

/**
 * Normalizes nullable/invalid privilege values to a safe integer baseline (0).
 */
export function normalizePrivilege(value: number | null | undefined) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

/**
 * Returns a privilege value with a fallback when value is null/undefined.
 * Fallback for member rows where missing privilege should still map to a known baseline.
 */
export function privilegeOrDefault(
  value: number | null | undefined,
  fallback: number,
) {
  return typeof value === "number" ? value : fallback;
}

/**
 * Member-row helper: defaults missing privilege to MEMBER (1).
 */
export function memberPrivilege(value: number | null | undefined) {
  return privilegeOrDefault(value, PRIVILEGE_LEVELS.MEMBER);
}

/**
 * True when privilege is voluntary or higher.
 */
export function isVoluntaryOrHigher(value: number | null | undefined) {
  return memberPrivilege(value) >= PRIVILEGE_LEVELS.VOLUNTARY;
}

/**
 * Dashboard entry requires at least voluntary-level access.
 */
export function canAccessDashboard(value: number | null | undefined) {
  return normalizePrivilege(value) >= PRIVILEGE_REQUIREMENTS.dashboardAccess;
}

/**
 * Member management (create/activate) requires voluntary or higher.
 */
export function canManageMembers(value: number | null | undefined) {
  return normalizePrivilege(value) >= PRIVILEGE_REQUIREMENTS.manageMembers;
}

/**
 * Certificate management requires groupleader or higher.
 */
export function canManageCertificates(value: number | null | undefined) {
  return normalizePrivilege(value) >= PRIVILEGE_REQUIREMENTS.manageCertificates;
}

/**
 * Password reset action for other users is restricted to 3+.
 */
export function canResetPasswords(value: number | null | undefined) {
  return normalizePrivilege(value) >= PRIVILEGE_REQUIREMENTS.resetPasswords;
}

/**
 * Member deletion is restricted to admin roles.
 */
export function canDeleteMembers(value: number | null | undefined) {
  return normalizePrivilege(value) >= PRIVILEGE_REQUIREMENTS.deleteMembers;
}

/**
 * Membership active/inactive toggle is admin-only (4+).
 */
export function canManageMembershipStatus(value: number | null | undefined) {
  return normalizePrivilege(value) >= PRIVILEGE_REQUIREMENTS.manageMembershipStatus;
}

/**
 * Banning users is admin-only (4+).
 */
export function canBanMembers(value: number | null | undefined) {
  return normalizePrivilege(value) >= PRIVILEGE_REQUIREMENTS.banMembers;
}

/**
 * Audit log is admin-only (4+).
 */
export function canViewAuditLogs(value: number | null | undefined) {
  return normalizePrivilege(value) >= PRIVILEGE_REQUIREMENTS.viewAuditLogs;
}

/**
 * Membership status helper.
 * Membership is active only when the explicit flag is true.
 * No privilege-based fallback: access level and active membership are independent.
 */
export function isMembershipActive(activeFlag: boolean | null | undefined) {
  return activeFlag === true;
}

/**
 * Returns the highest privilege value the current user is allowed to assign.
 * - 5 can assign up to 5
 * - 4 can assign up to 4
 * - 2 and 3 can assign up to 2
 * - others cannot assign any privilege
 */
export function getMaxAssignablePrivilege(value: number | null | undefined) {
  const privilege = normalizePrivilege(value);
  if (privilege >= PRIVILEGE_LEVELS.IT) {
    return PRIVILEGE_LEVELS.IT;
  }
  if (privilege >= PRIVILEGE_LEVELS.STORTINGET) {
    return PRIVILEGE_LEVELS.STORTINGET;
  }
  if (
    privilege === PRIVILEGE_LEVELS.VOLUNTARY ||
    privilege === PRIVILEGE_LEVELS.GROUP_LEADER
  ) {
    return PRIVILEGE_LEVELS.VOLUNTARY;
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
 * - 5 can edit anyone
 * - 4 can edit up to 4
 * - 2 and 3 can only promote users below 2 up to 2
 */
export function canEditPrivilegeForTarget(
  currentPrivilege: number | null | undefined,
  targetPrivilege: number | null | undefined,
) {
  const current = normalizePrivilege(currentPrivilege);
  const target = normalizePrivilege(targetPrivilege);
  if (current >= PRIVILEGE_LEVELS.IT) {
    return true;
  }
  if (current >= PRIVILEGE_LEVELS.STORTINGET) {
    return target <= current;
  }
  if (
    current === PRIVILEGE_LEVELS.VOLUNTARY ||
    current === PRIVILEGE_LEVELS.GROUP_LEADER
  ) {
    return target < PRIVILEGE_LEVELS.VOLUNTARY;
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
  if (current >= PRIVILEGE_LEVELS.IT) {
    return true;
  }
  if (current >= PRIVILEGE_LEVELS.STORTINGET) {
    if (typeof targetPrivilege !== "number") {
      return true;
    }
    return normalizePrivilege(targetPrivilege) <= current;
  }
  if (
    current === PRIVILEGE_LEVELS.VOLUNTARY ||
    current === PRIVILEGE_LEVELS.GROUP_LEADER
  ) {
    if (typeof targetPrivilege !== "number") {
      return nextPrivilege === PRIVILEGE_LEVELS.VOLUNTARY;
    }
    return (
      normalizePrivilege(targetPrivilege) < PRIVILEGE_LEVELS.VOLUNTARY &&
      nextPrivilege === PRIVILEGE_LEVELS.VOLUNTARY
    );
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
