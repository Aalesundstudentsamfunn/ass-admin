"use client";

import * as React from "react";
import { CheckCircle2, Pencil, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  canAssignPrivilege,
  canBanMembers,
  canEditPrivilegeForTarget,
  canEditMemberPrivileges,
  canManageMembers,
  canManageMembershipStatus,
  canSetOwnPrivilege,
  getMaxAssignablePrivilege,
  isMembershipActive,
  memberPrivilege,
} from "@/lib/privilege-checks";
import { copyToClipboard, MemberRow, PRIVILEGE_OPTIONS } from "./shared";

type AddedByProfile = {
  firstname?: string | null;
  lastname?: string | null;
  email?: string | null;
};

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_minmax(0,1fr)] items-center gap-4">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex min-w-0 justify-end text-right">{children}</div>
    </div>
  );
}

function YesNoStatus({ value }: { value: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-medium">
      {value ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
      ) : (
        <XCircle className="h-4 w-4 text-red-500" aria-hidden="true" />
      )}
      {value ? "Ja" : "Nei"}
    </span>
  );
}

function StatusIcon({ value }: { value: boolean }) {
  return value ? (
    <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
  ) : (
    <XCircle className="h-4 w-4 text-red-500" aria-hidden="true" />
  );
}

export function MemberDetailsDialog({
  open,
  onOpenChange,
  member,
  currentUserId,
  currentUserPrivilege,
  onPrivilegeUpdated,
  onMembershipStatusUpdated,
  onNameUpdated,
  onBanUpdated,
  showBanControls = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: MemberRow | null;
  currentUserId?: string | null;
  currentUserPrivilege?: number | null;
  onPrivilegeUpdated: (next: number) => void;
  onMembershipStatusUpdated: (next: boolean) => void;
  onNameUpdated: (firstname: string, lastname: string) => void;
  onBanUpdated: (next: boolean) => void;
  showBanControls?: boolean;
}) {
  const [addedByProfile, setAddedByProfile] = React.useState<AddedByProfile | null>(null);
  const [loadingAddedBy, setLoadingAddedBy] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isEditingName, setIsEditingName] = React.useState(false);
  const [firstnameDraft, setFirstnameDraft] = React.useState("");
  const [lastnameDraft, setLastnameDraft] = React.useState("");

  React.useEffect(() => {
    let active = true;
    const load = async () => {
      if (!open || !member?.added_by) {
        setAddedByProfile(null);
        return;
      }
      setLoadingAddedBy(true);
      const supabase = createClient();
      const { data } = await supabase
        .from("members")
        .select("firstname, lastname, email")
        .eq("id", member.added_by)
        .single<AddedByProfile>();
      if (!active) {
        return;
      }
      setAddedByProfile(data ?? null);
      setLoadingAddedBy(false);
    };

    load();

    return () => {
      active = false;
    };
  }, [open, member?.added_by]);

  React.useEffect(() => {
    setFirstnameDraft(member?.firstname ?? "");
    setLastnameDraft(member?.lastname ?? "");
    setIsEditingName(false);
  }, [member?.id, member?.firstname, member?.lastname]);

  const fullName = member ? `${member.firstname ?? ""} ${member.lastname ?? ""}`.trim() : "";
  const addedByName = addedByProfile
    ? [addedByProfile.firstname ?? "", addedByProfile.lastname ?? ""].join(" ").trim()
    : "";

  const addedByLabel = addedByName || addedByProfile?.email || member?.added_by || "—";
  const createdAtLabel = member?.created_at ? new Date(member.created_at).toLocaleString() : "—";
  const passwordSetLabel = member?.password_set_at ? new Date(member.password_set_at).toLocaleString() : null;
  const passwordIsSet = Boolean(member?.password_set_at);
  const currentPrivilege = typeof currentUserPrivilege === "number" ? currentUserPrivilege : null;
  const targetPrivilege = memberPrivilege(member?.privilege_type);
  const isSelf = Boolean(currentUserId && member?.id && String(currentUserId) === String(member.id));
  const canEditName = canManageMembers(currentPrivilege);
  const canEditTarget = canEditMemberPrivileges(currentPrivilege);
  const canEditThisTarget = canEditPrivilegeForTarget(currentPrivilege, targetPrivilege);
  const canEditMembershipStatus = canManageMembershipStatus(currentPrivilege);
  const canViewBanControls = showBanControls && canBanMembers(currentPrivilege);
  const allowedMax = getMaxAssignablePrivilege(currentPrivilege);
  const selectDisabled = !canEditTarget || !canEditThisTarget || isSaving || !member?.id;
  const membershipActive = isMembershipActive(member?.is_membership_active);
  const banned = member?.is_banned === true;
  const membershipDisabled = !canEditMembershipStatus || isSaving || !member?.id;
  const allowedOptions =
    allowedMax === null
      ? []
      : PRIVILEGE_OPTIONS.filter((option) => option.value <= allowedMax).filter((option) =>
          canAssignPrivilege(currentPrivilege, option.value, targetPrivilege),
        );
  const currentPrivilegeOption =
    PRIVILEGE_OPTIONS.find((option) => option.value === targetPrivilege) ?? {
      value: targetPrivilege,
      label: `Nivå ${targetPrivilege}`,
    };
  const privilegeSelectOptions =
    allowedOptions.some((option) => option.value === targetPrivilege)
      ? allowedOptions
      : [currentPrivilegeOption, ...allowedOptions];

  const handlePrivilegeChange = async (value: string) => {
    if (!member) {
      return;
    }
    const next = Number(value);
    if (!Number.isFinite(next) || next === targetPrivilege) {
      return;
    }
    if (isSelf && !canSetOwnPrivilege(currentPrivilege, next)) {
      toast.error("Du kan ikke gi deg selv høyere tilgangsnivå.");
      return;
    }
    if (!canAssignPrivilege(currentPrivilege, next, targetPrivilege)) {
      toast.error("Ugyldig tilgangsnivå for din rolle.");
      return;
    }
    const supabase = createClient();
    const toastId = toast.loading("Oppdaterer tilgangsnivå...", { duration: 10000 });
    setIsSaving(true);
    const { error } = await supabase.from("members").update({ privilege_type: next }).eq("id", member.id);
    if (error) {
      toast.error("Kunne ikke oppdatere tilgangsnivå.", {
        id: toastId,
        description: error.message,
        duration: Infinity,
      });
      setIsSaving(false);
      return;
    }
    onPrivilegeUpdated(next);
    toast.success("Tilgangsnivå oppdatert.", { id: toastId, duration: 6000 });
    setIsSaving(false);
  };

  const handleMembershipStatusChange = async (value: string) => {
    if (!member) {
      return;
    }
    const next = value === "true";
    if (next === membershipActive) {
      return;
    }
    if (!canEditMembershipStatus) {
      toast.error("Du har ikke tilgang til å endre medlemsstatus.");
      return;
    }

    const toastId = toast.loading("Oppdaterer medlemsstatus...", { duration: 10000 });
    setIsSaving(true);
    const response = await fetch("/api/admin/members/membership-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ member_id: member.id, is_active: next }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast.error("Kunne ikke oppdatere medlemsstatus.", {
        id: toastId,
        description: payload?.error ?? "Ukjent feil.",
        duration: Infinity,
      });
      setIsSaving(false);
      return;
    }
    onMembershipStatusUpdated(next);
    toast.success("Medlemsstatus oppdatert.", { id: toastId, duration: 6000 });
    setIsSaving(false);
  };

  const handleNameSave = async () => {
    if (!member) {
      return;
    }
    if (!canEditName) {
      toast.error("Du har ikke tilgang til å oppdatere navn.");
      return;
    }
    const firstname = firstnameDraft.trim();
    const lastname = lastnameDraft.trim();
    if (!firstname || !lastname) {
      toast.error("Fornavn og etternavn er påkrevd.");
      return;
    }
    if (firstname === (member.firstname ?? "") && lastname === (member.lastname ?? "")) {
      return;
    }

    const toastId = toast.loading("Oppdaterer navn...", { duration: 10000 });
    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/members/update-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: member.id, firstname, lastname }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error("Kunne ikke oppdatere navn.", {
          id: toastId,
          description: payload?.error ?? "Ukjent feil.",
          duration: Infinity,
        });
        setIsSaving(false);
        return;
      }
      onNameUpdated(firstname, lastname);
      toast.success("Navn oppdatert.", { id: toastId, duration: 6000 });
    } catch (error: unknown) {
      toast.error("Kunne ikke oppdatere navn.", {
        id: toastId,
        description: error instanceof Error ? error.message : "Ukjent feil.",
        duration: Infinity,
      });
    }
    setIsSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Medlemsdetaljer</DialogTitle>
          <DialogDescription>Informasjon om valgt medlem.</DialogDescription>
        </DialogHeader>
        {member ? (
          <div className="grid gap-2 text-sm">
            <DetailRow label="UUID">
              <span className="font-medium">
                <span className="relative inline-flex items-center group">
                  <button
                    type="button"
                    className="underline-offset-2 hover:underline"
                    onClick={(event) => {
                      event.stopPropagation();
                      copyToClipboard(String(member.id), "UUID");
                    }}
                  >
                    {member.id}
                  </button>
                  <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground/90 px-2 py-1 text-[10px] text-background opacity-0 transition-opacity group-hover:opacity-100">
                    Kopier
                  </span>
                </span>
              </span>
            </DetailRow>
            {canEditName ? (
              <div className="grid gap-2">
                <DetailRow label="Navn">
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 font-medium hover:opacity-80 ml-auto"
                    onClick={() => setIsEditingName((prev) => !prev)}
                  >
                    <Pencil className="h-4 w-4" />
                    <span>{fullName || "—"}</span>
                  </button>
                </DetailRow>
                {isEditingName ? (
                  <div className="flex w-full flex-wrap items-center gap-2">
                    <Input
                      value={firstnameDraft}
                      onChange={(event) => setFirstnameDraft(event.target.value)}
                      placeholder="Fornavn"
                      className="h-8 min-w-[9rem] flex-1"
                      disabled={isSaving}
                    />
                    <Input
                      value={lastnameDraft}
                      onChange={(event) => setLastnameDraft(event.target.value)}
                      placeholder="Etternavn"
                      className="h-8 min-w-[9rem] flex-1"
                      disabled={isSaving}
                    />
                    <div className="ml-auto flex items-center gap-2">
                      <Button size="sm" variant="outline" className="rounded-xl" onClick={handleNameSave} disabled={isSaving}>
                        Lagre
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="rounded-xl"
                        disabled={isSaving}
                        onClick={() => {
                          setFirstnameDraft(member?.firstname ?? "");
                          setLastnameDraft(member?.lastname ?? "");
                          setIsEditingName(false);
                        }}
                      >
                        Avbryt
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <DetailRow label="Navn">
                <span className="font-medium">{fullName || "—"}</span>
              </DetailRow>
            )}
            <DetailRow label="E-post">
              {member.email ? (
                <span className="font-medium">
                  <span className="relative inline-flex items-center group">
                    <button
                      type="button"
                      className="underline-offset-2 hover:underline"
                      onClick={(event) => {
                        event.stopPropagation();
                        copyToClipboard(member.email ?? "", "E-post");
                      }}
                    >
                      {member.email}
                    </button>
                    <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground/90 px-2 py-1 text-[10px] text-background opacity-0 transition-opacity group-hover:opacity-100">
                      Kopier
                    </span>
                  </span>
                </span>
              ) : (
                <span className="font-medium">—</span>
              )}
            </DetailRow>
            <DetailRow label="Tilgangsnivå">
              {canEditTarget && canEditThisTarget ? (
                <select
                  value={targetPrivilege}
                  disabled={selectDisabled}
                  onChange={(event) => handlePrivilegeChange(event.target.value)}
                  className="h-8 w-40 rounded-xl border border-border/60 bg-background/60 px-2 text-xs"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {privilegeSelectOptions.map((option) => (
                    <option
                      key={option.value}
                      value={option.value}
                      disabled={option.value === targetPrivilege}
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="font-medium">{PRIVILEGE_OPTIONS.find((option) => option.value === targetPrivilege)?.label ?? `Nivå ${targetPrivilege}`}</span>
              )}
            </DetailRow>
            {canEditMembershipStatus ? (
              <DetailRow label="Aktivt medlemskap">
                <span className="inline-flex items-center gap-2">
                  <StatusIcon value={membershipActive} />
                  <select
                    value={String(membershipActive)}
                    disabled={membershipDisabled}
                    onChange={(event) => handleMembershipStatusChange(event.target.value)}
                    className="h-8 w-24 rounded-xl border border-border/60 bg-background/60 px-2 text-xs"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    <option value="true">Ja</option>
                    <option value="false">Nei</option>
                  </select>
                </span>
              </DetailRow>
            ) : (
              <DetailRow label="Aktivt medlemskap">
                <YesNoStatus value={membershipActive} />
              </DetailRow>
            )}
            <DetailRow label="Passord satt">
              <span className="inline-flex items-center gap-2 font-medium">
                <YesNoStatus value={passwordIsSet} />
                {passwordSetLabel ? <span className="text-muted-foreground">({passwordSetLabel})</span> : null}
              </span>
            </DetailRow>
            {canViewBanControls ? (
              <DetailRow label="Konto status">
                <span className="inline-flex items-center gap-2 font-medium">
                  {!banned ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
                      <span>OK</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 text-red-500" aria-hidden="true" />
                      <span>Bannlyst</span>
                    </>
                  )}
                </span>
              </DetailRow>
            ) : null}
            <DetailRow label="Lagt til av">
              <span className="font-medium">{loadingAddedBy ? "Laster..." : addedByLabel}</span>
            </DetailRow>
            <DetailRow label="Opprettet">
              <span className="font-medium">{createdAtLabel}</span>
            </DetailRow>
            {member.email ? (
              <div className="flex justify-end pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl"
                  onClick={async () => {
                    const toastId = toast.loading("Sender passordlenke...", { duration: 10000 });
                    try {
                      const res = await fetch("/api/admin/members/password-reset", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ email: member.email }),
                      });
                      if (!res.ok) {
                        const payload = await res.json().catch(() => ({}));
                        toast.error("Kunne ikke sende passordlenke.", {
                          id: toastId,
                          description: payload?.error ?? "Ukjent feil.",
                          duration: Infinity,
                        });
                        return;
                      }
                      toast.success("Passordlenke sendt.", { id: toastId, duration: 6000 });
                    } catch (error: unknown) {
                      toast.error("Kunne ikke sende passordlenke.", {
                        id: toastId,
                        description: error instanceof Error ? error.message : "Ukjent feil.",
                        duration: Infinity,
                      });
                    }
                  }}
                >
                  Send passordlenke
                </Button>
              </div>
            ) : null}
            {canViewBanControls ? (
              <div className="flex justify-end pt-2">
                <Button
                  size="sm"
                  variant={banned ? "outline" : "destructive"}
                  className="rounded-xl"
                  disabled={isSaving || isSelf}
                  onClick={async () => {
                    if (isSelf) {
                      toast.error("Du kan ikke banne deg selv.");
                      return;
                    }
                    const nextBanned = !banned;
                    const confirmed = window.confirm(
                      nextBanned
                        ? "Er du sikker på at du vil banne denne brukeren?"
                        : "Er du sikker på at du vil oppheve bannlysning for denne brukeren?",
                    );
                    if (!confirmed) {
                      return;
                    }
                    const toastId = toast.loading(
                      nextBanned ? "Banner bruker..." : "Opphever bannlysning...",
                      { duration: 10000 },
                    );
                    setIsSaving(true);
                    try {
                      const res = await fetch("/api/admin/members/ban", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ member_id: member.id, is_banned: nextBanned }),
                      });
                      const payload = await res.json().catch(() => ({}));
                      if (!res.ok) {
                        toast.error(nextBanned ? "Kunne ikke banne bruker." : "Kunne ikke oppheve bannlysning.", {
                          id: toastId,
                          description: payload?.error ?? "Ukjent feil.",
                          duration: Infinity,
                        });
                        setIsSaving(false);
                        return;
                      }
                      toast.success(
                        nextBanned ? "Bruker ble bannlyst." : "Bannlysning opphevet.",
                        { id: toastId, duration: 6000 },
                      );
                      if (nextBanned) {
                        onMembershipStatusUpdated(false);
                      }
                      onBanUpdated(nextBanned);
                    } catch (error: unknown) {
                      toast.error(nextBanned ? "Kunne ikke banne bruker." : "Kunne ikke oppheve bannlysning.", {
                        id: toastId,
                        description: error instanceof Error ? error.message : "Ukjent feil.",
                        duration: Infinity,
                      });
                    }
                    setIsSaving(false);
                  }}
                >
                  {banned ? "Opphev bannlysning" : "Ban bruker"}
                </Button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">Ingen medlem valgt.</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
