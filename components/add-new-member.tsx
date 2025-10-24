"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { useActions } from "@/app/dashboard/members/providers"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Plus } from "lucide-react"
import { useActionState, useEffect } from "react"

// Liquid glass wrapper
function Glass({ className = "", children }: React.PropsWithChildren<{ className?: string }>) {
    return (
        <div
            className={
                `relative rounded-2xl border backdrop-blur-xl ` +
                `bg-white/65 border-white/50 shadow-[0_1px_0_rgba(255,255,255,0.6),0_10px_30px_-10px_rgba(16,24,40,0.25)] ` +
                `dark:bg-white/5 dark:border-white/10 dark:shadow-[0_1px_0_rgba(255,255,255,0.07),0_20px_60px_-20px_rgba(0,0,0,0.6)] ` +
                className
            }
        >
            {children}
        </div>
    )
}

export function CreateUserDialog() {
    const [open, setOpen] = React.useState(false)
    const [firstname, setFirstname] = React.useState("")
    const [lastname, setLastname] = React.useState("")
    const [email, setEmail] = React.useState("")
    const [voluntary, setVoluntary] = React.useState(false)

    const { addNewMember } = useActions();
    const [state, formAction, pending] = useActionState(addNewMember, { ok: false });

    useEffect(() => {
        if (state?.ok) {
            setFirstname("")
            setLastname("")
            setEmail("")
            setVoluntary(false)
            setOpen(false);
            state.ok = false;
        }
    }, [state, setOpen, setFirstname, setLastname, setEmail, setVoluntary]);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="rounded-xl">
                    <Plus className="mr-1 h-4 w-4" /> Ny bruker
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md border-0 bg-transparent p-0 shadow-none">
                <Glass className="p-[1px]">
                    <div className="rounded-2xl bg-transparent p-6">
                        <DialogHeader>
                            <DialogTitle>Opprett ny bruker</DialogTitle>
                            <DialogDescription>Fyll inn informasjonen under for å legge til en ny bruker.</DialogDescription>
                        </DialogHeader>

                        <form action={formAction} className="mt-4 space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="firstname">Fornavn</Label>
                                <Input
                                    id="firstname"
                                    name="firstname"
                                    placeholder="Ola"
                                    value={firstname}
                                    onChange={(e) => setFirstname(e.target.value)}
                                    required
                                    className="rounded-xl"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="lastname">Etternavn</Label>
                                <Input
                                    id="lastname"
                                    placeholder="Nordmann"
                                    name="lastname"
                                    value={lastname}
                                    onChange={(e) => setLastname(e.target.value)}
                                    required
                                    className="rounded-xl"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="email">E-post</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="ola@example.com"
                                    name="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="rounded-xl"
                                />
                            </div>

                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="voluntary"
                                    name="voluntary"
                                    checked={voluntary}
                                    onCheckedChange={(v) => setVoluntary(!!v)}
                                />
                                <Label htmlFor="voluntary">Frivillig</Label>
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <Button type="button" variant="secondary" onClick={() => setOpen(false)} className="rounded-xl">
                                    Avbryt
                                </Button>
                                <Button className="rounded-xl" disabled={pending}>
                                    {pending ? "Oppretter..." : "Opprett"}
                                </Button>
                            </div>
                            {state.error && <p className="text-red-800">Feil: {state.error}</p>}
                        </form>
                    </div>
                </Glass>
            </DialogContent>
        </Dialog>
    )
}
