import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Logo from "@/app/logo.png";

/**
 * Shared top header for auth pages with back action and logo.
 */
export function AuthPageHeader({
  backHref = "/",
  backLabel = "Tilbake",
}: {
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="mb-6 flex items-center justify-between">
      <Button asChild variant="ghost" size="sm" className="gap-2">
        <Link href={backHref}>
          <ArrowLeft className="h-4 w-4" />
          <span>{backLabel}</span>
        </Link>
      </Button>

      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-border/60 bg-white shadow-inner">
        <Image src={Logo} alt="ASS logo" className="h-7 w-7 object-contain" priority />
      </div>
    </div>
  );
}
