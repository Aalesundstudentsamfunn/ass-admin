"use client";

import * as React from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { copyToClipboard } from "./shared";

/**
 * Two-column layout used for all label/value rows inside member details.
 */
export function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[9rem_minmax(0,1fr)] items-center gap-4">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex min-w-0 justify-end text-right">{children}</div>
    </div>
  );
}

/**
 * Icon + label representation for boolean status values.
 */
export function YesNoStatus({ value }: { value: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-medium">
      {value ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
      ) : (
        <XCircle className="h-4 w-4 text-red-500" aria-hidden="true" />
      )}
      {value ? "Ja" : "Nei"}
    </span>
  );
}

/**
 * Icon-only variant used next to editable status selects.
 */
export function StatusIcon({ value }: { value: boolean }) {
  return value ? (
    <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
  ) : (
    <XCircle className="h-4 w-4 text-red-500" aria-hidden="true" />
  );
}

/**
 * Text value with hover tooltip and click-to-copy behavior.
 */
export function CopyableInlineValue({
  value,
  copyLabel,
}: {
  value: string;
  copyLabel: string;
}) {
  return (
    <span className="relative inline-flex items-center group">
      <button
        type="button"
        className="underline-offset-2 hover:underline"
        onClick={(event) => {
          event.stopPropagation();
          copyToClipboard(value, copyLabel);
        }}
      >
        {value}
      </button>
      <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground/90 px-2 py-1 text-[10px] text-background opacity-0 transition-opacity group-hover:opacity-100">
        Kopier
      </span>
    </span>
  );
}

