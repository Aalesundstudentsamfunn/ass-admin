"use client";

/**
 * Client hook that fetches and caches current user privilege for UX gating.
 */

import * as React from "react";
import { useDashboardSessionOptional } from "@/components/dashboard/session-context";

/**
 * Fetches current member privilege from `/api/me/privilege` once on mount.
 */
export function useCurrentPrivilege() {
  const session = useDashboardSessionOptional();
  const [privilege, setPrivilege] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (session) {
      setPrivilege(session.privilegeType);
      return;
    }

    let mounted = true;
    fetch("/api/me/privilege")
      .then(async (response) => {
        if (!mounted) {
          return;
        }
        if (!response.ok) {
          return;
        }
        const payload = await response.json().catch(() => null);
        if (!mounted) {
          return;
        }
        const next = Number(payload?.privilege_type);
        setPrivilege(Number.isFinite(next) ? next : null);
      })
      .catch(() => {
        // ignore
      });

    return () => {
      mounted = false;
    };
  }, [session]);

  return session?.privilegeType ?? privilege;
}
