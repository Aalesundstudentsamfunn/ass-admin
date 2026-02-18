import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default function NotVoluntaryPage() {
    async function handleLogout() {
        "use server";
        const supabase = await createClient();
        await supabase.auth.signOut();
        redirect("/auth/login");
    }

    return (
        <div className="flex min-h-screen items-center justify-center px-4">
            <div className="max-w-md text-center space-y-4">
                <h1 className="text-2xl font-semibold">
                    Ingen tilgang
                </h1>

                <p className="text-muted-foreground">
                    Du er ikke registrert som frivillig og har derfor ikke tilgang til dette området.
                </p>

                <p className="text-muted-foreground">
                    Dersom dette ikke stemmer, vennligst kontakt IT-avdelingen.
                </p>

                <form action={handleLogout} className="pt-2">
                    <button
                        type="submit"
                        className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                        Logg ut
                    </button>
                </form>
            </div>
        </div>
    )
}
