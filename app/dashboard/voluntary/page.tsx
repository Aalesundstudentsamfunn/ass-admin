import { createClient } from "@/lib/supabase/server";
import { PRIVILEGE_LEVELS } from "@/lib/privilege-config";
import DataTable from "./_wrapped_page";

/**
 * Renders members page.
 */
export default async function MembersPage() {
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("members")
    .select("id, firstname, lastname, email, privilege_type, created_by, created_at, password_set_at, is_membership_active, is_banned")
    .gte("privilege_type", PRIVILEGE_LEVELS.VOLUNTARY);
  if (error) {
    return <div>Error: {error?.message}</div>
  } else if (rows && rows.length > 0) {
    const initialData = rows.map((row) => ({
      ...row,
      added_by: row.created_by ?? null,
      profile_id: null,
      is_membership_active: row.is_membership_active ?? null,
      is_banned: row.is_banned ?? null,
    }))
    return <DataTable initialData={initialData} />
  } else {
    return <div>Ingen data</div>
  }
}
