"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function UpdatePasswordForm({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const [isSessionReady, setIsSessionReady] = useState(false);

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    const initSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (active) {
        setIsSessionReady(Boolean(data.session));
      }
    };

    initSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) {
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
                <Input id="password" type="password" placeholder="Nytt passord" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" className="w-full" disabled={isLoading || !isSessionReady}>
                {isLoading ? "Lagrer..." : "Lagre nytt passord"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
