"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useActions } from "@/app/dashboard/members/providers";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { watchPrinterQueueStatus } from "@/lib/printer-queue";
import { useActionState, useEffect } from "react";
import { useAutoPrintSetting } from "@/lib/auto-print";

type QueueResult = {
  ok: boolean;
  error?: string;
  autoPrint?: boolean;
  queueId?: string | number;
  queueRef?: string | number;
  queueInvoker?: string;
};

type CheckResult = {
  ok: boolean;
  error?: string;
  exists?: boolean;
  active?: boolean;
  email?: string;
  member?: {
    id: string;
    firstname: string;
    lastname: string;
    email: string;
    privilege_type: number | null;
  };
};

type Stage = "email" | "create" | "exists-active" | "exists-inactive";

function Glass({ className = "", children }: React.PropsWithChildren<{ className?: string }>) {
  return <div className={`relative rounded-2xl border backdrop-blur-xl ` + `bg-white/65 border-white/50 shadow-[0_1px_0_rgba(255,255,255,0.6),0_10px_30px_-10px_rgba(16,24,40,0.25)] ` + `dark:bg-white/5 dark:border-white/10 dark:shadow-[0_1px_0_rgba(255,255,255,0.07),0_20px_60px_-20px_rgba(0,0,0,0.6)] ` + className}>{children}</div>;
}

export function CreateUserDialog() {
  const [open, setOpen] = React.useState(false);
  const [stage, setStage] = React.useState<Stage>("email");
  const [firstname, setFirstname] = React.useState("");
  const [lastname, setLastname] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [resolvedEmail, setResolvedEmail] = React.useState("");
  const [voluntary, setVoluntary] = React.useState(false);
  const [existingMember, setExistingMember] = React.useState<CheckResult["member"] | null>(null);
  const { autoPrint } = useAutoPrintSetting();

  const { addNewMember, checkMemberEmail, activateMember } = useActions();
  const [checkState, checkAction, checkPending] = useActionState(checkMemberEmail, { ok: false } as CheckResult);
  const [createState, createAction, createPending] = useActionState(addNewMember, { ok: false } as QueueResult);
  const [activateState, activateAction, activatePending] = useActionState(activateMember, { ok: false } as QueueResult);

  const supabase = React.useMemo(() => createClient(), []);
  const toastIdRef = React.useRef<string | number | null>(null);
  const checkSubmittedRef = React.useRef(false);
  const createSubmittedRef = React.useRef(false);
  const activateSubmittedRef = React.useRef(false);
  const unsubscribeRef = React.useRef<(() => void) | null>(null);
  const queueKeyRef = React.useRef<string | null>(null);

  const stopQueueWatch = React.useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    queueKeyRef.current = null;
  }, []);

  const startQueueWatch = React.useCallback(
    ({
      result,
      queuedDescription,
      completedMessage,
    }: {
      result: QueueResult;
      queuedDescription: string;
      completedMessage: string;
    }) => {
      const queueId = result?.queueId;
      const queueRef = result?.queueRef;
      const queueInvoker = result?.queueInvoker;
      const queueKey = queueId
        ? `id:${queueId}`
        : queueRef && queueInvoker
          ? `ref:${queueRef}:invoker:${queueInvoker}`
          : null;

      if (!queueKey) {
        toast.success(completedMessage, {
          id: toastIdRef.current ?? undefined,
          duration: 10000,
        });
        toastIdRef.current = null;
        return;
      }

      if (queueKeyRef.current === queueKey) {
        return;
      }

      stopQueueWatch();
      queueKeyRef.current = queueKey;

      toast.loading("Venter på utskrift...", {
        id: toastIdRef.current ?? undefined,
        description: queuedDescription,
        duration: Infinity,
      });

      unsubscribeRef.current = watchPrinterQueueStatus(supabase, {
        queueId,
        ref: queueRef,
        refInvoker: queueInvoker,
        timeoutMs: 25000,
        timeoutErrorMessage: "Sjekk printer-PCen. Hvis den er offline, kontakt IT.",
        onCompleted: () => {
          toast.success(completedMessage, { id: toastIdRef.current ?? undefined, duration: 10000 });
          toastIdRef.current = null;
          queueKeyRef.current = null;
        },
        onError: (message) => {
          toast.error("Utskrift feilet.", {
            id: toastIdRef.current ?? undefined,
            description: message,
            duration: Infinity,
          });
          toastIdRef.current = null;
          queueKeyRef.current = null;
        },
        onTimeout: () => {
          toast.error("Utskrift tar lengre tid enn vanlig.", {
            id: toastIdRef.current ?? undefined,
            description: "Sjekk printer-PCen. Hvis den er offline, kontakt IT.",
            duration: Infinity,
          });
        },
      });
    },
    [stopQueueWatch, supabase],
  );

  useEffect(() => {
    if (!checkSubmittedRef.current || checkPending) {
      return;
    }

    if (!checkState?.ok) {
      toast.error("Kunne ikke sjekke e-post.", {
        id: toastIdRef.current ?? undefined,
        description: checkState?.error ?? "Ukjent feil.",
        duration: Infinity,
      });
      toastIdRef.current = null;
      checkSubmittedRef.current = false;
      return;
    }

    const nextEmail = String(checkState.email ?? email).trim().toLowerCase();
    setResolvedEmail(nextEmail);

    if (!checkState.exists) {
      setStage("create");
      setExistingMember(null);
      toast.success("E-post er ledig. Du kan opprette nytt medlem.", {
        id: toastIdRef.current ?? undefined,
        duration: 6000,
      });
      toastIdRef.current = null;
      checkSubmittedRef.current = false;
      return;
    }

    setExistingMember(checkState.member ?? null);
    const existing = checkState.member;
    if (existing) {
      setFirstname(existing.firstname ?? "");
      setLastname(existing.lastname ?? "");
    }

    if (checkState.active) {
      setStage("exists-active");
    } else {
      setStage("exists-inactive");
    }

    if (toastIdRef.current) {
      toast.dismiss(toastIdRef.current);
    }
    toastIdRef.current = null;
    checkSubmittedRef.current = false;
  }, [checkPending, checkState, email]);

  useEffect(() => {
    if (!createSubmittedRef.current || createPending) {
      return;
    }

    if (!createState?.ok) {
      toast.error("Kunne ikke opprette medlem.", {
        id: toastIdRef.current ?? undefined,
        description: String(createState?.error ?? "Ukjent feil."),
        duration: Infinity,
      });
      toastIdRef.current = null;
      createSubmittedRef.current = false;
      return;
    }

    if (createState?.autoPrint === false) {
      toast.success("Medlem opprettet.", {
        id: toastIdRef.current ?? undefined,
        description: "Auto-utskrift er deaktivert. Trykk Print kort for å skrive ut.",
        duration: 10000,
      });
      toastIdRef.current = null;
    } else {
      startQueueWatch({
        result: createState,
        queuedDescription: "Medlem opprettet og ligger i utskriftskø.",
        completedMessage: "Medlem opprettet og utskrift fullført.",
      });
    }

    createSubmittedRef.current = false;
    setFirstname("");
    setLastname("");
    setEmail("");
    setResolvedEmail("");
    setVoluntary(false);
    setExistingMember(null);
    setStage("email");
    setOpen(false);
  }, [createPending, createState, startQueueWatch]);

  useEffect(() => {
    if (!activateSubmittedRef.current || activatePending) {
      return;
    }

    if (!activateState?.ok) {
      toast.error("Kunne ikke aktivere medlemskap.", {
        id: toastIdRef.current ?? undefined,
        description: String(activateState?.error ?? "Ukjent feil."),
        duration: Infinity,
      });
      toastIdRef.current = null;
      activateSubmittedRef.current = false;
      return;
    }

    if (activateState?.autoPrint === false) {
      toast.success("Medlemskap aktivert.", {
        id: toastIdRef.current ?? undefined,
        description: "Auto-utskrift er deaktivert. Trykk Print kort for å skrive ut.",
        duration: 10000,
      });
      toastIdRef.current = null;
    } else {
      startQueueWatch({
        result: activateState,
        queuedDescription: "Medlemskap aktivert og lagt i utskriftskø.",
        completedMessage: "Medlemskap aktivert og utskrift fullført.",
      });
    }

    activateSubmittedRef.current = false;
    setFirstname("");
    setLastname("");
    setEmail("");
    setResolvedEmail("");
    setVoluntary(false);
    setExistingMember(null);
    setStage("email");
    setOpen(false);
  }, [activatePending, activateState, startQueueWatch]);

  useEffect(() => {
    if (!open) {
      stopQueueWatch();
      setStage("email");
      setExistingMember(null);
      setResolvedEmail("");
      setFirstname("");
      setLastname("");
      setVoluntary(false);
    }
  }, [open, stopQueueWatch]);

  useEffect(() => {
    return () => {
      stopQueueWatch();
    };
  }, [stopQueueWatch]);

  const normalizedEmail = resolvedEmail || email.trim().toLowerCase();
  const isBusy = checkPending || createPending || activatePending;

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
              <DialogDescription>
                Start med e-post. Vi sjekker om medlemskap allerede finnes før oppretting.
              </DialogDescription>
            </DialogHeader>

            <form
              action={checkAction}
              className="mt-4 space-y-3"
              onSubmit={() => {
                checkSubmittedRef.current = true;
                if (!toastIdRef.current) {
                  toastIdRef.current = toast.loading("Sjekker e-post...", { duration: 10000 });
                }
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="email-check">E-post</Label>
                <Input
                  id="email-check"
                  type="email"
                  name="email"
                  placeholder="ola@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  className="rounded-xl"
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit" variant="outline" className="rounded-xl" disabled={isBusy}>
                  {checkPending ? "Sjekker..." : stage === "email" ? "Sjekk e-post" : "Sjekk på nytt"}
                </Button>
              </div>
            </form>

            {stage === "create" ? (
              <form
                action={createAction}
                className="mt-4 space-y-4"
                onSubmit={() => {
                  createSubmittedRef.current = true;
                  if (!toastIdRef.current) {
                    toastIdRef.current = toast.loading("Oppretter medlem...", { duration: 10000 });
                  }
                }}
              >
                <input type="hidden" name="email" value={normalizedEmail} />
                <input type="hidden" name="autoPrint" value={autoPrint ? "true" : "false"} />

                <div className="space-y-2">
                  <Label htmlFor="firstname">Fornavn</Label>
                  <Input
                    id="firstname"
                    name="firstname"
                    placeholder="Ola"
                    value={firstname}
                    onChange={(event) => setFirstname(event.target.value)}
                    required
                    className="rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lastname">Etternavn</Label>
                  <Input
                    id="lastname"
                    name="lastname"
                    placeholder="Nordmann"
                    value={lastname}
                    onChange={(event) => setLastname(event.target.value)}
                    required
                    className="rounded-xl"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox id="voluntary-create" name="voluntary" checked={voluntary} onCheckedChange={(v) => setVoluntary(!!v)} />
                  <Label htmlFor="voluntary-create">Frivillig</Label>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="secondary" onClick={() => setOpen(false)} className="rounded-xl" disabled={isBusy}>
                    Avbryt
                  </Button>
                  <Button className="rounded-xl" disabled={isBusy}>
                    {createPending ? "Oppretter..." : "Opprett medlem"}
                  </Button>
                </div>
              </form>
            ) : null}

            {stage === "exists-inactive" ? (
              <form
                action={activateAction}
                className="mt-4 space-y-4"
                onSubmit={() => {
                  activateSubmittedRef.current = true;
                  if (!toastIdRef.current) {
                    toastIdRef.current = toast.loading("Aktiverer medlemskap...", { duration: 10000 });
                  }
                }}
              >
                <input type="hidden" name="email" value={normalizedEmail} />
                <input type="hidden" name="autoPrint" value={autoPrint ? "true" : "false"} />

                <div className="rounded-xl border border-border/60 bg-background/50 p-3 text-sm">
                  <p className="font-medium">E-posten finnes allerede i databasen.</p>
                  <p className="text-muted-foreground">Du kan aktivere medlemskapet, men ikke opprette ny bruker på samme e-post.</p>
                  {existingMember ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {existingMember.firstname} {existingMember.lastname} · {existingMember.email}
                    </p>
                  ) : null}
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox id="voluntary-activate" name="voluntary" checked={voluntary} onCheckedChange={(v) => setVoluntary(!!v)} />
                  <Label htmlFor="voluntary-activate">Aktiver som frivillig</Label>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="secondary" onClick={() => setOpen(false)} className="rounded-xl" disabled={isBusy}>
                    Avbryt
                  </Button>
                  <Button className="rounded-xl" disabled={isBusy}>
                    {activatePending ? "Aktiverer..." : "Aktiver medlemskap"}
                  </Button>
                </div>
              </form>
            ) : null}

            {stage === "exists-active" ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-xl border border-border/60 bg-background/50 p-3 text-sm">
                  <p className="font-medium">E-posten har allerede aktivt medlemskap.</p>
                  <p className="text-muted-foreground">Ny bruker kan ikke opprettes på denne e-posten.</p>
                  {existingMember ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {existingMember.firstname} {existingMember.lastname} · {existingMember.email}
                    </p>
                  ) : null}
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="secondary" onClick={() => setOpen(false)} className="rounded-xl" disabled={isBusy}>
                    Lukk
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </Glass>
      </DialogContent>
    </Dialog>
  );
}
