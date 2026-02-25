"use client";

import { toast } from "sonner";
import {
  PRIVILEGE_LEVELS,
  PRIVILEGE_OPTIONS as SHARED_PRIVILEGE_OPTIONS,
} from "@/lib/privilege-config";

export type MemberRow = {
  id: string | number;
  firstname: string;
  lastname: string;
  email: string;
  added_by?: string | null;
  created_at?: string | null;
  profile_id?: string | null;
  privilege_type?: number | null;
  is_membership_active?: boolean | null;
  is_banned?: boolean | null;
  password_set_at?: string | null;
};

export type PrivilegeOption = {
  value: number;
  label: string;
};

export const PILL_CLASS = "rounded-full px-2.5 py-0.5 text-xs font-medium";

export const PRIVILEGE_OPTIONS: PrivilegeOption[] = SHARED_PRIVILEGE_OPTIONS;

const PRIVILEGE_LABELS = new Map(PRIVILEGE_OPTIONS.map((option) => [option.value, option.label]));

/**
 * Returns privilege label.
 *
 * How: Uses deterministic transforms over the provided inputs.
 * @returns unknown
 */
export function getPrivilegeLabel(value: number | null | undefined) {
  if (typeof value !== "number") {
    return "Ukjent";
  }
  return PRIVILEGE_LABELS.get(value) ?? `Nivå ${value}`;
}

/**
 * Returns privilege-specific pill classes used in member/frivillig tables.
 *
 * How: Keeps "Medlem" on the current neutral style and applies color accents for higher privileges.
 * @returns string
 */
export function getPrivilegePillClass(value: number | null | undefined) {
  if (value === PRIVILEGE_LEVELS.MEMBER || typeof value !== "number") {
    return PILL_CLASS;
  }
  if (value === PRIVILEGE_LEVELS.VOLUNTARY) {
    return `${PILL_CLASS} border-orange-300/70 bg-orange-100 text-orange-800 dark:border-orange-500/45 dark:bg-orange-500/20 dark:text-orange-200`;
  }
  if (value === PRIVILEGE_LEVELS.GROUP_LEADER) {
    return `${PILL_CLASS} border-sky-300/70 bg-sky-100 text-sky-800 dark:border-sky-500/45 dark:bg-sky-500/20 dark:text-sky-200`;
  }
  if (value === PRIVILEGE_LEVELS.STORTINGET) {
    return `${PILL_CLASS} border-violet-300/70 bg-violet-100 text-violet-800 dark:border-violet-500/45 dark:bg-violet-500/20 dark:text-violet-200`;
  }
  if (value === PRIVILEGE_LEVELS.IT) {
    return `${PILL_CLASS} border-rose-300/70 bg-rose-100 text-rose-800 dark:border-rose-500/45 dark:bg-rose-500/20 dark:text-rose-200`;
  }
  return PILL_CLASS;
}

/**
 * Returns assignable privilege options for the current user max level.
 * Voluntary-level (2-3) users only get the voluntary option.
 */
export function getBulkPrivilegeOptions(allowedMax: number | null) {
  if (allowedMax === null) {
    return [];
  }
  if (allowedMax === PRIVILEGE_LEVELS.VOLUNTARY) {
    return PRIVILEGE_OPTIONS.filter((option) => option.value === PRIVILEGE_LEVELS.VOLUNTARY);
  }
  return PRIVILEGE_OPTIONS.filter((option) => option.value <= allowedMax);
}

/**
 * Executes copy to clipboard logic.
 *
 * How: Encapsulates the operation in one reusable function.
 * @returns Promise<unknown>
 */
export async function copyToClipboard(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} kopiert.`);
  } catch {
    toast.error(`Kunne ikke kopiere ${label.toLowerCase()}.`);
  }
}
