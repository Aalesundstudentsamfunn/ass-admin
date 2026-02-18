"use client";

import * as React from "react";
import { ArrowUpDown } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MemberDataTable } from "@/components/member-table/member-data-table";
import { MemberDetailsDialog } from "@/components/member-table/member-details-dialog";
import { copyToClipboard, getPrivilegeLabel, MemberRow, PILL_CLASS, PRIVILEGE_OPTIONS } from "@/components/member-table/shared";
import { createClient } from "@/lib/supabase/client";
import { useCurrentPrivilege } from "@/lib/use-current-privilege";
import { useMemberPageSizeDefault } from "@/lib/table-settings";
import {
  canAssignPrivilege,
  canEditPrivilegeForTarget,
  canEditMemberPrivileges,
  canSetOwnPrivilege,
  getMaxAssignablePrivilege,
} from "@/lib/privilege-checks";
import { toast } from "sonner";

export type UserRow = MemberRow;

function buildColumns(
  onPrivilegeChange: (member: UserRow, next: number) => void,
  canEditPrivileges: boolean,
  bulkOptions: { value: number; label: string }[],
  currentPrivilege: number | null | undefined,
): ColumnDef<UserRow, unknown>[] {
  return [
    {
      id: "search",
      accessorFn: (row: UserRow) => `${row.firstname ?? ""} ${row.lastname ?? ""} ${row.email ?? ""}`.trim(),
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
        <button
          className="inline-flex items-center gap-1"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
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
        <button
          className="inline-flex items-center gap-1"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Fornavn <ArrowUpDown className="h-3.5 w-3.5" />
        </button>
      ),
      cell: ({ row }) => <span>{row.getValue("firstname")}</span>,
    },
    {
      accessorKey: "lastname",
      header: ({ column }) => (
        <button
          className="inline-flex items-center gap-1"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Etternavn <ArrowUpDown className="h-3.5 w-3.5" />
        </button>
      ),
      cell: ({ row }) => <span>{row.getValue("lastname")}</span>,
    },
    {
      accessorKey: "privilege_type",
      header: ({ column }) => (
        <button
          className="inline-flex items-center gap-1"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Tilgang <ArrowUpDown className="h-3.5 w-3.5" />
        </button>
      ),
      cell: ({ row }) => {
        const member = row.original as UserRow;
        const label = getPrivilegeLabel(row.getValue("privilege_type") as number | null);
        const targetPrivilege = typeof member.privilege_type === "number" ? member.privilege_type : 1;
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
      cell: () => null,
      enableHiding: false,
    },
  ];
}

export default function VoluntaryPage({ initialData }: { initialData: UserRow[] }) {
  const supabase = React.useMemo(() => createClient(), []);
  const defaultPageSize = useMemberPageSizeDefault();
  const [rows, setRows] = React.useState<UserRow[]>(initialData);
  const [selectedMember, setSelectedMember] = React.useState<UserRow | null>(null);
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);

  const currentPrivilege = useCurrentPrivilege();
  const canEditPrivileges = canEditMemberPrivileges(currentPrivilege);
  const allowedMax = getMaxAssignablePrivilege(currentPrivilege);
  const bulkOptions = React.useMemo(
    () => {
      if (allowedMax === null) {
        return [];
      }
      if (allowedMax === 2) {
        return PRIVILEGE_OPTIONS.filter((option) => option.value === 2);
      }
      return PRIVILEGE_OPTIONS.filter((option) => option.value <= allowedMax);
    },
    [allowedMax],
  );

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

  const applyPrivilegeToRows = React.useCallback((ids: string[], next: number) => {
    const idSet = new Set(ids);
    setRows((prev) => {
      if (next < 2) {
        return prev.filter((row) => !idSet.has(String(row.id)));
      }
      return prev.map((row) => (idSet.has(String(row.id)) ? { ...row, privilege_type: next } : row));
    });
    setSelectedMember((prev) => {
      if (!prev || !idSet.has(String(prev.id))) {
        return prev;
      }
      if (next < 2) {
        setDetailsOpen(false);
        return null;
      }
      return { ...prev, privilege_type: next };
    });
  }, []);

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

  const handleRowPrivilegeChange = React.useCallback(
    async (member: UserRow, next: number) => {
      const currentValue = typeof member.privilege_type === "number" ? member.privilege_type : 1;
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

      applyPrivilegeToRows([String(member.id)], next);
      toast.success("Tilgangsnivå oppdatert.", { id: toastId, duration: 6000 });
    },
    [applyPrivilegeToRows, canEditPrivileges, currentPrivilege, currentUserId],
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
            typeof member.privilege_type === "number" ? member.privilege_type : 1,
          ),
        )
        .map((member) => String(member.id));
      if (!eligibleIds.length) {
        toast.error("Ingen valgte medlemmer kan oppdateres med dette nivået.");
        return;
      }

      const label = getPrivilegeLabel(next);
      const confirmed = window.confirm(`Oppdatere ${eligibleIds.length} frivillige til ${label}?`);
      if (!confirmed) {
        return;
      }

      const toastId = toast.loading("Oppdaterer tilgangsnivå...", { duration: 10000 });
      const supabaseClient = createClient();
      const { error } = await supabaseClient.from("members").update({ privilege_type: next }).in("id", eligibleIds);
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
      />
    </div>
  );
}
