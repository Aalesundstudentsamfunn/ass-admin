"use client"

import { Toaster } from "sonner"

/**
 * Renders app toaster.
 */
export function AppToaster() {
  return (
    <Toaster
      richColors
      closeButton
      position="top-right"
      toastOptions={{
        duration: 4000,
      }}
    />
  )
}
