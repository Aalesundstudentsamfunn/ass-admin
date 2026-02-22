"use client";

/**
 * Client-side helpers for persisted auto-print preference in member flows.
 */

import { getStoredSetting, setStoredSetting, useStoredSetting } from "@/lib/settings-storage";
import { AUTO_PRINT_DEFAULT, parseAutoPrint, serializeAutoPrint } from "@/lib/members/shared";

const AUTO_PRINT_KEY = "ass_admin_auto_print";

/**
 * Reads persisted auto-print setting from localStorage.
 */
export function getStoredAutoPrint(): boolean {
  return getStoredSetting(AUTO_PRINT_KEY, AUTO_PRINT_DEFAULT, parseAutoPrint);
}

/**
 * Persists auto-print setting in localStorage.
 */
export function setStoredAutoPrint(value: boolean) {
  setStoredSetting(AUTO_PRINT_KEY, value, serializeAutoPrint);
}

/**
 * React hook wrapper around auto-print setting storage.
 */
export function useAutoPrintSetting() {
  const { value: autoPrint, setValue } = useStoredSetting(AUTO_PRINT_KEY, AUTO_PRINT_DEFAULT, parseAutoPrint, serializeAutoPrint);

  return { autoPrint, setAutoPrint: setValue };
}
