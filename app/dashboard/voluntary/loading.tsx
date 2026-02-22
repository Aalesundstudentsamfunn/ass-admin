/**
 * Loading placeholder for `voluntary` dashboard view.
 */

"use client"

import * as React from "react"

// Liquid background with subtle animated blobs
function LiquidBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-sky-300/30 via-transparent to-violet-300/20 dark:from-sky-400/10 dark:to-fuchsia-400/10" />
      <div className="absolute -top-24 -left-24 h-[36rem] w-[36rem] rounded-full bg-sky-300/40 blur-3xl dark:bg-sky-500/20 motion-safe:animate-[float_22s_ease-in-out_infinite]" />
      <div className="absolute bottom-[-10rem] right-[-8rem] h-[28rem] w-[28rem] rounded-full bg-fuchsia-300/40 blur-3xl dark:bg-fuchsia-500/20 motion-safe:animate-[float2_26s_ease-in-out_infinite]" />
      <style jsx global>{`
        @keyframes float { 0% { transform: translateY(0px) } 50% { transform: translateY(30px) translateX(10px) } 100% { transform: translateY(0px) } }
        @keyframes float2 { 0% { transform: translateY(0px) } 50% { transform: translateY(-25px) translateX(-10px) } 100% { transform: translateY(0px) } }
        @keyframes pulsebar { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

function GlassPanel({ className = "", children }: React.PropsWithChildren<{ className?: string }>) {
  return (
    <div
      className={
        `relative rounded-2xl border backdrop-blur-xl ` +
        `bg-white/65 border-white/50 shadow-[0_1px_0_rgba(255,255,255,0.6),0_10px_30px_-10px_rgba(16,24,40,0.25)] ` +
        `dark:bg-white/5 dark:border-white/10 dark:shadow-[0_1px_0_rgba(255,255,255,0.07),0_20px_60px_-20px_rgba(0,0,0,0.6)] ` +
        className
      }
    >
      {children}
    </div>
  )
}

function Spinner() {
  return (
    <div className="relative h-10 w-10" role="status" aria-label="Laster">
      <svg viewBox="0 0 24 24" className="absolute inset-0 h-10 w-10 text-foreground/20">
        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="3" />
      </svg>
      <svg viewBox="0 0 24 24" className="absolute inset-0 h-10 w-10 text-foreground motion-safe:animate-[spin_900ms_linear_infinite]">
        <path d="M12 2 a10 10 0 0 1 10 10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <span className="sr-only">Loading…</span>
    </div>
  )
}

function IndeterminateBar() {
  return (
    <div className="relative mt-6 h-2 w-56 overflow-hidden rounded-full bg-foreground/10">
      <div className="absolute inset-y-0 -translate-x-full w-1/2 bg-foreground/30 motion-safe:animate-[pulsebar_1.4s_ease-in-out_infinite]" />
      <div className="absolute inset-y-0 -translate-x-full w-1/3 bg-foreground/30 motion-safe:animate-[pulsebar_1.6s_ease-in-out_infinite] delay-200" />
    </div>
  )
}

export default function Loading() {
  return (
    <div className="relative flex min-h-dvh items-center justify-center p-6">
      <LiquidBackground />
      <GlassPanel className="w-full max-w-xl p-6">
        <div className="flex flex-col items-center text-center">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400/70 to-violet-500/70 text-white shadow-inner dark:from-sky-500/50 dark:to-fuchsia-600/50">
              <span className="text-lg font-bold">FG</span>
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Laster inn</h1>
              <p className="text-sm text-foreground/70">Hent data og forbered visningen …</p>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-4">
            <Spinner />
            <IndeterminateBar />
          </div>
        </div>
      </GlassPanel>
    </div>
  )
}

// Reuse: You can also export as a component for Suspense fallbacks
export function LoadingInline() {
  return (
    <div className="flex w-full items-center justify-center py-10">
      <Spinner />
    </div>
  )
}
