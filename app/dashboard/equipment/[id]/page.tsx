import { createClient } from "@/lib/supabase/server";
import WrappedItemPage from "./_wrappedPage";


export type ItemType = {
    id: string; // bigint → string (tryggest i frontend)
    created_at: string; // timestamptz → ISO string
    img_path: string | null;
    img_type: string | null;
    parent_type: string | null; // FK → item_schema.item_type.id
    is_active: boolean;
    location: string;
    itemname: string;
    itemdescription: string | null;
    group_id: string | null; // FK → activity_group.id
    certification_type: number | null;
    certification_type_name?: string | null; // hentet via join, ikke i DB
    parent_type_title?: string | null; // hentet via join, ikke i DB
    certification_type_description?: string | null; // hentet via join, ikke i DB
    is_rented: boolean;
};

export type ItemReservation = {
    id: number;
    created_at: string; // timestamptz
    end_time: string; // timestamptz
    is_returned: boolean;
    returned_time: string | null; // timestamptz
    returned_photo_id: string | null;
    item_id: number;
    number_of_extends: number; // smallint
    start_time: string | null; // timestamptz
    user_id: string | null; // uuid
};



export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase
        .schema("item_schema")
        .from("item")
        .select(`
    *,
    item_type:parent_type (
      id,
      title,
      certification_type
    )
  `)
        .eq("id", id)
        .single();

    if (error) throw error;

    if (data.item_type.certification_type) {
        const { data: certData } = await supabase.from("certificate_type").select("*").eq("id", data.item_type.certification_type).single();
        if (data) {
            data.certification_type = data.item_type.certification_type;
            data.certification_type_name = certData?.type ?? null;
            data.parent_type_title = data.item_type.title ?? null;
            data.certification_type_description = certData?.description ?? null;
        }
    }
    const item = data;


    return (
        <main>
            {item && <WrappedItemPage item={item} />}
        </main>
    );
}