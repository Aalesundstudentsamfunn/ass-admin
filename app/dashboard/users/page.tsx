import { createClient } from "@/lib/supabase/server";
import DataTable from "./_wrapped_page";

export default async function MembersPage() {
  const supabase = await createClient();
  const { data: rows, error } = await supabase.rpc('admin_list_profiles')
  const { data: voluntaryMembers } = await supabase.from("ass_members").select("email").eq("is_voluntary", true)
  //print the first 5 rows
  if (error) {
    return <div>Error: {error?.message}</div>
  } else if (rows && rows.length > 0) {
    const voluntaryEmails = new Set(
      (voluntaryMembers ?? [])
        .map((row) => String(row.email ?? "").trim().toLowerCase())
        .filter(Boolean),
    )
    const hydratedRows = rows.map((row: Record<string, unknown>) => {
      const email = String(row.email ?? "").trim().toLowerCase()
      const rowVoluntary = row.is_voluntary ?? row.voluntary
      return {
        ...row,
        is_voluntary:
          typeof rowVoluntary === "boolean" ? rowVoluntary : email ? voluntaryEmails.has(email) : false,
      }
    })
    return <DataTable initialData={hydratedRows} />
  } else {
    return <div>Ingen data</div>
  }
}
