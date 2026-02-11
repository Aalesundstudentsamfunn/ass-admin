"use client"
import Image from "next/image";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ItemType } from "./page";
import { Button } from "@/components/ui/button";

// DEMO-item (bytt med data fra db)


function formatDate(iso: string) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("nb-NO");
}

function Badge({
    children,
    variant = "default",
}: {
    children: React.ReactNode;
    variant?: "default" | "success" | "muted";
}) {
    const classes =
        variant === "success"
            ? "bg-emerald-100 text-emerald-800"
            : variant === "muted"
                ? "bg-muted text-muted-foreground"
                : "bg-primary/10 text-primary";

    return (
        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${classes}`}>
            {children}
        </span>
    );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="grid grid-cols-3 gap-3 py-2">
            <div className="text-sm text-muted-foreground">{label}</div>
            <div className="col-span-2 text-sm">{value}</div>
        </div>
    );
}

export default function WrappedItemPage({ item }: { item: ItemType }) {
    return (
        <main className="mx-auto w-full max-w-4xl p-4 md:p-8">
            <div>            <div><Button onClick={() => window.history.back()}>← Tilbake</Button></div></div>
            <div className="mb-6">
                <h1 className="text-2xl font-semibold">Item</h1>
                <p className="text-sm text-muted-foreground">Detaljer for valgt utstyr.</p>
            </div>

            <Card className="overflow-hidden">
                {item.img_url ? (
                    <div className="relative h-56 w-full">
                        <Image
                            src={process.env.NEXT_PUBLIC_SUPABASE_URL + "/storage/v1/object/public/items/" + item.img_url + "." + item.img_type}
                            alt={item.itemname}
                            fill
                            className="object-cover"
                            sizes="(max-width: 1024px) 100vw, 768px"
                        />
                    </div>
                ) : null}

                <CardHeader className="gap-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <CardTitle className="text-xl">{item.itemname}</CardTitle>
                        <div className="flex items-center gap-2">
                            <Badge variant={item.is_active ? "success" : "muted"}>
                                {item.is_active ? "Aktiv" : "Inaktiv"}
                            </Badge>
                            <Badge variant="default">{item.location}</Badge>
                        </div>
                    </div>

                    {item.itemdescription ? (
                        <CardDescription className="max-w-2xl">{item.itemdescription}</CardDescription>
                    ) : (
                        <CardDescription className="italic">Ingen beskrivelse</CardDescription>
                    )}
                </CardHeader>

                <CardContent>
                    <div className="rounded-lg border">
                        <div className="px-4 py-3 text-sm font-medium">Metadata</div>
                        <div className="px-4">
                            <Row label="ID" value={item.id} />
                            <div className="h-px w-full bg-border" />
                            <Row label="Opprettet" value={formatDate(item.created_at)} />
                            <div className="h-px w-full bg-border" />
                            <Row label="Parent type" value={item.parent_type ?? <span className="text-muted-foreground">-</span>} />
                            <div className="h-px w-full bg-border" />
                            <Row label="Group ID" value={item.group_id ?? <span className="text-muted-foreground">-</span>} />
                            <div className="h-px w-full bg-border" />
                            <Row label="Bildeformat" value={item.img_type ?? <span className="text-muted-foreground">-</span>} />
                        </div>
                    </div>
                </CardContent>
            </Card>
        </main>
    );
}