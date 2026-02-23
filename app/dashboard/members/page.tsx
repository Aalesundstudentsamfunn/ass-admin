import { createClient } from "@/lib/supabase/server";
import DataTable from "./_wrapped_page";
import type { UserRow } from "./_wrapped_page";
import { ActionsProvider } from "./providers";
import { addNewMember, activateMember, checkMemberEmail } from "./server/actions";

/**
 * Maps raw `members` rows to the table shape used by members/voluntary views.
 */
function mapToUserRows(rows: Record<string, unknown>[]): UserRow[] {
  return rows.map((row): UserRow => ({
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
  }));
}

/**
 * Loads active members table data and wires member server actions into the page provider.
 */
export default async function MembersPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("members")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  const rows = mapToUserRows((data ?? []) as Record<string, unknown>[]);

  return (
    <ActionsProvider
      addNewMember={addNewMember}
      checkMemberEmail={checkMemberEmail}
      activateMember={activateMember}
    >
      <DataTable initialData={rows} />
    </ActionsProvider>
  );
}

