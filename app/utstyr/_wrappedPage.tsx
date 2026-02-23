"use client";

import Image from "next/image";
import * as React from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type Item = {
    id: number;
    itemname: string;
    img_path: string | null;
    img_type: string | null;
};

type ReservationWithItem = {
    id: number;
    start_time: string | null;
    end_time: string;
    is_returned: boolean;
    item: Item | null;
};

function cn(...classes: Array<string | false | null | undefined>) {
    return classes.filter(Boolean).join(" ");
}

function daysDiffCeil(from: Date, to: Date) {
    const ms = to.getTime() - from.getTime();
    return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function dueText(endIso: string) {
    const now = new Date();
    const end = new Date(endIso);

    // Dager igjen: positiv => før frist, negativ => over
    const d = daysDiffCeil(now, end);

    if (d >= 0) {
        // 0 dager igjen => “i dag”
        if (d === 0) return { text: "Må leveres i dag", overdue: false };
        return { text: `Må leveres innen ${d} dager`, overdue: false };
    } else {
        const overdueDays = Math.abs(d);
        return {
            text:
                overdueDays === 1
                    ? "1 dag over fristen"
                    : `${overdueDays} dager over fristen`,
            overdue: true,
        };
    }
}

export default function UtstyrClient({
    firstname,
    reservations,
    oldReservations,
}: {
    firstname: string;
    reservations: ReservationWithItem[];
    oldReservations: ReservationWithItem[];
}) {
    const anyOverdue = reservations.some((r) => dueText(r.end_time).overdue);

    return (
        <main className="min-h-screen bg-background p-6 text-foreground">
            <div className="mx-auto max-w-4xl space-y-8">
                {/* Header */}
                <div>
                    <h1 className="text-3xl font-semibold">Hei {firstname}</h1>
                    <p className="text-muted-foreground">
                        Her ser du utstyr du har lånt.
                    </p>
                </div>

                {/* Overdue warning */}
                {anyOverdue && (
                    <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300">
                        <p className="font-semibold">Du har lån som er over fristen.</p>
                        <p className="text-sm mt-1">
                            Hvis utstyr ikke leveres i tide kan det føre til sperring for
                            videre utlån, varsling til ansvarlig, og krav om erstatning ved
                            tap/skade.
                        </p>
                    </div>
                )}

                {/* Aktive lån */}
                <section className="space-y-4">
                    <h2 className="text-xl font-semibold">Aktive lån</h2>

                    {reservations.length > 0 ? (
                        <div className="space-y-4">
                            {reservations.map((res) => {
                                const due = dueText(res.end_time);

                                return (
                                    <div
                                        key={res.id}
                                        className="flex items-center gap-4 rounded-xl border p-4"
                                    >
                                        {/* Bilde */}
                                        {res.item?.img_path ? (
                                            <Image
                                                src={
                                                    process.env.NEXT_PUBLIC_SUPABASE_URL +
                                                    "/storage/v1/object/public/items/" +
                                                    res.item.img_path +
                                                    "." +
                                                    res.item.img_type
                                                }
                                                alt={res.item.itemname}
                                                width={80}
                                                height={80}
                                                className="h-20 w-20 rounded-lg object-cover"
                                            />
                                        ) : (
                                            <div className="h-20 w-20 rounded-lg bg-muted" />
                                        )}

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium truncate">
                                                {res.item?.itemname ?? "Ukjent utstyr"}
                                            </p>

                                            <p className="text-sm text-muted-foreground">
                                                {res.start_time
                                                    ? new Date(res.start_time).toLocaleDateString("no-NO")
                                                    : "—"}{" "}
                                                – {new Date(res.end_time).toLocaleDateString("no-NO")}
                                            </p>

                                            {/* Midt-tekst: frist */}
                                            <p
                                                className={cn(
                                                    "mt-1 text-sm font-medium",
                                                    due.overdue ? "text-red-600 dark:text-red-300" : "text-foreground/75 dark:text-foreground/70"
                                                )}
                                            >
                                                {due.text}
                                            </p>
                                        </div>

                                        {/* Handlinger */}
                                        <ReturnDialog reservationId={res.id} itemName={res.item?.itemname ?? "utstyr"} />

                                        <div
                                            className={cn(
                                                "text-sm font-medium",
                                                due.overdue ? "text-red-600 dark:text-red-300" : "text-emerald-700 dark:text-emerald-300"
                                            )}
                                        >
                                            Aktivt lån
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="rounded-xl border p-8 text-center text-muted-foreground">
                            Du har ingen aktive lån.
                        </div>
                    )}
                </section>

                {/* Tidligere lån */}
                <section className="space-y-4 pt-6">
                    <h2 className="text-xl font-semibold">Tidligere lån</h2>

                    {oldReservations.length > 0 ? (
                        <div className="space-y-4">
                            {oldReservations.map((res) => (
                                <div
                                    key={res.id}
                                    className="flex items-center gap-4 rounded-xl border p-4"
                                >
                                    {res.item?.img_path ? (
                                        <Image
                                            src={
                                                process.env.NEXT_PUBLIC_SUPABASE_URL +
                                                "/storage/v1/object/public/items/" +
                                                res.item.img_path +
                                                "." +
                                                res.item.img_type
                                            }
                                            alt={res.item.itemname}
                                            width={80}
                                            height={80}
                                            className="h-20 w-20 rounded-lg object-cover"
                                        />
                                    ) : (
                                        <div className="h-20 w-20 rounded-lg bg-muted" />
                                    )}

                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium truncate">
                                            {res.item?.itemname ?? "Ukjent utstyr"}
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            {res.start_time
                                                ? new Date(res.start_time).toLocaleDateString("no-NO")
                                                : "—"}{" "}
                                            – {new Date(res.end_time).toLocaleDateString("no-NO")}
                                        </p>
                                    </div>

                                    <div className="text-sm font-medium text-foreground/70 dark:text-foreground/65">
                                        Returnert
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="rounded-xl border p-8 text-center text-muted-foreground">
                            Du har ingen tidligere lån.
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
}

function ReturnDialog({
    reservationId,
    itemName
}: {
    reservationId: number;
    itemName: string;
}) {
    const [open, setOpen] = React.useState(false);
    const [confirmText, setConfirmText] = React.useState("");

    const required = "jeg er juridisk ansvarlig for dette utstyret";
    const ok = confirmText.trim().toLowerCase() === required;
    const router = useRouter();
    async function onConfirm() {
        if (!ok) return;

        const supabase = await createClient();
        const { error } = await supabase.schema("item_schema").rpc("return_reservation_tx", {
            p_reservation_id: reservationId,
            p_returned_photo_id: null, // eller fil-id
        });

        if (error) {
            toast.error("Det skjedde en feil ved innlevering: " + error.message);
            return;
        }

        toast.success("Utstyr levert tilbake. Takk for at du leverer i tide!");
        setOpen(false);
        setConfirmText("");
        router.refresh();
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline">Lever utstyr</Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-[520px]">
                <DialogHeader>
                    <DialogTitle>Lever tilbake</DialogTitle>
                    <DialogDescription>
                        Du er i ferd med å levere tilbake: <span className="font-medium">{itemName}</span>.
                        <br />
                        Skriv{" "}
                        <span className="font-medium">
                            {"\""}
                            {required}
                            {"\""}
                        </span>{" "}
                        for å bekrefte at du har levert utstyret tilbake i tilsvarende eller bedre stand, og at utstyret er levert tilbake til enten; naustet, aktivitetansvarlig, eller kontoret. Er du usikker ikke klikk lever, men oppsøk kontoret.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-2">
                    <Input
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        placeholder={`Skriv \"${required}\" for å bekrefte`}
                    />
                    {!ok && confirmText.length > 0 && (
                        <p className="text-sm text-red-600">
                            Du må skrive nøyaktig: {required}
                        </p>
                    )}
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        Avbryt
                    </Button>
                    <Button onClick={onConfirm} disabled={!ok}>
                        Bekreft levering
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
