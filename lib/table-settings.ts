"use client";

/**
 * Shared library module.
 */

import { getStoredSetting, setStoredSetting, useStoredSetting } from "@/lib/settings-storage";

const MEMBER_PAGE_SIZE_KEY = "ass_admin_member_page_size";
export const MEMBER_PAGE_SIZES = [5, 10, 15, 25, 50, 75, 100] as const;
const MEMBER_PAGE_SIZE_DEFAULT = 10;

/**
 * Ensures page-size values always map to approved options.
 */
function clampPageSize(value: number) {
  if (!Number.isFinite(value)) {
    return MEMBER_PAGE_SIZE_DEFAULT;
  }
  const rounded = Math.round(value);
  return MEMBER_PAGE_SIZES.includes(rounded as (typeof MEMBER_PAGE_SIZES)[number])
    ? rounded
    : MEMBER_PAGE_SIZE_DEFAULT;
}

const parsePageSize = (raw: string) => clampPageSize(Number(raw));
const serializePageSize = (value: number) => String(clampPageSize(value));

/**
 * Reads persisted table page size from localStorage.
 */
export function getStoredMemberPageSize(): number {
  return getStoredSetting(MEMBER_PAGE_SIZE_KEY, MEMBER_PAGE_SIZE_DEFAULT, parsePageSize);
}

/**
 * Persists table page size in localStorage.
 */
export function setStoredMemberPageSize(value: number) {
  setStoredSetting(MEMBER_PAGE_SIZE_KEY, value, serializePageSize);
}

/**
 * React hook for reading/updating persisted table page size.
 */
export function useMemberPageSizeSetting() {
  const { value: pageSize, setValue } = useStoredSetting(
    MEMBER_PAGE_SIZE_KEY,
    MEMBER_PAGE_SIZE_DEFAULT,
    parsePageSize,
    serializePageSize,
  );

  const setPageSize = (value: number) => setValue(clampPageSize(value));

  return { pageSize, setPageSize };
}

/**
 * Lightweight read-only hook variant used when only default value is needed.
 */
export function useMemberPageSizeDefault() {
  const { value } = useStoredSetting(
    MEMBER_PAGE_SIZE_KEY,
    MEMBER_PAGE_SIZE_DEFAULT,
    parsePageSize,
    serializePageSize,
  );
  return value;
}
