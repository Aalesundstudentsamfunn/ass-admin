"use client";

import * as React from "react";
import { toast } from "sonner";
import type { MemberRow } from "@/components/member-table/shared";
import { isSameMemberQuery, type MemberQuery } from "@/lib/members/member-query";

type LoadResult =
  | { ok: true; rows: MemberRow[]; totalCount: number }
  | { ok: false; error: string };

type UseMembersServerPageOptions = {
  initialRows: MemberRow[];
  initialTotalCount: number;
  /** The query the server component already answered, so mount does not refetch it. */
  initialQuery: MemberQuery;
  load: (query: MemberQuery) => Promise<LoadResult>;
};

/**
 * Owns the members table's data when paging happens in the database.
 *
 * The table component stays the source of truth for search/sort/filter/page UI state and
 * reports it through `onQueryChange`; this hook turns each distinct query into one fetch
 * and hands the rows back. `setRows` stays exposed so the existing mutation handlers can
 * keep updating rows optimistically.
 */
export function useMembersServerPage({
  initialRows,
  initialTotalCount,
  initialQuery,
  load,
}: UseMembersServerPageOptions) {
  const [rows, setRows] = React.useState<MemberRow[]>(initialRows);
  const [totalCount, setTotalCount] = React.useState(initialTotalCount);
  const [query, setQuery] = React.useState<MemberQuery>(initialQuery);
  const [isLoading, setIsLoading] = React.useState(false);
  const [reloadToken, setReloadToken] = React.useState(0);

  const initialQueryRef = React.useRef(initialQuery);
  const hasFetchedRef = React.useRef(false);
  // Guards against an earlier, slower request overwriting a newer one's rows.
  const requestIdRef = React.useRef(0);

  const onQueryChange = React.useCallback((next: MemberQuery) => {
    setQuery((previous) => (isSameMemberQuery(previous, next) ? previous : next));
  }, []);

  const reload = React.useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  React.useEffect(() => {
    if (
      !hasFetchedRef.current &&
      reloadToken === 0 &&
      isSameMemberQuery(query, initialQueryRef.current)
    ) {
      // The server component rendered exactly this page; refetching it would only flicker.
      return;
    }
    hasFetchedRef.current = true;

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    let cancelled = false;
    setIsLoading(true);

    load(query)
      .then((result) => {
        if (cancelled || requestId !== requestIdRef.current) {
          return;
        }
        if (!result.ok) {
          toast.error("Kunne ikke hente medlemmer.", { description: result.error });
          return;
        }
        setRows(result.rows);
        setTotalCount(result.totalCount);
      })
      .catch((error: unknown) => {
        if (cancelled || requestId !== requestIdRef.current) {
          return;
        }
        toast.error("Kunne ikke hente medlemmer.", {
          description: error instanceof Error ? error.message : "Ukjent feil.",
        });
      })
      .finally(() => {
        if (!cancelled && requestId === requestIdRef.current) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [load, query, reloadToken]);

  return { rows, setRows, totalCount, query, onQueryChange, isLoading, reload };
}
