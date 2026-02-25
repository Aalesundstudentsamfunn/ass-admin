"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useActionState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useActions } from "@/app/dashboard/members/providers";
import { createClient } from "@/lib/supabase/client";
import { watchPrinterQueueStatus } from "@/lib/printer-queue";
import { useAutoPrintSetting } from "@/lib/auto-print";
import { AddMemberDialogGlass } from "@/components/add-member-dialog/glass";
import {
  MemberActivateForm,
  MemberBlockedStatePanel,
  MemberCreateForm,
  MemberEmailCheckForm,
} from "@/components/add-member-dialog/stage-content";
import { enqueueMemberPrintJobs } from "@/lib/members/client-actions";
import type {
  AddMemberDialogStage,
  CheckEmailActionResult,
  QueueActionResult,
} from "@/components/add-member-dialog/types";

/**
 * Add-member modal with 2-step flow:
 * 1) check email
 * 2) create or activate membership depending on existing state.
 */
export function CreateUserDialog() {
  const [open, setOpen] = React.useState(false);
  const [stage, setStage] = React.useState<AddMemberDialogStage>("email");
  const [firstname, setFirstname] = React.useState("");
  const [lastname, setLastname] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [resolvedEmail, setResolvedEmail] = React.useState("");
  const [voluntary, setVoluntary] = React.useState(false);
  const [printPending, setPrintPending] = React.useState(false);
  const [existingMember, setExistingMember] = React.useState<CheckEmailActionResult["member"] | null>(null);
  const { autoPrint } = useAutoPrintSetting();

  const { addNewMember, checkMemberEmail, activateMember } = useActions();
  const [checkState, checkAction, checkPending] = useActionState(checkMemberEmail, {
    ok: false,
  } as CheckEmailActionResult);
  const [createState, createAction, createPending] = useActionState(addNewMember, {
    ok: false,
  } as QueueActionResult);
  const [activateState, activateAction, activatePending] = useActionState(
    activateMember,
    { ok: false } as QueueActionResult,
  );

  const supabase = React.useMemo(() => createClient(), []);
  const toastIdRef = React.useRef<string | number | null>(null);
  const checkSubmittedRef = React.useRef(false);
  const createSubmittedRef = React.useRef(false);
  const activateSubmittedRef = React.useRef(false);
  const unsubscribeRef = React.useRef<(() => void) | null>(null);
  const queueKeyRef = React.useRef<string | null>(null);

  /**
   * Stops any active printer-queue subscription when dialog closes or unmounts.
   */
  const stopQueueWatch = React.useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    queueKeyRef.current = null;
  }, []);

  /**
   * Starts queue watcher after successful create/activate with auto-print enabled.
   */
  const startQueueWatch = React.useCallback(
    ({
      result,
      queuedDescription,
      completedMessage,
    }: {
      result: QueueActionResult;
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
          toast.success(completedMessage, {
            id: toastIdRef.current ?? undefined,
            duration: 10000,
          });
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

    if (checkState.banned) {
      setStage("exists-banned");
    } else if (checkState.active) {
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

  /**
   * Enqueues card printing for an already-existing member found by email lookup.
   */
  const handlePrintExistingMember = React.useCallback(async () => {
    if (!existingMember?.id) {
      toast.error("Fant ikke medlem å skrive ut kort for.");
      return;
    }
    if (existingMember.is_banned === true) {
      toast.error("Kunne ikke sende utskrift for denne brukeren.");
      return;
    }

    setPrintPending(true);
    if (!toastIdRef.current) {
      toastIdRef.current = toast.loading("Sender til utskriftskø...", { duration: 10000 });
    }

    try {
      const { response, payload } = await enqueueMemberPrintJobs([existingMember.id]);
      if (!response.ok) {
        const failureMessage =
          typeof payload?.failed?.[0]?.message === "string"
            ? payload.failed[0].message
            : payload?.error;

        toast.error("Kunne ikke legge til i utskriftskø.", {
          id: toastIdRef.current ?? undefined,
          description:
            typeof failureMessage === "string" && failureMessage.trim()
              ? failureMessage
              : "Ukjent feil.",
          duration: Infinity,
        });
        toastIdRef.current = null;
        return;
      }

      const queueEntry = Array.isArray(payload?.queued) ? payload.queued[0] : null;
      const queueId =
        queueEntry && (typeof queueEntry.queue_id === "string" || typeof queueEntry.queue_id === "number")
          ? queueEntry.queue_id
          : null;
      if (queueId === null) {
        toast.error("Kunne ikke legge til i utskriftskø.", {
          id: toastIdRef.current ?? undefined,
          description: "Ingen kø-ID ble returnert.",
          duration: Infinity,
        });
        toastIdRef.current = null;
        return;
      }

      startQueueWatch({
        result: { ok: true, queueId },
        queuedDescription: "Kort lagt i utskriftskø.",
        completedMessage: "Utskrift sendt til printer.",
      });
    } finally {
      setPrintPending(false);
    }
  }, [existingMember, startQueueWatch]);

  const normalizedEmail = resolvedEmail || email.trim().toLowerCase();
  const isBusy = checkPending || createPending || activatePending || printPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-xl">
          <Plus className="mr-1 h-4 w-4" /> Ny bruker
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md border-0 bg-transparent p-0 shadow-none">
        <AddMemberDialogGlass className="p-[1px]">
          <div className="rounded-2xl bg-background/95 p-6 text-foreground">
            <DialogHeader>
              <DialogTitle>Opprett ny bruker</DialogTitle>
              <DialogDescription className="text-foreground/75">
                Start med e-post. Vi sjekker om medlemskap allerede finnes før oppretting.
              </DialogDescription>
            </DialogHeader>

            <MemberEmailCheckForm
              action={checkAction}
              email={email}
              isBusy={isBusy}
              stage={stage}
              checkPending={checkPending}
              onEmailChange={setEmail}
              onSubmitStart={() => {
                checkSubmittedRef.current = true;
                if (!toastIdRef.current) {
                  toastIdRef.current = toast.loading("Sjekker e-post...", { duration: 10000 });
                }
              }}
            />

            {stage === "create" ? (
              <MemberCreateForm
                action={createAction}
                normalizedEmail={normalizedEmail}
                autoPrint={autoPrint}
                firstname={firstname}
                lastname={lastname}
                voluntary={voluntary}
                isBusy={isBusy}
                createPending={createPending}
                onFirstnameChange={setFirstname}
                onLastnameChange={setLastname}
                onVoluntaryChange={setVoluntary}
                onClose={() => setOpen(false)}
                onSubmitStart={() => {
                  createSubmittedRef.current = true;
                  if (!toastIdRef.current) {
                    toastIdRef.current = toast.loading("Oppretter medlem...", { duration: 10000 });
                  }
                }}
              />
            ) : null}

            {stage === "exists-inactive" ? (
              <MemberActivateForm
                action={activateAction}
                normalizedEmail={normalizedEmail}
                autoPrint={autoPrint}
                voluntary={voluntary}
                existingMember={existingMember}
                isBusy={isBusy}
                activatePending={activatePending}
                onVoluntaryChange={setVoluntary}
                onClose={() => setOpen(false)}
                onSubmitStart={() => {
                  activateSubmittedRef.current = true;
                  if (!toastIdRef.current) {
                    toastIdRef.current = toast.loading("Aktiverer medlemskap...", {
                      duration: 10000,
                    });
                  }
                }}
              />
            ) : null}

            {stage === "exists-active" ? (
              <MemberBlockedStatePanel
                title="E-posten har allerede aktivt medlemskap."
                description="Ny bruker kan ikke opprettes på denne e-posten."
                existingMember={existingMember}
                isBusy={isBusy}
                printPending={printPending}
                onClose={() => setOpen(false)}
                onPrint={handlePrintExistingMember}
              />
            ) : null}

            {stage === "exists-banned" ? (
              <MemberBlockedStatePanel
                title="E-posten kan ikke brukes."
                description="Oppretting eller aktivering er ikke tilgjengelig for denne e-posten."
                existingMember={existingMember}
                isBusy={isBusy}
                onClose={() => setOpen(false)}
              />
            ) : null}
          </div>
        </AddMemberDialogGlass>
      </DialogContent>
    </Dialog>
  );
}
