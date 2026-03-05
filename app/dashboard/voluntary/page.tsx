import { createClient } from "@/lib/supabase/server";
import { PRIVILEGE_LEVELS } from "@/lib/privilege-config";
import DataTable from "./_wrapped_page";
import {
  parseCommitteeId,
} from "@/lib/committee-options";
import { fetchCommitteeNameByIdMap } from "@/lib/server/committee-type";

/**
 * Renders members page.
 */
export default async function MembersPage() {
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("members")
    .select("id, firstname, lastname, email, committee, privilege_type, created_by, created_at, password_set_at, is_membership_active, is_banned")
    .gte("privilege_type", PRIVILEGE_LEVELS.VOLUNTARY);
  const { nameById: committeeNameById } = await fetchCommitteeNameByIdMap(supabase);

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
