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
