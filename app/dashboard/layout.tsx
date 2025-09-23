"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Users, UserCheck, HardHat, Package, Building2, Menu, Shield } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { ThemeSwitcher } from "@/components/theme-switcher"
import { LogoutButton } from "@/components/logout-button"

/**
 * Liquid Glass redesign for your dashboard layout
 * - Works on mobile & desktop
 * - Light & dark mode aware (Tailwind `dark:`)
 * - Frosted glass surfaces, soft depth, animated liquid background
 */

const navigation = [
  { name: "Medlemmer", href: "/dashboard/members", icon: Users },
  { name: "Brukere", href: "/dashboard/users", icon: UserCheck },
  { name: "Frivillige", href: "/dashboard/workers", icon: HardHat },
  { name: "Utstyr", href: "/dashboard/equipment", icon: Package },
  { name: "Grupper", href: "/dashboard/groups", icon: Building2 },
]

// ---- Reusable UI primitives -------------------------------------------------

function LiquidBackground() {
  // Animated, subtle radial blobs behind everything
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* glow gradient behind */}
      <div className="absolute inset-0 bg-gradient-to-b from-sky-300/30 via-transparent to-violet-300/20 dark:from-sky-400/10 dark:to-fuchsia-400/10" />

      {/* moving blobs */}
      <div className="absolute -top-20 -left-24 h-[36rem] w-[36rem] rounded-full bg-sky-300/40 blur-3xl dark:bg-sky-500/20 animate-[float_22s_ease-in-out_infinite]" />
      <div className="absolute bottom-[-10rem] right-[-8rem] h-[28rem] w-[28rem] rounded-full bg-fuchsia-300/40 blur-3xl dark:bg-fuchsia-500/20 animate-[float2_26s_ease-in-out_infinite]" />

      <style jsx global>{`
        @keyframes float { 0% { transform: translateY(0px) } 50% { transform: translateY(30px) translateX(10px) } 100% { transform: translateY(0px) } }
        @keyframes float2 { 0% { transform: translateY(0px) } 50% { transform: translateY(-25px) translateX(-10px) } 100% { transform: translateY(0px) } }
      `}</style>
    </div>
  )
}

function GlassPanel({ className, children }: React.PropsWithChildren<{ className?: string }>) {
  return (
    <div
      className={cn(
        "relative rounded-2xl border backdrop-blur-xl",
        // Surface tinting for light/dark
        "bg-white/65 border-white/50 shadow-[0_1px_0_rgba(255,255,255,0.6),0_10px_30px_-10px_rgba(16,24,40,0.25)]",
        "dark:bg-white/5 dark:border-white/10 dark:shadow-[0_1px_0_rgba(255,255,255,0.07),0_20px_60px_-20px_rgba(0,0,0,0.6)]",
        className,
      )}
    >
      {/* subtle inner highlight */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl [mask-image:radial-gradient(55%_60%_at_50%_10%,black,transparent)]" />
      {children}
    </div>
  )
}

function NavItem({ item, active, onClick }: { item: (typeof navigation)[number]; active: boolean; onClick?: () => void }) {
  const Icon = item.icon
  return (
    <li>
      <Link
        href={item.href}
        onClick={onClick}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium outline-none transition",
          active
            ? "text-foreground"
            : "text-foreground/80 hover:text-foreground",
        )}
      >
        {/* Liquid hover ring */}
        <span
          className={cn(
            "absolute inset-0 rounded-xl",
            "bg-white/60 dark:bg-white/10 backdrop-blur-md",
            "opacity-0 ring-1 ring-white/60 dark:ring-white/10 transition-opacity duration-300",
            active ? "opacity-100" : "group-hover:opacity-100",
          )}
        />
        <span className="relative z-10 flex items-center gap-3">
          <Icon className="h-5 w-5" />
          {item.name}
        </span>
      </Link>
    </li>
  )
}

// ---- Layout -----------------------------------------------------------------

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <div className={cn("flex h-full flex-col gap-4", mobile ? "w-full" : "w-72 p-3")}>
      <GlassPanel className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400/70 to-violet-500/70 text-white shadow-inner dark:from-sky-500/50 dark:to-fuchsia-600/50">
            <Shield className="h-5 w-5" />
          </div>
          <button
            onClick={() => {
              router.push("/dashboard")
              if (mobile) setSidebarOpen(false)
            }}
            className="text-left"
          >
            <div className="text-base font-semibold tracking-tight">Admin Panel</div>
            <div className="text-xs text-foreground/70">Overview</div>
          </button>
        </div>
      </GlassPanel>

      <GlassPanel className="flex-1 p-3">
        <nav aria-label="Primary">
          <ul className="space-y-1">
            {navigation.map((item) => (
              <NavItem
                key={item.name}
                item={item}
                active={pathname === item.href}
                onClick={() => mobile && setSidebarOpen(false)}
              />
            ))}
          </ul>
        </nav>

        <div className="mt-4 flex items-center justify-between gap-2 rounded-xl border border-white/40 p-2 dark:border-white/10">
          <LogoutButton />
          <ThemeSwitcher />
        </div>
      </GlassPanel>
    </div>
  )

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-background antialiased">
      <LiquidBackground />

      {/* Top bar (mobile+desktop) */}
      <div className="sticky top-0 z-40 px-3 py-3 lg:hidden">
        <GlassPanel className="flex items-center justify-between px-2 py-1">
          <div className="flex items-center gap-2">
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Open navigation</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-3 bg-transparent border-0">
                <Sidebar mobile />
              </SheetContent>
            </Sheet>
            <span className="text-sm font-semibold">Admin Panel</span>
          </div>
          <ThemeSwitcher />
        </GlassPanel>
      </div>

      <div className="mx-auto flex w-full max-w-[1400px] flex-1 gap-3 px-3 pb-6 lg:pt-6">
        {/* Desktop sidebar */}
        <aside className="relative hidden shrink-0 lg:block">
          <Sidebar />
        </aside>

        {/* Main content area */}
        <main className="relative z-0 flex min-h-[70vh] flex-1 flex-col">
          <GlassPanel className="flex min-h-[70vh] flex-1 p-4 md:p-6">
            <div className="flex-1 overflow-auto">
              {children}
            </div>
          </GlassPanel>
        </main>
      </div>

      {/* Subtle bottom padding / safe area for mobile */}
      <div className="h-4 lg:h-6" />
    </div>
  )
}
