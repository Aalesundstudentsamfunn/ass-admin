"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouteProgress } from "@/components/navigation/route-progress";
import { type EmailOtpType } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Engangstokens fra e-postlenken kan bare brukes én gang. React kjører effekter
 * to ganger i utvikling (StrictMode), så vi husker hvilke tokens som allerede er
 * innløst for å unngå at det andre forsøket feiler med "token already used".
 */
const consumedTokens = new Set<string>();

/**
 * Oversetter Supabase-feil til norsk tekst brukeren kan handle på.
 *
 * How: Kjenner igjen kjente feilsignaturer og faller tilbake på originalteksten.
 * @returns Feilmelding, og om brukeren trenger en ny lenke.
 */
function describeAuthError(message: string): { message: string; needsNewLink: boolean } {
  const normalized = message.toLowerCase();

  if (normalized.includes("code verifier")) {
    return {
      message:
        "Denne lenken må åpnes i samme nettleser som du ba om nullstilling fra. Be om en ny lenke og åpne den på denne enheten.",
      needsNewLink: true,
    };
  }

  if (normalized.includes("expired") || normalized.includes("invalid") || normalized.includes("already used")) {
    return {
      message: "Lenken er utløpt eller allerede brukt. Be om en ny lenke for å fortsette.",
      needsNewLink: true,
    };
  }

  return { message, needsNewLink: false };
}

/**
 * Renders update password form.
 */
export function UpdatePasswordForm({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [needsNewLink, setNeedsNewLink] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { startNavigation } = useRouteProgress();
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

    const reportError = (message: string) => {
      if (!active) {
        return;
      }
      const described = describeAuthError(message);
      setError(described.message);
      setNeedsNewLink(described.needsNewLink);
      setIsSessionReady(false);
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

      if (authError) {
        reportError(authError);
      }

      if (tokenHash) {
        // Foretrukket flyt: token_hash virker på tvers av enheter fordi den ikke
        // er bundet til en PKCE-verifier i nettleserens lagring.
        if (!consumedTokens.has(tokenHash)) {
          consumedTokens.add(tokenHash);
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: otpType,
          });
          if (error) {
            reportError(error.message);
            return;
          }
          cleanupAuthUrl(currentUrl);
        }
      } else if (code) {
        // Reservevei: PKCE virker bare når lenken åpnes i samme nettleser som ba
        // om nullstillingen, siden code_verifier ligger lagret der.
        if (!consumedTokens.has(code)) {
          consumedTokens.add(code);
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            reportError(error.message);
            return;
          }
          cleanupAuthUrl(currentUrl);
        }
      } else if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) {
          reportError(error.message);
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
          setNeedsNewLink(false);
        }
        setIsSessionReady(Boolean(session));
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  // Feil som gjelder selve lenken må stå igjen mens brukeren skriver, ellers
  // forsvinner "be om ny lenke" og knappen blir bare deaktivert uten forklaring.
  const clearSubmitError = () => {
    if (!needsNewLink) {
      setError(null);
    }
  };

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
      startNavigation();
      router.push("/dashboard");
      return;
    } catch (error: unknown) {
      const raw = error instanceof Error ? error.message : "Ukjent feil";
      const described = describeAuthError(raw);
      setError(described.message);
      setNeedsNewLink(described.needsNewLink);
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
                    clearSubmitError();
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
                    clearSubmitError();
                  }}
                />
              </div>
              {passwordsDoNotMatch && <p className="text-sm text-red-500">Passordene er ikke like.</p>}
              {error && (
                <div className="space-y-1 text-sm text-red-500">
                  <p>{error}</p>
                  {needsNewLink && (
                    <Link href="/auth/forgot-password" className="underline underline-offset-4">
                      Be om en ny lenke
                    </Link>
                  )}
                </div>
              )}
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
