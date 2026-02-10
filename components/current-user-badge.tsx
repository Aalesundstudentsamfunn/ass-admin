"use client";

import { User } from "lucide-react";
import { cn } from "@/lib/utils";

export function CurrentUserBadge({ compact = false, prominent = false, name, email, className }: { compact?: boolean; prominent?: boolean; name?: string | null; email?: string | null; className?: string }) {
  const safeName = (name ?? "").trim();
  const safeEmail = (email ?? "").trim();
  const label = safeName || safeEmail || "Problem med henting";

  return (
    <div className={cn("flex items-center gap-2 rounded-xl border border-white/40 px-3 py-2 text-xs text-foreground/80 dark:border-white/10", compact && "px-2 py-1 text-[11px]", prominent && "flex-col items-start gap-1 px-3 py-3 text-sm", className)} title={safeEmail || undefined}>
      {prominent ? (
        <>
          <div className="flex items-center gap-2 text-foreground">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground/10">
              <User className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{label}</div>
              {safeEmail ? <div className="truncate text-xs text-foreground/60">{safeEmail}</div> : null}
            </div>
          </div>
          {safeEmail ? <div className="sr-only">{safeEmail}</div> : null}
        </>
      ) : (
        <>
          <User className={cn("h-3.5 w-3.5", compact && "h-3 w-3")} />
          <span className="truncate max-w-[160px]">{label}</span>
        </>
      )}
    </div>
  );
}
