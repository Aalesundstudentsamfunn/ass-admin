"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  canAssignPrivilege,
  canEditMemberPrivileges,
  canManageMembers,
  canSetOwnPrivilege,
  getMaxAssignablePrivilege,
} from "@/lib/privilege-checks";
import { copyToClipboard, MemberRow, PRIVILEGE_OPTIONS } from "./shared";

type AddedByProfile = {
  firstname?: string | null;
  lastname?: string | null;
  email?: string | null;
};

export function MemberDetailsDialog({
  open,
  onOpenChange,
  member,
  currentUserId,
  currentUserPrivilege,
  onPrivilegeUpdated,
  onMembershipStatusUpdated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: MemberRow | null;
  currentUserId?: string | null;
  currentUserPrivilege?: number | null;
  onPrivilegeUpdated: (next: number) => void;
  onMembershipStatusUpdated: (next: boolean) => void;
}) {
  const [addedByProfile, setAddedByProfile] = React.useState<AddedByProfile | null>(null);
  const [loadingAddedBy, setLoadingAddedBy] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

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

  const fullName = member ? `${member.firstname ?? ""} ${member.lastname ?? ""}`.trim() : "";
  const addedByName = addedByProfile
    ? [addedByProfile.firstname ?? "", addedByProfile.lastname ?? ""].join(" ").trim()
    : "";

  const addedByLabel = addedByName || addedByProfile?.email || member?.added_by || "—";
  const createdAtLabel = member?.created_at ? new Date(member.created_at).toLocaleString() : "—";
  const passwordSetLabel = member?.password_set_at ? new Date(member.password_set_at).toLocaleString() : null;
  const currentPrivilege = typeof currentUserPrivilege === "number" ? currentUserPrivilege : null;
  const targetPrivilege = typeof member?.privilege_type === "number" ? member?.privilege_type : 1;
  const isSelf = Boolean(currentUserId && member?.id && String(currentUserId) === String(member.id));
  const canEditTarget = canEditMemberPrivileges(currentPrivilege);
  const canEditMembership = canManageMembers(currentPrivilege);
  const allowedMax = getMaxAssignablePrivilege(currentPrivilege);
  const selectDisabled = !canEditTarget || isSaving || !member?.id;
  const membershipActive =
    typeof member?.is_membership_active === "boolean"
      ? member.is_membership_active
      : (member?.privilege_type ?? 0) >= 1;
  const membershipDisabled = !canEditMembership || isSaving || !member?.id;
  const allowedOptions =
    allowedMax === null ? [] : PRIVILEGE_OPTIONS.filter((option) => option.value <= allowedMax);

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
    if (!canAssignPrivilege(currentPrivilege, next)) {
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
    if (!canEditMembership) {
      toast.error("Du har ikke tilgang til å endre medlemsstatus.");
      return;
    }

    const supabase = createClient();
    const toastId = toast.loading("Oppdaterer medlemsstatus...", { duration: 10000 });
    setIsSaving(true);
    const { error } = await supabase.from("members").update({ is_membership_active: next }).eq("id", member.id);
    if (error) {
      toast.error("Kunne ikke oppdatere medlemsstatus.", {
        id: toastId,
        description: error.message,
        duration: Infinity,
      });
      setIsSaving(false);
      return;
    }
    onMembershipStatusUpdated(next);
    toast.success("Medlemsstatus oppdatert.", { id: toastId, duration: 6000 });
    setIsSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Medlemsdetaljer</DialogTitle>
          <DialogDescription>Informasjon om valgt medlem.</DialogDescription>
        </DialogHeader>
        {member ? (
          <div className="grid gap-2 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">UUID</span>
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
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Navn</span>
              <span className="font-medium">{fullName || "—"}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">E-post</span>
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
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Tilgangsnivå</span>
              <select
                value={targetPrivilege}
                disabled={selectDisabled}
                onChange={(event) => handlePrivilegeChange(event.target.value)}
                className="h-8 w-40 rounded-xl border border-border/60 bg-background/60 px-2 text-xs"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {(allowedOptions.length ? allowedOptions : PRIVILEGE_OPTIONS).map((option) => (
                  <option key={option.value} value={option.value} disabled={!canEditTarget && option.value !== targetPrivilege}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Aktivt medlemskap</span>
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
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Passord</span>
              <span className="font-medium">{passwordSetLabel ? `Satt (${passwordSetLabel})` : "Ikke satt"}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Lagt til av</span>
              <span className="font-medium">{loadingAddedBy ? "Laster..." : addedByLabel}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Opprettet</span>
              <span className="font-medium">{createdAtLabel}</span>
            </div>
            {!member.password_set_at && member.email ? (
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
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">Ingen medlem valgt.</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
