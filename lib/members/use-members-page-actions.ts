"use client";

import * as React from "react";
import { toast } from "sonner";
import type { MemberRow } from "@/components/member-table/shared";
import { createClient } from "@/lib/supabase/client";
import {
  bulkUpdateMemberPrivilege,
  deleteMembers as deleteMembersRequest,
  sendMemberPasswordReset,
  updateMemberPrivilege,
  updateMembershipStatus,
} from "@/lib/members/client-actions";
import { enqueuePrinterQueue, watchPrinterQueueStatus } from "@/lib/printer-queue";
import {
  canAssignPrivilege,
  canSetOwnPrivilege,
  isVoluntaryOrHigher,
  memberPrivilege,
} from "@/lib/privilege-checks";

type UserRow = MemberRow;

type UseMembersPageActionsOptions = {
  rows: UserRow[];
  currentUserId: string | null;
  currentPrivilege: number | null | undefined;
  canEditPrivileges: boolean;
  canManageMembership: boolean;
  canResetPasswords: boolean;
  canDeleteMembers: boolean;
  setRows: React.Dispatch<React.SetStateAction<UserRow[]>>;
  setSelectedMember: React.Dispatch<React.SetStateAction<UserRow | null>>;
  setDetailsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsDeleting: React.Dispatch<React.SetStateAction<boolean>>;
  refresh: () => void;
};

const idOf = (value: string | number) => String(value);

/**
 * Applies a partial row update to both list state and currently open details row.
 *
 * @returns void
 */
function patchMembersByIds(
  setRows: React.Dispatch<React.SetStateAction<UserRow[]>>,
  setSelectedMember: React.Dispatch<React.SetStateAction<UserRow | null>>,
  ids: string[],
  patch: Partial<UserRow>,
) {
  const idSet = new Set(ids);
  setRows((prev) => prev.map((row) => (idSet.has(idOf(row.id)) ? { ...row, ...patch } : row)));
  setSelectedMember((prev) => (prev && idSet.has(idOf(prev.id)) ? { ...prev, ...patch } : prev));
}

/**
 * Removes rows from list state and closes details dialog if selected row is removed.
 *
 * @returns void
 */
function removeMembersByIds(
  setRows: React.Dispatch<React.SetStateAction<UserRow[]>>,
  setSelectedMember: React.Dispatch<React.SetStateAction<UserRow | null>>,
  setDetailsOpen: React.Dispatch<React.SetStateAction<boolean>>,
  ids: string[],
) {
  const idSet = new Set(ids);
  setRows((prev) => prev.filter((row) => !idSet.has(idOf(row.id))));
  setSelectedMember((prev) => {
    if (!prev || !idSet.has(idOf(prev.id))) {
      return prev;
    }
    setDetailsOpen(false);
    return null;
  });
}

/**
 * Encapsulates mutation handlers used by members table page.
 * Keeps page component focused on composition/rendering.
 */
export function useMembersPageActions({
  rows,
  currentUserId,
  currentPrivilege,
  canEditPrivileges,
  canManageMembership,
  canResetPasswords,
  canDeleteMembers,
  setRows,
  setSelectedMember,
  setDetailsOpen,
  setIsDeleting,
  refresh,
}: UseMembersPageActionsOptions) {
  /**
   * Enqueues card printing for one member and waits for queue completion status.
   *
   * @returns Promise<void>
   */
  const handlePrint = React.useCallback(async (member: UserRow) => {
    if (member.is_banned === true) {
      toast.error("Kunne ikke sende utskrift for denne brukeren.");
      return;
    }

    const supabaseClient = createClient();
    const toastId = toast.loading("Sender til utskriftskø...", { duration: 10000 });
    const { data: authData, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !authData.user) {
      toast.error("Kunne ikke legge til i utskriftskø.", {
        id: toastId,
        description: "Prøv å logge inn på nytt.",
        duration: Infinity,
      });
      return;
    }

    const { data: queueRow, error } = await enqueuePrinterQueue(supabaseClient, {
      firstname: member.firstname,
      lastname: member.lastname,
      email: member.email,
      ref: member.id,
      ref_invoker: authData.user.id,
      is_voluntary: isVoluntaryOrHigher(member.privilege_type),
    });
    if (error) {
      toast.error(
        "Kunne ikke legge til i utskriftskø.",
        error.message
          ? { id: toastId, description: error.message, duration: Infinity }
          : { id: toastId, duration: Infinity },
      );
      return;
    }

    toast.loading("Venter på utskrift...", {
      id: toastId,
      description: "Utskrift starter når skriveren er klar.",
      duration: Infinity,
    });

    watchPrinterQueueStatus(supabaseClient, {
      queueId: queueRow?.id,
      ref: member.id,
      refInvoker: authData.user.id,
      timeoutMs: 25000,
      timeoutErrorMessage: "Sjekk printer-PCen. Hvis den er offline, kontakt IT.",
      onCompleted: () => {
        toast.success("Utskrift sendt til printer.", { id: toastId, duration: 10000 });
      },
      onError: (message) => {
        toast.error("Utskrift feilet.", { id: toastId, description: message, duration: Infinity });
      },
      onTimeout: () => {
        toast.error("Utskrift tar lengre tid enn vanlig.", {
          id: toastId,
          description: "Sjekk printer-PCen. Hvis den er offline, kontakt IT.",
          duration: Infinity,
        });
      },
    });
  }, []);

  /**
   * Updates one member privilege after client-side permission/validity checks.
   * Patches local table + details state on success.
   *
   * @returns Promise<void>
   */
  const handleRowPrivilegeChange = React.useCallback(
    async (member: UserRow, next: number) => {
      // Skip unchanged/invalid requests before any permission checks.
      const currentValue = memberPrivilege(member.privilege_type);
      if (!Number.isFinite(next) || next === currentValue) {
        return;
      }

      // UX guardrail checks: these mirror server rules and give fast feedback.
      if (!canEditPrivileges) {
        toast.error("Du har ikke tilgang til å endre tilgangsnivå.");
        return;
      }
      if (!canAssignPrivilege(currentPrivilege, next, currentValue)) {
        toast.error("Ugyldig tilgangsnivå for din rolle.");
        return;
      }
      if (currentUserId && idOf(currentUserId) === idOf(member.id) && !canSetOwnPrivilege(currentPrivilege, next)) {
        toast.error("Du kan ikke gi deg selv høyere tilgangsnivå.");
        return;
      }

      // Persist to DB first, then patch local list/dialog state on success.
      const toastId = toast.loading("Oppdaterer tilgangsnivå...", { duration: 10000 });
      const { error } = await updateMemberPrivilege(idOf(member.id), next);
      if (error) {
        toast.error("Kunne ikke oppdatere tilgangsnivå.", { id: toastId, description: error.message, duration: Infinity });
        return;
      }
      patchMembersByIds(setRows, setSelectedMember, [idOf(member.id)], { privilege_type: next });
      toast.success("Tilgangsnivå oppdatert.", { id: toastId, duration: 6000 });
    },
    [canEditPrivileges, currentPrivilege, currentUserId, setRows, setSelectedMember],
  );

  /**
   * Deletes one member with optimistic removal and rollback if API fails.
   *
   * @returns Promise<void>
   */
  const handleDeleteMember = React.useCallback(
    async (id: string | number) => {
      // Confirm destructive action before applying optimistic removal.
      if (!window.confirm("Er du sikker på at du vil slette dette medlemmet?")) {
        return;
      }

      const memberId = idOf(id);
      const before = rows;
      const toastId = toast.loading("Sletter medlem...", { duration: 10000 });
      setIsDeleting(true);
      try {
        // Optimistic UI: remove row immediately while API call is pending.
        removeMembersByIds(setRows, setSelectedMember, setDetailsOpen, [memberId]);
        const { response, payload } = await deleteMembersRequest([memberId]);
        if (!response.ok) {
          throw new Error(payload?.error ?? "Kunne ikke slette medlem.");
        }
        toast.success("Medlem slettet.", { id: toastId, duration: 10000 });
        refresh();
      } catch (error: unknown) {
        // Restore previous table state if deletion fails.
        setRows(before);
        toast.error("Kunne ikke slette medlem.", {
          id: toastId,
          description: error instanceof Error ? error.message : String(error),
          duration: Infinity,
        });
      } finally {
        setIsDeleting(false);
      }
    },
    [refresh, rows, setDetailsOpen, setIsDeleting, setRows, setSelectedMember],
  );

  /**
   * Bulk privilege update for selected members.
   * Filters to assignable rows before calling the mutation.
   *
   * @returns Promise<void>
   */
  const handleBulkPrivilege = React.useCallback(
    async (members: UserRow[], next: number) => {
      if (!members.length) {
        return;
      }
      if (!canEditPrivileges) {
        toast.error("Du har ikke tilgang til å endre tilgangsnivå.");
        return;
      }
      if (!canAssignPrivilege(currentPrivilege, next)) {
        toast.error("Ugyldig tilgangsnivå for din rolle.");
        return;
      }
      const eligibleIds = members
        .filter((member) =>
          canAssignPrivilege(currentPrivilege, next, memberPrivilege(member.privilege_type)),
        )
        .map((member) => idOf(member.id));
      if (!eligibleIds.length) {
        toast.error("Ingen valgte medlemmer kan oppdateres med dette nivået.");
        return;
      }

      const toastId = toast.loading("Oppdaterer tilgangsnivå...", { duration: 10000 });
      const { error } = await bulkUpdateMemberPrivilege(eligibleIds, next);
      if (error) {
        toast.error("Kunne ikke oppdatere tilgangsnivå.", {
          id: toastId,
          description: error.message,
          duration: Infinity,
        });
        return;
      }

      patchMembersByIds(setRows, setSelectedMember, eligibleIds, { privilege_type: next });
      toast.success("Tilgangsnivå oppdatert.", { id: toastId, duration: 6000 });
    },
    [canEditPrivileges, currentPrivilege, setRows, setSelectedMember],
  );

  /**
   * Bulk active/inactive membership toggle for selected members.
   *
   * @returns Promise<void>
   */
  const handleBulkMembershipStatus = React.useCallback(
    async (members: UserRow[], isActive: boolean) => {
      if (!members.length) {
        return;
      }
      if (!canManageMembership) {
        toast.error("Du har ikke tilgang til å endre medlemsstatus.");
        return;
      }

      const ids = members.map((member) => idOf(member.id));
      const toastId = toast.loading("Oppdaterer medlemsstatus...", { duration: 10000 });
      const { response, payload } = await updateMembershipStatus(ids, isActive);
      if (!response.ok) {
        toast.error("Kunne ikke oppdatere medlemsstatus.", {
          id: toastId,
          description: payload?.error ?? "Ukjent feil.",
          duration: Infinity,
        });
        return;
      }

      patchMembersByIds(setRows, setSelectedMember, ids, { is_membership_active: isActive });
      toast.success("Medlemsstatus oppdatert.", { id: toastId, duration: 6000 });
    },
    [canManageMembership, setRows, setSelectedMember],
  );

  /**
   * Sends password reset links to unique emails from selected members.
   * Reports partial success when one or more sends fail.
   *
   * @returns Promise<void>
   */
  const handleBulkPasswordReset = React.useCallback(
    async (members: UserRow[]) => {
      if (!members.length) {
        return;
      }
      if (!canResetPasswords) {
        toast.error("Du har ikke tilgang til å sende passordlenker.");
        return;
      }

      const emails = Array.from(
        new Set(
          members
            .map((member) => member.email?.trim().toLowerCase())
            .filter((email): email is string => Boolean(email)),
        ),
      );
      if (!emails.length) {
        toast.error("Ingen gyldige e-poster valgt.");
        return;
      }

      const toastId = toast.loading("Sender passordlenker...", { duration: 10000 });
      let successCount = 0;
      let errorCount = 0;

      for (const email of emails) {
        try {
          const response = await sendMemberPasswordReset(email);
          if (!response.ok) {
            errorCount += 1;
            continue;
          }
          successCount += 1;
        } catch {
          errorCount += 1;
        }
      }

      if (errorCount > 0) {
        toast.error("Kunne ikke sende passordlenke til alle.", {
          id: toastId,
          description: `Sendt ${successCount} av ${emails.length}.`,
          duration: Infinity,
        });
        return;
      }

      toast.success(`Passordlenke sendt til ${successCount} medlemmer.`, {
        id: toastId,
        duration: 6000,
      });
    },
    [canResetPasswords],
  );

  /**
   * Bulk card print request for selected members.
   * Skips banned members and summarizes success/failure counts.
   *
   * @returns Promise<void>
   */
  const handleBulkPrint = React.useCallback(async (members: UserRow[]) => {
    if (!members.length) {
      return;
    }
    const bannedCount = members.filter((member) => member.is_banned === true).length;
    const printableMembers = members.filter((member) => member.is_banned !== true);
    if (!printableMembers.length) {
      toast.error("Ingen utskrifter sendt. Valgte kontoer kan ikke brukes for utskrift.");
      return;
    }

    const toastId = toast.loading("Sender til utskriftskø...", { duration: 10000 });
    const supabaseClient = createClient();
    const { data: authData, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !authData.user) {
      toast.error("Kunne ikke legge til i utskriftskø.", {
        id: toastId,
        description: "Prøv å logge inn på nytt.",
        duration: Infinity,
      });
      return;
    }

    let successCount = 0;
    let errorCount = 0;
    for (const member of printableMembers) {
      const { error } = await enqueuePrinterQueue(supabaseClient, {
        firstname: member.firstname,
        lastname: member.lastname,
        email: member.email,
        ref: member.id,
        ref_invoker: authData.user.id,
        is_voluntary: isVoluntaryOrHigher(member.privilege_type),
      });
      if (error) {
        errorCount += 1;
      } else {
        successCount += 1;
      }
    }

    if (errorCount > 0 || bannedCount > 0) {
      const parts: string[] = [];
      if (successCount > 0) {
        parts.push(`sendt ${successCount}`);
      }
      if (errorCount > 0) {
        parts.push(`feilet ${errorCount}`);
      }
      if (bannedCount > 0) {
        parts.push(`hoppet over utilgjengelig ${bannedCount}`);
      }
      toast.error("Kunne ikke skrive ut alle valgte.", {
        id: toastId,
        description: parts.join(" · "),
        duration: Infinity,
      });
      return;
    }

    toast.success(`Sendt ${successCount} til utskriftskø.`, { id: toastId, duration: 6000 });
  }, []);

  /**
   * Bulk delete for selected members.
   * Removes rows locally after successful API response.
   *
   * @returns Promise<void>
   */
  const handleBulkDelete = React.useCallback(
    async (members: UserRow[]) => {
      if (!members.length) {
        return;
      }
      if (!canDeleteMembers) {
        toast.error("Du har ikke tilgang til å slette medlemmer.");
        return;
      }

      const ids = members.map((member) => idOf(member.id));
      const toastId = toast.loading("Sletter medlemmer...", { duration: 10000 });
      const { response, payload } = await deleteMembersRequest(ids);
      if (!response.ok) {
        const failed = Array.isArray(payload?.failed) ? payload.failed.length : 0;
        const details =
          failed > 0
            ? `${payload?.error ?? "Kunne ikke slette medlemmer."} (${failed} feilet)`
            : payload?.error ?? "Kunne ikke slette medlemmer.";
        toast.error("Kunne ikke slette medlemmer.", { id: toastId, description: details, duration: Infinity });
        return;
      }

      removeMembersByIds(setRows, setSelectedMember, setDetailsOpen, ids);
      toast.success("Medlemmer slettet.", { id: toastId, duration: 6000 });
      refresh();
    },
    [canDeleteMembers, refresh, setDetailsOpen, setRows, setSelectedMember],
  );

  return {
    handlePrint,
    handleRowPrivilegeChange,
    handleDeleteMember,
    handleBulkPrivilege,
    handleBulkMembershipStatus,
    handleBulkPasswordReset,
    handleBulkPrint,
    handleBulkDelete,
  };
}
