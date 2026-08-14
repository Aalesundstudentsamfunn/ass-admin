"use server";

import type { MemberRow } from "@/components/member-table/shared";
import { createClient } from "@/lib/supabase/server";
import { canAccessDashboard } from "@/lib/privilege-checks";
import { fetchCommitteeNameByIdMap } from "@/lib/server/committee-type";
import type { MemberQuery } from "@/lib/members/member-query";
import { fetchAllMatchingMembers, fetchMembersPage } from "./fetch-members";

export type LoadMembersPageResult =
  | { ok: true; rows: MemberRow[]; totalCount: number }
  | { ok: false; error: string };

export type LoadAllMatchingMembersResult =
  | { ok: true; rows: MemberRow[]; truncated: boolean; totalCount: number }
  | { ok: false; error: string };

/**
 * Resolves the caller and the committee names every member row needs.
 *
 * Why the privilege check: these actions are reachable by anyone who can guess the
 * endpoint, so viewing the member list is gated on dashboard access the same way the
 * page is. Row visibility beyond that is left to RLS on `members`.
 */
async function resolveListViewer() {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) {
    return { ok: false as const, error: "Du må være innlogget." };
  }

  const { data: me, error: meError } = await sb
    .from("members")
    .select("privilege_type")
    .eq("id", user.id)
    .maybeSingle();

  if (meError) {
    return { ok: false as const, error: meError.message };
  }
  if (!canAccessDashboard(me?.privilege_type)) {
    return { ok: false as const, error: "Mangler tilgang." };
  }

  const { nameById } = await fetchCommitteeNameByIdMap(sb);
  return { ok: true as const, sb, committeeNameById: nameById };
}

/**
 * Server action backing the members table: one page of rows plus the matching total.
 */
export async function loadMembersPage(
  query: Partial<MemberQuery>,
): Promise<LoadMembersPageResult> {
  const viewer = await resolveListViewer();
  if (!viewer.ok) {
    return { ok: false, error: viewer.error };
  }

  try {
    const { rows, totalCount } = await fetchMembersPage(
      viewer.sb,
      query,
      viewer.committeeNameById,
    );
    return { ok: true, rows, totalCount };
  } catch (error: unknown) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Kunne ikke hente medlemmer.",
    };
  }
}

/**
 * Server action backing "velg alle": every member matching the current filter.
 */
export async function loadAllMatchingMembers(
  query: Partial<MemberQuery>,
): Promise<LoadAllMatchingMembersResult> {
  const viewer = await resolveListViewer();
  if (!viewer.ok) {
    return { ok: false, error: viewer.error };
  }

  try {
    const { rows, truncated, totalCount } = await fetchAllMatchingMembers(
      viewer.sb,
      query,
      viewer.committeeNameById,
    );
    return { ok: true, rows, truncated, totalCount };
  } catch (error: unknown) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Kunne ikke hente medlemmer.",
    };
  }
}
