"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export default function RegistrerClient({ nextPath }: { nextPath: string }) {
    const router = useRouter();
    const supabase = createClient();

    const [firstname, setFirstname] = React.useState("");
    const [lastname, setLastname] = React.useState("");
    const [approved, setApproved] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const isValid =
        firstname.trim().length > 0 && lastname.trim().length > 0 && approved;

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        if (!isValid) return;

        setSaving(true);
        try {
            const { error } = await supabase.rpc("update_my_profile", {
                p_firstname: firstname.trim(),
                p_lastname: lastname.trim(),
                p_img_path: null,
                p_img_type: null,
            });

            if (error) throw error;

            router.replace(nextPath);
            router.refresh();
        } catch (err: any) {
            setError(err?.message ?? "Noe gikk galt.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <main className="min-h-screen flex items-center justify-center bg-white p-6">
            <div className="w-full max-w-md space-y-6 border rounded-xl p-6">
                <div>
                    <h1 className="text-2xl font-semibold">Fullfør registrering</h1>
                    <p className="text-sm text-muted-foreground">
                        Du må fylle inn navn og godkjenne før du kan fortsette.
                    </p>
                </div>

                <form onSubmit={onSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="firstname">Fornavn</Label>
                        <Input
                            id="firstname"
                            value={firstname}
                            onChange={(e) => setFirstname(e.target.value)}
                            placeholder="Ola"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="lastname">Etternavn</Label>
                        <Input
                            id="lastname"
                            value={lastname}
                            onChange={(e) => setLastname(e.target.value)}
                            placeholder="Nordmann"
                        />
                    </div>

                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="approve"
                            checked={approved}
                            onCheckedChange={(v) => setApproved(Boolean(v))}
                        />
                        <Label htmlFor="approve">Jeg godkjenner</Label>
                    </div>

                    {error && (
                        <p className="text-sm text-red-600">{error}</p>
                    )}

                    <Button type="submit" className="w-full" disabled={!isValid || saving}>
                        {saving ? "Lagrer..." : "Lagre"}
                    </Button>
                </form>
            </div>
        </main>
    );
}