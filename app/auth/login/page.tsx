import { LoginForm } from "@/components/login-form";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Logo from "@/app/logo.png";

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-between">
          <Button asChild variant="ghost" size="sm" className="gap-2">
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
              <span>Tilbake</span>
            </Link>
          </Button>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 shadow-inner ring-1 ring-white/10">
            <Image src={Logo} alt="ASS logo" className="h-7 w-7 object-contain" priority />
          </div>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
