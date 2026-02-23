"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { useDashboardSessionOptional } from "@/components/dashboard/session-context";

/**
 * Loads the authenticated user id once for client-side permission guards.
 */
export function useCurrentUserId() {
  const session = useDashboardSessionOptional();
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (session) {
      setCurrentUserId(session.userId);
      return;
    }

    let active = true;
    const loadUser = async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (active) {
        setCurrentUserId(data.user?.id ?? null);
      }
    };
    loadUser();
    return () => {
      active = false;
    };
  }, [session]);

  return session?.userId ?? currentUserId;
}
