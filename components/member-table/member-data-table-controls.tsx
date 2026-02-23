"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { isVoluntaryOrHigher } from "@/lib/privilege-checks";
import type { MemberRow, PrivilegeOption } from "./shared";

export type MemberSortPreset =
  | "latest"
  | "oldest"
  | "lastname_asc"
  | "lastname_desc"
  | "email_asc"
  | "email_desc"
  | "privilege_desc"
  | "privilege_asc";

export type MemberRowFilterPreset =
  | "role_voluntary"
  | "role_member"
  | "membership_active"
  | "membership_inactive";

export type MemberQuickFilterPreset =
  | MemberSortPreset
  | MemberRowFilterPreset
  | "reset";

/**
 * Shared funnel presets used by member-like tables.
 */
export const MEMBER_QUICK_FILTERS = [
  { key: "latest", label: "Nyeste oppføring først" },
  { key: "oldest", label: "Eldste oppføring først" },
  { key: "privilege_desc", label: "Tilgang høyest først" },
  { key: "privilege_asc", label: "Tilgang lavest først" },
  { key: "lastname_asc", label: "Etternavn A-Å" },
  { key: "lastname_desc", label: "Etternavn Å-A" },
  { key: "email_asc", label: "E-post A-Å" },
  { key: "email_desc", label: "E-post Å-A" },
  { key: "role_voluntary", label: "Kun frivillige" },
  { key: "role_member", label: "Kun medlemmer" },
  { key: "membership_active", label: "Kun aktive medlemskap" },
  { key: "membership_inactive", label: "Kun inaktive medlemskap" },
  { key: "reset", label: "Nullstill hurtigfiltre" },
] as const;

/**
 * Type guard for quick-filter keys that only affect sorting.
 */
export function isMemberSortPreset(value: MemberQuickFilterPreset): value is MemberSortPreset {
  return (
    value === "latest" ||
    value === "oldest" ||
    value === "lastname_asc" ||
    value === "lastname_desc" ||
    value === "email_asc" ||
    value === "email_desc" ||
    value === "privilege_desc" ||
    value === "privilege_asc"
  );
}

/**
 * Type guard for quick-filter keys that affect row visibility only.
 */
export function isMemberRowFilterPreset(value: MemberQuickFilterPreset): value is MemberRowFilterPreset {
  return (
    value === "role_voluntary" ||
    value === "role_member" ||
    value === "membership_active" ||
    value === "membership_inactive"
  );
}

/**
 * Renders bulk mutation controls when one or more rows are selected.
 */
export function MemberBulkActionsBar({
  selectedCount,
  selectedMembers,
  canDelete,
  canManageMembership,
  canResetPasswords,
  canEditPrivileges,
  bulkOptions,
  bulkPrivilege,
  onBulkPrivilegeValueChange,
  onBulkPrivilege,
  onBulkMembershipStatus,
  onBulkPasswordReset,
  onBulkPrint,
  onBulkDelete,
  onResetSelection,
}: {
  selectedCount: number;
  selectedMembers: MemberRow[];
  canDelete?: boolean;
  canManageMembership?: boolean;
  canResetPasswords?: boolean;
  canEditPrivileges?: boolean;
  bulkOptions?: PrivilegeOption[];
  bulkPrivilege: string;
  onBulkPrivilegeValueChange: (value: string) => void;
  onBulkPrivilege?: (members: MemberRow[], next: number) => Promise<void>;
  onBulkMembershipStatus?: (members: MemberRow[], isActive: boolean) => Promise<void>;
  onBulkPasswordReset?: (members: MemberRow[]) => Promise<void>;
  onBulkPrint?: (members: MemberRow[]) => Promise<void>;
  onBulkDelete?: (members: MemberRow[]) => Promise<void>;
  onResetSelection: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-background/60 px-3 py-2 text-sm">
      <span className="font-medium">{selectedCount} valgt</span>

      {canEditPrivileges && onBulkPrivilege && bulkOptions && bulkOptions.length > 0 ? (
        <div className="flex items-center gap-2">
          <select
            className="h-8 rounded-xl border border-border/60 bg-background/60 px-2 text-xs"
            value={bulkPrivilege}
            onChange={(event) => onBulkPrivilegeValueChange(event.target.value)}
          >
            {bulkOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl"
            disabled={!bulkPrivilege}
            onClick={async () => {
              const next = Number(bulkPrivilege);
              await onBulkPrivilege(selectedMembers, next);
              onResetSelection();
            }}
          >
            Oppdater tilgang
          </Button>
        </div>
      ) : null}

      {canManageMembership && onBulkMembershipStatus ? (
        <>
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl"
            onClick={async () => {
              await onBulkMembershipStatus(selectedMembers, true);
              onResetSelection();
            }}
          >
            Sett aktiv
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl"
            onClick={async () => {
              await onBulkMembershipStatus(selectedMembers, false);
              onResetSelection();
            }}
          >
            Sett inaktiv
          </Button>
        </>
      ) : null}

      {canResetPasswords && onBulkPasswordReset ? (
        <Button
          size="sm"
          variant="outline"
          className="rounded-xl"
          onClick={async () => {
            await onBulkPasswordReset(selectedMembers);
            onResetSelection();
          }}
        >
          Send passordlenke
        </Button>
      ) : null}

      {onBulkPrint ? (
        <Button
          size="sm"
          variant="outline"
          className="rounded-xl"
          onClick={async () => {
            await onBulkPrint(selectedMembers);
            onResetSelection();
          }}
        >
          Print kort
        </Button>
      ) : null}

      {canDelete && onBulkDelete ? (
        <Button
          size="sm"
          variant="destructive"
          className="rounded-xl"
          onClick={async () => {
            await onBulkDelete(selectedMembers);
            onResetSelection();
          }}
        >
          Slett
        </Button>
      ) : null}

      <Button size="sm" variant="ghost" className="rounded-xl" onClick={onResetSelection}>
        Nullstill valg
      </Button>
    </div>
  );
}

/**
 * Renders fast row-selection shortcuts for selection mode.
 */
export function MemberQuickSelectionBar({
  onSelectPreset,
}: {
  onSelectPreset: (preset: "voluntary" | "members" | "visible" | "everyone") => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-background/40 px-3 py-2 text-xs">
      <span className="font-medium text-muted-foreground">Hurtigvalg</span>
      <Button size="sm" variant="outline" className="rounded-xl" onClick={() => onSelectPreset("voluntary")}>
        Velg alle frivillige
      </Button>
      <Button size="sm" variant="outline" className="rounded-xl" onClick={() => onSelectPreset("members")}>
        Velg alle medlemmer
      </Button>
      <Button size="sm" variant="outline" className="rounded-xl" onClick={() => onSelectPreset("visible")}>
        Velg synlige
      </Button>
      <Button size="sm" variant="outline" className="rounded-xl" onClick={() => onSelectPreset("everyone")}>
        Velg alle
      </Button>
    </div>
  );
}

/**
 * Computes sorting state + active quick-filter label for the selected preset.
 */
export function getMemberQuickFilterState(
  preset: MemberSortPreset,
): {
  sorting: Array<{ id: string; desc: boolean }>;
  activeQuickFilter: string | null;
} {
  switch (preset) {
    case "oldest":
      return {
        sorting: [{ id: "created_at_sort", desc: false }],
        activeQuickFilter: "Eldste oppføring først",
      };
    case "lastname_asc":
      return {
        sorting: [{ id: "lastname", desc: false }],
        activeQuickFilter: "Etternavn A-Å",
      };
    case "lastname_desc":
      return {
        sorting: [{ id: "lastname", desc: true }],
        activeQuickFilter: "Etternavn Å-A",
      };
    case "email_asc":
      return {
        sorting: [{ id: "email", desc: false }],
        activeQuickFilter: "E-post A-Å",
      };
    case "email_desc":
      return {
        sorting: [{ id: "email", desc: true }],
        activeQuickFilter: "E-post Å-A",
      };
    case "privilege_desc":
      return {
        sorting: [{ id: "privilege_type", desc: true }],
        activeQuickFilter: "Høyeste tilgang først",
      };
    case "privilege_asc":
      return {
        sorting: [{ id: "privilege_type", desc: false }],
        activeQuickFilter: "Laveste tilgang først",
      };
    case "latest":
    default:
      return {
        sorting: [{ id: "created_at_sort", desc: true }],
        activeQuickFilter: null,
      };
  }
}

/**
 * Returns rows that match a given selection preset.
 */
export function filterMembersBySelectionPreset(
  rows: MemberRow[],
  preset: "voluntary" | "members" | "visible" | "everyone",
) {
  if (preset === "visible" || preset === "everyone") {
    return rows;
  }
  if (preset === "voluntary") {
    return rows.filter((row) => isVoluntaryOrHigher(row.privilege_type));
  }
  return rows.filter((row) => !isVoluntaryOrHigher(row.privilege_type));
}
