/**
 * POST /api/admin/members/password-reset
 * Alias route for admin password reset used by member detail dialogs.
 * Re-exports the main handler from /api/admin/password-reset.
 */
export { POST } from "../../password-reset/route";
