import { createClient } from "@/lib/supabase/server";
import { PRIVILEGE_LEVELS } from "@/lib/privilege-config";
import DataTable from "./_wrapped_page";
import {
  buildCommitteeNameById,
  normalizeCommitteeOptions,
  parseCommitteeId,
} from "@/lib/committee-options";

/**
 * Renders members page.
 */
export default async function MembersPage() {
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("members")
    .select("id, firstname, lastname, email, committee, privilege_type, created_by, created_at, password_set_at, is_membership_active, is_banned")
    .gte("privilege_type", PRIVILEGE_LEVELS.VOLUNTARY);
  let committeeTypeResult = await supabase
    .from("committee_type")
    .select("id, committee_name")
    .order("id", { ascending: true });
  if (committeeTypeResult.error) {
    committeeTypeResult = await supabase
      .from("committee_type")
      .select("id, name")
      .order("id", { ascending: true });
  }
  if (committeeTypeResult.error) {
    committeeTypeResult = await supabase
      .from("committee_types")
      .select("id, committee_name")
      .order("id", { ascending: true });
  }
  if (committeeTypeResult.error) {
    committeeTypeResult = await supabase
      .from("committee_types")
      .select("id, name")
      .order("id", { ascending: true });
  }
  const committeeTypeRows = committeeTypeResult.data;

  const committeeOptions = normalizeCommitteeOptions(
    (
      (committeeTypeRows ?? []) as Array<{
        id: unknown;
        committee_name?: unknown;
        name?: unknown;
      }>
    ).map(
      (row) => ({
        id: row.id,
        name:
          typeof row.committee_name === "string" && row.committee_name.trim()
            ? row.committee_name
            : (row.name ?? ""),
      }),
    ),
  );
  const committeeNameById = buildCommitteeNameById(committeeOptions);

  if (error) {
    return <div>Error: {error?.message}</div>;
  }

  const initialData = (rows ?? []).map((row) => {
    const committeeId = parseCommitteeId(row.committee);
    const committeeTitle =
      committeeId === null ? null : committeeNameById.get(committeeId) ?? null;
    const shouldAddLeaderSuffix =
      committeeTitle !== null &&
      committeeId !== null &&
      committeeId > 3 &&
      Number(row.privilege_type) === 4;
    const committeeDisplay =
      shouldAddLeaderSuffix
        ? `${committeeTitle} (Leder)`
        : committeeTitle;
    return {
      ...row,
      committee: committeeDisplay,
      committee_id: committeeId,
      committee_rank: committeeId,
      added_by: row.created_by ?? null,
      profile_id: null,
      is_membership_active: row.is_membership_active ?? null,
      is_banned: row.is_banned ?? null,
    };
  });
  return <DataTable initialData={initialData} />;
}
