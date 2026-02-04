"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useAutoPrintSetting } from "@/lib/auto-print";
import { MEMBER_PAGE_SIZES, useMemberPageSizeSetting } from "@/lib/table-settings";

export default function SettingsPage() {
  const { autoPrint, setAutoPrint } = useAutoPrintSetting();
  const { pageSize, setPageSize } = useMemberPageSizeSetting();
  const pageSizeOptions = MEMBER_PAGE_SIZES;

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
              <select
                id="member-page-size"
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value))}
                className="h-9 w-28 rounded-xl border border-border/60 bg-background/60 px-3 text-sm"
              >
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
    </div>
  );
}
