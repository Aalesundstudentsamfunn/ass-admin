import { PublicContactForm } from "@/components/public/public-contact-form";
import { PublicFooter } from "@/components/public/public-footer";
import { PublicNavbar } from "@/components/public/public-navbar";

/**
 * Public contact page.
 */
export default function KontaktPage() {
  return (
    <main className="flex min-h-dvh flex-col bg-background text-foreground">
      <PublicNavbar />

      <section className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
        <div className="rounded-2xl border border-border/60 bg-card/60 p-6 sm:p-8">
          <h1 className="text-3xl font-semibold tracking-tight">Kontakt oss</h1>
          <p className="mt-2 text-sm text-foreground/70">
            Har du spørsmål om medlemskap, tilgang eller admin-løysinga? Send oss ei melding.
          </p>

          <div className="mt-6">
            <PublicContactForm />
          </div>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
