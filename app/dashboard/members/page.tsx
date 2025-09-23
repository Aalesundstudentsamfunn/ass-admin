import { createClient } from "@/lib/supabase/server";
import DataTable from "./_wrapped_page";

export default async function MembersPage() {
  const supabase = await createClient();
  const { data: rows, error } = await supabase.from('ass_members').select('*')
  //print the first 5 rows
  if (error) {
    return <div>Error: {error?.message}</div>
  } else if (rows && rows.length > 0) {
    return <DataTable initialData={rows} />
  } else {
    return <div>Ingen data</div>
  }
}