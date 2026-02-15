import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import UtstyrClient from "./_wrappedPage";

export default async function UtstyrPage() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    const { data: userData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

    const { data: reservations } = await supabase
        .schema("item_schema")
        .from("item_reservation")
        .select(
            `
      *,
      item:item_id (
        id,
        itemname,
        img_path,
        img_type
      )
    `
        )
        .eq("user_id", user.id)
        .eq("is_returned", false)
        .order("start_time", { ascending: false });

    const { data: oldReservations } = await supabase
        .schema("item_schema")
        .from("item_reservation")
        .select(
            `
      *,
      item:item_id (
        id,
        itemname,
        img_path,
        img_type
      )
    `
        )
        .eq("user_id", user.id)
        .eq("is_returned", true)
        .order("start_time", { ascending: false });

    return (
        <UtstyrClient
            firstname={userData?.firstname ?? "bruker"}
            reservations={(reservations ?? []) as any}
            oldReservations={(oldReservations ?? []) as any}
        />
    );
}