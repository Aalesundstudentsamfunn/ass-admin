"use client";

import * as React from "react";
import { toast } from "sonner";
import { AppToaster } from "@/components/ui/sonner";
import { ActionConfirmProvider } from "@/components/feedback/action-confirm-provider";

/**
 * Dashboard-scoped client providers.
 * Ensures toasts only exist on /dashboard and are reset on user-session changes.
 */
export default function DashboardClientProviders({
  sessionUserId,
  children,
}: React.PropsWithChildren<{ sessionUserId: string }>) {
  React.useEffect(() => {
    toast.dismiss();
  }, [sessionUserId]);

  return (
    <>
      {children}
      <ActionConfirmProvider />
      <AppToaster />
    </>
  );
}
