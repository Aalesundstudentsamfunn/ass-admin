"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Renders logout button.
 */
export function LogoutButton({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  const router = useRouter();

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  if (compact) {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={logout}
        title="Logout"
        aria-label="Logout"
        className={cn("h-9 w-9", className)}
      >
        <LogOut className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Button onClick={logout} className={className}>
      Logout
    </Button>
  );
}
