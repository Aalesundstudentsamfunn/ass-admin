import { createClient } from "@/lib/supabase/server";
import Landing from "./_wrapped_page";

export default async function Page() {
  const supabase = await createClient();
  const { data: rows, error } = await supabase.rpc('volunteer_stats')
  if (error) {
    return <div>Error: {error?.message}</div>
  } else if (rows && rows.length > 0) {
    return <Landing initialData={rows} />
  } else {
    return <div>Ingen data</div>
  }
}
