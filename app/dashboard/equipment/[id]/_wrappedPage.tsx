/**
 * Client-side presentation and interaction layer for `equipment/[id]/_wrappedPage.tsx`.
 */
"use client"
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { EquipmentImage } from "@/components/equipment/equipment-image";

import { createClient } from "@/lib/supabase/client";
import { ItemType } from "./page";
import { useRouter } from "next/navigation";

type DateRangeState = {
    from?: Date;
    to?: Date;
};

function toDateInputValue(date?: Date) {
    if (!date) {
        return "";
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function fromDateInputValue(value: string) {
    if (!value) {
        return undefined;
    }
    const parsed = new Date(`${value}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

/**
 * Renders wrapped item page.
 *
 */
export default function WrappedItemPage({ item }: { item: ItemType }) {
    const [open, setOpen] = React.useState(false);

    const [range, setRange] = React.useState<DateRangeState>({});
    const [email, setEmail] = React.useState("");
    const [emailStatus, setEmailStatus] = React.useState<
        "idle" | "checking" | "valid" | "invalid"
    >("idle");
    const [emailMsg, setEmailMsg] = React.useState<string>("");

    const canSubmit = Boolean(range?.from && range?.to && emailStatus === "valid");
    const router = useRouter();

    const disabledFrom = new Date()// do not disable today, as same-day rental might be desired. just disable past dates.
    disabledFrom.setDate(disabledFrom.getDate() - 1);
    const minDate = toDateInputValue(new Date(disabledFrom.getTime() + 24 * 60 * 60 * 1000));

    // Debounced “does email exist in public.profiles?”
    React.useEffect(() => {
        const trimmed = email.trim();

        // reset states
        if (!trimmed) {
            setEmailStatus("idle");
            setEmailMsg("");
            return;
        }

        // Basic email shape check first (avoid spamming DB)
        const emailLike =
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) && trimmed.length <= 254;
        if (!emailLike) {
            setEmailStatus("invalid");
            setEmailMsg("Ugyldig e-postformat.");
            return;
        }

        setEmailStatus("checking");
        setEmailMsg("Sjekker e-post...");

        const t = setTimeout(async () => {
            try {
                const supabase = createClient();

                // IMPORTANT:
                // - table is usually "profiles" (not "profile")
                // - column might be "email" (change if yours differs)
                const { data, error } = await supabase
                    .from("profiles")
                    .select("id")
                    .eq("email", trimmed.toLowerCase())
                    .maybeSingle();

                if (error) {
                    // If RLS blocks this, you'll get an error here.
                    // In that case, solve with an RPC or a service-side check.
                    setEmailStatus("invalid");
                    setEmailMsg("Kunne ikke verifisere e-post (tilgang/regel).");
                    return;
                }

                if (data?.id) {
                    setEmailStatus("valid");
                    setEmailMsg("E-post funnet.");
                } else {
                    setEmailStatus("invalid");
                    setEmailMsg("Fant ingen bruker med denne e-posten.");
                }
            } catch {
                setEmailStatus("invalid");
                setEmailMsg("Noe gikk galt ved sjekk av e-post.");
            }
        }, 350);

        return () => clearTimeout(t);
    }, [email]);

    async function onSubmit() {
        if (!canSubmit) {
            toast.error("Feil.")
            return;
        }

        // Her kan du lage reservasjon i DB senere
        // f.eks. insert i item_schema.item_reservation
        console.log("Submit rental:", {
            item_id: item.id,
            from: range?.from?.toISOString(),
            to: range?.to?.toISOString(),
            email: email.trim(),
        });
        const supabase = await createClient();
        const { data: pdata, error: pError } = await supabase.from("profiles").select("id").eq("email", email.trim().toLowerCase()).maybeSingle();
        if (pError || !pdata?.id) {
            toast.error("Kunne ikke finne bruker for gitt e-post.");
            return;
        }

        if (item.certification_type) {
            const { data: certData, error: certError } = await supabase
                .from("certificate")
                .select("*")
                .eq("type", item.certification_type)
                .eq("holder", pdata.id)
                .single();

            if (certError || !certData) {
                toast.error("Låner mangler nødvendig sertifisering for dette utstyret.");
                return;
            }
        }

        const lenderId = await supabase.auth.getUser().then(res => res.data.user?.id);
        if (!lenderId) {
            toast.error("Kunne ikke verifisere utleier.");
            return;
        }
        const { error } = await supabase.schema("item_schema").from("item_reservation").insert({
            item_id: item.id,
            start_time: range?.from?.toISOString(),
            end_time: range?.to?.toISOString(),
            user_id: pdata.id,
            lenderId: lenderId,
            number_of_extends: 0,
        });

        if (error) {
            toast.error("Feil ved opprettelse av reservasjon. feil: " + error.message);
            return;
        }

        const { error: UpdateItemError } = await supabase.schema("item_schema").from("item").update({ is_rented: true }).eq("id", item.id);

        if (UpdateItemError) {
            toast.error("Feil ved oppdatering av utstyr. kontakt it. feil: " + UpdateItemError.message);
        }

        toast.success("Utlån opprettet!");

        setOpen(false);
        setRange({});
        setEmail("");
        setEmailStatus("idle");
        setEmailMsg("");
        router.refresh();
    }

    return (
        <main className="space-y-6 text-foreground">
            <div>
                <Button variant="outline" onClick={() => window.history.back()}>
                    ← Tilbake
                </Button>
            </div>

            <div className="mb-6">
                <h1 className="text-2xl font-semibold">Rediger og lei ut {item.itemname}</h1>
                <p className="text-sm text-muted-foreground">
                    Detaljer for valgt utstyr.
                </p>
            </div>

            <div className="mx-auto max-w-6xl overflow-hidden rounded-2xl border border-border/60 bg-transparent lg:grid lg:grid-cols-2">
                {/* VENSTRE SIDE – BILDE */}
                <section className="bg-muted/20 lg:sticky lg:top-0 lg:h-screen lg:border-r lg:border-border/60">
                    <div className="relative w-full aspect-[4/3] lg:h-full lg:aspect-auto">
                        <EquipmentImage
                            imgPath={item.img_path}
                            imgType={item.img_type}
                            alt={item.itemname}
                            fill
                            priority
                            className="object-cover"
                            sizes="(max-width: 1024px) 100vw, 50vw"
                        />
                    </div>
                </section>

                {/* HØYRE SIDE – INFO */}
                <section className="lg:h-screen lg:overflow-y-auto">
                    <div className="px-4 py-6 lg:px-8 lg:py-8 space-y-6">
                        <h1 className="text-2xl font-semibold lg:text-4xl">
                            {item.itemname}
                        </h1>

                        <div className="flex flex-row space-x-4">
                            <div>
                                <span
                                    className={`inline-block rounded-full px-4 py-1 text-sm ${item.is_active
                                        ? "bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-500/25 dark:text-emerald-300"
                                        : "bg-rose-500/15 text-rose-700 ring-1 ring-rose-500/25 dark:text-rose-300"
                                        }`}
                                >
                                    {item.is_active ? "Aktiv" : "Deaktivert / mistet / ødelagt"}
                                </span>
                            </div>
                            {
                                item.is_active && (
                                    <div>
                                        <span
                                            className={`inline-block rounded-full px-4 py-1 text-sm ${item.is_rented
                                                ? "bg-amber-500/15 text-amber-700 ring-1 ring-amber-500/25 dark:text-amber-300"
                                                : "bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-500/25 dark:text-emerald-300"
                                                }`}
                                        >
                                            {item.is_rented ? "Utlånt" : "Tilgjengelig"}
                                        </span>
                                    </div>
                                )
                            }
                        </div>

                        <div>
                            <p className="text-sm text-muted-foreground">Lokasjon</p>
                            <p className="font-medium">{item.location}</p>
                        </div>

                        {item.itemdescription && (
                            <div>
                                <p className="mb-2 text-sm text-muted-foreground">Beskrivelse</p>
                                <p className="whitespace-pre-line text-foreground/90">
                                    {item.itemdescription}
                                </p>
                            </div>
                        )}

                        <div>
                            <p className="mb-2 text-sm font-bold">Krav til sertifisering</p>
                            <p className="whitespace-pre-line text-foreground/90">
                                {item.certification_type
                                    ? `Dette utstyret krever sertifisering av typen ${item.certification_type_name} (${item.certification_type_description}).`
                                    : "Dette utstyret har ingen sertifiseringskrav."}
                            </p>
                        </div>

                        {/* Knapper */}
                        <div className="flex gap-3 pt-4">
                            <Dialog open={open} onOpenChange={setOpen}>
                                <DialogTrigger asChild>
                                    <Button className="flex-1" disabled={!item.is_active || item.is_rented}>
                                        Lei ut
                                    </Button>
                                </DialogTrigger>

                                <DialogContent className="sm:max-w-[520px]">
                                    <DialogHeader>
                                        <DialogTitle>Lei ut: {item.itemname}</DialogTitle>
                                        <DialogDescription>
                                            Les gjennom reglene nøye. Hvis du er usikker kontakt it.
                                        </DialogDescription>
                                    </DialogHeader>

                                    {/* Regler (filler) */}
                                    <div className="space-y-2 text-sm text-foreground/90">
                                        <p className="font-medium">Krav: (kortversjon)</p>
                                        <ul className="list-disc pl-5 space-y-1">
                                            <li>Opplys låner om reglene.</li>
                                            <li>Be låner registrere bruker på admin.astudent.no/utstyr og les igjennom reglene.</li>
                                            <li>Sjekk evt sertifisering.</li>
                                            <li>Både utlåner og låner blir logget.</li>
                                            <li>Fyll inn eposten til låner, ikke din!</li>
                                            <li>For øyeblikket er maks utlånsperiode: 1 uke.</li>
                                        </ul>
                                    </div>

                                    {/* Dato range */}
                                    <div className="space-y-2">
                                        <Label>Periode</Label>
                                        <div className="grid gap-2 sm:grid-cols-2">
                                            <div className="space-y-1">
                                                <Label htmlFor="rent-from" className="text-xs text-muted-foreground">
                                                    Fra
                                                </Label>
                                                <Input
                                                    id="rent-from"
                                                    type="date"
                                                    min={minDate}
                                                    value={toDateInputValue(range.from)}
                                                    onChange={(event) => {
                                                        const from = fromDateInputValue(event.target.value);
                                                        setRange((prev) => {
                                                            const nextTo =
                                                                prev.to && from && prev.to < from ? undefined : prev.to;
                                                            return { from, to: nextTo };
                                                        });
                                                    }}
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label htmlFor="rent-to" className="text-xs text-muted-foreground">
                                                    Til
                                                </Label>
                                                <Input
                                                    id="rent-to"
                                                    type="date"
                                                    min={toDateInputValue(range.from) || minDate}
                                                    value={toDateInputValue(range.to)}
                                                    onChange={(event) => {
                                                        const to = fromDateInputValue(event.target.value);
                                                        setRange((prev) => ({ from: prev.from, to }));
                                                    }}
                                                    disabled={!range.from}
                                                />
                                            </div>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            {range.from && range.to
                                                ? `Valgt periode: ${range.from.toLocaleDateString("nb-NO")} – ${range.to.toLocaleDateString("nb-NO")}`
                                                : "Du må velge både start- og sluttdato."}
                                        </p>
                                    </div>

                                    {/* Email */}
                                    <div className="space-y-2">
                                        <Label htmlFor="email">E-post</Label>
                                        <Input
                                            id="email"
                                            placeholder="navn@domene.no"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            autoComplete="email"
                                        />
                                        <p
                                            className={cn(
                                                "text-xs",
                                                emailStatus === "valid" && "text-green-700",
                                                (emailStatus === "invalid" || emailStatus === "checking") &&
                                                "text-muted-foreground"
                                            )}
                                        >
                                            {emailMsg}
                                        </p>
                                        {emailStatus === "invalid" && (
                                            <p className="text-xs text-red-600">
                                                E-posten må finnes i systemet (public.profiles). Be bruker registrere seg på admin.astudent.no/utstyr hvis de ikke har gjort det, og kontakt it hvis det er problemer med registrering.
                                            </p>
                                        )}
                                    </div>

                                    <DialogFooter className="gap-2 sm:gap-0">
                                        <Button variant="outline" onClick={() => setOpen(false)}>
                                            Avbryt
                                        </Button>
                                        <Button
                                            onClick={onSubmit}
                                            disabled={!canSubmit}
                                            className="min-w-[140px]"
                                        >
                                            Registrer lån
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>

                            <Button variant="outline" className="flex-1">
                                Rediger
                            </Button>
                        </div>

                        <div>
                            <p className="italic whitespace-pre-line text-muted-foreground">For å levere bruk admin.astudent.no/utstyr</p>
                        </div>

                        <div className="pt-6 text-xs text-muted-foreground">
                            Lagt til: {new Date(item.created_at).toLocaleDateString("no-NO")}
                        </div>
                    </div>
                </section>
            </div>
        </main>
    );
}
