import {
  buildCommitteeNameById,
  normalizeCommitteeOptions,
  parseCommitteeId,
  type CommitteeOption,
} from "@/lib/committee-options";

type CommitteeLookupClient = {
  from: (table: string) => {
    select: (columns: string) => CommitteeSelectBuilder;
  };
};

type CommitteeRow = {
  id: unknown;
  committee_name?: unknown;
  name?: unknown;
};

type CommitteeQueryResult = Promise<{
  data: unknown[] | null;
  error: { message: string } | null;
}>;

type CommitteeOrderBuilder = {
  order: (column: string, config: { ascending: boolean }) => CommitteeQueryResult;
};

type CommitteeSelectBuilder = CommitteeOrderBuilder & {
  in: (column: string, values: number[]) => CommitteeOrderBuilder;
};

/**
 * Loads committee options with schema fallback compatibility.
 */
export async function fetchCommitteeOptions(
  supabase: unknown,
  ids?: number[],
): Promise<{ options: CommitteeOption[]; error: string | null }> {
  const client = supabase as CommitteeLookupClient;
  const normalizedIds = Array.from(new Set((ids ?? []).map(parseCommitteeId).filter((value): value is number => value !== null)));

  const attempts: Array<{ table: string; column: "committee_name" | "name" }> = [
    { table: "committee_type", column: "committee_name" },
    { table: "committee_type", column: "name" },
    { table: "committee_types", column: "committee_name" },
    { table: "committee_types", column: "name" },
  ];

  let lastError: string | null = null;

  for (const attempt of attempts) {
    const query = client
      .from(attempt.table)
      .select(`id, ${attempt.column}`);

    const result = await (
      normalizedIds.length > 0
        ? query.in("id", normalizedIds).order("id", { ascending: true })
        : query.order("id", { ascending: true })
    );
    if (result.error) {
      lastError = result.error.message;
      continue;
    }

    const mappedRows = ((result.data ?? []) as CommitteeRow[]).map((row) => ({
      id: row.id,
      name:
        attempt.column === "committee_name"
          ? row.committee_name
          : row.name,
    }));

    return {
      options: normalizeCommitteeOptions(mappedRows),
      error: null,
    };
  }

  return {
    options: [],
    error: lastError,
  };
}

/**
 * Loads committee options and returns a map for quick id -> name resolution.
 */
export async function fetchCommitteeNameByIdMap(
  supabase: unknown,
  ids?: number[],
): Promise<{ options: CommitteeOption[]; nameById: Map<number, string>; error: string | null }> {
  const { options, error } = await fetchCommitteeOptions(supabase, ids);
  return {
    options,
    nameById: buildCommitteeNameById(options),
    error,
  };
}
