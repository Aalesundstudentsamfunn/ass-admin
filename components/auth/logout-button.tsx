"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouteProgress } from "@/components/navigation/route-progress";
import { useRouter } from "next/navigation";
import { LoaderCircle, LogOut } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useState } from "react";

/**
 * Renders logout button.
 */
export function LogoutButton({ compact = false, className }: { compact?: boolean; className?: string }) {
  const router = useRouter();
  const { startNavigation } = useRouteProgress();
  const [isLoading, setIsLoading] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const logoutButtonClassName = cn(
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg border text-sm font-medium outline-none transition-[background-color,color,box-shadow,transform]",
    "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
    "disabled:pointer-events-none disabled:opacity-50",
    "text-white dark:text-zinc-950",
    "shadow-sm hover:shadow-md",
    compact ? "h-9 w-9 px-0" : "h-9 px-4 py-2",
    className,
  );
  const logoutButtonStyle = {
    backgroundColor: isHovered ? "#b01030" : "#dc143c",
    borderColor: isHovered ? "#b01030" : "#dc143c",
  };

  const logout = async () => {
    if (isLoading) {
      return;
    }
    toast.dismiss();
    setIsLoading(true);
    const supabase = createClient();

    try {
      await supabase.auth.signOut();
      startNavigation();
      router.push("/auth/login");
    } catch {
      toast.error("Kunne ikke logge ut.");
      setIsLoading(false);
    }
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={logout}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        title="Logg ut"
        aria-label="Logg ut"
        className={logoutButtonClassName}
        style={logoutButtonStyle}
        disabled={isLoading}
      >
        {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={logout}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={logoutButtonClassName}
      style={logoutButtonStyle}
      disabled={isLoading}
    >
      {isLoading ? (
        <>
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Logger ut...
        </>
      ) : (
        "Logg ut"
      )}
    </button>
  );
}
