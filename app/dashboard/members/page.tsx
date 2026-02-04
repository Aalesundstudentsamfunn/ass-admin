import { createClient } from "@/lib/supabase/server";
import DataTable from "./_wrapped_page";
import { ActionsProvider } from "./providers";
import { revalidatePath } from 'next/cache';
import { enqueuePrinterQueue } from "@/lib/printer-queue";

export default async function MembersPage() {
    const supabase = await createClient();
    const { data: rows, error } = await supabase
        .from('ass_members')
        .select('*')
        .order('id', { ascending: false })
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
            const { data: newMember, error: insertError } = await sb
                .from("ass_members")
                .insert({ email, firstname, lastname, is_voluntary: voluntary })
                .select("id, firstname, lastname, email, is_voluntary")
                .single();
            if (insertError || !newMember) {
                return { ok: false, error: insertError?.message ?? "Failed to add new member." }
            }
            console.log("successfully added new member")
            if (voluntary) {
                try {
                    //todo add function for added_by
                    const { error: voluntaryError } = await sb.from("voluntary").insert({ email })
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

            const { data: authData, error: authError } = await sb.auth.getUser()
            if (authError || !authData.user) {
                return { ok: false, error: "added user but failed to queue print job, please log in again." }
            }

            const { data: queueRow, error: queueError } = await enqueuePrinterQueue(sb, {
                firstname: newMember.firstname,
                lastname: newMember.lastname,
                email: newMember.email,
                ref: newMember.id,
                ref_invoker: authData.user.id,
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
                <DataTable initialData={rows}
                />
            </ActionsProvider>
        )
    } else {
        return <div>Ingen data</div>
    }
}
