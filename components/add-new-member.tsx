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
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { watchPrinterQueueStatus } from "@/lib/printer-queue"
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
    const [state, formAction, pending] = useActionState(
        addNewMember,
        { ok: false } as {
            ok: boolean
            error?: string
            queueId?: string | number
            queueRef?: string | number
            queueInvoker?: string
        },
    );
    const supabase = React.useMemo(() => createClient(), [])
    const toastIdRef = React.useRef<string | number | null>(null)
    const submittedRef = React.useRef(false)
    const unsubscribeRef = React.useRef<(() => void) | null>(null)
    const queueKeyRef = React.useRef<string | null>(null)

    useEffect(() => {
        if (!submittedRef.current || pending) {
            return
        }

        if (state?.ok) {
            const queueKey = state?.queueId
                ? `id:${state.queueId}`
                : state?.queueRef && state?.queueInvoker
                  ? `ref:${state.queueRef}:invoker:${state.queueInvoker}`
                  : null

            if (!queueKey) {
                toast.success("Medlem lagt til.", {
                    id: toastIdRef.current ?? undefined,
                    description: "Kortet er lagt i utskriftskø.",
                })
                toastIdRef.current = null
                submittedRef.current = false
                return
            }

            toast.message("Medlem lagt til.", {
                id: toastIdRef.current ?? undefined,
                description: "Kortet ligger i utskriftskø.",
                duration: Infinity,
            })
        } else if (state?.error) {
            toast.error("Kunne ikke opprette medlem.", {
                id: toastIdRef.current ?? undefined,
                description: String(state.error),
            })
            toastIdRef.current = null
        }

        submittedRef.current = false
    }, [state, pending])

    useEffect(() => {
        if (!state?.ok || !toastIdRef.current) {
            return
        }

        const queueId = state?.queueId
        const queueRef = state?.queueRef
        const queueInvoker = state?.queueInvoker
        const queueKey = queueId
            ? `id:${queueId}`
            : queueRef && queueInvoker
              ? `ref:${queueRef}:invoker:${queueInvoker}`
              : null

        if (!queueKey || queueKeyRef.current === queueKey) {
            return
        }

        queueKeyRef.current = queueKey
        if (unsubscribeRef.current) {
            unsubscribeRef.current()
            unsubscribeRef.current = null
        }

        unsubscribeRef.current = watchPrinterQueueStatus(supabase, {
            queueId,
            ref: queueRef,
            refInvoker: queueInvoker,
            onCompleted: () => {
                toast.success("Utskrift fullført.", { id: toastIdRef.current ?? undefined })
                toastIdRef.current = null
                queueKeyRef.current = null
            },
            onError: (message) => {
                toast.error("Utskrift feilet.", { id: toastIdRef.current ?? undefined, description: message })
                toastIdRef.current = null
                queueKeyRef.current = null
            },
        })
    }, [state, supabase])

    useEffect(() => {
        return () => {
            if (unsubscribeRef.current) {
                unsubscribeRef.current()
                unsubscribeRef.current = null
            }
        }
    }, [])

    useEffect(() => {
        if (state?.ok) {
            setFirstname("")
            setLastname("")
            setEmail("")
            setVoluntary(false)
            setOpen(false);
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

                        <form
                            action={formAction}
                            className="mt-4 space-y-4"
                            onSubmit={() => {
                                submittedRef.current = true
                                queueKeyRef.current = null
                                if (unsubscribeRef.current) {
                                    unsubscribeRef.current()
                                    unsubscribeRef.current = null
                                }
                                if (!toastIdRef.current) {
                                    toastIdRef.current = toast.loading("Oppretter medlem...", { duration: Infinity })
                                }
                            }}
                        >
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
