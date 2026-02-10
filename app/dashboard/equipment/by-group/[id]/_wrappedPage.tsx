"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ItemType } from "./page";
import { Button } from "@/components/ui/button";
import Link from "next/link";




export default function WrappedUtstyrPage({ items }: { items: ItemType[] }) {
    const [query, setQuery] = useState("");
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return items;
        return items?.filter((x) => (x.title ?? "").toLowerCase().includes(q));
    }, [query, items]);



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
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered?.map((item) => (
                    <Card key={item.id.toString()} className="overflow-hidden">

                        <CardHeader>
                            {item.img_url ? (
                                // request image through our proxy API so the server includes the Authorization header
                                <div className="relative w-full h-48 rounded-md overflow-hidden">
                                    <Image src={process.env.NEXT_PUBLIC_SUPABASE_URL + "/storage/v1/object/public/items/types/" + item.img_url + "." + item.img_type} alt="certificate" fill style={{ objectFit: "cover" }} sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw" />
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