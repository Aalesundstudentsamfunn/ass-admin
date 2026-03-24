"use client";

import * as React from "react";
import { toast } from "sonner";
import { AppToaster } from "@/components/ui/sonner";
import { ActionConfirmProvider } from "@/components/feedback/action-confirm-provider";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const INACTIVITY_WARN_MS = 28 * 60 * 1000;
const INACTIVITY_LOGOUT_MS = 30 * 60 * 1000;

/**
 * Dashboard-scoped client providers.
 * Ensures toasts only exist on /dashboard and are reset on user-session changes.
 * Automatically logs out after 30 minutes of inactivity.
 */
export default function DashboardClientProviders({
  sessionUserId,
  children,
}: React.PropsWithChildren<{ sessionUserId: string }>) {
  const router = useRouter();

  React.useEffect(() => {
    toast.dismiss();
  }, [sessionUserId]);

  React.useEffect(() => {
    const supabase = createClient();
    let warnTimer: ReturnType<typeof setTimeout>;
    let logoutTimer: ReturnType<typeof setTimeout>;

    const reset = () => {
      clearTimeout(warnTimer);
      clearTimeout(logoutTimer);
      toast.dismiss("inactivity-warning");

      warnTimer = setTimeout(() => {
        toast.warning("Du logges ut om 2 minutter på grunn av inaktivitet.", {
          id: "inactivity-warning",
          duration: 2 * 60 * 1000,
        });
      }, INACTIVITY_WARN_MS);

      logoutTimer = setTimeout(async () => {
        toast.dismiss("inactivity-warning");
        await supabase.auth.signOut();
        router.push("/auth/login");
      }, INACTIVITY_LOGOUT_MS);
    };

    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"] as const;
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();

    return () => {
      clearTimeout(warnTimer);
      clearTimeout(logoutTimer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [router]);

  return (
    <>
      {children}
      <ActionConfirmProvider />
      <AppToaster />
    </>
  );
}
