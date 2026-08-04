# E-postmal for nullstilling av passord

`recovery.html` er malen som ligger i Supabase-dashboardet under
**Authentication → Email Templates → Reset Password**. Supabase leser den ikke
herfra - filen er kopien vår, slik at malen kan versjoneres og leses i
sammenheng med koden som er avhengig av den
(`components/auth/update-password-form.tsx`).

Endrer du malen i dashboardet, oppdater `recovery.html` i samme slengen, ellers
divergerer de uten at noe varsler om det.

## Lenken

Malen bygger lenken to steder, i knappen og i kopier-og-lim-inn-fallbacken.
Begge er pakket inn i samme betingelse:

```html
{{ if eq .RedirectTo "https://admin.astudent.no/auth/update-password" }}
  <a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery">Nullstill passord</a>
{{ else }}
  <a href="{{ .ConfirmationURL }}">Nullstill passord</a>
{{ end }}
```

Malen bruker bare `if`, `else` og `eq`. Fristelsen er å samle URL-en i en
variabel med `{{ $url := printf ... }}`, men en mal som ikke lar seg parse gjør
at ingen e-post sendes i det hele tatt. Duplisering er den billigere feilen her.

## Hvorfor

`@supabase/ssr` hardkoder `flowType: "pkce"` etter at den har spredt inn våre
egne `auth`-opsjoner, så webklienten kan ikke velge implicit flow. PKCE binder
lenken til nettleseren som ba om nullstillingen, fordi `code_verifier` ligger
lagret der. Ber du om nullstilling på PC og åpner lenken i Mail på mobil, finnes
ikke verifieren, og `exchangeCodeForSession` feiler med
`both auth code and code verifier should be non-empty`.

`token_hash` er ikke bundet til noen nettleserlagring og virker derfor på tvers
av enheter. `verifyOtp` skriver sesjonen til cookies, så server-rutene
(`/api/auth/password-initialized`, `/dashboard`) fungerer som før.

## Hvorfor betingelsen

Malen deles med mobilappen. Mobil bruker PKCE på samme enhet, der flyten virker
fint, og appen leser ikke `token_hash`. Betingelsen gir derfor `token_hash` bare
til webappen og lar mobil beholde `{{ .ConfirmationURL }}`.

Fjern betingelsen når mobilappen kaller
`verifyOtp({ token_hash, type: "recovery" })`.

## Fallgruver

- `eq` er eksakt strengsammenligning. Alle tre kallstedene sender nøyaktig
  `https://admin.astudent.no/auth/update-password` (`forgot-password-form.tsx`,
  `dashboard/settings/page.tsx` via `window.location.origin`, og
  `api/admin/password-reset/route.ts` via `NEXT_PUBLIC_SITE_URL`). Endres domenet
  eller `NEXT_PUBLIC_SITE_URL`, må strengen her endres i takt.
- Preview-deployments (`*.vercel.app`) treffer ikke betingelsen og faller til
  PKCE-grenen. Det virker fortsatt på samme enhet, men ikke på tvers.
- `auth-js` sender `redirectTo` uendret videre. Slår noen på det eksperimentelle
  flagget `appendPkceFlowIdToRedirects`, får `.RedirectTo` en `sb_flow_id`-parameter
  og sammenligningen slutter å treffe.
