"use client";

import * as React from "react";
import { Filter, X } from "lucide-react";
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
  onClearQuickFilter,
  onClearSearch,
  onRefresh,
  rightSlot,
  searchPillPrefix = "Søk",
}: {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  isDefaultSort: boolean;
  quickFilters: QuickFilterOption[];
  onQuickFilterSelect: (key: string) => void;
  activeQuickFilter: string | null;
  onClearQuickFilter: () => void;
  onClearSearch: () => void;
  onRefresh?: () => void;
  rightSlot?: React.ReactNode;
  searchPillPrefix?: string;
}) {
  const hasSearchFilter = Boolean(searchValue);

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
                )}
                aria-label="Filteranbefalinger"
              >
                <Filter className="h-4 w-4" />
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
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {hasSearchFilter ? (
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

        {activeQuickFilter ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/70 px-2.5 py-1 text-xs">
            {activeQuickFilter}
            <button
              type="button"
              className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Fjern hurtigfilter"
              onClick={onClearQuickFilter}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ) : null}

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
