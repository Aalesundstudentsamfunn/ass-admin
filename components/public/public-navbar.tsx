"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Button } from "@/components/ui/button";
import logo from "@/app/logo.png";

/**
 * Shared public navbar used on homepage and `/utstyr`.
 */
export function PublicNavbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3.5">
        <Link href="/" className="inline-flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-white p-1.5">
            <Image src={logo} alt="ÅSS logo" className="h-full w-full object-contain" priority />
          </span>
          <span className="text-sm font-medium tracking-tight">Ålesund Studentsamfunn</span>
        </Link>

        <nav className="hidden items-center gap-1.5 md:flex">
          <NavLink href="/" active={pathname === "/"}>
            Hjem
          </NavLink>
          <NavLink href="/utstyr" active={pathname === "/utstyr"}>
            Utstyr
          </NavLink>
          <NavLink href="#">Appstore</NavLink>
        </nav>

        <div className="flex items-center gap-2">
          <ThemeSwitcher />
          <Button asChild size="sm" className="rounded-lg">
            <Link href="/auth/login">Logg inn</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

/**
 * Reusable nav link style for public navbar items.
 */
function NavLink({ href, children, active = false }: { href: string; children: React.ReactNode; active?: boolean }) {
  const className = `rounded-lg px-3 py-1.5 text-sm transition ${active ? "bg-muted/60 text-foreground ring-1 ring-border/70" : "text-foreground/80 ring-1 ring-transparent hover:bg-muted/50 hover:text-foreground hover:ring-border/60"}`;

  if (href.startsWith("/")) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }

  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}
