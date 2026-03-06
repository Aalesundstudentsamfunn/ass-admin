/**
 * Server route for `equipment/by-type/[id]` dashboard view.
 */
import { createClient } from "@/lib/supabase/server";
import WrappedItemPage from "./_wrappedPage";


export type Item = {
    id: string; // bigint → string (tryggest i frontend)
    created_at: string; // timestamptz → ISO string
    img_path: Array<string> | null;
    parent_type: string; // FK → item_schema.item_type.id
    itemdescription: string | null;
    isRented: boolean;
    is_active: boolean;
    variant: string; // FK → activity_group.id
};



export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {

    const { id } = await params
    const supabase = await createClient()
    const eq = await supabase.schema("item_schema").from('item').select('*').eq("parent_type", id)
    const items = eq.data as Item[] | null


    return (
        <main>
            <WrappedItemPage items={items ?? []} />
        </main>
    );
}