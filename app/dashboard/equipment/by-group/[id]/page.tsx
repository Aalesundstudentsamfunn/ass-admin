/**
 * Server route for `equipment/by-group/[id]` dashboard view.
 */
import { createClient } from "@/lib/supabase/server";
import WrappedUtstyrPage from "./_wrappedPage";
import Link from "next/link";
import { Button } from "@/components/ui/button";
export type ItemType = {
    id: number;
    created_at: string;
    title: string;
    responsible_activity_group: number;
    certification_type: number | null;
    location: string | null;
    items?: Array<{ img_path?: string[] | null }>;
};



export default async function UtstyrPage({ params }: { params: Promise<{ id: string }> }) {

    const { id } = await params
    const supabase = await createClient()
    
    // Fetch item types
    const { data: itemTypesData } = await supabase.schema("item_schema")
        .from('item_type')
        .select('*')
        .eq("responsible_activity_group", id)
    
    // Fetch first item image for each type
    const itemTypesWithImages = await Promise.all(
        (itemTypesData || []).map(async (itemType) => {
            const { data: itemData } = await supabase.schema("item_schema")
                .from('item')
                .select('img_path')
                .eq('parent_type', itemType.id)
                .limit(1)
                .maybeSingle();
            
            return {
                ...itemType,
                items: itemData ? [itemData] : []
            };
        })
    );
    
    const items = itemTypesWithImages as ItemType[]

    return (
        <main>
            <div><Link href="/dashboard/equipment"><Button>Tilbake</Button></Link></div>
            <WrappedUtstyrPage itemTypes={items} groupId={id} />
        </main>
    );
}