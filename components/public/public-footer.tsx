/**
 * Shared public footer used on homepage and `/utstyr`.
 */
export function PublicFooter() {
  return (
    <footer className="mx-auto w-full max-w-6xl px-4 pb-8 pt-8">
      <div className="h-px w-full bg-gradient-to-r from-transparent via-border to-transparent" />
      <div className="mt-4 flex flex-col gap-3 text-xs text-foreground/70 sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} Ålesund Studentsamfunn</p>
        <div className="flex items-center gap-4 sm:justify-end">
          <a href="https://astudent.no" className="hover:text-foreground">
            astudent.no
          </a>
          <a href="#personvern" className="hover:text-foreground">
            Personvern
          </a>
          <a href="#kontakt" className="hover:text-foreground">
            Kontakt
          </a>
        </div>
      </div>
    </footer>
  );
}
