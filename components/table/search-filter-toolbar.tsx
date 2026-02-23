"use client";

import * as React from "react";
import { Check, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type QuickFilterOption = {
  key: string;
  label: string;
};

type ActiveQuickFilterPill = {
  key: string;
  label: string;
};

/**
 * Shared table toolbar:
 * - text search
 * - quick-filter dropdown
 * - active filter pills
 * - optional refresh button and right-side slot
 */
export function SearchFilterToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  isDefaultSort,
  quickFilters,
  onQuickFilterSelect,
  activeQuickFilter,
  activeQuickFilters,
  onClearQuickFilter,
  onClearSearch,
  onRefresh,
  rightSlot,
  searchPillPrefix = "Søk",
  activeFilterCount = 0,
  showActivePills = true,
  activeQuickFilterKeys = [],
  sortPriorityByKey,
}: {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  isDefaultSort: boolean;
  quickFilters: QuickFilterOption[];
  onQuickFilterSelect: (key: string) => void;
  activeQuickFilter: string | null;
  activeQuickFilters?: ActiveQuickFilterPill[];
  onClearQuickFilter: (key?: string) => void;
  onClearSearch: () => void;
  onRefresh?: () => void;
  rightSlot?: React.ReactNode;
  searchPillPrefix?: string;
  activeFilterCount?: number;
  showActivePills?: boolean;
  activeQuickFilterKeys?: string[];
  sortPriorityByKey?: Record<string, number>;
}) {
  const hasSearchFilter = Boolean(searchValue);
  const quickFilterPills = activeQuickFilters ?? (activeQuickFilter ? [{ key: "__single", label: activeQuickFilter }] : []);

  return (
    <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Input
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            className="rounded-xl bg-background/60 pr-10"
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 transition-colors",
                  "hover:bg-muted/50",
                  !isDefaultSort && "text-primary",
                  "z-10",
                )}
                aria-label="Filteranbefalinger"
              >
                <Filter className="h-4 w-4" />
                {activeFilterCount > 0 ? (
                  <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                    {activeFilterCount}
                  </span>
                ) : null}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[14rem]">
              {quickFilters.map((option) => (
                <DropdownMenuItem
                  key={option.key}
                  onSelect={(event) => {
                    event.preventDefault();
                    onQuickFilterSelect(option.key);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-3.5 w-3.5",
                      activeQuickFilterKeys.includes(option.key) ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {option.label}
                  {sortPriorityByKey?.[option.key] ? (
                    <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-border/70 bg-muted/40 px-1 text-[10px] font-semibold">
                      {sortPriorityByKey[option.key]}
                    </span>
                  ) : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {showActivePills && hasSearchFilter ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/70 px-2.5 py-1 text-xs">
            {searchPillPrefix}: {searchValue}
            <button
              type="button"
              className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Fjern søkefilter"
              onClick={onClearSearch}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ) : null}

        {showActivePills
          ? quickFilterPills.map((pill) => (
          <span
            key={pill.key}
            className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/70 px-2.5 py-1 text-xs"
          >
            {pill.label}
            <button
              type="button"
              className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Fjern hurtigfilter"
              onClick={() => onClearQuickFilter(pill.key)}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
          ))
          : null}

        {onRefresh ? (
          <Button size="sm" variant="outline" className="rounded-xl" onClick={onRefresh}>
            Oppdater
          </Button>
        ) : null}
      </div>

      {rightSlot ? <div className="flex items-center gap-2">{rightSlot}</div> : null}
    </div>
  );
}
