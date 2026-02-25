"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ItemType } from "./page";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { EquipmentImage } from "@/components/equipment/equipment-image";




export default function WrappedUtstyrPage({ items }: { items: ItemType[] }) {
    const [query, setQuery] = useState("");
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return items;
        return items?.filter((x) => (x.itemname ?? "").toLowerCase().includes(q));
    }, [query, items]);


    return (
        <main className="mx-auto w-full max-w-6xl p-4 md:p-8">
            <div><Button onClick={() => window.history.back()}>← Tilbake</Button></div>
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
                            <div className="relative aspect-square w-full overflow-hidden rounded-md">
                                <EquipmentImage
                                    imgPath={item.img_path}
                                    imgType={item.img_type}
                                    alt={item.itemname ?? "Utstyr"}
                                    fill
                                    className="object-cover"
                                    sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                                />
                            </div>
                            <CardTitle className="text-base">
                                {item.itemname ?? "Uten navn"}
                            </CardTitle>
                            <CardDescription className="line-clamp-2">
                                {item.itemdescription ?? ""}
                            </CardDescription>
                        </CardHeader>

                        <CardContent className="text-xs text-muted-foreground">
                            <div className="grid gap-1">
                                <div>ID: {item.id.toString()}</div>
                                <div>parent_type: {item.parent_type?.toString() ?? "-"}</div>
                                <div>group_id: {item.group_id?.toString() ?? "-"}</div>
                                <div>is_active: {item.is_active?.toString() ?? "-"}</div>
                                <div>location: {item.location ?? "-"}</div>
                                <div>img_type: {item.img_type ?? "-"}</div>
                            </div>
                        </CardContent>
                        <CardFooter><Link href={`/dashboard/equipment/${item.id}`}><Button>Gå til {item.itemname}</Button></Link></CardFooter>
                    </Card>
                ))}
            </div>

            {filtered?.length === 0 ? (
                <p className="mt-6 text-sm text-muted-foreground">Ingen treff.</p>
            ) : null}
        </main>
    );
}
