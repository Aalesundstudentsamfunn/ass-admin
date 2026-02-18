"use client";

import { toast } from "sonner";

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

export const PRIVILEGE_OPTIONS: PrivilegeOption[] = [
  { value: 1, label: "Medlem" },
  { value: 2, label: "Frivillig" },
  { value: 3, label: "Gruppeleder" },
  { value: 4, label: "Stortinget" },
  { value: 5, label: "IT" },
];

const PRIVILEGE_LABELS = new Map(PRIVILEGE_OPTIONS.map((option) => [option.value, option.label]));

export function getPrivilegeLabel(value: number | null | undefined) {
  if (typeof value !== "number") {
    return "Ukjent";
  }
  return PRIVILEGE_LABELS.get(value) ?? `Nivå ${value}`;
}

export async function copyToClipboard(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} kopiert.`);
  } catch {
    toast.error(`Kunne ikke kopiere ${label.toLowerCase()}.`);
  }
}
