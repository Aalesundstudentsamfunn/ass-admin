/**
 * Shared response contracts for members server actions.
 *
 * These types are consumed by both:
 * - server actions (`app/dashboard/members/server/actions.ts`)
 * - client action context (`app/dashboard/members/providers.tsx`)
 */

export type AddMemberActionResult = {
  ok: boolean;
  error?: string;
  autoPrint?: boolean;
  queueId?: string | number;
  queueRef?: string | number;
  queueInvoker?: string;
};

export type MemberLookupResult = {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  privilege_type: number | null;
  is_banned?: boolean | null;
};

export type CheckMemberEmailResult = {
  ok: boolean;
  error?: string;
  exists?: boolean;
  active?: boolean;
  banned?: boolean;
  email?: string;
  member?: MemberLookupResult;
};

