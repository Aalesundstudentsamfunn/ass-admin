import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { createClient } from "@/lib/supabase/server";


//midlertidig auth sjekk, bør bli oppdatert 
export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/utstyr/:path*"],
};
