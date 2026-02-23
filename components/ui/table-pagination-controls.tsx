"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type TablePaginationControlsProps = {
  rowCount: number;
  filteredCount: number;
  pageIndex: number;
  pageCount: number;
  canPrevious: boolean;
  canNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onPageIndexChange: (page: number) => void;
  pageSize?: number;
  pageSizeOptions?: readonly number[];
  onPageSizeChange?: (pageSize: number) => void;
};

/**
 * Renders get bounded page index.
 *
 * How: Uses deterministic transforms over the provided inputs.
 */
function getBoundedPageIndex(rawValue: string, pageCount: number) {
  const page = Number(rawValue) - 1;
  if (Number.isNaN(page)) {
    return null;
  }
  return Math.max(0, Math.min(page, Math.max(0, pageCount - 1)));
}

/**
 * Renders table pagination controls.
 */
export function TablePaginationControls({
  rowCount,
  filteredCount,
  pageIndex,
  pageCount,
  canPrevious,
  canNext,
  onPrevious,
  onNext,
  onPageIndexChange,
  pageSize,
  pageSizeOptions,
  onPageSizeChange,
}: TablePaginationControlsProps) {
  const showPageSize =
    typeof pageSize === "number" &&
    Array.isArray(pageSizeOptions) &&
    pageSizeOptions.length > 0 &&
    typeof onPageSizeChange === "function";

  return (
    <div className="flex items-center justify-between">
      <div className="text-xs text-muted-foreground">
        Viser {rowCount} av {filteredCount} rader
      </div>
      <div className="flex items-center gap-2">
        {showPageSize ? (
          <>
            <span className="text-xs text-muted-foreground">Rader per side</span>
            <select
              value={pageSize}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (Number.isNaN(next)) {
                  return;
                }
                onPageSizeChange(next);
              }}
              className="h-8 w-20 rounded-xl border border-border/60 bg-background/60 px-2 text-xs"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </>
        ) : null}
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl"
          onClick={onPrevious}
          disabled={!canPrevious}
        >
          Forrige
        </Button>
        <span className="text-xs">Gå til side</span>
        <Input
          type="number"
          min={1}
          max={Math.max(1, pageCount)}
          value={pageIndex + 1}
          onChange={(event) => {
            const nextPage = getBoundedPageIndex(event.target.value, pageCount);
            if (nextPage === null) {
              return;
            }
            onPageIndexChange(nextPage);
          }}
          className="h-8 w-16 px-2 py-1 text-xs"
          style={{ fontVariantNumeric: "tabular-nums" }}
        />
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl"
          onClick={onNext}
          disabled={!canNext}
        >
          Neste
        </Button>
      </div>
    </div>
  );
}
