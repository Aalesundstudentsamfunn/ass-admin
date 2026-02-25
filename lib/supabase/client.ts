/**
 * Creates the browser Supabase client used in client components/hooks.
 */
import { createBrowserClient } from "@supabase/ssr";

/**
 * Creates a browser Supabase client for client components/hooks.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
