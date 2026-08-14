"use client";

import * as React from "react";
import { toast } from "sonner";
import { Printer, Trash2 } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateUserDialog } from "@/components/add-new-member";
import { MemberDataTable } from "@/components/member-table/member-data-table";
import { MemberDetailsDialog } from "@/components/member-table/member-details-dialog";
import { createMemberCreatedAtSortColumn, createMemberIdentityColumns, createMemberPrivilegeColumn, createMemberSearchColumn } from "@/components/member-table/columns";
import { getBulkPrivilegeOptions, MemberRow } from "@/components/member-table/shared";
import { useCurrentPrivilege } from "@/lib/use-current-privilege";
import { useCurrentUserId } from "@/lib/use-current-user-id";
import { useMemberPageSizeDefault } from "@/lib/table-settings";
import type { CommitteeOption } from "@/lib/committee-options";
import type { MemberQuery } from "@/lib/members/member-query";
import { useMembersServerPage } from "@/lib/members/use-members-server-page";
import { loadAllMatchingMembers, loadMembersPage } from "./server/list-actions";
import { canDeleteMembers as canDeleteMembersByPrivilege, canEditMemberPrivileges, canManageMembershipStatus, canResetPasswords as canResetPasswordsByPrivilege, getMaxAssignablePrivilege } from "@/lib/privilege-checks";
import { useMembersPageActions } from "@/lib/members/use-members-page-actions";

export type UserRow = MemberRow;

/**
 * Builds members table columns used by `MemberDataTable`.
 *
 * How: Composes shared member columns (search/identity/privilege) and appends row action buttons.
 * @returns ColumnDef<UserRow, unknown>[]
 */
function buildColumns({ onDelete, onPrint, isDeleting, canEditPrivileges, bulkOptions, onPrivilegeChange, canDelete, currentPrivilege }: { onDelete: (id: string | number) => Promise<void>; onPrint: (member: UserRow) => Promise<void>; isDeleting: boolean; canEditPrivileges: boolean; bulkOptions: { value: number; label: string }[]; onPrivilegeChange: (member: UserRow, next: number) => void; canDelete: boolean; currentPrivilege: number | null | undefined }): ColumnDef<UserRow, unknown>[] {
  return [
    createMemberSearchColumn(true),
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
      cell: ({ row }) => {
        const user = row.original as UserRow;
        return (
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="default"
              size="sm"
              className="rounded-lg"
              onClick={async (event) => {
                event.stopPropagation();
                await onPrint(user);
              }}>
              <Printer className="mr-1 h-4 w-4" /> Print kort
            </Button>
            {canDelete ? (
              <Button
                variant="destructive"
                size="sm"
                className="rounded-lg"
                disabled={isDeleting}
                onClick={async (event) => {
                  event.stopPropagation();
                  await onDelete(user.id);
                }}>
                <Trash2 className="mr-1 h-4 w-4" /> {isDeleting ? "Sletter..." : "Slett"}
              </Button>
            ) : null}
          </div>
        );
      },
      enableHiding: false,
    },
  ];
}

/**
 * Client container for the members page.
 *
 * How: Owns table/dialog state, wires permission flags, and binds mutation handlers from `useMembersPageActions`.
 */
export default function MembersTablePage({
  initialData,
  initialTotalCount,
  initialQuery,
  canBulkTemporaryPasswords,
  committeeOptions = [],
  autoOpenCreateDialog = false,
}: {
  initialData: UserRow[];
  initialTotalCount: number;
  initialQuery: MemberQuery;
  canBulkTemporaryPasswords: boolean;
  committeeOptions?: CommitteeOption[];
  autoOpenCreateDialog?: boolean;
}) {
  const defaultPageSize = useMemberPageSizeDefault();
  const { rows, setRows, totalCount, query, onQueryChange, isLoading, reload } =
    useMembersServerPage({
      initialRows: initialData,
      initialTotalCount,
      initialQuery,
      load: loadMembersPage,
    });
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [selectedMember, setSelectedMember] = React.useState<UserRow | null>(null);
  const [detailsOpen, setDetailsOpen] = React.useState(false);

  const currentUserId = useCurrentUserId();
  const currentPrivilege = useCurrentPrivilege();
  const canDeleteMembers = canDeleteMembersByPrivilege(currentPrivilege);
  const canManageMembership = canManageMembershipStatus(currentPrivilege);
  const canResetPasswords = canResetPasswordsByPrivilege(currentPrivilege);
  const canEditPrivileges = canEditMemberPrivileges(currentPrivilege);
  const allowedMax = getMaxAssignablePrivilege(currentPrivilege);
  const bulkOptions = React.useMemo(() => getBulkPrivilegeOptions(allowedMax), [allowedMax]);

  const isFirstRender = React.useRef(true);
  React.useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    // A server action that calls `revalidatePath` re-renders this page with fresh props;
    // that is the signal to re-run whichever query the table is currently showing.
    reload();
  }, [initialData, reload]);

  /**
   * Resolves the members a "velg alle" preset should select.
   *
   * How: Re-runs the active filter on the server without its pagination, narrowed to the
   * preset's privilege range. A preset that contradicts an active role filter matches
   * nothing, which is how the client-side version behaved.
   */
  const handleSelectAllMatching = React.useCallback(
    async (preset: "voluntary" | "members" | "everyone"): Promise<UserRow[]> => {
      const presetRoleFilter = preset === "voluntary" ? "voluntary" : "member";
      if (preset !== "everyone" && query.roleFilter !== "all" && query.roleFilter !== presetRoleFilter) {
        return [];
      }
      try {
        const result = await loadAllMatchingMembers({
          ...query,
          roleFilter: preset === "everyone" ? query.roleFilter : presetRoleFilter,
        });
        if (!result.ok) {
          toast.error("Kunne ikke hente treffene.", { description: result.error });
          return [];
        }
        if (result.truncated) {
          toast.warning(
            `Filteret treffer ${result.totalCount} medlemmer. Valgte de ${result.rows.length} første.`,
          );
        }
        return result.rows;
      } catch (error: unknown) {
        toast.error("Kunne ikke hente treffene.", {
          description: error instanceof Error ? error.message : "Ukjent feil.",
        });
        return [];
      }
    },
    [query],
  );

  const { handlePrint, handleRowPrivilegeChange, handleDeleteMember, handleBulkPrivilege, handleBulkMembershipStatus, handleBulkPasswordReset, handleBulkTemporaryPasswords: handleBulkTemporaryPasswordsAction, handleBulkPrint, handleBulkDelete } = useMembersPageActions({
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
    refresh: reload,
  });

  const patchSelectedMember = React.useCallback(
    (patch: Partial<UserRow>) => {
      if (!selectedMember) {
        return;
      }
      const selectedId = String(selectedMember.id);
      setRows((prev) => prev.map((row) => (String(row.id) === selectedId ? { ...row, ...patch } : row)));
      setSelectedMember((prev) => (prev ? { ...prev, ...patch } : prev));
    },
    [selectedMember, setRows],
  );

  const columns = React.useMemo(
    () =>
      buildColumns({
        onDelete: handleDeleteMember,
        onPrint: handlePrint,
        isDeleting,
        canEditPrivileges,
        bulkOptions,
        onPrivilegeChange: handleRowPrivilegeChange,
        canDelete: canDeleteMembers,
        currentPrivilege,
      }),
    [handleDeleteMember, handlePrint, isDeleting, canEditPrivileges, bulkOptions, handleRowPrivilegeChange, canDeleteMembers, currentPrivilege],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-balance">Aktive ÅSS Medlemskap</h1>
        <p className="text-muted-foreground text-pretty">Administrer aktive medlemmer</p>
      </div>

      <Card className="border-0 bg-transparent shadow-none">
        <CardHeader className="px-0 pt-0">
          <CardTitle>Oversikt</CardTitle>
          <CardDescription>Sorter, filtrer og håndter medlemmer</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
        <MemberDataTable
          columns={columns}
          data={rows}
          defaultPageSize={defaultPageSize}
          onBulkPrivilege={handleBulkPrivilege}
          onBulkMembershipStatus={handleBulkMembershipStatus}
          onBulkPasswordReset={handleBulkPasswordReset}
          onBulkTemporaryPasswords={handleBulkTemporaryPasswordsAction}
          onBulkPrint={handleBulkPrint}
          onBulkDelete={handleBulkDelete}
          canDelete={canDeleteMembers}
          canManageMembership={canManageMembership}
          canResetPasswords={canResetPasswords}
          canBulkTemporaryPasswords={canBulkTemporaryPasswords}
          canEditPrivileges={canEditPrivileges}
          bulkOptions={bulkOptions}
          onRefresh={reload}
          serverMode={{
            totalCount,
            isLoading,
            onQueryChange,
            onSelectAllMatching: handleSelectAllMatching,
          }}
          showSelectionQuickActions
          toolbarActions={
            <CreateUserDialog
              autoOpen={autoOpenCreateDialog}
              committeeOptions={committeeOptions}
            />
          }
          searchParamKey="email"
          searchPlaceholder="Søk navn, e-post eller UUID…"
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
        currentUserPrivilege={currentPrivilege ?? null}
        onPrivilegeUpdated={(next) => patchSelectedMember({ privilege_type: next })}
        onMembershipStatusUpdated={(next) => patchSelectedMember({ is_membership_active: next })}
        onMembershipBlockUpdated={(next) =>
          patchSelectedMember({ membership_disabled_at: next ? new Date().toISOString() : null })
        }
        onMembershipExpiryUpdated={(next) => patchSelectedMember({ membership_active_until: next })}
        onNameUpdated={(firstname, lastname) => patchSelectedMember({ firstname, lastname })}
        onBanUpdated={(next) => patchSelectedMember({ is_banned: next })}
      />
    </div>
  );
}
