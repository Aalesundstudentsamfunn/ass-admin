"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type EmailOtpType } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Renders update password form.
 */
export function UpdatePasswordForm({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const [isSessionReady, setIsSessionReady] = useState(false);
  const passwordsDoNotMatch = confirmPassword.length > 0 && password !== confirmPassword;

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    const cleanupAuthUrl = (url: URL, shouldClearHash = false) => {
      url.searchParams.delete("code");
      url.searchParams.delete("token_hash");
      url.searchParams.delete("type");
      url.searchParams.delete("error");
      url.searchParams.delete("error_code");
      url.searchParams.delete("error_description");
      if (shouldClearHash) {
        url.hash = "";
      }
      const nextUrl = `${url.pathname}${url.search}${url.hash}`;
      window.history.replaceState({}, document.title, nextUrl);
    };

    const initSession = async () => {
      const currentUrl = new URL(window.location.href);
      const hashParams = new URLSearchParams(currentUrl.hash.replace(/^#/, ""));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const code = currentUrl.searchParams.get("code");
      const tokenHash = currentUrl.searchParams.get("token_hash");
      const otpType = (currentUrl.searchParams.get("type") ?? "recovery") as EmailOtpType;
      const authError =
        currentUrl.searchParams.get("error_description") ??
        hashParams.get("error_description") ??
        currentUrl.searchParams.get("error") ??
        hashParams.get("error");

      if (authError && active) {
        setError(authError);
      }

      if (tokenHash) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: otpType,
        });
        if (error) {
          if (active) {
            setError(error.message);
            setIsSessionReady(false);
          }
          return;
        }
        cleanupAuthUrl(currentUrl);
      } else if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          if (active) {
            setError(error.message);
            setIsSessionReady(false);
          }
          return;
        }
        cleanupAuthUrl(currentUrl);
      } else if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) {
          if (active) {
            setError(error.message);
            setIsSessionReady(false);
          }
          return;
        }
        cleanupAuthUrl(currentUrl, true);
      }

      const { data } = await supabase.auth.getSession();
      if (active) {
        setIsSessionReady(Boolean(data.session));
      }
    };

    initSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (active) {
        if (event === "PASSWORD_RECOVERY") {
          setError(null);
        }
        setIsSessionReady(Boolean(session));
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passordene er ikke like.");
      return;
    }

    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      const markResponse = await fetch("/api/auth/password-initialized", {
        method: "POST",
      });
      if (!markResponse.ok) {
        const payload = await markResponse.json().catch(() => ({}));
        throw new Error(payload?.error ?? "Kunne ikke lagre passordstatus.");
      }
      router.push("/dashboard");
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Sett nytt passord</CardTitle>
          <CardDescription>Tast inn nytt passord nedenfor.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdatePassword}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="password">Nytt passord</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Nytt passord"
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="confirm-password">Bekreft nytt passord</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Bekreft nytt passord"
                  required
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setError(null);
                  }}
                />
              </div>
              {passwordsDoNotMatch && <p className="text-sm text-red-500">Passordene er ikke like.</p>}
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" className="w-full" disabled={isLoading || !isSessionReady || passwordsDoNotMatch}>
                {isLoading ? "Lagrer..." : "Lagre nytt passord"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
