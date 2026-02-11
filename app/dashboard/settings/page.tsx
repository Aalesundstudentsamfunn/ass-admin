"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useAutoPrintSetting } from "@/lib/auto-print";
import { MEMBER_PAGE_SIZES, useMemberPageSizeSetting } from "@/lib/table-settings";
import * as React from "react";

export default function SettingsPage() {
  const { autoPrint, setAutoPrint } = useAutoPrintSetting();
  const { pageSize, setPageSize } = useMemberPageSizeSetting();
  const pageSizeOptions = MEMBER_PAGE_SIZES;
  const [isSendingReset, setIsSendingReset] = React.useState(false);
  const [resetStatus, setResetStatus] = React.useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  const handleResetPassword = async () => {
    if (isSendingReset) {
      return;
    }
    setIsSendingReset(true);
    const supabase = createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user?.email) {
      toast.error("Kunne ikke finne innlogget bruker.");
      setResetStatus({ type: "error", message: "Kunne ikke finne innlogget bruker." });
      setIsSendingReset(false);
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(authData.user.email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    if (error) {
      if (error.status === 429) {
        toast.error("For mange forespørsler.", { description: "Vent litt og prøv igjen." });
        setResetStatus({ type: "error", message: "For mange forespørsler. Vent litt og prøv igjen." });
      } else {
        toast.error("Kunne ikke sende link.", { description: error.message });
        setResetStatus({ type: "error", message: "Ta kontakt med IT." });
      }
      setIsSendingReset(false);
      return;
    }
    toast.success("Reset link sendt til e-post.");
    setResetStatus({ type: "success", message: "Linken er sendt til e-post." });
    setIsSendingReset(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-balance">Innstillinger</h1>
        <p className="text-muted-foreground text-pretty">Tilpass hvordan nye medlemmer håndteres.</p>
      </div>

      <Card className="border-0 bg-transparent shadow-none">
        <CardHeader className="px-0 pt-0">
          <CardTitle>Medlemskort</CardTitle>
          <CardDescription>Bestem om nye kort automatisk skal sendes til skriver.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-background/60 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <Label htmlFor="auto-print" className="text-base">
                Auto-print nye medlemmer
              </Label>
              <p className="text-sm text-muted-foreground">Når dette er på, sendes medlemskort til utskrift umiddelbart etter opprettelse.</p>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="auto-print" checked={autoPrint} onCheckedChange={(value) => setAutoPrint(!!value)} />
              <span className="text-sm text-muted-foreground">{autoPrint ? "På" : "Av"}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 bg-transparent shadow-none">
        <CardHeader className="px-0 pt-0">
          <CardTitle>Visning</CardTitle>
          <CardDescription>Velg standard antall rader per side i medlemslisten.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-background/60 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <Label htmlFor="member-page-size" className="text-base">
                Standard rader per side
              </Label>
              <p className="text-sm text-muted-foreground">Velg en verdi mellom 1 og 100.</p>
            </div>
            <div className="flex items-center gap-2">
              <select id="member-page-size" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} className="h-9 w-28 rounded-xl border border-border/60 bg-background/60 px-3 text-sm">
                {pageSizeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <span className="text-sm text-muted-foreground">rader</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 bg-transparent shadow-none">
        <CardHeader className="px-0 pt-0">
          <CardTitle>Sikkerhet</CardTitle>
          <CardDescription>Be om en link for å tilbakestille passordet ditt.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-background/60 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <Label className="text-base">Tilbakestill passord</Label>
              <p className="text-sm text-muted-foreground">Linken blir sendt til e-posten du er innlogget med.</p>
              {resetStatus ? (
                <p
                  className={
                    resetStatus.type === "success"
                      ? "text-xs text-emerald-600"
                      : resetStatus.type === "error"
                      ? "text-xs text-rose-600"
                      : "text-xs text-muted-foreground"
                  }
                >
                  {resetStatus.message}
                </p>
              ) : null}
            </div>
            <Button onClick={handleResetPassword} className="rounded-xl" disabled={isSendingReset}>
              {isSendingReset ? "Sender..." : "Send forespørsel"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
