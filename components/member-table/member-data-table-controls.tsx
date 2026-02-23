"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { isVoluntaryOrHigher } from "@/lib/privilege-checks";
import type { MemberRow, PrivilegeOption } from "./shared";

export type MemberQuickFilterPreset =
  | "latest"
  | "oldest"
  | "lastname"
  | "email"
  | "privilege"
  | "reset";

/**
 * Shared funnel presets used by member-like tables.
 */
export const MEMBER_QUICK_FILTERS = [
  { key: "latest", label: "Nyeste oppføring først" },
  { key: "oldest", label: "Eldste oppføring først" },
  { key: "privilege", label: "Høyeste tilgang først" },
  { key: "lastname", label: "Etternavn A-Å" },
  { key: "email", label: "E-post A-Å" },
  { key: "reset", label: "Nullstill anbefaling" },
] as const;

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
  preset: MemberQuickFilterPreset,
): {
  sorting: Array<{ id: string; desc: boolean }>;
  activeQuickFilter: string | null;
  clearSearch: boolean;
} {
  switch (preset) {
    case "oldest":
      return {
        sorting: [{ id: "created_at_sort", desc: false }],
        activeQuickFilter: "Eldste oppføring først",
        clearSearch: false,
      };
    case "lastname":
      return {
        sorting: [{ id: "lastname", desc: false }],
        activeQuickFilter: "Etternavn A-Å",
        clearSearch: false,
      };
    case "email":
      return {
        sorting: [{ id: "email", desc: false }],
        activeQuickFilter: "E-post A-Å",
        clearSearch: false,
      };
    case "privilege":
      return {
        sorting: [{ id: "privilege_type", desc: true }],
        activeQuickFilter: "Høyeste tilgang først",
        clearSearch: false,
      };
    case "reset":
      return {
        sorting: [{ id: "created_at_sort", desc: true }],
        activeQuickFilter: null,
        clearSearch: true,
      };
    case "latest":
    default:
      return {
        sorting: [{ id: "created_at_sort", desc: true }],
        activeQuickFilter: null,
        clearSearch: false,
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

