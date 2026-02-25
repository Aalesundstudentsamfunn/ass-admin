"use client";

import * as React from "react";
import { toast } from "sonner";
import type { MemberRow } from "@/components/member-table/shared";
import { createClient } from "@/lib/supabase/client";
import {
  bulkUpdateMemberPrivilege,
  enqueueMemberPrintJobs,
  deleteMembers as deleteMembersRequest,
  sendBulkTemporaryPasswords,
  sendMemberPasswordReset,
  updateMemberPrivilege,
  updateMembershipStatus,
} from "@/lib/members/client-actions";
import { watchPrinterQueueStatus } from "@/lib/printer-queue";
import {
  canAssignPrivilege,
  canSetOwnPrivilege,
  isMembershipActive,
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
  canBulkTemporaryPasswords: boolean;
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
  canBulkTemporaryPasswords,
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
    const toastId = toast.loading("Sender til utskriftskø...", { duration: 10000 });
    const { response, payload } = await enqueueMemberPrintJobs([idOf(member.id)]);
    if (!response.ok) {
      const failureMessage =
        typeof payload?.failed?.[0]?.message === "string"
          ? payload.failed[0].message
          : payload?.error;
      toast.error("Kunne ikke legge til i utskriftskø.", {
        id: toastId,
        description:
          typeof failureMessage === "string" && failureMessage.trim()
            ? failureMessage
            : "Ukjent feil.",
        duration: Infinity,
      });
      return;
    }

    const queueEntry = Array.isArray(payload?.queued) ? payload.queued[0] : null;
    const queueId =
      queueEntry && (typeof queueEntry.queue_id === "string" || typeof queueEntry.queue_id === "number")
        ? queueEntry.queue_id
        : null;
    if (queueId === null) {
      toast.error("Kunne ikke legge til i utskriftskø.", {
        id: toastId,
        description: "Ingen kø-ID ble returnert.",
        duration: Infinity,
      });
      return;
    }

    const supabaseClient = createClient();
    toast.loading("Venter på utskrift...", {
      id: toastId,
      description: "Utskrift starter når skriveren er klar.",
      duration: Infinity,
    });

    watchPrinterQueueStatus(supabaseClient, {
      queueId,
      timeoutMs: 25000,
      timeoutErrorMessage: "Sjekk om printer-PC er koblet på internett. Kontakt IT om det ikke går.",
      onCompleted: () => {
        toast.success("Utskrift sendt til printer.", { id: toastId, duration: 10000 });
      },
      onError: (message) => {
        toast.error("Utskrift feilet.", { id: toastId, description: message, duration: Infinity });
      },
      onTimeout: () => {
        toast.error("Utskrift tar lengre tid enn vanlig.", {
          id: toastId,
          description: "Sjekk om printer-PC er koblet på internett. Kontakt IT om det ikke går.",
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
        toast.error("Medlemmet har allerede dette tilgangsnivået.");
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
      const unchangedIds: string[] = [];
      const blockedIds: string[] = [];
      const eligibleIds: string[] = [];
      for (const member of members) {
        const currentValue = memberPrivilege(member.privilege_type);
        const memberId = idOf(member.id);
        if (currentValue === next) {
          unchangedIds.push(memberId);
          continue;
        }
        if (!canAssignPrivilege(currentPrivilege, next, currentValue)) {
          blockedIds.push(memberId);
          continue;
        }
        eligibleIds.push(memberId);
      }
      if (!eligibleIds.length) {
        if (unchangedIds.length > 0 && blockedIds.length === 0) {
          toast.error("Alle valgte medlemmer har allerede dette tilgangsnivået.");
          return;
        }
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
      const skippedCount = unchangedIds.length + blockedIds.length;
      if (skippedCount > 0) {
        toast.warning("Noen valgte medlemmer ble hoppet over.", {
          id: toastId,
          description: `Oppdatert ${eligibleIds.length}, hoppet over ${skippedCount}.`,
          duration: 7000,
        });
        return;
      }
      toast.success("Tilgangsnivå oppdatert.", {
        id: toastId,
        description: members.length > 1 ? `Oppdatert ${eligibleIds.length} medlemmer.` : undefined,
        duration: 6000,
      });
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

      const unchangedIds: string[] = [];
      const blockedIds: string[] = [];
      const eligibleIds: string[] = [];
      for (const member of members) {
        const currentIsActive = isMembershipActive(member.is_membership_active);
        const memberId = idOf(member.id);
        if (currentIsActive === isActive) {
          unchangedIds.push(memberId);
          continue;
        }
        if (isActive && member.is_banned === true) {
          blockedIds.push(memberId);
          continue;
        }
        eligibleIds.push(memberId);
      }
      if (!eligibleIds.length) {
        if (unchangedIds.length > 0 && blockedIds.length === 0) {
          toast.error(
            isActive
              ? "Alle valgte medlemmer er allerede aktive."
              : "Alle valgte medlemmer er allerede inaktive.",
          );
          return;
        }
        // Send request anyway when there are unavailable targets, so the attempt is auditable.
      }

      const toastId = toast.loading("Oppdaterer medlemsstatus...", { duration: 10000 });
      const requestedIds = members.map((member) => idOf(member.id));
      const { response, payload } = await updateMembershipStatus(requestedIds, isActive);
      if (!response.ok) {
        toast.error("Kunne ikke oppdatere medlemsstatus.", {
          id: toastId,
          description: payload?.error ?? "Ukjent feil.",
          duration: Infinity,
        });
        return;
      }

      const updatedIdsFromApi = Array.isArray(payload?.updated_member_ids)
        ? payload.updated_member_ids
            .map((value: unknown) => String(value ?? "").trim())
            .filter((value: string): value is string => Boolean(value))
        : [];
      const idsToPatch = updatedIdsFromApi.length ? updatedIdsFromApi : eligibleIds;
      if (idsToPatch.length > 0) {
        patchMembersByIds(setRows, setSelectedMember, idsToPatch, { is_membership_active: isActive });
      }
      const updatedCount =
        typeof payload?.updated === "number" && Number.isFinite(payload.updated)
          ? payload.updated
          : idsToPatch.length;
      const skippedCount =
        typeof payload?.skipped === "number" && Number.isFinite(payload.skipped)
          ? payload.skipped
          : unchangedIds.length + blockedIds.length;
      if (skippedCount > 0) {
        toast.warning("Noen valgte medlemmer ble hoppet over.", {
          id: toastId,
          description: `Oppdatert ${updatedCount}, hoppet over ${skippedCount}.`,
          duration: 7000,
        });
        return;
      }
      toast.success("Medlemsstatus oppdatert.", {
        id: toastId,
        description: members.length > 1 ? `Oppdatert ${updatedCount} medlemmer.` : undefined,
        duration: 6000,
      });
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
   * Generates unique temporary passwords for selected members and sends onboarding emails.
   *
   * @returns Promise<void>
   */
  const handleBulkTemporaryPasswords = React.useCallback(
    async (members: UserRow[]) => {
      if (!members.length) {
        return;
      }
      if (!canBulkTemporaryPasswords) {
        toast.error("Du har ikke tilgang til å sende engangspassord.");
        return;
      }

      const memberIds = Array.from(new Set(members.map((member) => idOf(member.id))));
      if (!memberIds.length) {
        toast.error("Ingen gyldige medlemmer valgt.");
        return;
      }

      const toastId = toast.loading("Setter engangspassord...", { duration: 10000 });
      const { response, payload } = await sendBulkTemporaryPasswords(memberIds);
      if (!response.ok) {
        toast.error("Kunne ikke sende engangspassord.", {
          id: toastId,
          description: payload?.error ?? "Ukjent feil.",
          duration: Infinity,
        });
        return;
      }

      const updated =
        typeof payload?.updated === "number" && Number.isFinite(payload.updated)
          ? payload.updated
          : memberIds.length;
      const failed =
        typeof payload?.failed === "number" && Number.isFinite(payload.failed)
          ? payload.failed
          : 0;
      const skipped =
        typeof payload?.skipped === "number" && Number.isFinite(payload.skipped)
          ? payload.skipped
          : 0;
      const description = `Oppdatert ${updated}${failed > 0 ? `, feilet ${failed}` : ""}${skipped > 0 ? `, hoppet over ${skipped}` : ""}.`;

      if (failed > 0 || skipped > 0 || payload?.status === "partial") {
        toast.warning("Engangspassord sendt delvis.", {
          id: toastId,
          description,
          duration: 8000,
        });
        return;
      }

      toast.success("Engangspassord sendt.", {
        id: toastId,
        description: members.length > 1 ? `Oppdatert ${updated} medlemmer.` : undefined,
        duration: 6000,
      });
    },
    [canBulkTemporaryPasswords],
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
    const toastId = toast.loading("Sender til utskriftskø...", { duration: 10000 });
    const memberIds = members.map((member) => idOf(member.id));
    const { response, payload } = await enqueueMemberPrintJobs(memberIds);
    const successCount =
      typeof payload?.queued_count === "number" && Number.isFinite(payload.queued_count)
        ? payload.queued_count
        : 0;
    const errorCount =
      typeof payload?.failed_count === "number" && Number.isFinite(payload.failed_count)
        ? payload.failed_count
        : response.ok
          ? 0
          : memberIds.length;

    if (errorCount > 0) {
      const parts: string[] = [];
      if (successCount > 0) {
        parts.push(`sendt ${successCount}`);
      }
      if (errorCount > 0) {
        parts.push(`feilet ${errorCount}`);
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
    handleBulkTemporaryPasswords,
    handleBulkPrint,
    handleBulkDelete,
  };
}
