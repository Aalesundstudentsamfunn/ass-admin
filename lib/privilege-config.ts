/**
 * Central privilege config used by both server guards and UI/business checks.
 * Keep all privilege numbers and requirement thresholds here.
 */

export const PRIVILEGE_LEVELS = {
  NONE: 0,
  MEMBER: 1,
  VOLUNTARY: 2,
  GROUP_LEADER: 3,
  STORTINGET: 4,
  IT: 5,
} as const;

export const PRIVILEGE_REQUIREMENTS = {
  dashboardAccess: PRIVILEGE_LEVELS.VOLUNTARY,
  manageMembers: PRIVILEGE_LEVELS.VOLUNTARY,
  manageCertificates: PRIVILEGE_LEVELS.GROUP_LEADER,
  resetPasswords: PRIVILEGE_LEVELS.GROUP_LEADER,
  deleteMembers: PRIVILEGE_LEVELS.STORTINGET,
  manageMembershipStatus: PRIVILEGE_LEVELS.STORTINGET,
  banMembers: PRIVILEGE_LEVELS.STORTINGET,
} as const;

export const PRIVILEGE_OPTIONS: { value: number; label: string }[] = [
  { value: PRIVILEGE_LEVELS.MEMBER, label: "Medlem" },
  { value: PRIVILEGE_LEVELS.VOLUNTARY, label: "Frivillig" },
  { value: PRIVILEGE_LEVELS.GROUP_LEADER, label: "Gruppeleder" },
  { value: PRIVILEGE_LEVELS.STORTINGET, label: "Stortinget" },
  { value: PRIVILEGE_LEVELS.IT, label: "IT" },
];
