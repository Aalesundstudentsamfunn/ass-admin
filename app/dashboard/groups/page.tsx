/**
 * Server route for `groups` dashboard view.
 */
// app/dashboard/groups/page.tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

// Types
interface ActivityGroup {
  id: number;
  created_at: string;
  name: string | null;
  description: string | null;
  img_url: string | null;
  website_url: string | null;
  group_leader: { firstname: string | null; lastname: string | null }[] | null;
}

/**
 * Renders Liquid Glass glass.
 */
function Glass({ className = "", children }: React.PropsWithChildren<{ className?: string }>) {
  return <div className={`relative rounded-2xl border backdrop-blur-xl ` + `bg-white/65 border-white/50 shadow-[0_1px_0_rgba(255,255,255,0.6),0_10px_30px_-10px_rgba(16,24,40,0.25)] ` + `dark:bg-white/5 dark:border-white/10 dark:shadow-[0_1px_0_rgba(255,255,255,0.07),0_20px_60px_-20px_rgba(0,0,0,0.6)] ` + className}>{children}</div>;
}

/**
 * Renders fallback logo.
 */
function FallbackLogo({ name }: { name?: string | null }) {
  const safe = (name?.trim() || "Aktivitetsgruppe").toUpperCase();
  const initials = safe
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("");

  return (
    <div className="flex h-36 w-full items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-sky-400/40 to-fuchsia-500/40 p-0 text-white shadow-inner dark:from-sky-600/30 dark:to-fuchsia-600/30" aria-hidden>
      <svg viewBox="0 0 200 200" className="h-full w-full">
        {/* soft glassy blob */}
        <defs>
          <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.7)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.2)" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="200" height="200" fill="url(#g)" opacity="0.25" />
        <g>
          <circle cx="160" cy="40" r="26" fill="white" opacity="0.18" />
          <circle cx="48" cy="160" r="20" fill="white" opacity="0.14" />
        </g>
        <text x="50%" y="54%" textAnchor="middle" fontSize="64" fontWeight="700" fill="white" style={{ letterSpacing: "0.08em" }}>
          {initials}
        </text>
      </svg>
    </div>
  );
}

/**
 * Renders safe image.
 */
function SafeImage({ src, alt }: { src?: string | null; alt: string }) {
  if (!src) return <FallbackLogo name={alt} />;
  try {
    const url = new URL(src); // validates absolute URLs too
    return (
      <div className="h-36 w-full overflow-hidden rounded-2xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url.toString()} alt={alt} className="h-full w-full object-cover" />
      </div>
    );
  } catch {
    return <FallbackLogo name={alt} />;
  }
}

/**
 * Normalizes url.
 *
 * How: Uses deterministic transforms over the provided inputs.
 * @returns trimmed url | null
 */
function normalizeUrl(u?: string | null) {
  if (!u) return null;
  const trimmed = u.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/**
 * Renders activity groups page.
 */
export default async function ActivityGroupsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activity_group")
    .select(
      `
    id,
    created_at,
    name,
    description,
    img_url,
    website_url,
    group_leader:members (
      firstname,
      lastname
    )
  `,
    )
    .order("created_at", { ascending: false });

  if (error) {
    return <div>Error: {error?.message}</div>;
  }
  const groups: ActivityGroup[] = Array.isArray(data) ? data : [];

  // Fallback data if table is empty or error
  const safeGroups: ActivityGroup[] = groups.length
    ? groups
    : [
        {
          id: 1,
          created_at: new Date().toISOString(),
          name: "Turgruppe Fjell",
          description: "Ukentlige turer i nærområdet og helgeturer i fjellet.",
          img_url: null,
          website_url: "fjordfix.no",
          group_leader: null,
        },
        {
          id: 2,
          created_at: new Date().toISOString(),
          name: "Sykkel & Service",
          description: "Vedlikehold av sykler og felles sykkelturer.",
          img_url: null,
          website_url: null,
          group_leader: null,
        },
      ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-balance">Aktivitetsgrupper</h1>
        <p className="text-muted-foreground text-pretty">Oppdag og administrer grupper. Flytende glass-kort med bilde/fallback, beskrivelse og lenker.</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {safeGroups.map((g) => {
          const name = g.name ?? "Uten navn";
          const desc = g.description ?? "Ingen beskrivelse tilgjengelig.";
          const url = normalizeUrl(g.website_url);
          const created = new Date(g.created_at);
          const createdLabel = isNaN(created.getTime()) ? "Ukjent dato" : created.toLocaleDateString();

          return (
            <Glass key={g.id} className="p-[1px]">
              <Card className="rounded-2xl border-0 bg-transparent shadow-none">
                <CardHeader className="px-4 pt-4">
                  <CardTitle className="text-base">{name}</CardTitle>
                  <CardDescription>Opprettet {createdLabel}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 px-4 pb-4">
                  <SafeImage src={g.img_url ?? undefined} alt={name} />

                  <p className="text-sm text-foreground/80">{desc}</p>

                  <div className="flex flex-wrap items-center gap-2">
                    {url ? (
                      <Button asChild className="rounded-xl">
                        <Link href={url} target="_blank" rel="noopener noreferrer">
                          Besøk nettside
                        </Link>
                      </Button>
                    ) : (
                      <Button variant="secondary" disabled className="rounded-xl">
                        Ingen nettside
                      </Button>
                    )}
                    <Button variant="outline" className="rounded-xl">
                      Mer info
                    </Button>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    {/* @ts-expect-error fix this later */}
                    Gruppeleder: {Array.isArray(g.group_leader) ? "ukjent" : g.group_leader ? g.group_leader.firstname + " " + g.group_leader.lastname : "ukjent"}
                  </div>
                </CardContent>
              </Card>
            </Glass>
          );
        })}
      </div>
    </div>
  );
}
