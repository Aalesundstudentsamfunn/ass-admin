"use client";

import Image from "next/image";
import Link from "next/link";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Button } from "@/components/ui/button";
import logo from "@/app/logo.png";

/**
 * Shared public navbar used on homepage and `/utstyr`.
 */
export function PublicNavbar() {
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
          <NavLink href="https://astudent.no">Hovudside</NavLink>
          <NavLink href="/utstyr">Utstyr</NavLink>
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
function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const className =
    "rounded-lg px-3 py-1.5 text-sm text-foreground/80 ring-1 ring-transparent transition hover:bg-muted/50 hover:text-foreground hover:ring-border/60";

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
