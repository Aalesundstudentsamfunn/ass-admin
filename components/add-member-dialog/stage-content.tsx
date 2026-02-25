import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AddMemberDialogStage, CheckEmailActionResult } from "./types";

/**
 * Form for first-step email validation.
 */
export function MemberEmailCheckForm({ action, email, isBusy, stage, checkPending, onEmailChange, onSubmitStart }: { action: (payload: FormData) => void; email: string; isBusy: boolean; stage: AddMemberDialogStage; checkPending: boolean; onEmailChange: (value: string) => void; onSubmitStart: () => void }) {
  return (
    <form action={action} className="mt-4 space-y-3" onSubmit={onSubmitStart}>
      <div className="space-y-2">
        <Label htmlFor="email-check" className="text-foreground">
          E-post
        </Label>
        <Input id="email-check" type="email" name="email" placeholder="ola@example.com" value={email} onChange={(event) => onEmailChange(event.target.value)} required className="h-12 rounded-xl border-zinc-400/80 bg-white text-zinc-900 placeholder:text-zinc-500 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-400" />
      </div>
      <div className="flex justify-end">
        <Button type="submit" variant="outline" className="h-12 rounded-xl border-border/90 bg-background/95 text-foreground hover:bg-accent" disabled={isBusy}>
          {checkPending ? "Sjekker..." : stage === "email" ? "Sjekk e-post" : "Sjekk på nytt"}
        </Button>
      </div>
    </form>
  );
}

/**
 * Form for creating a brand new member after email check.
 */
export function MemberCreateForm({ action, normalizedEmail, autoPrint, firstname, lastname, isBusy, createPending, onFirstnameChange, onLastnameChange, onClose, onSubmitStart }: { action: (payload: FormData) => void; normalizedEmail: string; autoPrint: boolean; firstname: string; lastname: string; isBusy: boolean; createPending: boolean; onFirstnameChange: (value: string) => void; onLastnameChange: (value: string) => void; onVoluntaryChange: (value: boolean) => void; onClose: () => void; onSubmitStart: () => void }) {
  return (
    <form action={action} className="mt-4 space-y-4" onSubmit={onSubmitStart}>
      <input type="hidden" name="email" value={normalizedEmail} />
      <input type="hidden" name="autoPrint" value={autoPrint ? "true" : "false"} />

      <div className="space-y-2">
        <Label htmlFor="firstname" className="text-foreground">
          Fornavn
        </Label>
        <Input id="firstname" name="firstname" placeholder="Ola" value={firstname} onChange={(event) => onFirstnameChange(event.target.value)} required className="h-12 rounded-xl border-zinc-400/80 bg-white text-zinc-900 placeholder:text-zinc-500 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-400" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="lastname" className="text-foreground">
          Etternavn
        </Label>
        <Input id="lastname" name="lastname" placeholder="Nordmann" value={lastname} onChange={(event) => onLastnameChange(event.target.value)} required className="h-12 rounded-xl border-zinc-400/80 bg-white text-zinc-900 placeholder:text-zinc-500 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-400" />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onClose} className="h-11 rounded-xl border border-border/80 bg-background text-foreground hover:bg-accent" disabled={isBusy}>
          Avbryt
        </Button>
        <Button className="h-11 rounded-xl font-semibold" disabled={isBusy}>
          {createPending ? "Oppretter..." : "Opprett medlem"}
        </Button>
      </div>
    </form>
  );
}

/**
 * Form for re-activating an inactive membership.
 */
export function MemberActivateForm({ action, normalizedEmail, existingMember, isBusy, activatePending, onClose, onSubmitStart }: { action: (payload: FormData) => void; normalizedEmail: string; existingMember: CheckEmailActionResult["member"] | null; isBusy: boolean; activatePending: boolean; onClose: () => void; onSubmitStart: () => void }) {
  return (
    <form action={action} className="mt-4 space-y-4" onSubmit={onSubmitStart}>
      <input type="hidden" name="email" value={normalizedEmail} />

      <ExistingMemberNotice title="E-posten finnes allerede i databasen." description="Du kan aktivere medlemskapet, men ikke opprette ny bruker på samme e-post." member={existingMember} />

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onClose} className="h-11 rounded-xl border border-border/80 bg-background text-foreground hover:bg-accent" disabled={isBusy}>
          Avbryt
        </Button>
        <Button className="h-11 rounded-xl font-semibold" disabled={isBusy}>
          {activatePending ? "Aktiverer..." : "Aktiver medlemskap"}
        </Button>
      </div>
    </form>
  );
}

/**
 * Passive info panel for active/banned email states where mutation is blocked.
 */
export function MemberBlockedStatePanel({ title, description, existingMember, isBusy, printPending = false, onClose, onPrint }: { title: string; description: string; existingMember: CheckEmailActionResult["member"] | null; isBusy: boolean; printPending?: boolean; onClose: () => void; onPrint?: () => void }) {
  return (
    <div className="mt-4 space-y-4">
      <ExistingMemberNotice title={title} description={description} member={existingMember} />
      <div className="flex justify-end gap-2 pt-2">
        {onPrint ? (
          <Button type="button" variant="outline" onClick={onPrint} className="h-11 rounded-xl border-border/90 bg-background/95 text-foreground hover:bg-accent" disabled={isBusy}>
            {printPending ? "Sender til utskriftskø..." : "Print kort"}
          </Button>
        ) : null}
        <Button type="button" variant="secondary" onClick={onClose} className="h-11 rounded-xl border border-border/80 bg-background text-foreground hover:bg-accent" disabled={isBusy}>
          Lukk
        </Button>
      </div>
    </div>
  );
}

/**
 * Shared notice block that shows why email cannot proceed directly.
 */
function ExistingMemberNotice({ title, description, member }: { title: string; description: string; member: CheckEmailActionResult["member"] | null }) {
  return (
    <div className="rounded-xl border border-border/90 bg-card/95 p-4 text-sm shadow-sm">
      <p className="font-semibold text-foreground">{title}</p>
      <p className="text-foreground/80">{description}</p>
      {member ? (
        <p className="mt-2 text-sm text-foreground/75">
          {member.firstname} {member.lastname} · {member.email}
        </p>
      ) : null}
    </div>
  );
}
