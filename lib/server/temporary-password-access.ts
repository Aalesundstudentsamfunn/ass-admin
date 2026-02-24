import { PRIVILEGE_LEVELS } from "@/lib/privilege-config";

/**
 * Server-side gate for bulk temporary-password action.
 *
 * Rules:
 * - user must be IT (5+)
 */
export function canUseBulkTemporaryPasswordAction({
  privilege,
}: {
  privilege: number;
}) {
  return privilege >= PRIVILEGE_LEVELS.IT;
}
