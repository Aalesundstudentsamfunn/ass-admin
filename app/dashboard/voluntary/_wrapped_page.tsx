"use client";

import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MemberDataTable } from "@/components/member-table/member-data-table";
import { MemberDetailsDialog } from "@/components/member-table/member-details-dialog";
import {
  createMemberCreatedAtSortColumn,
  createMemberIdentityColumns,
  createMemberPrivilegeColumn,
  createMemberSearchColumn,
} from "@/components/member-table/columns";
import {
  getBulkPrivilegeOptions,
  MemberRow,
} from "@/components/member-table/shared";
import {
  bulkUpdateMemberPrivilege,
  updateMemberPrivilege,
} from "@/lib/members/client-actions";
import { useCurrentPrivilege } from "@/lib/use-current-privilege";
import { useCurrentUserId } from "@/lib/use-current-user-id";
import { useMemberPageSizeDefault } from "@/lib/table-settings";
import { PRIVILEGE_LEVELS } from "@/lib/privilege-config";
import {
  canAssignPrivilege,
  canEditMemberPrivileges,
  canSetOwnPrivilege,
  getMaxAssignablePrivilege,
  memberPrivilege,
} from "@/lib/privilege-checks";
import { toast } from "sonner";

export type UserRow = MemberRow;

/**
 * Builds voluntary table columns.
 *
 * How: Reuses shared member columns and keeps an empty actions column to match table layout.
 * @returns ColumnDef<UserRow, unknown>[]
 */
function buildColumns(
  onPrivilegeChange: (member: UserRow, next: number) => void,
  canEditPrivileges: boolean,
  bulkOptions: { value: number; label: string }[],
  currentPrivilege: number | null | undefined,
): ColumnDef<UserRow, unknown>[] {
  return [
    createMemberSearchColumn(false),
    createMemberCreatedAtSortColumn(),
    ...createMemberIdentityColumns(),
    createMemberPrivilegeColumn({
      canEditPrivileges,
      bulkOptions,
      currentPrivilege,
      onPrivilegeChange,
    }),
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: () => null,
      enableHiding: false,
    },
  ];
}

/**
 * Client container for the frivillige page.
 *
 * How: Loads local row state from server data, handles privilege updates, and opens shared member details dialog.
 */
export default function VoluntaryPage({ initialData }: { initialData: UserRow[] }) {
  const defaultPageSize = useMemberPageSizeDefault();
  const [rows, setRows] = React.useState<UserRow[]>(initialData);
  const [selectedMember, setSelectedMember] = React.useState<UserRow | null>(null);
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const currentUserId = useCurrentUserId();

  const currentPrivilege = useCurrentPrivilege();
  const canEditPrivileges = canEditMemberPrivileges(currentPrivilege);
  const allowedMax = getMaxAssignablePrivilege(currentPrivilege);
  const bulkOptions = React.useMemo(() => getBulkPrivilegeOptions(allowedMax), [allowedMax]);

  React.useEffect(() => {
    setRows(initialData);
  }, [initialData]);

  /**
   * Applies privilege updates to local state and removes rows that drop below frivillig.
   *
   * @returns void
   */
  const applyPrivilegeToRows = React.useCallback((ids: string[], next: number) => {
    const idSet = new Set(ids);
    setRows((prev) => {
      if (next < PRIVILEGE_LEVELS.VOLUNTARY) {
        return prev.filter((row) => !idSet.has(String(row.id)));
      }
      return prev.map((row) => (idSet.has(String(row.id)) ? { ...row, privilege_type: next } : row));
    });
    setSelectedMember((prev) => {
      if (!prev || !idSet.has(String(prev.id))) {
        return prev;
      }
      if (next < PRIVILEGE_LEVELS.VOLUNTARY) {
        setDetailsOpen(false);
        return null;
      }
      return { ...prev, privilege_type: next };
    });
  }, []);

  /**
   * Applies membership active/inactive updates to local list + selected dialog row.
   *
   * @returns void
   */
  const applyMembershipStatusToRows = React.useCallback((ids: string[], isActive: boolean) => {
    const idSet = new Set(ids);
    setRows((prev) =>
      prev.map((row) =>
        idSet.has(String(row.id)) ? { ...row, is_membership_active: isActive } : row,
      ),
    );
    setSelectedMember((prev) => {
      if (!prev || !idSet.has(String(prev.id))) {
        return prev;
      }
      return { ...prev, is_membership_active: isActive };
    });
  }, []);

  /**
   * Updates one row's privilege after client-side permission checks.
   *
   * @returns Promise<void>
   */
  const handleRowPrivilegeChange = React.useCallback(
    async (member: UserRow, next: number) => {
      const currentValue = memberPrivilege(member.privilege_type);
      if (!Number.isFinite(next) || next === currentValue) {
        return;
      }
      if (!canEditPrivileges) {
        toast.error("Du har ikke tilgang til å endre tilgangsnivå.");
        return;
      }
      if (!canAssignPrivilege(currentPrivilege, next, currentValue)) {
        toast.error("Ugyldig tilgangsnivå for din rolle.");
        return;
      }
      if (currentUserId && String(currentUserId) === String(member.id) && !canSetOwnPrivilege(currentPrivilege, next)) {
        toast.error("Du kan ikke gi deg selv høyere tilgangsnivå.");
        return;
      }

      const toastId = toast.loading("Oppdaterer tilgangsnivå...", { duration: 10000 });
      const { error } = await updateMemberPrivilege(String(member.id), next);
      if (error) {
        toast.error("Kunne ikke oppdatere tilgangsnivå.", { id: toastId, description: error.message, duration: Infinity });
        return;
      }

      applyPrivilegeToRows([String(member.id)], next);
      toast.success("Tilgangsnivå oppdatert.", { id: toastId, duration: 6000 });
    },
    [applyPrivilegeToRows, canEditPrivileges, currentPrivilege, currentUserId],
  );

  /**
   * Bulk-updates privileges for all selected rows the current actor is allowed to change.
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
          canAssignPrivilege(
            currentPrivilege,
            next,
            memberPrivilege(member.privilege_type),
          ),
        )
        .map((member) => String(member.id));
      if (!eligibleIds.length) {
        toast.error("Ingen valgte medlemmer kan oppdateres med dette nivået.");
        return;
      }

      const toastId = toast.loading("Oppdaterer tilgangsnivå...", { duration: 10000 });
      const { error } = await bulkUpdateMemberPrivilege(eligibleIds, next);
      if (error) {
        toast.error("Kunne ikke oppdatere tilgangsnivå.", { id: toastId, description: error.message, duration: Infinity });
        return;
      }

      applyPrivilegeToRows(eligibleIds, next);
      toast.success("Tilgangsnivå oppdatert.", { id: toastId, duration: 6000 });
    },
    [applyPrivilegeToRows, canEditPrivileges, currentPrivilege],
  );

  const columns = React.useMemo(
    () => buildColumns(handleRowPrivilegeChange, canEditPrivileges, bulkOptions, currentPrivilege),
    [handleRowPrivilegeChange, canEditPrivileges, bulkOptions, currentPrivilege],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-balance">Frivillige i ÅSS</h1>
        <p className="text-muted-foreground text-pretty">Administrer aktive frivillige</p>
      </div>

      <Card className="border-0 bg-transparent shadow-none">
        <CardHeader className="px-0 pt-0">
          <CardTitle>Oversikt</CardTitle>
          <CardDescription>Sorter, filtrer og håndter frivillige</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <MemberDataTable
            columns={columns}
            data={rows}
            defaultPageSize={defaultPageSize}
            onBulkPrivilege={handleBulkPrivilege}
            canEditPrivileges={canEditPrivileges}
            bulkOptions={bulkOptions}
            onRowClick={(member) => {
              setSelectedMember(member);
              setDetailsOpen(true);
            }}
          />
        </CardContent>
      </Card>

      <MemberDetailsDialog
        open={detailsOpen}
        onOpenChange={(open) => {
          setDetailsOpen(open);
          if (!open) {
            setSelectedMember(null);
          }
        }}
        member={selectedMember}
        currentUserId={currentUserId}
        currentUserPrivilege={currentPrivilege}
        onPrivilegeUpdated={(next) => {
          if (selectedMember) {
            applyPrivilegeToRows([String(selectedMember.id)], next);
          }
        }}
        onMembershipStatusUpdated={(next) => {
          if (selectedMember) {
            applyMembershipStatusToRows([String(selectedMember.id)], next);
          }
        }}
        onNameUpdated={(firstname, lastname) => {
          if (!selectedMember) {
            return;
          }
          setRows((prev) =>
            prev.map((row) =>
              String(row.id) === String(selectedMember.id) ? { ...row, firstname, lastname } : row,
            ),
          );
          setSelectedMember((prev) => (prev ? { ...prev, firstname, lastname } : prev));
        }}
        onBanUpdated={(next) => {
          if (!selectedMember) {
            return;
          }
          setRows((prev) =>
            prev.map((row) =>
              String(row.id) === String(selectedMember.id) ? { ...row, is_banned: next } : row,
            ),
          );
          setSelectedMember((prev) => (prev ? { ...prev, is_banned: next } : prev));
        }}
        showBanControls={false}
      />
    </div>
  );
}
