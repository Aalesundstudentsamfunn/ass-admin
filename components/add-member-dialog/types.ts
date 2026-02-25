import type {
  AddMemberActionResult,
  CheckMemberEmailResult,
} from "@/lib/members/actions-types";

/**
 * Dialog workflow stages for add-member flow.
 */
export type AddMemberDialogStage =
  | "email"
  | "create"
  | "exists-active"
  | "exists-inactive"
  | "exists-banned";

/**
 * Alias for create/activate server action result.
 */
export type QueueActionResult = AddMemberActionResult;

/**
 * Alias for email-check server action result.
 */
export type CheckEmailActionResult = CheckMemberEmailResult;

