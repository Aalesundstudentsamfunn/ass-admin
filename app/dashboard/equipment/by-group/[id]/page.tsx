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
    title: string | null;
    description: string | null;
    parent_category: number | null;
    responsible_activity_group: number | null;
    variants: number | null;
    certification_type: number | null;
    img_path: string | null;
    img_type: string | null;
    img_full_url?: string | null;
};



export default async function UtstyrPage({ params }: { params: Promise<{ id: string }> }) {

    const { id } = await params
    const supabase = await createClient()
    const eq = await supabase.schema("item_schema").from('item_type').select('*').eq("responsible_activity_group", id)
    const items = eq.data as ItemType[] | null

    return (
        <main>
            <div><Link href="/dashboard/equipment"><Button>Tilbake</Button></Link></div>
            <WrappedUtstyrPage items={items ?? []} groupId={id} />
        </main>
    );
}