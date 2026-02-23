"use client"

import React, { useState } from "react"
import CertificationCard, { AppShape } from "./certification-card"


// eslint-disable-next-line @typescript-eslint/no-explicit-any -- fix later
type ActionsRenderer = (app: any) => React.ReactNode

/**
 * Tabbed certification list that switches between unprocessed and processed applications.
 *
 * How: Tracks active tab locally and auto-jumps to hashed application ids (`#app-<id>`) when present.
 */
export default function CertificationTabs({
  processed,
  unprocessed,
  actions,
  onAccept,
  onReject,
  onDelete,
  canManage = true,
}: {
  processed: AppShape[];
  unprocessed: AppShape[];
  actions?: ActionsRenderer;
  onAccept?: (id: number) => void;
  onReject?: (id: number) => void;
  onDelete?: (id: number) => void;
  canManage?: boolean;
}) {
  const [tab, setTab] = useState<"unprocessed" | "processed">("unprocessed")

  // If the page is loaded with a hash like #app-123, switch to the correct tab and scroll the element into view
  React.useEffect(() => {
    try {
      const hash = typeof window !== "undefined" ? window.location.hash : ""
      if (!hash) return
      const m = hash.match(/^#app-(\d+)$/)
      if (!m) return
      const id = Number(m[1])
      // check if id is in unprocessed or processed
      const inUnprocessed = unprocessed.some(a => a.id === id)
      const inProcessed = processed.some(a => a.id === id)
      if (inUnprocessed) setTab("unprocessed")
      else if (inProcessed) setTab("processed")

      // scroll after a short delay so the tab change has been applied
      setTimeout(() => {
        const el = document.getElementById(`app-${id}`)
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" })
      }, 60)
    } catch {
      // noop
    }
  }, [processed, unprocessed])

  const list = tab === "unprocessed" ? unprocessed : processed

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <button onClick={() => setTab("unprocessed")} className={`px-3 py-1 rounded ${tab === "unprocessed" ? "bg-orange-800 text-white" : "bg-muted-foreground/10"}`}>Ubehandlede</button>
        <button onClick={() => setTab("processed")} className={`px-3 py-1 rounded ${tab === "processed" ? "bg-primary text-white" : "bg-muted-foreground/10"}`}>Behandlet</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {list.map((app) => (
          <div key={app.id} id={`app-${app.id}`} className="flex flex-col gap-2">
            <CertificationCard
              app={app}
              onAccept={canManage ? onAccept : undefined}
              onReject={canManage ? onReject : undefined}
              onDelete={canManage ? onDelete : undefined}
              canManage={canManage}
            />
            {actions ? <div className="px-1">{actions(app)}</div> : null}
          </div>
        ))}
      </div>
    </div>
  )
}
