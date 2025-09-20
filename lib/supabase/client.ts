import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  console.log("process.env.NEXT_PUBLIC_SUPABASE_URL!", process.env.NEXT_PUBLIC_SUPABASE_URL!)
  console.log("process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY!", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY!)
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
