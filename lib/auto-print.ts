"use client";

import { getStoredSetting, setStoredSetting, useStoredSetting } from "@/lib/settings-storage";

const AUTO_PRINT_KEY = "ass_admin_auto_print";
const AUTO_PRINT_DEFAULT = true;
const parseAutoPrint = (raw: string) => raw !== "false";
const serializeAutoPrint = (value: boolean) => (value ? "true" : "false");

export function getStoredAutoPrint(): boolean {
  return getStoredSetting(AUTO_PRINT_KEY, AUTO_PRINT_DEFAULT, parseAutoPrint);
}

export function setStoredAutoPrint(value: boolean) {
  setStoredSetting(AUTO_PRINT_KEY, value, serializeAutoPrint);
}

export function useAutoPrintSetting() {
  const { value: autoPrint, setValue } = useStoredSetting(AUTO_PRINT_KEY, AUTO_PRINT_DEFAULT, parseAutoPrint, serializeAutoPrint);

  return { autoPrint, setAutoPrint: setValue };
}
