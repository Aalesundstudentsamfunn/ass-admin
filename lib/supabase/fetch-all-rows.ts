const DEFAULT_PAGE_SIZE = 1000;
const MAX_PAGES = 100;

type PageResult<T> = { data: T[] | null; error: { message: string } | null };

/**
 * Fetches every row of a query, working around PostgREST's `max-rows` cap.
 *
 * How: Repeatedly calls `fetchPage` with `.range()` bounds, advancing by the number of rows
 * actually returned (the server may return fewer than asked), until a page comes back empty.
 * Callers must order by a stable, unique tiebreaker so rows are not skipped or duplicated
 * across pages.
 */
export async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
  pageSize: number = DEFAULT_PAGE_SIZE,
): Promise<PageResult<T>> {
  const rows: T[] = [];
  let from = 0;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) {
      return { data: null, error };
    }
    const batch = data ?? [];
    if (batch.length === 0) {
      break;
    }
    rows.push(...batch);
    from += batch.length;
  }

  return { data: rows, error: null };
}
