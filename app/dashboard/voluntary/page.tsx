import { createClient } from "@/lib/supabase/server";
import DataTable from "./_wrapped_page";

export default async function MembersPage() {
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("members")
    .select("id, firstname, lastname, email, privilege_type, created_by, created_at, password_set_at")
    .gte("privilege_type", 2);
  if (error) {
    return <div>Error: {error?.message}</div>
  } else if (rows && rows.length > 0) {
    const initialData = rows.map((row) => ({
      ...row,
      added_by: row.created_by ?? null,
      profile_id: null,
    }))
    return <DataTable initialData={initialData} />
  } else {
    return <div>Ingen data</div>
  }
}
