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
        `bg-white/65 border-white/50 shadow-[0_1px_0_rgba(255,255,255,0.6),0_10px_30px_-10px_rgba(16,24,40,0.25)] ` +
        `dark:bg-white/5 dark:border-white/10 dark:shadow-[0_1px_0_rgba(255,255,255,0.07),0_20px_60px_-20px_rgba(0,0,0,0.6)] ` +
        className
      }
    >
      {children}
    </div>
  );
}

