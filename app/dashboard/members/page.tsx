import { createClient } from "@/lib/supabase/server";
import DataTable from "./_wrapped_page";
import type { UserRow } from "./_wrapped_page";
import { ActionsProvider } from "./providers";
import { addNewMember, activateMember, checkMemberEmail } from "./server/actions";
import { normalizePrivilege } from "@/lib/privilege-checks";
import { canUseBulkTemporaryPasswordAction } from "@/lib/server/temporary-password-access";
import {
  parseCommitteeId,
} from "@/lib/committee-options";
import { fetchCommitteeNameByIdMap } from "@/lib/server/committee-type";

/**
 * Maps raw `members` rows to the table shape used by members/voluntary views.
 */
function mapToUserRows(
  rows: Record<string, unknown>[],
  committeeNameById: Map<number, string>,
): UserRow[] {
  return rows.map((row): UserRow => {
    const committeeId = parseCommitteeId(row.committee);
    const committeeName = committeeId === null ? null : committeeNameById.get(committeeId) ?? null;
    return {
      id: String(row.id ?? ""),
      firstname: String(row.firstname ?? ""),
      lastname: String(row.lastname ?? ""),
      email: String(row.email ?? ""),
      added_by: (row.created_by as string | null | undefined) ?? null,
      created_at: (row.created_at as string | null | undefined) ?? null,
      password_set_at: (row.password_set_at as string | null | undefined) ?? null,
      is_membership_active: (row.is_membership_active as boolean | null | undefined) ?? null,
      is_banned: (row.is_banned as boolean | null | undefined) ?? null,
      profile_id: null,
      privilege_type: (row.privilege_type as number | null | undefined) ?? null,
      committee: committeeName,
      committee_id: committeeId,
      committee_rank: committeeId,
    };
  });
}

/**
 * Loads active members table data and wires member server actions into the page provider.
 */
export default async function MembersPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const newParamRaw = resolvedSearchParams.new;
  const newParam = Array.isArray(newParamRaw) ? newParamRaw[0] : newParamRaw;
  const autoOpenCreateDialog = newParam === "1" || newParam === "true";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let canBulkTemporaryPasswords = false;
  if (user?.id) {
    const { data: me } = await supabase
      .from("members")
      .select("privilege_type")
      .eq("id", user.id)
      .maybeSingle();
    canBulkTemporaryPasswords = canUseBulkTemporaryPasswordAction({
      privilege: normalizePrivilege(me?.privilege_type),
    });
  }

  const { data, error } = await supabase
    .from("members")
    .select("*")
    .order("created_at", { ascending: false });
  const {
    options: committeeOptions,
    nameById: committeeNameById,
  } = await fetchCommitteeNameByIdMap(supabase);

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  const rows = mapToUserRows(
    (data ?? []) as Record<string, unknown>[],
    committeeNameById,
  );

  return (
    <ActionsProvider
      addNewMember={addNewMember}
      checkMemberEmail={checkMemberEmail}
      activateMember={activateMember}
    >
      <DataTable
        initialData={rows}
        canBulkTemporaryPasswords={canBulkTemporaryPasswords}
        committeeOptions={committeeOptions}
        autoOpenCreateDialog={autoOpenCreateDialog}
      />
    </ActionsProvider>
  );
}
