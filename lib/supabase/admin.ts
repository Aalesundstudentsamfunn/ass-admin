/**
 * Shared library module.
 */
import { createClient } from "@supabase/supabase-js";

/**
 * Creates a service-role Supabase client for server-only privileged operations.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Mangler NEXT_PUBLIC_SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY, Kontakt IT");
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}
