"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const GENERIC_LOGIN_BLOCKED_MESSAGE = "Kunne ikke logge inn. Sjekk opplysningene dine eller kontakt it@astudent.no.";

/**
 * Checks whether is banned auth error.
 *
 * How: Evaluates provided input using local business rules.
 * @returns boolean
 */
function isBannedAuthError(error: unknown) {
  const rawMessage = typeof error === "object" && error !== null && "message" in error ? String((error as { message?: unknown }).message ?? "") : String(error ?? "");
  const message = rawMessage.toLowerCase();
  return message.includes("user is banned");
}

/**
 * Returns a safe in-app redirect target from the `next` query param.
 */
function getSafeRedirectTarget(nextValue: string | null) {
  if (!nextValue) {
    return null;
  }
  if (!nextValue.startsWith("/")) {
    return null;
  }
  if (nextValue.startsWith("//")) {
    return null;
  }
  if (nextValue.startsWith("/auth/login")) {
    return null;
  }
  return nextValue;
}

/**
 * Renders login form.
 */
export function LoginForm({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = getSafeRedirectTarget(searchParams.get("next"));

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const hash = window.location.hash.toLowerCase();
    if (hash.includes("banned") || hash.includes("user_banned")) {
      setError(GENERIC_LOGIN_BLOCKED_MESSAGE);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      router.push(redirectTarget ?? "/dashboard");
    } catch (error: unknown) {
      if (isBannedAuthError(error)) {
        setError(GENERIC_LOGIN_BLOCKED_MESSAGE);
      } else {
        setError(error instanceof Error ? error.message : "An error occurred");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Logg inn</CardTitle>
          <CardDescription>Tast inn e-posten og passordet ditt for å logge inn.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="email">E-post</Label>
                <Input id="email" type="email" placeholder="epost@astudent.no" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Passord</Label>
                  <Link href="/auth/forgot-password" className="ml-auto inline-block text-sm underline-offset-4 hover:underline">
                    Glemt passord?
                  </Link>
                </div>
                <Input id="password" placeholder="&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Logger inn..." : "Logg inn"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
