import { createClient } from "@/lib/supabase/server";
import DataTable from "./_wrapped_page";
import { ActionsProvider } from "./providers";
import { addNewMember, activateMember, checkMemberEmail } from "./server/actions";
import { fetchMembersPage } from "./server/fetch-members";
import { normalizePrivilege } from "@/lib/privilege-checks";
import { canUseBulkTemporaryPasswordAction } from "@/lib/server/temporary-password-access";
import { DEFAULT_MEMBER_QUERY, type MemberQuery } from "@/lib/members/member-query";
import { fetchCommitteeNameByIdMap } from "@/lib/server/committee-type";

/**
 * Reads the first value of a search param that may arrive repeated.
 */
function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Renders the first page of active members and wires member server actions into the page provider.
 *
 * Why only a page: the member list outgrows PostgREST's 1000-row response cap, so paging,
 * sorting and search all happen in the database. This renders page one; the client table
 * asks a server action for the rest.
 */
export default async function MembersPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const newParam = firstParam(resolvedSearchParams.new);
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

  // Must match the table's own starting state, or it refetches the same page on mount.
  const initialQuery: MemberQuery = {
    ...DEFAULT_MEMBER_QUERY,
    search: (firstParam(resolvedSearchParams.email) ?? "").trim(),
  };

  const {
    options: committeeOptions,
    nameById: committeeNameById,
  } = await fetchCommitteeNameByIdMap(supabase);

  let initialRows;
  let initialTotalCount = 0;
  try {
    const page = await fetchMembersPage(supabase, initialQuery, committeeNameById);
    initialRows = page.rows;
    initialTotalCount = page.totalCount;
  } catch (error: unknown) {
    return <div>Error: {error instanceof Error ? error.message : "Kunne ikke hente medlemmer."}</div>;
  }

  return (
    <ActionsProvider
      addNewMember={addNewMember}
      checkMemberEmail={checkMemberEmail}
      activateMember={activateMember}
    >
      <DataTable
        initialData={initialRows}
        initialTotalCount={initialTotalCount}
        initialQuery={initialQuery}
        canBulkTemporaryPasswords={canBulkTemporaryPasswords}
        committeeOptions={committeeOptions}
        autoOpenCreateDialog={autoOpenCreateDialog}
      />
    </ActionsProvider>
  );
}
