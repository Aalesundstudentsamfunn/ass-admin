"use client"

import * as React from "react"
import { User } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

type Profile = {
  firstname?: string | null
  lastname?: string | null
  email?: string | null
}

export function CurrentUserBadge({
  compact = false,
  prominent = false,
  className,
}: {
  compact?: boolean
  prominent?: boolean
  className?: string
}) {
  const [displayName, setDisplayName] = React.useState<string>("")
  const [email, setEmail] = React.useState<string>("")
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let active = true
    const supabase = createClient()

    const load = async () => {
      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (!active) {
        return
      }
      if (authError || !authData.user) {
        setLoading(false)
        return
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("firstname, lastname, email")
        .eq("id", authData.user.id)
        .single<Profile>()

      if (!active) {
        return
      }

      const name = [profile?.firstname ?? "", profile?.lastname ?? ""].join(" ").trim()
      setDisplayName(name || authData.user.email || "")
      setEmail(profile?.email ?? authData.user.email ?? "")
      setLoading(false)
    }

    load()

    return () => {
      active = false
    }
  }, [])

  const label = loading
    ? "Laster..."
    : displayName
      ? displayName
      : "Ikke innlogget"

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl border border-white/40 px-3 py-2 text-xs text-foreground/80 dark:border-white/10",
        compact && "px-2 py-1 text-[11px]",
        prominent && "flex-col items-start gap-1 px-3 py-3 text-sm",
        className,
      )}
      title={email || undefined}
    >
      {prominent ? (
        <>
          <div className="flex items-center gap-2 text-foreground">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground/10">
              <User className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{label}</div>
              {email ? (
                <div className="truncate text-xs text-foreground/60">{email}</div>
              ) : null}
            </div>
          </div>
          {email ? (
            <div className="sr-only">{email}</div>
          ) : null}
        </>
      ) : (
        <>
          <User className={cn("h-3.5 w-3.5", compact && "h-3 w-3")} />
          <span className="truncate max-w-[160px]">{label}</span>
        </>
      )}
    </div>
  )
}
