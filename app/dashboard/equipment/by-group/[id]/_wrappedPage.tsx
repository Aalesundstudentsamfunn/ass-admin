"use client";

/**
 * Dashboard client wrapper/presentation module.
 */

import { useMemo, useState } from "react";
import Image from "next/image";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ItemType } from "./page";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface CertificateType {
    id: number;
    type: string;
}

export default function WrappedUtstyrPage({ items, groupId }: { items: ItemType[]; groupId: string }) {
    const supabase = createClient();
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [certificationType, setCertificationType] = useState<number | null>(null);
    const [certificateTypes, setCertificateTypes] = useState<CertificateType[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        const fetchCertificateTypes = async () => {
            const { data, error } = await supabase
                .from("certificate_type")
                .select("id, type");

            if (!error && data) {
                setCertificateTypes(data);
            }
        };

        fetchCertificateTypes();
    }, [supabase]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return items;
        return items?.filter((x) => (x.title ?? "").toLowerCase().includes(q));
    }, [query, items]);

    const openDialog = () => setOpen(true);

    const handleCreate = async () => {
        const trimmedTitle = title.trim();
        if (!trimmedTitle) {
            setErrorMessage("Tittel er påkrevd.");
            return;
        }

        setSubmitting(true);
        setErrorMessage(null);

        const { error } = await supabase
            .schema("item_schema")
            .from("item_type")
            .insert({
                title: trimmedTitle,
                description: description.trim() || null,
                parent_category: null,
                responsible_activity_group: parseInt(groupId),
                certification_type: certificationType,
            })

        setSubmitting(false);

        if (error) {
            setErrorMessage(error.message);
            return;
        }

        setTitle("");
        setDescription("");
        setCertificationType(null);
        setOpen(false);
        window.location.reload();
    };

    return (
        <main className="mx-auto w-full max-w-6xl p-4 md:p-8">
            <div className="mb-6 flex flex-col gap-3">
                <h1 className="text-2xl font-semibold">Utstyr</h1>

                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Søk etter utstyr på navn…"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
                <div className="flex flex-row space-x-4">
                    <Dialog open={open} onOpenChange={setOpen}>
                        <DialogTrigger asChild>
                            <Button onClick={openDialog}>Legg til utstyrtype</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Ny utstyrtype</DialogTitle>
                                <DialogDescription>Legg inn enkel informasjon og lagre.</DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-3">
                                <label className="text-sm font-medium" htmlFor="item-type-title">Tittel</label>
                                <input
                                    id="item-type-title"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Tittel"
                                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                                />
                                <label className="text-sm font-medium" htmlFor="item-type-description">Beskrivelse</label>
                                <textarea
                                    id="item-type-description"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Beskrivelse (valgfritt)"
                                    className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                                />
                                <label className="text-sm font-medium" htmlFor="item-type-certification">Sertifiseringstype</label>
                                <select
                                    id="item-type-certification"
                                    value={certificationType ?? ""}
                                    onChange={(e) => setCertificationType(e.target.value ? parseInt(e.target.value) : null)}
                                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                                >
                                    <option value="">Ingen sertifiseringskrav</option>
                                    {certificateTypes.map((cert) => (
                                        <option key={cert.id} value={cert.id}>
                                            {cert.type}
                                        </option>
                                    ))}
                                </select>
                                {errorMessage ? (
                                    <p className="text-sm text-destructive">{errorMessage}</p>
                                ) : null}
                            </div>
                            <DialogFooter>
                                <Button variant="secondary" onClick={() => setOpen(false)} disabled={submitting}>Avbryt</Button>
                                <Button onClick={handleCreate} disabled={submitting}>Lagre</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                    <Button disabled>Legg til utstyr</Button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered?.map((item) => (
                    <Card key={item.id.toString()} className="overflow-hidden">
                        <CardHeader>
                            {item.img_path ? (
                                <div className="relative w-full h-48 rounded-md overflow-hidden">
                                    <Image src={process.env.NEXT_PUBLIC_SUPABASE_URL + "/storage/v1/object/public/items/types/" + item.img_path + "." + item.img_type} alt="certificate" fill style={{ objectFit: "cover" }} sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw" />
                                </div>
                            ) : (
                                <div className="h-48 w-full rounded-md bg-muted-foreground/10 flex items-center justify-center text-sm">Ingen bilde</div>
                            )}
                            <CardTitle className="text-base">
                                {item.title ?? "Uten tittel"}
                            </CardTitle>
                            <CardDescription className="line-clamp-2">
                                {item.description ?? ""}
                            </CardDescription>
                        </CardHeader>

                        <CardContent className="text-xs text-muted-foreground">
                            <div className="grid gap-1">
                                <div>ID: {item.id.toString()}</div>
                                <div>parent_category: {item.parent_category?.toString() ?? "-"}</div>
                                <div>responsible_activity_group: {item.responsible_activity_group?.toString() ?? "-"}</div>
                                <div>variants: {item.variants?.toString() ?? "-"}</div>
                                <div>certification_type: {item.certification_type?.toString() ?? "-"}</div>
                                <div>img_type: {item.img_type ?? "-"}</div>
                            </div>
                        </CardContent>
                        <CardFooter><Link href={`/dashboard/equipment/by-type/${item.id}`}><Button>Se alle {item.title}</Button></Link></CardFooter>
                    </Card>
                ))}
            </div>

            {filtered?.length === 0 ? (
                <p className="mt-6 text-sm text-muted-foreground">Ingen treff.</p>
            ) : null}
        </main>
    );
}