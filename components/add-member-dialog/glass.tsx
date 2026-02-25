import * as React from "react";

/**
 * Shared glass container used by add-member dialog content.
 */
export function AddMemberDialogGlass({
  className = "",
  children,
}: React.PropsWithChildren<{ className?: string }>) {
  return (
    <div
      className={
        `relative rounded-2xl border backdrop-blur-xl ` +
        `bg-white/95 border-zinc-300 shadow-[0_8px_32px_-12px_rgba(15,23,42,0.35)] ` +
        `dark:bg-zinc-900/95 dark:border-zinc-700 dark:shadow-[0_16px_50px_-20px_rgba(0,0,0,0.7)] ` +
        className
      }
    >
      {children}
    </div>
  );
}
