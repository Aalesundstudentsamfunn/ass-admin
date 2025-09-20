import { createClient } from "@/lib/supabase/server";

export default async function getStats() {
    const supabase = await createClient();
    const { data: profiles } = await supabase.from("profiles").select("*");
    console.log(profiles);
    return profiles;
}