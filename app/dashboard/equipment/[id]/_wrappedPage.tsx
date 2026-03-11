/**
 * Client-side presentation and interaction layer for `equipment/[id]/_wrappedPage.tsx`.
 */
"use client"
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
    const [editOpen, setEditOpen] = React.useState(false);

    const [range, setRange] = React.useState<DateRangeState>({});
    const [email, setEmail] = React.useState("");
    const [emailStatus, setEmailStatus] = React.useState<
        "idle" | "checking" | "valid" | "invalid"
    >("idle");
    const [emailMsg, setEmailMsg] = React.useState<string>("");

    // Edit form state
    const [editName, setEditName] = React.useState(item.variant);
    const [editDescription, setEditDescription] = React.useState(item.itemdescription ?? "");
    const [editImagePath, setEditImagePath] = React.useState(
        item.img_path && item.img_path.length > 0 ? item.img_path[0] : ""
    );
    const [editIsActive, setEditIsActive] = React.useState(item.is_active);
    const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
    const [imagePreview, setImagePreview] = React.useState<string | null>(null);
    const [isUploading, setIsUploading] = React.useState(false);

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
                    .from("members")
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
        const { data: pdata, error: pError } = await supabase.from("members").select("id").eq("email", email.trim().toLowerCase()).maybeSingle();
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

        const { error: UpdateItemError, data: res } = await supabase.schema("item_schema").from("item").update({ is_rented: true }).eq("id", item.id);
        console.log("Update item result:", { error: UpdateItemError, res });

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

    function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith("image/")) {
            toast.error("Kun bildefiler er tillatt");
            return;
        }

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            toast.error("Bildet er for stort (maks 10MB)");
            return;
        }

        setSelectedFile(file);

        // Create preview
        const reader = new FileReader();
        reader.onload = (e) => {
            setImagePreview(e.target?.result as string);
        };
        reader.readAsDataURL(file);
    }

    async function onEditSubmit() {
        if (!editName.trim()) {
            toast.error("Navn kan ikke være tomt.");
            return;
        }

        setIsUploading(true);

        try {
            // Only update fields that have actually changed
            const updates: any = {};
            
            if (editName.trim() !== item.variant) {
                updates.variant = editName.trim();
            }
            
            const trimmedDescription = editDescription && typeof editDescription === 'string' ? editDescription.trim() : '';
            if (trimmedDescription !== (item.itemdescription || '')) {
                updates.itemdescription = trimmedDescription || null;
            }
            
            // Check if is_active changed
            if (editIsActive !== item.is_active) {
                updates.is_active = editIsActive;
            }
            
            // Handle image upload if a new file was selected
            if (selectedFile) {
                const formData = new FormData();
                formData.append("file", selectedFile);
                formData.append("itemId", item.id);
                
                const currentImagePath = item.img_path && item.img_path.length > 0 ? item.img_path[0] : null;
                if (currentImagePath) {
                    formData.append("oldImagePath", currentImagePath);
                }

                const response = await fetch("/api/equipment/upload-image", {
                    method: "POST",
                    body: formData,
                });

                const result = await response.json();

                if (!response.ok || !result.success) {
                    toast.error(result.error || "Bildeopplasting feilet");
                    setIsUploading(false);
                    return;
                }

                // Image path is already updated by the upload API
                // Don't add to updates since API handles it
            }
            
            // If nothing changed, don't update
            if (Object.keys(updates).length === 0) {
                // Check if only image was uploaded
                if (selectedFile) {
                    toast.success("Bilde oppdatert!");
                    setEditOpen(false);
                    setSelectedFile(null);
                    setImagePreview(null);
                    setIsUploading(false);
                    router.refresh();
                    return;
                }
                toast.info("Ingen endringer å lagre.");
                setEditOpen(false);
                setIsUploading(false);
                return;
            }
            
            // Update item via API
            const response = await fetch("/api/equipment/update-item", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    itemId: item.id,
                    updates: updates,
                }),
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                toast.error(result.error || "Oppdatering feilet");
                setIsUploading(false);
                return;
            }

            toast.success("Utstyr oppdatert!");
            setEditOpen(false);
            setSelectedFile(null);
            setImagePreview(null);
            setIsUploading(false);
            router.refresh();
        } catch (error) {
            console.error("Error updating equipment:", error);
            toast.error("En uventet feil oppstod");
            setIsUploading(false);
        }
    }

    return (
        <main className="space-y-6 text-foreground">
            <header className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                    <h1 className="text-2xl font-semibold lg:text-3xl">Rediger og lei ut</h1>
                    <p className="text-sm text-muted-foreground">
                        Detaljer for valgt utstyr.
                    </p>
                </div>
                <Button variant="outline" onClick={() => window.history.back()}>
                    ← Tilbake
                </Button>
            </header>

            <div className="mx-auto grid max-w-6xl items-start gap-6 xl:grid-cols-[minmax(340px,1fr)_minmax(440px,1fr)]">
                {/* VENSTRE SIDE – BILDE */}
                <section className="relative aspect-[10/11] w-full overflow-hidden rounded-2xl border border-border/60 bg-muted/20">
                    <EquipmentImage
                        imgPath={item.img_path}
                        alt={item.variant ?? "Utstyr"}
                        fill
                        priority
                        className="object-cover"
                        sizes="(max-width: 1280px) 100vw, 480px"
                    />
                </section>

                {/* HØYRE SIDE – INFO */}
                <section className="rounded-2xl border border-border/60 bg-card/40 p-5 lg:p-7">
                    <div className="space-y-6">
                        <h2 className="text-2xl font-semibold lg:text-4xl">
                            {item.variant}
                        </h2>

                        <div className="flex flex-wrap gap-3">
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
                        <div className="grid gap-3 pt-4 sm:grid-cols-2">
                            <Dialog open={open} onOpenChange={setOpen}>
                                <DialogTrigger asChild>
                                    <Button className="flex-1" disabled={!item.is_active || item.is_rented}>
                                        Lei ut
                                    </Button>
                                </DialogTrigger>

                                <DialogContent className="sm:max-w-[520px]">
                                    <DialogHeader>
                                        <DialogTitle>Lei ut: {item.variant}</DialogTitle>
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
                                                E-posten må finnes i systemet (public.members). Be bruker registrere seg på admin.astudent.no/utstyr hvis de ikke har gjort det, og kontakt it hvis det er problemer med registrering.
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

                            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="outline" className="flex-1">
                                        Rediger
                                    </Button>
                                </DialogTrigger>

                                <DialogContent className="sm:max-w-[520px]">
                                    <DialogHeader>
                                        <DialogTitle>Rediger utstyr</DialogTitle>
                                        <DialogDescription>
                                            Oppdater navn, beskrivelse, status og bilde for dette utstyret.
                                        </DialogDescription>
                                    </DialogHeader>

                                    <div className="flex items-center space-x-2">
                                            <Checkbox
                                                id="edit-is-active"
                                                checked={editIsActive}
                                                onCheckedChange={(checked) => setEditIsActive(checked === true)}
                                                disabled={isUploading}
                                            />
                                            <Label
                                                htmlFor="edit-is-active"
                                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                            >
                                                Aktivt
                                            </Label>
                                        </div>
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="edit-name">Navn *</Label>
                                            <Input
                                                id="edit-name"
                                                placeholder="Utstyrsnavn"
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="edit-description">Beskrivelse</Label>
                                            <textarea
                                                id="edit-description"
                                                placeholder="Beskrivelse av utstyret..."
                                                value={editDescription}
                                                onChange={(e) => setEditDescription(e.target.value)}
                                                rows={4}
                                                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                            />
                                        </div>

                                        
                                        

                                        <div className="space-y-2">
                                            <Label htmlFor="edit-image">Bilde</Label>
                                            <Input
                                                id="edit-image"
                                                type="file"
                                                accept="image/*"
                                                onChange={handleFileSelect}
                                                disabled={isUploading}
                                            />
                                           
                                            {imagePreview && (
                                                <div className="mt-2">
                                                    <img
                                                        src={imagePreview}
                                                        alt="Preview"
                                                        className="h-32 w-auto rounded-md border object-cover"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <DialogFooter className="gap-2 sm:gap-0">
                                        <Button variant="outline" onClick={() => setEditOpen(false)} disabled={isUploading}>
                                            Avbryt
                                        </Button>
                                        <Button onClick={onEditSubmit} className="min-w-[140px]" disabled={isUploading}>
                                            {isUploading ? "Lagrer..." : "Lagre endringer"}
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
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
