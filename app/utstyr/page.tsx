import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import UtstyrClient from "./_wrappedPage";

type ItemReservation = {
  id: number;
  start_time: string | null;
  end_time: string;
  is_returned: boolean;
  item: {
    id: number;
    itemname: string;
    img_path: string | null;
    img_type: string | null;
  } | null;
};

const RESERVATION_SELECT = `
  id,
  start_time,
  end_time,
  is_returned,
  item:item_id (
    id,
    itemname,
    img_path,
    img_type
  )
`;

/**
 * Loads reservation rows for one user by returned status.
 */
async function fetchReservationsForUser(
  userId: string,
  isReturned: boolean,
): Promise<ItemReservation[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .schema("item_schema")
    .from("item_reservation")
    .select(RESERVATION_SELECT)
    .eq("user_id", userId)
    .eq("is_returned", isReturned)
    .order("start_time", { ascending: false });

  if (error) {
    return [];
  }

  return (data ?? []) as ItemReservation[];
}

/**
 * Temporary member rental page (`/utstyr`) while the new app flow is being finalized.
 */
export default async function UtstyrPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: member } = await supabase
    .from("members")
    .select("firstname")
    .eq("id", user.id)
    .maybeSingle();

  const [reservations, oldReservations] = await Promise.all([
    fetchReservationsForUser(user.id, false),
    fetchReservationsForUser(user.id, true),
  ]);

  return (
    <UtstyrClient
      firstname={member?.firstname ?? "bruker"}
      reservations={reservations}
      oldReservations={oldReservations}
    />
  );
}
