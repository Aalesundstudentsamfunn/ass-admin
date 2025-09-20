"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Users, UserCheck, HardHat, Package, Building2, Menu, LogOut, Shield } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { ThemeSwitcher } from "@/components/theme-switcher"
import { LogoutButton } from "@/components/logout-button"

const navigation = [
  { name: "Members", href: "/dashboard/members", icon: Users },
  { name: "Users", href: "/dashboard/users", icon: UserCheck },
  { name: "Workers", href: "/dashboard/workers", icon: HardHat },
  { name: "Equipment", href: "/dashboard/equipment", icon: Package },
  { name: "Groups", href: "/dashboard/groups", icon: Building2 },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = () => {
    router.push("/")
  }

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <div className={cn("flex flex-col h-full", mobile ? "w-full" : "w-64")}>
      <div className="flex items-center gap-2 px-6 py-4 border-b border-sidebar-border">
        <div className="bg-sidebar-primary rounded-lg p-2">
          <Shield className="h-6 w-6 text-sidebar-primary-foreground" />
        </div>
        <div
          className="cursor-pointer clickable"
          onClick={() => {
            router.push("/dashboard")
            if (mobile) setSidebarOpen(false)
          }}
        >
          <h1 className="font-bold text-lg text-sidebar-foreground">Admin Panel</h1>
          <p className="text-sm">Overview</p>
        </div>
      </div>

      <nav className="flex-1 px-4 py-6">
        <ul className="space-y-2">
          {navigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  onClick={() => mobile && setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="px-4 py-4 border-t border-sidebar-border flex items-center justify-between">
        <LogoutButton />
        <ThemeSwitcher />
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex bg-sidebar border-r border-sidebar-border">
        <Sidebar />
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="p-0 bg-sidebar">
          <Sidebar mobile />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        <header className="lg:hidden bg-card border-b border-border px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
              </Sheet>
              <h1 className="font-semibold text-foreground">Admin Panel</h1>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  )
}
