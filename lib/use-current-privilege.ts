"use client";

import * as React from "react";

export function useCurrentPrivilege() {
  const [privilege, setPrivilege] = React.useState<number | null>(null);

  React.useEffect(() => {
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
  }, []);

  return privilege;
}
