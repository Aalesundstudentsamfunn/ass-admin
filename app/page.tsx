import type { ReactNode } from "react";
import { ArrowUpRight, HeartHandshake } from "lucide-react";
import { PublicNavbar } from "@/components/public/public-navbar";

const GROUPS = ["Ølbryggergruppen", "Spillgruppen", "Surfegruppen", "Håndarbeidgruppen", "Friluftsgruppen", "Fiskegruppen", "Dykkergruppen"];

const EVENTS = [
  {
    title: "U.-KA",
    description: "Festivalen av studenter for alle, med show, konserter og opplevelser gjennom uka.",
    href: "https://ukaa.no",
  },
  {
    title: "Revyen",
    description: "Studentenes egen scene med humor, musikk og lokale skråblikk.",
    href: "https://astudent.no/revyen",
  },
  {
    title: "Ski & Magi",
    description: "Årets vintereventyr med aktivitetar, fellesskap og mye energi.",
    href: "https://skiogmagi.no",
  },
];

/**
 * Public root page for ÅSS admin.
 */
export default function HomePage() {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-background text-foreground">
      <BackgroundBlobs />
      <PublicNavbar />

      <section className="mx-auto w-full max-w-6xl px-4 pt-12 sm:pt-16">
        <GlassCard className="p-7 sm:p-10">
          <div className="flex items-center gap-2 text-xs font-medium text-foreground/75 dark:text-foreground/70">
            <HeartHandshake className="h-4 w-4" />
            Av studentar, for studentar i Ålesund
          </div>

          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">Ålesund Studentsamfunn</h1>

          <div className="mt-4 max-w-4xl space-y-4 text-sm leading-relaxed text-foreground/75 sm:text-base dark:text-foreground/70">
            <p>Ålesund Studentsamfunn er den største studentorganisasjonen i Ålesund, eigd og driven av medlemmene. Vi jobber aktivt for å skape tilhørighet i den vakre jugendbyen og har dannet flere partnerskap og samarbeid slik at våre medlemmer kan benytte seg av et variert og godt tilbud rundt om i byen vår. Sidan gjenoppstarten i 2009 har vi bygd eit inkluderande miljø for studentlivet i byen.</p>
            <p>Med rundt 1000 medlemmer og over 50 frivillige skaper vi aktivitetar, samarbeid og tilhøyrigheit i byen.</p>
          </div>

          <div className="mt-7 grid gap-4 md:grid-cols-3">
            {EVENTS.map((event) => (
              <a key={event.title} href={event.href} target="_blank" rel="noreferrer" className="group rounded-2xl border border-border/60 bg-card/60 p-4 transition hover:-translate-y-0.5 hover:bg-card/80">
                <div className="flex items-center justify-between">
                  <span className="text-base font-semibold">{event.title}</span>
                  <ArrowUpRight className="h-4 w-4 text-foreground/60 transition group-hover:text-foreground" />
                </div>
                <p className="mt-2 text-sm text-foreground/70 dark:text-foreground/65">{event.description}</p>
              </a>
            ))}
          </div>
        </GlassCard>
      </section>

      <section className="mx-auto mt-10 w-full max-w-6xl px-4 pb-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Aktivitetsgrupper</h2>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {GROUPS.map((group) => (
            <GlassCard
              key={group}
              className="bg-card/85 px-4 py-3 ring-0 border-border/65 shadow-[0_2px_8px_rgba(15,23,42,0.06)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.16)]"
            >
              <p className="font-medium text-foreground/90">{group}</p>
            </GlassCard>
          ))}
        </div>
      </section>

      <Footer />
    </main>
  );
}

/**
 * Footer with copyright and public links.
 */
function Footer() {
  return (
    <footer className="mx-auto mt-8 w-full max-w-6xl px-4 pb-8">
      <div className="h-px w-full bg-gradient-to-r from-transparent via-border to-transparent" />
      <div className="mt-4 flex flex-col gap-3 text-xs text-foreground/70 sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} Ålesund Studentsamfunn</p>
        <div className="flex items-center gap-4 sm:justify-end">
          <a href="https://astudent.no" className="hover:text-foreground">
            astudent.no
          </a>
          <a href="#personvern" className="hover:text-foreground">
            Personvern
          </a>
          <a href="#kontakt" className="hover:text-foreground">
            Kontakt
          </a>
        </div>
      </div>
    </footer>
  );
}

/**
 * Shared frosted glass surface.
 */
function GlassCard({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={`relative rounded-3xl border border-border/70 bg-card/75 shadow-[0_10px_28px_rgba(15,23,42,0.10)] ring-1 ring-white/40 backdrop-blur-xl dark:border-white/15 dark:bg-white/8 dark:ring-white/5 dark:shadow-[0_10px_28px_rgba(0,0,0,0.28)] ${className ?? ""}`}
    >
      <div className="pointer-events-none absolute inset-0 rounded-3xl [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      {children}
    </div>
  );
}

/**
 * Ambient background gradients to keep the page visually alive.
 */
function BackgroundBlobs() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10">
      <div className="absolute -top-24 -left-24 h-[34rem] w-[34rem] rounded-full bg-gradient-to-br from-cyan-400/30 via-blue-400/20 to-fuchsia-400/20 blur-3xl dark:from-cyan-500/15 dark:via-blue-500/10 dark:to-fuchsia-500/15" />
      <div className="absolute -bottom-24 -right-24 h-[30rem] w-[30rem] rounded-full bg-gradient-to-tr from-emerald-400/20 via-cyan-400/20 to-indigo-400/20 blur-3xl dark:from-emerald-500/10 dark:via-cyan-500/10 dark:to-indigo-500/10" />
    </div>
  );
}
