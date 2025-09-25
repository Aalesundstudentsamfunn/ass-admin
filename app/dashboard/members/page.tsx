import { createClient } from "@/lib/supabase/server";
import DataTable from "./_wrapped_page";
import { ActionsProvider } from "./providers";
import { revalidatePath } from 'next/cache';

export default async function MembersPage() {
    const supabase = await createClient();
    const { data: rows, error } = await supabase.from('ass_members').select('*')
    async function addNewMember(_: unknown, formData: FormData) {
        'use server';
        console.log(formData)
        const firstname = String(formData.get('firstname') ?? '');
        const email = String(formData.get('email') ?? '');
        const lastname = String(formData.get('lastname') ?? '');
        const voluntary = Boolean(formData.get('voluntary') ?? false)
        //const voluntary = Boolean(formData.get('voluntary') ?? false)
        try {
            const sb = await createClient();
            const s_m = await sb.from("ass_members").insert({ email, firstname, lastname })
            console.log("successfully added new member")
            if (voluntary && s_m.status === 201) {
                try {
                    //todo add function for added_by
                    await sb.from("voluntary").insert({ email })
                    console.log("successfully added as voluntary also")
                    revalidatePath("/dashboard/members")
                    return { ok: true };
                } catch (error: unknown) {
                    return { ok: false, error: "added user but failed to add as voluntary, kontakt it: error:" + error }
                }
            }
        } catch (error: unknown) {
            return { ok: false, error: error }
        }
        return { ok: true };
    }
    //print the first 5 rows
    if (error) {
        return <div>Error: {error?.message}</div>
    } else if (rows && rows.length > 0) {
        "use server"
        return (
            <ActionsProvider addNewMember={addNewMember}>
                <DataTable initialData={rows}
                />
            </ActionsProvider>
        )
    } else {
        return <div>Ingen data</div>
    }
}