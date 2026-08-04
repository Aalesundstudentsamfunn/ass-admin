/**
 * Creates the browser Supabase client used in client components/hooks.
 */
import { createBrowserClient } from "@supabase/ssr";

/**
 * Creates a browser Supabase client for client components/hooks.
 */
export function createClient() {
  // NB: createBrowserClient hardkoder `flowType: "pkce"` etter at den har spredt
  // inn `auth`-opsjonene våre, så flowType kan ikke overstyres her. Lenker som
  // skal fungere på tvers av enheter må derfor bruke `token_hash` (verifyOtp),
  // ikke PKCE-koden - se components/auth/update-password-form.tsx.
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        detectSessionInUrl: true,
      },
    },
  );
}
