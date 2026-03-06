"use client";

import { useMemo, useState } from "react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Item } from "./page";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { EquipmentImage } from "@/components/equipment/equipment-image";



export default function WrappedUtstyrPage({ items }: { items: Item[] }) {
    const [query, setQuery] = useState("");
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return items;
        return items?.filter((x) => (x.variant ?? "").toLowerCase().includes(q));
    }, [query, items]);


    return (
        <main className="mx-auto w-full max-w-6xl p-4 md:p-8">
            <div className="mb-4"><Button onClick={() => window.history.back()}>← Tilbake</Button></div>
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
                <Link key={item.id.toString()} href={`/dashboard/equipment/${item.id}`}>
                <Card className="overflow-hidden">
                <CardHeader>
                    <div className="relative aspect-square w-full overflow-hidden rounded-md">
                    <EquipmentImage
                        imgPath={item.img_path}
                        alt={item.variant ?? "Utstyr"}
                        fill
                        className="object-cover"
                        sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                    />
                    </div>
                    <CardTitle className="text-base">
                    {item.variant ?? "Uten navn"}
                    </CardTitle>
                    <CardDescription className="line-clamp-2">
                    {item.itemdescription ?? ""}
                    </CardDescription>
                </CardHeader>

                
                
                </Card></Link>
            ))}
            </div>

            {filtered?.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">Ingen treff.</p>
            ) : null}
        </main>
    );
}
