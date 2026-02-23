"use client";

import React from "react";
import { Lock, ChevronRight, Wrench, Building2, Users2, CalendarDays, Waves, Mountain, Music4, Gamepad2, ArrowUpRight } from "lucide-react";
import { ThemeSwitcher } from "@/components/theme-switcher";
import Image from "next/image";
import favicon from "./favicon.webp";

// Minimal, glassy admin landing page for ÅSS (Ålesund Studentsamfunn)
// Tech: Next.js (App Router compatible), TailwindCSS, TypeScript
// Drop this file in /app/admin/page.tsx or /app/page.tsx as needed.

/**
 * Renders ass admin landing.
 */
export default function AssAdminLanding() {
  return (
    <main className="relative min-h-dvh overflow-hidden antialiased">
      {/* Ambient gradient blobs ("liquid" feel) */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 -left-24 h-[38rem] w-[38rem] rounded-full bg-gradient-to-br from-cyan-400/30 via-blue-500/20 to-fuchsia-500/30 blur-3xl" />
        <div className="absolute -bottom-20 -right-24 h-[32rem] w-[32rem] rounded-full bg-gradient-to-tr from-emerald-400/20 via-cyan-500/20 to-indigo-500/30 blur-3xl" />
        <div className="absolute top-1/3 right-1/3 h-72 w-72 rounded-full bg-gradient-to-tr from-white/10 to-white/0 blur-2xl" />
      </div>

      <NavBar />

      {/* Hero */}
      <section className="mx-auto mt-12 max-w-6xl px-4 sm:mt-16">
        <GlassCard className="p-6 sm:p-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs font-medium /80 ring-1 ring-white/10">
                <Lock className="h-3.5 w-3.5" />
                Adminside – kun for frivillige
              </p>
              <h1 className="mt-2 text-3xl/tight font-semibold tracking-tight sm:text-4xl md:text-5xl">Ålesund Studentsamfunn (ÅSS)</h1>
              <p className="mt-3 max-w-2xl text-sm/relaxed sm:text-base">
                Ålesund Studentsamfunn er en frivillig organisasjon drevet av studenter for å tilrettelegge for den utenomfaglige og sosiale arenaen for alle studenter i Ålesund. Vi drifter <span className="font-medium">Samfunnet Studenthus</span>, fyller huset med aktiviteter og koordinerer undergrupper innen alt fra dykking og klatring til musikk og spill.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <a href="/dashboard" className="group inline-flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-2 text-sm font-medium  backdrop-blur-md ring-1 ring-white/15 transition hover:bg-white/15">
                  Logg inn som frivillig <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </a>
                <a href="https://www.astudent.no" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-2xl bg-transparent px-4 py-2 text-sm font-medium /90 ring-1 ring-white/15 transition hover:bg-white/5">
                  Gå til hovednettstedet <ArrowUpRight className="h-4 w-4" />
                </a>
              </div>
            </div>

            <div className="mx-auto w-full max-w-sm sm:mx-0">
              <GlassCard className="relative overflow-hidden p-4">
                <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br from-cyan-400/30 to-fuchsia-400/20 blur-2xl" />
                <div className="grid grid-cols-2 gap-3">
                  <QuickLink icon={Building2} title="Samfunnet" desc="Studenthus" />
                  <QuickLink icon={CalendarDays} title="Arrangementer" desc="Plan & booking" />
                  <QuickLink icon={Users2} title="Frivillige" desc="Roller & vakter" />
                  <QuickLink icon={Wrench} title="Utstyr" desc="Lån & leie" />
                </div>
              </GlassCard>
            </div>
          </div>
        </GlassCard>
      </section>

      {/* Undergrupper */}
      <section className="mx-auto mt-12 max-w-6xl px-4 sm:mt-16">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Undergrupper</h2>
          <a href="#alle-undergrupper" className="text-sm /80 hover:">
            Se alle
          </a>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          <GroupPill icon={Waves} label="Dykking" />
          <GroupPill icon={Mountain} label="Klatring" />
          <GroupPill icon={Music4} label="Musikk" />
          <GroupPill icon={Gamepad2} label="Spill" />
          <GroupPill icon={Users2} label="Eventcrew" />
          <GroupPill icon={CalendarDays} label="Program" />
          <GroupPill icon={Building2} label="Samfunnet" />
          <GroupPill icon={Wrench} label="Teknisk" />
        </div>
      </section>

      {/* Utstyr */}
      <section className="mx-auto mt-12 max-w-6xl px-4 sm:mt-16">
        <GlassCard className="p-6 sm:p-8">
          <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-lg font-semibold sm:text-xl">Utstyrsutleie for medlemmer</h3>
              <p className="mt-2 max-w-2xl text-sm /80">Vi har mye utstyr som medlemmer kan leie til en rimelig pris. Her finner du inventar, vilkår og tilgjengelighet.</p>
            </div>
            <div className="flex gap-3">
              <a href="#utstyr-katalog" className="rounded-xl bg-white/10 px-4 py-2 text-sm font-medium ring-1 ring-white/15 backdrop-blur-md transition hover:bg-white/15">
                Se katalog
              </a>
              <a href="#utstyr-foresporsel" className="rounded-xl bg-white text-zinc-900 px-4 py-2 text-sm font-semibold transition hover:opacity-90">
                Send forespørsel
              </a>
            </div>
          </div>
        </GlassCard>
      </section>

      <Footer />
    </main>
  );
}

/* --------------------------------- UI ---------------------------------- */

/**
 * Renders nav bar.
 *
 */
function NavBar() {
  return (
    <header className="sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-zinc-950/5">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <a href="#" className="group inline-flex items-center gap-3">
          <span className="inline-flex items-center justify-center rounded-full bg-white p-1">
            <Image src={favicon} alt="ÅSS Logo" width={32} height={32} />
          </span>
          <span className="text-sm font-semibold tracking-tight">
            <span className="/60">Admin</span>
          </span>
        </a>
        <nav className="hidden items-center gap-1 sm:flex">
          <NavBtn href="#arr">Arrangementer</NavBtn>
          <NavBtn href="#bank">Samfunnet</NavBtn>
          <NavBtn href="#folk">Frivillige</NavBtn>
          <NavBtn href="#utstyr">Utstyr</NavBtn>
        </nav>
        <div className="flex items-center gap-2">
          <a href="/dashboard" className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-1.5 text-sm font-medium ring-1 ring-white/15 transition hover:bg-white/15">
            <Lock className="h-4 w-4" /> Logg inn
          </a>
          <ThemeSwitcher />
        </div>
      </div>
      <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </header>
  );
}

/**
 * Renders footer.
 *
 */
function Footer() {
  return (
    <footer className="mx-auto mt-16 max-w-6xl px-4 pb-12">
      <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div className="mt-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <p className="text-xs /60">© {new Date().getFullYear()} Ålesund Studentsamfunn. Adminside – kun frivillige har tilgang.</p>
        <div className="flex items-center gap-4 text-xs /70">
          <a className="hover:" href="https://www.astudent.no" target="_blank" rel="noreferrer">
            astudent.no
          </a>
          <a className="hover:" href="#personvern">
            Personvern
          </a>
          <a className="hover:" href="#kontakt">
            Kontakt
          </a>
        </div>
      </div>
    </footer>
  );
}

/**
 * Renders glass card.
 *
 */
function GlassCard({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <div className={"relative rounded-3xl border border-white/10 bg-white/5 shadow-2xl shadow-black/40 backdrop-blur-xl " + "[--glass-highlight:linear-gradient(180deg,rgba(255,255,255,0.25),rgba(255,255,255,0))] " + "before:pointer-events-none before:absolute before:inset-0 before:rounded-3xl before:bg-[image:var(--glass-highlight)] " + className}>{children}</div>;
}

/**
 * Renders nav btn.
 *
 */
function NavBtn({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="rounded-xl px-3 py-1.5 text-sm /85 ring-1 ring-white/10 transition hover:bg-white/5 hover:">
      {children}
    </a>
  );
}

/**
 * Renders quick link.
 *
 */
function QuickLink({ icon: Icon, title, desc }: { icon: React.ComponentType<{ className?: string }>; title: string; desc: string }) {
  return (
    <a href={`#${title.toLowerCase()}`} className="group flex items-start gap-3 rounded-2xl bg-white/5 p-3 ring-1 ring-white/10 transition hover:bg-white/10">
      <div className="mt-0.5 rounded-xl bg-white/10 p-2 ring-1 ring-white/10">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="font-medium leading-none">{title}</div>
        <div className="mt-1 text-xs /70">{desc}</div>
      </div>
    </a>
  );
}

/**
 * Renders group pill.
 *
 */
function GroupPill({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <a href={`#${label.toLowerCase()}`} className="group inline-flex items-center gap-2 rounded-2xl bg-white/5 px-3 py-2 ring-1 ring-white/10 backdrop-blur-md transition hover:bg-white/10">
      <Icon className="h-4 w-4" />
      <span className="text-sm font-medium">{label}</span>
    </a>
  );
}
