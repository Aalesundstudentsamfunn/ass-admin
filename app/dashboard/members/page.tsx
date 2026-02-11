import { createClient } from "@/lib/supabase/server";
import DataTable from "./_wrapped_page";
import type { UserRow } from "./_wrapped_page";
import { ActionsProvider } from "./providers";
import { revalidatePath } from 'next/cache';
import { enqueuePrinterQueue } from "@/lib/printer-queue";

export default async function MembersPage() {
    const supabase = await createClient();
    const { data: rows, error } = await supabase
        .from('ass_members')
        .select('*, profile:profiles!ass_members_profile_id_fkey ( privilege_type )')
        .order('id', { ascending: false })

    type MemberRow = {
        id: string | number;
        firstname: string;
        lastname: string;
        email: string;
        is_voluntary: boolean;
        added_by?: string | null;
        created_at?: string | null;
        profile_id?: string | null;
        profile?: { privilege_type?: number | null } | null;
    };
    async function addNewMember(_: unknown, formData: FormData) {
        'use server';
        console.log(formData)
        const firstname = String(formData.get('firstname') ?? '');
        const email = String(formData.get('email') ?? '');
        const lastname = String(formData.get('lastname') ?? '');
        const voluntary = Boolean(formData.get('voluntary')) ? true : false
        const autoPrintValue = formData.get('autoPrint');
        const autoPrint = autoPrintValue === null ? true : String(autoPrintValue) !== 'false';
        console.log(voluntary)
        //const voluntary = Boolean(formData.get('voluntary') ?? false)
        try {
            const sb = await createClient();
            const { data: authData, error: authError } = await sb.auth.getUser()
            if (authError || !authData.user) {
                return { ok: false, error: "Du må være innlogget for å legge til medlem." }
            }
            const addedBy = authData.user.id
            const { data: newMember, error: insertError } = await sb
                .from("ass_members")
                .insert({ email, firstname, lastname, is_voluntary: voluntary, added_by: addedBy })
                .select("id, firstname, lastname, email, is_voluntary, added_by")
                .single();
            if (insertError || !newMember) {
                return { ok: false, error: insertError?.message ?? "Failed to add new member." }
            }
            console.log("successfully added new member")
            if (voluntary) {
                try {
                    //todo add function for added_by
                    const { error: voluntaryError } = await sb.from("voluntary").insert({ email, added_by: addedBy })
                    if (voluntaryError) {
                        return { ok: false, error: "added user but failed to add as voluntary, kontakt it: error:" + voluntaryError.message }
                    }
                    console.log("successfully added as voluntary also")
                } catch (error: unknown) {
                    return { ok: false, error: "added user but failed to add as voluntary, kontakt it: error:" + error }
                }
            }

            if (!autoPrint) {
                revalidatePath("/dashboard/members")
                return { ok: true, autoPrint: false };
            }

            const { data: queueRow, error: queueError } = await enqueuePrinterQueue(sb, {
                firstname: newMember.firstname,
                lastname: newMember.lastname,
                email: newMember.email,
                ref: newMember.id,
                ref_invoker: addedBy,
                is_voluntary: newMember.is_voluntary,
            })
            if (queueError) {
                return { ok: false, error: "added user but failed to add to printer queue: " + queueError.message }
            }
            revalidatePath("/dashboard/members")
            return { ok: true, autoPrint: true, queueId: queueRow?.id, queueRef: newMember.id, queueInvoker: authData.user.id };
        } catch (error: unknown) {
            return { ok: false, error: error }
        }
    }
    //print the first 5 rows
    if (error) {
        return <div>Error: {error?.message}</div>
    } else if (rows && rows.length > 0) {
        return (
            <ActionsProvider addNewMember={addNewMember}>
                <DataTable
                    initialData={(rows as MemberRow[]).map((row): UserRow => ({
                        id: row.id,
                        firstname: row.firstname,
                        lastname: row.lastname,
                        email: row.email,
                        is_voluntary: row.is_voluntary,
                        added_by: row.added_by ?? null,
                        created_at: row.created_at ?? null,
                        profile_id: row.profile_id ?? null,
                        privilege_type: row.profile?.privilege_type ?? null,
                    }))}
                />
            </ActionsProvider>
        )
    } else {
        return <div>Ingen data</div>
    }
}
