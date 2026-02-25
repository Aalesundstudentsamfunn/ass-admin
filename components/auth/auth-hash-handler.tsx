"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type AuthHashHandlerProps = {
  redirectPath?: string;
};

/**
 * Renders auth hash handler.
 *
 */
export function AuthHashHandler({ redirectPath = "/auth/update-password" }: AuthHashHandlerProps) {
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) {
      return;
    }

    const params = new URLSearchParams(hash.replace(/^#/, ""));
    const hasAuthError = params.has("error") || params.has("error_code");
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");

    if (!access_token && hasAuthError) {
      if (window.location.pathname !== "/auth/login") {
        window.location.replace("/auth/login");
        return;
      }
      window.history.replaceState({}, document.title, "/auth/login");
      return;
    }

    if (!access_token) {
      return;
    }

    const supabase = createClient();

    const finalize = () => {
      window.history.replaceState({}, document.title, window.location.pathname);
      window.location.replace(redirectPath);
    };

    if (!access_token || !refresh_token) {
      finalize();
      return;
    }

    supabase.auth.setSession({ access_token, refresh_token }).finally(finalize);
  }, [redirectPath]);

  return null;
}
