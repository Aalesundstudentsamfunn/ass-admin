"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * Renders logout button.
 */
export function LogoutButton({ compact = false, className }: { compact?: boolean; className?: string }) {
  const router = useRouter();

  const logout = async () => {
    toast.dismiss();
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  if (compact) {
    return (
      <Button variant="ghost" size="icon" onClick={logout} title="Logg ut" aria-label="Logg ut" className={cn("h-9 w-9", className)}>
        <LogOut className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Button onClick={logout} className={className}>
      Logg ut
    </Button>
  );
}
