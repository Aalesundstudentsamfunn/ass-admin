"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowUpDown, Printer, Trash2 } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CreateUserDialog } from "@/components/add-new-member";
import { MemberDataTable } from "@/components/member-table/member-data-table";
import { MemberDetailsDialog } from "@/components/member-table/member-details-dialog";
import {
  copyToClipboard,
  getBulkPrivilegeOptions,
  getPrivilegeLabel,
  MemberRow,
  PILL_CLASS,
  PRIVILEGE_OPTIONS,
} from "@/components/member-table/shared";
import { createClient } from "@/lib/supabase/client";
import { enqueuePrinterQueue, watchPrinterQueueStatus } from "@/lib/printer-queue";
import { useCurrentPrivilege } from "@/lib/use-current-privilege";
import { useMemberPageSizeDefault } from "@/lib/table-settings";
import {
  canAssignPrivilege,
  canEditPrivilegeForTarget,
  canDeleteMembers as canDeleteMembersByPrivilege,
  canEditMemberPrivileges,
  canManageMembershipStatus,
  canResetPasswords as canResetPasswordsByPrivilege,
  canSetOwnPrivilege,
  getMaxAssignablePrivilege,
  isVoluntaryOrHigher,
  memberPrivilege,
} from "@/lib/privilege-checks";
import { toast } from "sonner";

export type UserRow = MemberRow;

/**
 * Builds members table columns.
 *
 * Notes:
 * - Search column is hidden and used as a combined haystack for name/email/uuid.
 * - `created_at_sort` is hidden and used to keep a stable default sort.
 * - Privilege cell uses dropdown options constrained by current user's permissions.
 */
function buildColumns({
  onDelete,
  onPrint,
  isDeleting,
  canEditPrivileges,
  bulkOptions,
  onPrivilegeChange,
  canDelete,
  currentPrivilege,
}: {
  onDelete: (id: string | number) => Promise<void>;
  onPrint: (member: UserRow) => Promise<void>;
  isDeleting: boolean;
  canEditPrivileges: boolean;
  bulkOptions: { value: number; label: string }[];
  onPrivilegeChange: (member: UserRow, next: number) => void;
  canDelete: boolean;
  currentPrivilege: number | null | undefined;
}): ColumnDef<UserRow, unknown>[] {
  return [
    {
      id: "search",
      accessorFn: (row: UserRow) =>
        `${row.firstname} ${row.lastname} ${row.email ?? ""} ${String(row.id ?? "")}`.trim(),
      filterFn: (row, columnId, value) => {
        const query = String(value ?? "").trim().toLowerCase();
        if (!query) {
          return true;
        }
        const haystack = String(row.getValue(columnId) ?? "").toLowerCase();
        return haystack.includes(query);
      },
      enableSorting: false,
      enableHiding: true,
    },
    {
      id: "created_at_sort",
      accessorKey: "created_at",
      sortingFn: (a, b) => {
        const aValue = new Date(String(a.getValue("created_at_sort") ?? "")).getTime();
        const bValue = new Date(String(b.getValue("created_at_sort") ?? "")).getTime();
        return aValue - bValue;
      },
      header: () => null,
      cell: () => null,
      enableHiding: true,
    },
    {
      accessorKey: "email",
      header: ({ column }) => (
        <button className="inline-flex items-center gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          E-post <ArrowUpDown className="h-3.5 w-3.5" />
        </button>
      ),
      cell: ({ row }) => (
        <span className="relative inline-flex items-center group">
          <button
            type="button"
            className="underline-offset-2 hover:underline"
            onClick={(event) => {
              event.stopPropagation();
              copyToClipboard(String(row.getValue("email") ?? ""), "E-post");
            }}
          >
            {row.getValue("email")}
          </button>
          <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground/90 px-2 py-1 text-[10px] text-background opacity-0 transition-opacity group-hover:opacity-100">
            Kopier
          </span>
        </span>
      ),
    },
    {
      accessorKey: "firstname",
      header: ({ column }) => (
        <button className="inline-flex items-center gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Fornavn <ArrowUpDown className="h-3.5 w-3.5" />
        </button>
      ),
      cell: ({ row }) => <span>{row.getValue("firstname")}</span>,
    },
    {
      accessorKey: "lastname",
      header: ({ column }) => (
        <button className="inline-flex items-center gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Etternavn <ArrowUpDown className="h-3.5 w-3.5" />
        </button>
      ),
      cell: ({ row }) => <span>{row.getValue("lastname")}</span>,
    },
    {
      accessorKey: "privilege_type",
      header: ({ column }) => (
        <button className="inline-flex items-center gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Tilgang <ArrowUpDown className="h-3.5 w-3.5" />
        </button>
      ),
      cell: ({ row }) => {
        const member = row.original as UserRow;
        const label = getPrivilegeLabel(row.getValue("privilege_type") as number | null);
        const targetPrivilege = memberPrivilege(member.privilege_type);
        if (!canEditPrivileges || !canEditPrivilegeForTarget(currentPrivilege, targetPrivilege)) {
          return (
            <Badge variant="secondary" className={PILL_CLASS}>
              {label}
            </Badge>
          );
        }
        const options = (bulkOptions.length ? bulkOptions : PRIVILEGE_OPTIONS).filter((option) =>
          canAssignPrivilege(currentPrivilege, option.value, targetPrivilege),
        );
        if (!options.length) {
          return (
            <Badge variant="secondary" className={PILL_CLASS}>
              {label}
            </Badge>
          );
        }
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex"
                onClick={(event) => event.stopPropagation()}
              >
                <Badge variant="secondary" className={`${PILL_CLASS} cursor-pointer`}>
                  {label}
                </Badge>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[10rem]">
              {options.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onSelect={(event) => {
                    event.preventDefault();
                    onPrivilegeChange(member, option.value);
                  }}
                >
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const user = row.original as UserRow;
        return (
          <div className="flex items-center gap-2 justify-end">
            <Button
              variant="default"
              size="sm"
              className="rounded-lg"
              onClick={async (event) => {
                event.stopPropagation();
                await onPrint(user);
              }}
            >
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
                }}
              >
                <Trash2 className="mr-1 h-4 w-4" /> {isDeleting ? "Sletter..." : "Delete"}
              </Button>
            ) : null}
          </div>
        );
      },
      enableHiding: false,
    },
  ];
}

export default function MembersTablePage({ initialData }: { initialData: UserRow[] }) {
  /**
   * Client-side container for members management:
   * - keeps local table state for optimistic UX
   * - coordinates API actions (print/delete/bulk updates)
   * - drives details dialog state
   */
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);
  const defaultPageSize = useMemberPageSizeDefault();
  const [rows, setRows] = React.useState<UserRow[]>(initialData);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [selectedMember, setSelectedMember] = React.useState<UserRow | null>(null);
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);

  const currentPrivilege = useCurrentPrivilege();
  const canDeleteMembers = canDeleteMembersByPrivilege(currentPrivilege);
  const canManageMembership = canManageMembershipStatus(currentPrivilege);
  const canResetPasswords = canResetPasswordsByPrivilege(currentPrivilege);
  const canEditPrivileges = canEditMemberPrivileges(currentPrivilege);
  const allowedMax = getMaxAssignablePrivilege(currentPrivilege);
  const bulkOptions = React.useMemo(() => getBulkPrivilegeOptions(allowedMax), [allowedMax]);

  React.useEffect(() => {
    setRows(initialData);
  }, [initialData]);

  React.useEffect(() => {
    let active = true;
    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (!active) {
        return;
      }
      setCurrentUserId(data.user?.id ?? null);
    };
    loadUser();
    return () => {
      active = false;
    };
  }, [supabase]);

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
      toast.error("Kunne ikke legge til i utskriftskø.", error.message ? { id: toastId, description: error.message, duration: Infinity } : { id: toastId, duration: Infinity });
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
      const supabaseClient = createClient();
      const { error } = await supabaseClient.from("members").update({ privilege_type: next }).eq("id", member.id);
      if (error) {
        toast.error("Kunne ikke oppdatere tilgangsnivå.", { id: toastId, description: error.message, duration: Infinity });
        return;
      }
      setRows((prev) => prev.map((row) => (String(row.id) === String(member.id) ? { ...row, privilege_type: next } : row)));
      setSelectedMember((prev) => (prev && String(prev.id) === String(member.id) ? { ...prev, privilege_type: next } : prev));
      toast.success("Tilgangsnivå oppdatert.", { id: toastId, duration: 6000 });
    },
    [canEditPrivileges, currentPrivilege, currentUserId],
  );

  const handleDeleteMember = React.useCallback(
    async (id: string | number) => {
      const confirmed = window.confirm("Er du sikker på at du vil slette dette medlemmet?");
      if (!confirmed) {
        return;
      }

      const toastId = toast.loading("Sletter medlem...", { duration: 10000 });
      setIsDeleting(true);
      const memberId = String(id);
      const before = rows;
      try {
        setRows((prev) => prev.filter((row) => String(row.id) !== memberId));
        const response = await fetch("/api/admin/members/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ member_id: memberId }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error ?? "Kunne ikke slette medlem.");
        }
        if (selectedMember && String(selectedMember.id) === memberId) {
          setSelectedMember(null);
          setDetailsOpen(false);
        }
        toast.success("Medlem slettet.", { id: toastId, duration: 10000 });
        router.refresh();
      } catch (error: unknown) {
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
    [rows, selectedMember, router],
  );

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
      const label = getPrivilegeLabel(next);
      const confirmed = window.confirm(`Oppdatere ${eligibleIds.length} medlemmer til ${label}?`);
      if (!confirmed) {
        return;
      }
      const toastId = toast.loading("Oppdaterer tilgangsnivå...", { duration: 10000 });
      const supabaseClient = createClient();
      const { error } = await supabaseClient.from("members").update({ privilege_type: next }).in("id", eligibleIds);

      if (error) {
        toast.error("Kunne ikke oppdatere tilgangsnivå.", {
          id: toastId,
          description: error.message,
          duration: Infinity,
        });
        return;
      }

      setRows((prev) => prev.map((row) => (eligibleIds.includes(String(row.id)) ? { ...row, privilege_type: next } : row)));
      setSelectedMember((prev) => (prev && eligibleIds.includes(String(prev.id)) ? { ...prev, privilege_type: next } : prev));
      toast.success("Tilgangsnivå oppdatert.", { id: toastId, duration: 6000 });
    },
    [canEditPrivileges, currentPrivilege],
  );

  const handleBulkMembershipStatus = React.useCallback(
    async (members: UserRow[], isActive: boolean) => {
      if (!members.length) {
        return;
      }
      if (!canManageMembership) {
        toast.error("Du har ikke tilgang til å endre medlemsstatus.");
        return;
      }

      const confirmed = window.confirm(`${isActive ? "Aktivere" : "Sette inaktivt"} medlemskap for ${members.length} medlemmer?`);
      if (!confirmed) {
        return;
      }

      const ids = members.map((member) => String(member.id));
      const toastId = toast.loading("Oppdaterer medlemsstatus...", { duration: 10000 });
      const response = await fetch("/api/admin/members/membership-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_ids: ids, is_active: isActive }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        toast.error("Kunne ikke oppdatere medlemsstatus.", {
          id: toastId,
          description: payload?.error ?? "Ukjent feil.",
          duration: Infinity,
        });
        return;
      }

      setRows((prev) => prev.map((row) => (ids.includes(String(row.id)) ? { ...row, is_membership_active: isActive } : row)));
      setSelectedMember((prev) => (prev && ids.includes(String(prev.id)) ? { ...prev, is_membership_active: isActive } : prev));
      toast.success("Medlemsstatus oppdatert.", { id: toastId, duration: 6000 });
    },
    [canManageMembership],
  );

  const handleBulkPasswordReset = React.useCallback(
    async (members: UserRow[]) => {
      if (!members.length) {
        return;
      }
      if (!canResetPasswords) {
        toast.error("Du har ikke tilgang til å sende passordlenker.");
        return;
      }

      const emails = Array.from(new Set(members.map((member) => member.email?.trim().toLowerCase()).filter((email): email is string => Boolean(email))));
      if (!emails.length) {
        toast.error("Ingen gyldige e-poster valgt.");
        return;
      }

      const confirmed = window.confirm(`Sende passordlenke til ${emails.length} medlemmer?`);
      if (!confirmed) {
        return;
      }

      const toastId = toast.loading("Sender passordlenker...", { duration: 10000 });
      let successCount = 0;
      let errorCount = 0;

      for (const email of emails) {
        try {
          const response = await fetch("/api/admin/members/password-reset", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
          });
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

      toast.success(`Passordlenke sendt til ${successCount} medlemmer.`, { id: toastId, duration: 6000 });
    },
    [canResetPasswords],
  );

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
    const confirmed = window.confirm(`Sende ${printableMembers.length} til utskriftskø?`);
    if (!confirmed) {
      return;
    }
    const toastId = toast.loading("Sender til utskriftskø...", { duration: 10000 });
    const supabaseClient = createClient();
    const { data: authData, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !authData.user) {
      toast.error("Kunne ikke legge til i utskriftskø.", { id: toastId, description: "Prøv å logge inn på nytt.", duration: Infinity });
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
      const parts = [];
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
    } else {
      toast.success(`Sendt ${successCount} til utskriftskø.`, { id: toastId, duration: 6000 });
    }
  }, []);

  const handleBulkDelete = React.useCallback(
    async (members: UserRow[]) => {
      if (!members.length) {
        return;
      }
      if (!canDeleteMembers) {
        toast.error("Du har ikke tilgang til å slette medlemmer.");
        return;
      }
      const confirmed = window.confirm(`Er du sikker på at du vil slette ${members.length} medlemmer?`);
      if (!confirmed) {
        return;
      }
      const ids = members.map((member) => String(member.id));
      const toastId = toast.loading("Sletter medlemmer...", { duration: 10000 });
      const response = await fetch("/api/admin/members/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_ids: ids }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const failed = Array.isArray(payload?.failed) ? payload.failed.length : 0;
        const details =
          failed > 0
            ? `${payload?.error ?? "Kunne ikke slette medlemmer."} (${failed} feilet)`
            : payload?.error ?? "Kunne ikke slette medlemmer.";
        toast.error("Kunne ikke slette medlemmer.", { id: toastId, description: details, duration: Infinity });
        return;
      }
      setRows((prev) => prev.filter((row) => !ids.includes(String(row.id))));
      if (selectedMember && ids.includes(String(selectedMember.id))) {
        setSelectedMember(null);
        setDetailsOpen(false);
      }
      toast.success("Medlemmer slettet.", { id: toastId, duration: 6000 });
      router.refresh();
    },
    [canDeleteMembers, selectedMember, router],
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
            onBulkPrint={handleBulkPrint}
            onBulkDelete={handleBulkDelete}
            canDelete={canDeleteMembers}
            canManageMembership={canManageMembership}
            canResetPasswords={canResetPasswords}
            canEditPrivileges={canEditPrivileges}
            bulkOptions={bulkOptions}
            onRefresh={() => router.refresh()}
            showSelectionQuickActions
            toolbarActions={<CreateUserDialog />}
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
        onPrivilegeUpdated={(next) => {
          if (!selectedMember) {
            return;
          }
          setRows((prev) =>
            prev.map((row) =>
              String(row.id) === String(selectedMember.id) ? { ...row, privilege_type: next } : row,
            ),
          );
          setSelectedMember((prev) => (prev ? { ...prev, privilege_type: next } : prev));
        }}
        onMembershipStatusUpdated={(next) => {
          if (!selectedMember) {
            return;
          }
          setRows((prev) =>
            prev.map((row) =>
              String(row.id) === String(selectedMember.id) ? { ...row, is_membership_active: next } : row,
            ),
          );
          setSelectedMember((prev) => (prev ? { ...prev, is_membership_active: next } : prev));
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
      />
    </div>
  );
}
