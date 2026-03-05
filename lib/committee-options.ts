export type CommitteeOption = {
  id: number;
  name: string;
};

export function parseCommitteeId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed) && Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return null;
}

export function normalizeCommitteeOptions(
  rows: Array<{ id: unknown; name: unknown }> | null | undefined,
): CommitteeOption[] {
  if (!rows || rows.length === 0) {
    return [];
  }
  const options: CommitteeOption[] = [];
  for (const row of rows) {
    const id = parseCommitteeId(row.id);
    const name = typeof row.name === "string" ? row.name.trim() : "";
    if (id === null || !name) {
      continue;
    }
    options.push({ id, name });
  }
  options.sort((a, b) => a.id - b.id);
  return options;
}

export function buildCommitteeNameById(
  options: CommitteeOption[],
): Map<number, string> {
  return new Map(options.map((option) => [option.id, option.name]));
}
