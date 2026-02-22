import type { Row } from "@tanstack/react-table";

/**
 * Joins values into one normalized searchable string for hidden search columns.
 */
export function buildSearchHaystack(values: unknown[]) {
  return values
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

/**
 * Case-insensitive "contains" filter used by shared hidden search columns.
 */
export function containsTextFilter<TData>(
  row: Row<TData>,
  columnId: string,
  value: unknown,
) {
  const query = String(value ?? "").trim().toLowerCase();
  if (!query) {
    return true;
  }
  const haystack = String(row.getValue(columnId) ?? "").toLowerCase();
  return haystack.includes(query);
}

const toDateMs = (value: unknown) => {
  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Shared sorting function for columns containing ISO date strings.
 */
export function sortByDateValue<TData>(
  rowA: Row<TData>,
  rowB: Row<TData>,
  columnId: string,
) {
  return toDateMs(rowA.getValue(columnId)) - toDateMs(rowB.getValue(columnId));
}
