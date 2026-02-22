/**
 * Dashboard page module.
 * Fetches data and renders route-specific admin UI.
 */
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
};



export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {

    const { id } = await params
    const supabase = await createClient()
    const eq = await supabase.schema("item_schema").from('item').select('*').eq("parent_type", id)
    const items = eq.data as ItemType[] | null


    return (
        <main>
            <WrappedItemPage items={items ?? []} />
        </main>
    );
}