import type { MemberRow } from "@/components/member-table/shared";
import { parseCommitteeId } from "@/lib/committee-options";
import type { createClient } from "@/lib/supabase/server";
import {
  isMemberIdSearch,
  MEMBER_SELECT_ALL_LIMIT,
  MEMBER_SORT_COLUMN_BY_ID,
  normalizeMemberQuery,
  toMemberSearchTokens,
  VOLUNTARY_PRIVILEGE_THRESHOLD,
  type MemberQuery,
} from "@/lib/members/member-query";

type MemberServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Columns the members table renders. Listed explicitly rather than `*` so the payload
 * stays small - every extra column is paid for on each page fetch.
 */
const MEMBER_LIST_COLUMNS =
  "id, firstname, lastname, email, committee, privilege_type, created_by, created_at, password_set_at, is_membership_active, membership_active_until, membership_disabled_at, is_banned";

/**
 * PostgREST refuses to return more than `max-rows` (1000 by default) in one response,
 * so bulk reads walk the result set in slices of this size.
 */
const SELECT_ALL_PAGE_SIZE = 1000;

export type MemberPageResult = {
  rows: MemberRow[];
  totalCount: number;
};

export type MemberSelectAllResult = {
  rows: MemberRow[];
  /** True when the filter matched more rows than `MEMBER_SELECT_ALL_LIMIT`. */
  truncated: boolean;
  totalCount: number;
};

/**
 * Maps a raw `members` row to the shape the members/frivillige tables render.
 */
function mapToMemberRow(
  row: Record<string, unknown>,
  committeeNameById: Map<number, string>,
): MemberRow {
  const committeeId = parseCommitteeId(row.committee);
  return {
    id: String(row.id ?? ""),
    firstname: String(row.firstname ?? ""),
    lastname: String(row.lastname ?? ""),
    email: String(row.email ?? ""),
    added_by: (row.created_by as string | null | undefined) ?? null,
    created_at: (row.created_at as string | null | undefined) ?? null,
    password_set_at: (row.password_set_at as string | null | undefined) ?? null,
    is_membership_active: (row.is_membership_active as boolean | null | undefined) ?? null,
    membership_active_until: (row.membership_active_until as string | null | undefined) ?? null,
    membership_disabled_at: (row.membership_disabled_at as string | null | undefined) ?? null,
    is_banned: (row.is_banned as boolean | null | undefined) ?? null,
    profile_id: null,
    privilege_type: (row.privilege_type as number | null | undefined) ?? null,
    committee: committeeId === null ? null : committeeNameById.get(committeeId) ?? null,
    committee_id: committeeId,
    committee_rank: committeeId,
  };
}

/**
 * Builds the filtered, ordered `members` query for one request.
 *
 * How: Quick filters become column predicates, and each search term becomes an `or`
 * across the searchable columns. Repeated `or` filters are ANDed by PostgREST, so
 * multi-word searches narrow the result instead of widening it. A secondary sort on
 * `id` keeps paging stable when the primary sort column has ties.
 */
function buildMemberQuery(sb: MemberServerClient, query: MemberQuery) {
  let builder = sb.from("members").select(MEMBER_LIST_COLUMNS, { count: "exact" });

  if (query.roleFilter === "voluntary") {
    builder = builder.gte("privilege_type", VOLUNTARY_PRIVILEGE_THRESHOLD);
  } else if (query.roleFilter === "member") {
    // A null privilege reads as "medlem" in the UI, so it has to survive this filter.
    builder = builder.or(
      `privilege_type.lt.${VOLUNTARY_PRIVILEGE_THRESHOLD},privilege_type.is.null`,
    );
  }

  if (query.membershipFilter === "active") {
    builder = builder.eq("is_membership_active", true);
  } else if (query.membershipFilter === "inactive") {
    builder = builder.or("is_membership_active.is.null,is_membership_active.eq.false");
  }

  const search = query.search.trim();
  if (isMemberIdSearch(search)) {
    builder = builder.eq("id", search);
  } else {
    for (const token of toMemberSearchTokens(search)) {
      builder = builder.or(
        `firstname.ilike.%${token}%,lastname.ilike.%${token}%,email.ilike.%${token}%`,
      );
    }
  }

  return builder
    .order(MEMBER_SORT_COLUMN_BY_ID[query.sortId], {
      ascending: !query.sortDesc,
      nullsFirst: false,
    })
    .order("id", { ascending: true });
}

/**
 * Loads one page of members plus the total number of rows the filter matches.
 */
export async function fetchMembersPage(
  sb: MemberServerClient,
  rawQuery: Partial<MemberQuery> | null | undefined,
  committeeNameById: Map<number, string>,
): Promise<MemberPageResult> {
  const query = normalizeMemberQuery(rawQuery);
  const from = query.pageIndex * query.pageSize;
  const { data, error, count } = await buildMemberQuery(sb, query).range(
    from,
    from + query.pageSize - 1,
  );

  if (error) {
    throw new Error(error.message);
  }

  return {
    rows: ((data ?? []) as Record<string, unknown>[]).map((row) =>
      mapToMemberRow(row, committeeNameById),
    ),
    totalCount: count ?? 0,
  };
}

/**
 * Loads every member matching a filter, ignoring its pagination fields.
 *
 * Why it exists: "velg alle" in the table has to mean all matching members, not just
 * the page on screen. Capped at `MEMBER_SELECT_ALL_LIMIT` so a cleared filter cannot
 * pull the whole table into the browser unannounced.
 */
export async function fetchAllMatchingMembers(
  sb: MemberServerClient,
  rawQuery: Partial<MemberQuery> | null | undefined,
  committeeNameById: Map<number, string>,
): Promise<MemberSelectAllResult> {
  const query = normalizeMemberQuery(rawQuery);
  const rows: MemberRow[] = [];
  let totalCount = 0;
  let from = 0;

  while (from < MEMBER_SELECT_ALL_LIMIT) {
    const to = Math.min(from + SELECT_ALL_PAGE_SIZE, MEMBER_SELECT_ALL_LIMIT) - 1;
    const { data, error, count } = await buildMemberQuery(sb, query).range(from, to);
    if (error) {
      throw new Error(error.message);
    }
    totalCount = count ?? totalCount;
    const batch = (data ?? []) as Record<string, unknown>[];
    if (batch.length === 0) {
      break;
    }
    for (const row of batch) {
      rows.push(mapToMemberRow(row, committeeNameById));
    }
    from += batch.length;
  }

  return { rows, truncated: totalCount > rows.length, totalCount };
}
