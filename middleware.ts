/**
 * Next.js middleware entrypoint for dashboard/admin route protection.
 */
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Delegates auth/session handling for protected app areas.
 */
export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/utstyr/:path*"],
};
