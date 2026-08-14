/**
 * Shape of a members-list request, shared by the table UI and the server that answers it.
 *
 * The table is paginated in the database rather than in the browser, so every filter,
 * sort and search term the user picks has to survive the trip to a server action.
 * `normalizeMemberQuery` is the trust boundary: values arrive from a client component
 * and are clamped here before they reach a query builder.
 */

import { PRIVILEGE_LEVELS } from "@/lib/privilege-config";

export type MemberRoleFilter = "all" | "voluntary" | "member";
export type MemberMembershipFilter = "all" | "active" | "inactive";

/**
 * Sortable columns, keyed by the table column id the UI uses.
 * Anything outside this map is rejected - the value ends up in an `order by`.
 */
export const MEMBER_SORT_COLUMN_BY_ID = {
  created_at_sort: "created_at",
  email: "email",
  firstname: "firstname",
  lastname: "lastname",
  privilege_type: "privilege_type",
} as const;

export type MemberSortId = keyof typeof MEMBER_SORT_COLUMN_BY_ID;

export const DEFAULT_MEMBER_SORT_ID: MemberSortId = "created_at_sort";

/** Mirrors the largest option in `MEMBER_PAGE_SIZES`. */
export const MEMBER_QUERY_MAX_PAGE_SIZE = 100;

/**
 * Page size the table starts on. It lives here rather than in `lib/table-settings`
 * because the server has to render the same first page the table will ask for; a
 * mismatch means an immediate second fetch on every page load.
 */
export const DEFAULT_MEMBER_PAGE_SIZE = 10;

/** Upper bound for "velg alle" so a wide filter cannot pull an unbounded result set. */
export const MEMBER_SELECT_ALL_LIMIT = 5000;

/** Long search strings only cost query time; nobody pastes six useful terms. */
const MAX_SEARCH_TOKENS = 6;
const MAX_SEARCH_LENGTH = 200;

export type MemberQuery = {
  search: string;
  roleFilter: MemberRoleFilter;
  membershipFilter: MemberMembershipFilter;
  sortId: MemberSortId;
  sortDesc: boolean;
  pageIndex: number;
  pageSize: number;
};

export const DEFAULT_MEMBER_QUERY: MemberQuery = {
  search: "",
  roleFilter: "all",
  membershipFilter: "all",
  sortId: DEFAULT_MEMBER_SORT_ID,
  sortDesc: true,
  pageIndex: 0,
  pageSize: DEFAULT_MEMBER_PAGE_SIZE,
};

/**
 * True when the value names a column the table is allowed to sort by.
 */
export function isMemberSortId(value: unknown): value is MemberSortId {
  return typeof value === "string" && value in MEMBER_SORT_COLUMN_BY_ID;
}

/**
 * Privilege threshold that separates "frivillig eller høyere" from plain members.
 */
export const VOLUNTARY_PRIVILEGE_THRESHOLD = PRIVILEGE_LEVELS.VOLUNTARY;

function clampInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

/**
 * Clamps an untrusted query payload into something safe to hand a query builder.
 *
 * How: Every field falls back to its default unless it matches a known value, and
 * numeric fields are bounded so a hand-rolled request cannot ask for a huge page.
 */
export function normalizeMemberQuery(raw: Partial<MemberQuery> | null | undefined): MemberQuery {
  const input = raw ?? {};
  const search = typeof input.search === "string" ? input.search.slice(0, MAX_SEARCH_LENGTH) : "";
  return {
    search,
    roleFilter:
      input.roleFilter === "voluntary" || input.roleFilter === "member" ? input.roleFilter : "all",
    membershipFilter:
      input.membershipFilter === "active" || input.membershipFilter === "inactive"
        ? input.membershipFilter
        : "all",
    sortId: isMemberSortId(input.sortId) ? input.sortId : DEFAULT_MEMBER_SORT_ID,
    sortDesc: input.sortDesc !== false,
    pageIndex: clampInteger(input.pageIndex, 0, 0, Number.MAX_SAFE_INTEGER),
    pageSize: clampInteger(input.pageSize, DEFAULT_MEMBER_PAGE_SIZE, 1, MEMBER_QUERY_MAX_PAGE_SIZE),
  };
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * True when the whole search term is a member id.
 *
 * Why exact: `id` is a uuid column, so it cannot be matched with `ilike` without a cast.
 * Pasting a full id is the case that matters; partial ids fall through to name/e-post search.
 */
export function isMemberIdSearch(search: string): boolean {
  return UUID_PATTERN.test(search.trim());
}

/**
 * PostgREST reads `or=(a.eq.1,b.eq.2)` as syntax, so these characters cannot reach it
 * inside a value. `%` and `_` are left alone - they widen the match, which is harmless
 * for a search box, and stripping `_` would break e-post addresses that contain one.
 */
const POSTGREST_RESERVED = /[,()"\\*]/g;

/**
 * Splits a search box value into the terms a row must match.
 *
 * How: Whitespace-separated terms, stripped of PostgREST filter syntax. Each term is
 * matched against every searchable column and the terms are ANDed, so "ola nordmann"
 * finds the row whose first name and last name each match one term.
 */
export function toMemberSearchTokens(search: string): string[] {
  return search
    .trim()
    .split(/\s+/)
    .map((token) => token.replace(POSTGREST_RESERVED, "").trim())
    .filter((token) => token.length > 0)
    .slice(0, MAX_SEARCH_TOKENS);
}

/**
 * True when two queries would produce the same result set and page.
 */
export function isSameMemberQuery(a: MemberQuery, b: MemberQuery): boolean {
  return (
    a.search === b.search &&
    a.roleFilter === b.roleFilter &&
    a.membershipFilter === b.membershipFilter &&
    a.sortId === b.sortId &&
    a.sortDesc === b.sortDesc &&
    a.pageIndex === b.pageIndex &&
    a.pageSize === b.pageSize
  );
}
