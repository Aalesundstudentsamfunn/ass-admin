"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Users, UserCheck, Heart, Package, Building2, Menu, Settings, Award, FileText, ChevronLeft, ChevronRight } from "lucide-react"
import Image from "next/image"
import Logo from "@/app/logo.png"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { ThemeSwitcher } from "@/components/theme-switcher"
import { LogoutButton } from "@/components/logout-button"
import { CurrentUserBadge } from "@/components/current-user-badge"

type CurrentUser = {
  name?: string | null
  email?: string | null
} | null

/**
 * Liquid Glass redesign for your dashboard layout
 * - Works on mobile & desktop
 * - Light & dark mode aware (Tailwind `dark:`)
 * - Frosted glass surfaces, soft depth, animated liquid background
 */

const navigation = [
  { name: "Medlemmer", href: "/dashboard/members", icon: Users },
  { name: "Brukere", href: "/dashboard/users", icon: UserCheck },
  { name: "Frivillige", href: "/dashboard/workers", icon: Heart },
  { name: "Utstyr", href: "/dashboard/equipment", icon: Package },
  { name: "Grupper", href: "/dashboard/groups", icon: Building2 },
  { name: "Sertifisering", href: "/dashboard/certification", icon: Award },
  { name: "Sertifisering — søknader", href: "/dashboard/certification-application", icon: FileText },
  { name: "Innstillinger", href: "/dashboard/settings", icon: Settings },
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

function NavItem({
  item,
  active,
  onClick,
  collapsed,
}: {
  item: (typeof navigation)[number];
  active: boolean;
  onClick?: () => void;
  collapsed?: boolean;
}) {
  const Icon = item.icon
  return (
    <li>
      <Link
        href={item.href}
        onClick={onClick}
        aria-current={active ? "page" : undefined}
        aria-label={collapsed ? item.name : undefined}
        title={collapsed ? item.name : undefined}
        className={cn(
          "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium outline-none transition",
          collapsed && "justify-center",
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
        <span className={cn("relative z-10 flex items-center", collapsed ? "gap-0" : "gap-3")}>
          <Icon className="h-5 w-5" />
          <span
            className={cn(
              "overflow-hidden whitespace-nowrap text-left transition-[max-width,opacity,transform] duration-300",
              collapsed ? "max-w-0 opacity-0 translate-x-1" : "max-w-[200px] opacity-100 translate-x-0",
            )}
          >
            {item.name}
          </span>
        </span>
      </Link>
    </li>
  )
}

// ---- Layout -----------------------------------------------------------------

export default function DashboardShell({
  children,
  currentUser = null,
}: {
  children: React.ReactNode
  currentUser?: CurrentUser
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <div className={cn("flex h-full flex-col gap-4", mobile ? "w-full" : "w-full p-3")}>
      <GlassPanel className={cn("p-4", !mobile && sidebarCollapsed && "px-3 py-3")}>
        <div className={cn("flex items-center gap-3", !mobile && sidebarCollapsed && "justify-center")}>
          <button
            onClick={() => {
              router.push("/dashboard")
              if (mobile) setSidebarOpen(false)
            }}
            className={cn(
              "flex items-center text-left transition-all",
              !mobile && sidebarCollapsed ? "w-full justify-center gap-0" : "gap-3",
            )}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 shadow-inner ring-1 ring-white/10">
              <Image src={Logo} alt="ASS logo" className="h-7 w-7 object-contain" priority />
            </div>
            <div
              className={cn(
                "overflow-hidden whitespace-nowrap transition-[max-width,opacity,transform] duration-300",
                mobile || !sidebarCollapsed ? "max-w-[180px] opacity-100 translate-x-0" : "max-w-0 opacity-0 translate-x-1",
              )}
            >
              <div className="text-base font-semibold tracking-tight">Admin Panel</div>
              <div className="text-xs text-foreground/70">Overview</div>
            </div>
          </button>
        </div>
      </GlassPanel>

      <GlassPanel className="flex-1 p-3">
        <div
          className={cn(
            "mb-3 hidden lg:flex",
            sidebarCollapsed ? "min-h-[72px] items-center justify-center" : "items-start",
          )}
        >
          {sidebarCollapsed ? (
            <CurrentUserBadge compact name={currentUser?.name} email={currentUser?.email} className="justify-center px-2 py-1" />
          ) : (
            <CurrentUserBadge prominent name={currentUser?.name} email={currentUser?.email} className="px-2 py-1.5" />
          )}
        </div>
        <nav aria-label="Primary">
          <ul className="space-y-1">
            {navigation.map((item) => (
              <NavItem
                key={item.name}
                item={item}
                active={pathname === item.href}
                onClick={() => mobile && setSidebarOpen(false)}
                collapsed={!mobile && sidebarCollapsed}
              />
            ))}
          </ul>
        </nav>

        <div className="mt-4 rounded-xl border border-white/40 p-4 dark:border-white/10">
          <div
            className={cn(
              "flex items-center gap-2",
              !mobile && sidebarCollapsed ? "flex-col justify-center items-center" : "justify-between",
            )}
          >
            <LogoutButton
              compact={!mobile && sidebarCollapsed}
              className="rounded-lg transition-colors hover:bg-white/60 dark:hover:bg-white/15"
            />
            <ThemeSwitcher
              compact={!mobile && sidebarCollapsed}
              className="rounded-lg transition-colors hover:bg-white/60 dark:hover:bg-white/15"
            />
          </div>
          {!mobile ? (
            <div
              className={cn(
                "mt-2 border-t border-white/40 pt-2 dark:border-white/10",
                sidebarCollapsed ? "flex justify-center" : "flex",
              )}
            >
              <Button
                variant="ghost"
                size={sidebarCollapsed ? "icon" : "sm"}
                className={cn(
                  "h-9 rounded-lg hover:bg-white/50 dark:hover:bg-white/10",
                  sidebarCollapsed ? "w-9" : "w-full justify-center gap-2",
                )}
                onClick={() => setSidebarCollapsed((prev) => !prev)}
                aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                {sidebarCollapsed ? null : <span>Skjul meny</span>}
              </Button>
            </div>
          ) : null}
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
          <div className="flex items-center gap-2">
            <CurrentUserBadge compact name={currentUser?.name} email={currentUser?.email} />
            <ThemeSwitcher />
          </div>
        </GlassPanel>
      </div>

      <div className="mx-auto flex w-full max-w-[1400px] flex-1 gap-3 px-3 pb-6 lg:pt-6">
        {/* Desktop sidebar */}
        <aside
          className={cn(
            "relative hidden shrink-0 transition-[width] duration-300 lg:block",
            sidebarCollapsed ? "w-20" : "w-72",
          )}
        >
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
