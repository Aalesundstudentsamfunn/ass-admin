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

type CommitteeColumnOptions = {
  usePrivilegePill?: boolean;
  sortByPrivilegeWithinCommittee?: boolean;
};

type CommitteePillPalette = {
  normal: string;
  leader: string;
};

const COMMITTEE_HUE_BY_ID: Record<number, number> = {
  1: 345,
  2: 35,
  3: 24,
  4: 90,
  5: 152,
  6: 170,
  7: 188,
  8: 200,
  9: 217,
  10: 240,
  11: 262,
  12: 300,
  13: 325,
};

const DEFAULT_COMMITTEE_PILL: CommitteePillPalette = {
  normal:
    "rounded-full px-2.5 py-0.5 text-xs font-medium border-zinc-300/70 bg-zinc-100 text-zinc-800 dark:border-zinc-500/60 dark:bg-zinc-500/45 dark:text-zinc-100",
  leader:
    "rounded-full px-2.5 py-0.5 text-xs font-medium border-zinc-400/90 bg-zinc-200 text-zinc-900 dark:border-zinc-300/80 dark:bg-zinc-500/65 dark:text-zinc-50",
};

const COMMITTEE_PILL_BY_ID: Record<number, CommitteePillPalette> = {
  1: {
    normal:
      "rounded-full px-2.5 py-0.5 text-xs font-medium border-rose-300/70 bg-rose-100 text-rose-800 dark:border-rose-500/60 dark:bg-rose-500/45 dark:text-rose-100",
    leader:
      "rounded-full px-2.5 py-0.5 text-xs font-medium border-rose-400/90 bg-rose-200 text-rose-900 dark:border-rose-300/80 dark:bg-rose-500/65 dark:text-rose-50",
  },
  2: {
    normal:
      "rounded-full px-2.5 py-0.5 text-xs font-medium border-amber-300/70 bg-amber-100 text-amber-800 dark:border-amber-500/60 dark:bg-amber-500/45 dark:text-amber-100",
    leader:
      "rounded-full px-2.5 py-0.5 text-xs font-medium border-amber-400/90 bg-amber-200 text-amber-900 dark:border-amber-300/80 dark:bg-amber-500/65 dark:text-amber-50",
  },
  3: {
    normal:
      "rounded-full px-2.5 py-0.5 text-xs font-medium border-orange-300/70 bg-orange-100 text-orange-800 dark:border-orange-500/60 dark:bg-orange-500/45 dark:text-orange-100",
    leader:
      "rounded-full px-2.5 py-0.5 text-xs font-medium border-orange-400/90 bg-orange-200 text-orange-900 dark:border-orange-300/80 dark:bg-orange-500/65 dark:text-orange-50",
  },
  4: {
    normal:
      "rounded-full px-2.5 py-0.5 text-xs font-medium border-lime-300/70 bg-lime-100 text-lime-800 dark:border-lime-500/60 dark:bg-lime-500/45 dark:text-lime-100",
    leader:
      "rounded-full px-2.5 py-0.5 text-xs font-medium border-lime-400/90 bg-lime-200 text-lime-900 dark:border-lime-300/80 dark:bg-lime-500/65 dark:text-lime-50",
  },
  5: {
    normal:
      "rounded-full px-2.5 py-0.5 text-xs font-medium border-emerald-300/70 bg-emerald-100 text-emerald-800 dark:border-emerald-500/60 dark:bg-emerald-500/45 dark:text-emerald-100",
    leader:
      "rounded-full px-2.5 py-0.5 text-xs font-medium border-emerald-400/90 bg-emerald-200 text-emerald-900 dark:border-emerald-300/80 dark:bg-emerald-500/65 dark:text-emerald-50",
  },
  6: {
    normal:
      "rounded-full px-2.5 py-0.5 text-xs font-medium border-teal-300/70 bg-teal-100 text-teal-800 dark:border-teal-500/60 dark:bg-teal-500/45 dark:text-teal-100",
    leader:
      "rounded-full px-2.5 py-0.5 text-xs font-medium border-teal-400/90 bg-teal-200 text-teal-900 dark:border-teal-300/80 dark:bg-teal-500/65 dark:text-teal-50",
  },
  7: {
    normal:
      "rounded-full px-2.5 py-0.5 text-xs font-medium border-cyan-300/70 bg-cyan-100 text-cyan-800 dark:border-cyan-500/60 dark:bg-cyan-500/45 dark:text-cyan-100",
    leader:
      "rounded-full px-2.5 py-0.5 text-xs font-medium border-cyan-400/90 bg-cyan-200 text-cyan-900 dark:border-cyan-300/80 dark:bg-cyan-500/65 dark:text-cyan-50",
  },
  8: {
    normal:
      "rounded-full px-2.5 py-0.5 text-xs font-medium border-sky-300/70 bg-sky-100 text-sky-800 dark:border-sky-500/60 dark:bg-sky-500/45 dark:text-sky-100",
    leader:
      "rounded-full px-2.5 py-0.5 text-xs font-medium border-sky-400/90 bg-sky-200 text-sky-900 dark:border-sky-300/80 dark:bg-sky-500/65 dark:text-sky-50",
  },
  9: {
    normal:
      "rounded-full px-2.5 py-0.5 text-xs font-medium border-blue-300/70 bg-blue-100 text-blue-800 dark:border-blue-500/60 dark:bg-blue-500/45 dark:text-blue-100",
    leader:
      "rounded-full px-2.5 py-0.5 text-xs font-medium border-blue-400/90 bg-blue-200 text-blue-900 dark:border-blue-300/80 dark:bg-blue-500/65 dark:text-blue-50",
  },
  10: {
    normal:
      "rounded-full px-2.5 py-0.5 text-xs font-medium border-indigo-300/70 bg-indigo-100 text-indigo-800 dark:border-indigo-500/60 dark:bg-indigo-500/45 dark:text-indigo-100",
    leader:
      "rounded-full px-2.5 py-0.5 text-xs font-medium border-indigo-400/90 bg-indigo-200 text-indigo-900 dark:border-indigo-300/80 dark:bg-indigo-500/65 dark:text-indigo-50",
  },
  11: {
    normal:
      "rounded-full px-2.5 py-0.5 text-xs font-medium border-violet-300/70 bg-violet-100 text-violet-800 dark:border-violet-500/60 dark:bg-violet-500/45 dark:text-violet-100",
    leader:
      "rounded-full px-2.5 py-0.5 text-xs font-medium border-violet-400/90 bg-violet-200 text-violet-900 dark:border-violet-300/80 dark:bg-violet-500/65 dark:text-violet-50",
  },
  12: {
    normal:
      "rounded-full px-2.5 py-0.5 text-xs font-medium border-fuchsia-300/70 bg-fuchsia-100 text-fuchsia-800 dark:border-fuchsia-500/60 dark:bg-fuchsia-500/45 dark:text-fuchsia-100",
    leader:
      "rounded-full px-2.5 py-0.5 text-xs font-medium border-fuchsia-400/90 bg-fuchsia-200 text-fuchsia-900 dark:border-fuchsia-300/80 dark:bg-fuchsia-500/65 dark:text-fuchsia-50",
  },
  13: {
    normal:
      "rounded-full px-2.5 py-0.5 text-xs font-medium border-pink-300/70 bg-pink-100 text-pink-800 dark:border-pink-500/60 dark:bg-pink-500/45 dark:text-pink-100",
    leader:
      "rounded-full px-2.5 py-0.5 text-xs font-medium border-pink-400/90 bg-pink-200 text-pink-900 dark:border-pink-300/80 dark:bg-pink-500/65 dark:text-pink-50",
  },
};

const COMMITTEE_PILL_ROTATION: CommitteePillPalette[] = [
  COMMITTEE_PILL_BY_ID[1],
  COMMITTEE_PILL_BY_ID[2],
  COMMITTEE_PILL_BY_ID[3],
  COMMITTEE_PILL_BY_ID[4],
  COMMITTEE_PILL_BY_ID[5],
  COMMITTEE_PILL_BY_ID[6],
  COMMITTEE_PILL_BY_ID[7],
  COMMITTEE_PILL_BY_ID[8],
  COMMITTEE_PILL_BY_ID[9],
  COMMITTEE_PILL_BY_ID[10],
  COMMITTEE_PILL_BY_ID[11],
  COMMITTEE_PILL_BY_ID[12],
  COMMITTEE_PILL_BY_ID[13],
];

function normalizeCommitteeKey(value: string): string {
  return value.replace(/\s*\(leder\)\s*$/i, "").trim().toLowerCase();
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function getCommitteeHue({
  committeeId,
  committeeLabel,
}: {
  committeeId: number | null | undefined;
  committeeLabel: string;
}): number {
  if (typeof committeeId === "number" && COMMITTEE_HUE_BY_ID[committeeId]) {
    return COMMITTEE_HUE_BY_ID[committeeId];
  }
  const key = normalizeCommitteeKey(committeeLabel);
  if (!key) {
    return 220;
  }
  const hues = Object.values(COMMITTEE_HUE_BY_ID);
  return hues[hashString(key) % hues.length] ?? 220;
}

function getCommitteePillStyle({
  committeeId,
  committeeLabel,
  privilegeType,
}: {
  committeeId: number | null | undefined;
  committeeLabel: string;
  privilegeType: number | null | undefined;
}) {
  const hue = getCommitteeHue({ committeeId, committeeLabel });
  const isLeaderWithinCommittee = Number(privilegeType) === 4;
  const backgroundAlpha = isLeaderWithinCommittee ? 0.44 : 0.28;
  const borderAlpha = isLeaderWithinCommittee ? 0.9 : 0.7;
  const saturation = isLeaderWithinCommittee ? 82 : 78;
  const lightness = isLeaderWithinCommittee ? 52 : 60;
  return {
    backgroundColor: `hsl(${hue} ${saturation}% ${lightness}% / ${backgroundAlpha})`,
    borderColor: `hsl(${hue} ${saturation}% ${lightness}% / ${borderAlpha})`,
  } as const;
}

function getCommitteePillClass({
  committeeId,
  committeeLabel,
  privilegeType,
}: {
  committeeId: number | null | undefined;
  committeeLabel: string;
  privilegeType: number | null | undefined;
}): string {
  let palette: CommitteePillPalette = DEFAULT_COMMITTEE_PILL;
  if (typeof committeeId === "number" && COMMITTEE_PILL_BY_ID[committeeId]) {
    palette = COMMITTEE_PILL_BY_ID[committeeId];
  } else {
    const key = normalizeCommitteeKey(committeeLabel);
    if (key) {
      palette = COMMITTEE_PILL_ROTATION[hashString(key) % COMMITTEE_PILL_ROTATION.length];
    }
  }
  const isLeaderWithinCommittee = Number(privilegeType) === 4;
  const paletteClass = isLeaderWithinCommittee ? palette.leader : palette.normal;
  return paletteClass
    .replace(/\s*dark:text-\S+/g, "")
    .replace(/\s*text-\S+/g, "");
}

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
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
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
 * Committee column sorted by committee id (DB-defined order).
 */
export function createMemberCommitteeColumn({
  usePrivilegePill = false,
  sortByPrivilegeWithinCommittee = false,
}: CommitteeColumnOptions = {}): ColumnDef<MemberRow, unknown> {
  return {
    id: "committee",
    accessorFn: (row) => row.committee_id ?? Number.MAX_SAFE_INTEGER,
    header: ({ column }) => <SortableHeader column={column} label="Komité" />,
    sortingFn: (rowA, rowB) => {
      const committeeA =
        typeof rowA.original.committee_id === "number"
          ? rowA.original.committee_id
          : Number.MAX_SAFE_INTEGER;
      const committeeB =
        typeof rowB.original.committee_id === "number"
          ? rowB.original.committee_id
          : Number.MAX_SAFE_INTEGER;
      if (committeeA !== committeeB) {
        return committeeA - committeeB;
      }

      if (sortByPrivilegeWithinCommittee) {
        const privilegeA =
          typeof rowA.original.privilege_type === "number"
            ? rowA.original.privilege_type
            : Number.NEGATIVE_INFINITY;
        const privilegeB =
          typeof rowB.original.privilege_type === "number"
            ? rowB.original.privilege_type
            : Number.NEGATIVE_INFINITY;
        if (privilegeA !== privilegeB) {
          return privilegeB - privilegeA;
        }
      }

      return 0;
    },
    cell: ({ row }) => {
      const committee = String(row.original.committee ?? "").trim() || "—";
      if (!usePrivilegePill) {
        return <span>{committee}</span>;
      }
      const pillClass = getCommitteePillClass({
        committeeId: row.original.committee_id,
        committeeLabel: committee,
        privilegeType: row.original.privilege_type,
      });
      const pillStyle = getCommitteePillStyle({
        committeeId: row.original.committee_id,
        committeeLabel: committee,
        privilegeType: row.original.privilege_type,
      });
      return (
        <Badge
          variant="outline"
          className={`${pillClass} !text-zinc-900 dark:!text-zinc-50`}
          style={pillStyle}
        >
          {committee}
        </Badge>
      );
    },
  };
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
