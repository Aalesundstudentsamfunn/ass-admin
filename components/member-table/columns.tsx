"use client";

import { ArrowUpDown } from "lucide-react";
import { type ColumnDef, type HeaderContext } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MemberRow,
  copyToClipboard,
  getPrivilegeLabel,
  getPrivilegePillClass,
  PILL_CLASS,
  PRIVILEGE_OPTIONS,
  type PrivilegeOption,
} from "@/components/member-table/shared";
import {
  canAssignPrivilege,
  canEditPrivilegeForTarget,
  memberPrivilege,
} from "@/lib/privilege-checks";
import {
  buildSearchHaystack,
  containsTextFilter,
  sortByDateValue,
} from "@/lib/table/column-helpers";

type PrivilegeColumnOptions = {
  canEditPrivileges: boolean;
  bulkOptions: PrivilegeOption[];
  currentPrivilege: number | null | undefined;
  onPrivilegeChange: (member: MemberRow, next: number) => void;
};

/**
 * Renders sortable header.
 */
function SortableHeader({
  column,
  label,
}: {
  column: HeaderContext<MemberRow, unknown>["column"];
  label: string;
}) {
  return (
    <button
      className="inline-flex items-center gap-1"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc", true)}
    >
      {label} <ArrowUpDown className="h-3.5 w-3.5" />
    </button>
  );
}

/**
 * Hidden search column that aggregates values from name/email and optional UUID.
 */
export function createMemberSearchColumn(includeId: boolean): ColumnDef<MemberRow, unknown> {
  return {
    id: "search",
    accessorFn: (row) =>
      buildSearchHaystack([
        row.firstname,
        row.lastname,
        row.email,
        includeId ? row.id : "",
      ]),
    filterFn: containsTextFilter,
    enableSorting: false,
    enableHiding: true,
  };
}

/**
 * Hidden sort column used to keep "newest first" as default sorting.
 */
export function createMemberCreatedAtSortColumn(): ColumnDef<MemberRow, unknown> {
  return {
    id: "created_at_sort",
    accessorKey: "created_at",
    sortingFn: sortByDateValue,
    header: () => null,
    cell: () => null,
    enableHiding: true,
  };
}

/**
 * Creates member identity columns.
 *
 * How: Uses deterministic transforms over the provided inputs.
 * @returns ColumnDef<MemberRow, unknown>[]
 */
export function createMemberIdentityColumns(): ColumnDef<MemberRow, unknown>[] {
  return [
    {
      accessorKey: "email",
      header: ({ column }) => <SortableHeader column={column} label="E-post" />,
      cell: ({ row }) => (
        <span className="group relative inline-flex items-center">
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
      header: ({ column }) => <SortableHeader column={column} label="Fornavn" />,
      cell: ({ row }) => <span>{row.getValue("firstname")}</span>,
    },
    {
      accessorKey: "lastname",
      header: ({ column }) => <SortableHeader column={column} label="Etternavn" />,
      cell: ({ row }) => <span>{row.getValue("lastname")}</span>,
    },
  ];
}

/**
 * Shared privilege pill/dropdown used by members and frivillige tables.
 */
export function createMemberPrivilegeColumn({
  canEditPrivileges,
  bulkOptions,
  currentPrivilege,
  onPrivilegeChange,
}: PrivilegeColumnOptions): ColumnDef<MemberRow, unknown> {
  return {
    accessorKey: "privilege_type",
    header: ({ column }) => <SortableHeader column={column} label="Tilgang" />,
    cell: ({ row }) => {
      const member = row.original;
      const label = getPrivilegeLabel(row.getValue("privilege_type") as number | null);
      const pillClass = getPrivilegePillClass(member.privilege_type);
      const targetPrivilege = memberPrivilege(member.privilege_type);
      if (!canEditPrivileges || !canEditPrivilegeForTarget(currentPrivilege, targetPrivilege)) {
        return (
          <Badge variant="secondary" className={pillClass}>
            {label}
          </Badge>
        );
      }
      const options = (bulkOptions.length ? bulkOptions : PRIVILEGE_OPTIONS).filter((option) =>
        canAssignPrivilege(currentPrivilege, option.value, targetPrivilege),
      );
      if (!options.length) {
        return (
          <Badge variant="secondary" className={pillClass}>
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
              onPointerDown={(event) => event.stopPropagation()}
              data-row-action="true"
            >
              <Badge variant="secondary" className={`${pillClass} cursor-pointer`}>
                {label}
              </Badge>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="min-w-[10rem]"
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            data-row-action="true"
          >
            {options.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onClick={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
                onSelect={(event) => {
                  event.stopPropagation();
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
  };
}
