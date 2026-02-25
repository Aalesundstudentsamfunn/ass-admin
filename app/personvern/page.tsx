import { PublicFooter } from "@/components/public/public-footer";
import { PublicNavbar } from "@/components/public/public-navbar";

/**
 * Privacy policy for public/admin pages.
 */
export default function PersonvernPage() {
  return (
    <main className="flex min-h-dvh flex-col bg-background text-foreground">
      <PublicNavbar />

      <section className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
        <div className="rounded-2xl border border-border/60 bg-card/60 p-6 sm:p-8">
          <h1 className="text-3xl font-semibold tracking-tight">Personvernerklæring</h1>
          <p className="mt-2 text-sm text-foreground/70">
            Sist oppdatert: {new Date().toLocaleDateString("no-NO")}
          </p>

          <div className="mt-6 space-y-6 text-sm leading-relaxed text-foreground/80">
            <section>
              <h2 className="text-base font-semibold text-foreground">Kva vi lagrar</h2>
              <p>
                For å drifte medlemskap og adminfunksjonar lagrar vi opplysningar som namn, e-post,
                brukar-ID (UUID), tilgangsnivå, medlemsstatus og tidspunkt for passordoppsett.
                For utlån lagrar vi reservasjonar, utlånsperiode og referansar til utstyr. Vi lagrar
                òg driftsloggar som utskriftskø og admin-auditlogg for sikkerheit og feilsøking.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground">Kvifor vi lagrar data</h2>
              <p>
                Opplysningane blir brukte for innlogging, tilgangskontroll, medlemsadministrasjon,
                handtering av utlån, utskrift av medlemskort og sporbarheit ved administrative
                handlingar.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground">Kven data blir delt med</h2>
              <p>
                Data blir behandla i Supabase (vår databehandlar for autentisering og database).
                Vi sel ikkje personopplysningar vidare.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground">Dine rettar</h2>
              <p>
                Du kan be om innsyn, retting eller sletting av personopplysningar. Ta kontakt med oss
                via kontaktsida eller på <a className="underline underline-offset-2" href="mailto:it@astudent.no">it@astudent.no</a>.
              </p>
            </section>
          </div>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
