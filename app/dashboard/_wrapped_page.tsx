"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle, CheckCircle2, Package, Printer, ShieldCheck, TrendingDown, TrendingUp, UserCheck2, Users } from "lucide-react"
import Link from "next/link";
import { useState, useEffect } from "react";
import { CreateUserDialog } from "@/components/add-new-member";
import { useDashboardSessionOptional } from "@/components/dashboard/session-context";
import { canViewAuditLogs } from "@/lib/privilege-checks";
import {
    isPrinterOffline,
    type PrinterHealthRow,
} from "@/components/queue/shared";

interface Stats {
    title: string;
    value: string;
    description: string;
    icon: React.ElementType;
    trend: string;
}

type DashboardPageProps = {
    initialData: Stats[];
    printerHealth: PrinterHealthRow | null;
};

type GitHubCommit = {
    sha: string;
    message: string;
    author: string;
    date?: string;
    url: string;
};

type GitHubApiCommit = {
    sha: string;
    html_url: string;
    commit: {
        message: string;
        author?: {
            name?: string;
            date?: string;
        };
    };
    author?: {
        login?: string;
    };
};

const base = "https://api.github.com";
const TREND_WARNING_THRESHOLD = 3;

/**
 * Parses trend text and maps it to display tone.
 *
 * Rules:
 * - |trend| <= threshold => warning/orange
 * - negative below threshold => red
 * - positive above threshold => green
 */
function getTrendMeta(trend: string) {
    const match = trend.match(/-?\d+(?:[.,]\d+)?/);
    const numeric = match ? Number(match[0].replace(",", ".")) : 0;
    const absolute = Math.abs(numeric);

    if (absolute <= TREND_WARNING_THRESHOLD) {
        return {
            className: "text-amber-700 dark:text-amber-300",
            icon: TrendingUp,
        };
    }
    if (numeric < 0) {
        return {
            className: "text-red-700 dark:text-red-300",
            icon: TrendingDown,
        };
    }
    return {
        className: "text-emerald-700 dark:text-emerald-300",
        icon: TrendingUp,
    };
}



/**
 * Returns latest commits fetch.
 *
 * How: Uses deterministic transforms over the provided inputs.
 * @returns Promise<unknown>
 */
export async function getLatestCommitsFetch(owner: string, repo: string) {
    const url = `${base}/repos/${owner}/${repo}/commits?per_page=5`;

    const res = await fetch(url)
    if (!res.ok) {
        const txt = await res.text();
        throw new Error(`GitHub API error ${res.status}: ${txt}`);
    }

    const data = (await res.json()) as GitHubApiCommit[];
    return data.map((c) => ({
        sha: c.sha,
        message: c.commit.message,
        author: c.commit.author?.name ?? c.author?.login ?? "unknown",
        date: c.commit.author?.date,
        url: c.html_url,
    })) as GitHubCommit[];
}

/**
 * Renders dashboard page.
 *
 */
export default function DashboardPage({
    initialData,
    printerHealth,
}: DashboardPageProps) {
    const dashboardSession = useDashboardSessionOptional();
    const canSeeAuditLogs = canViewAuditLogs(dashboardSession?.privilegeType);
    const [commits, setCommits] = useState<GitHubCommit[]>([]);
    const isOffline = isPrinterOffline(printerHealth?.last_heartbeat ?? null);
    const printerReady = !isOffline;
    const printerStatusLabel = printerReady ? "PC: Klar for utskrift" : "PC: Frakoblet";
    const printerConnected = printerHealth?.printer_connected;
    const printerConnectionKnown = typeof printerConnected === "boolean";
    const printerConnectedNow = printerConnected === true;
    const printerConnectionLabel = !printerConnectionKnown
        ? "Printer: Ukjent"
        : printerConnectedNow
          ? "Printer: Tilkoblet"
          : "Printer: Frakoblet";

    const quickActions = [
        {
            href: "/dashboard/equipment",
            label: "Nytt utstyr",
            description: "Registrer utstyr",
            icon: Package,
        },
        {
            href: "/dashboard/queue",
            label: "Printerkø",
            description: "Sjekk utskrifter",
            icon: Printer,
        },
        {
            href: "/dashboard/voluntary",
            label: "Frivillige",
            description: "Administrer frivillige",
            icon: UserCheck2,
        },
        {
            href: "/dashboard/audit",
            label: "Logg",
            description: "Se admin-hendelser",
            icon: ShieldCheck,
        },
    ] as const;
    const visibleQuickActions = canSeeAuditLogs
      ? quickActions
      : quickActions.filter((action) => action.href !== "/dashboard/audit");

    useEffect(() => {
        getLatestCommitsFetch("Aalesundstudentsamfunn", "ass-admin").then((data) => {
            setCommits(data);
        });
    }, []);

    return (
        <div className="space-y-6">
            <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h1 className="text-3xl font-bold text-balance">Oversikt</h1>
                        <p className="text-pretty text-foreground/75 dark:text-foreground/70">
                            Administrasjon for frivillige, medlemmer og utstyr i ÅSS.
                        </p>
                    </div>
                    <div className="hidden flex-none items-center gap-2 lg:flex">
                        <div
                            className={`inline-flex items-center gap-2.5 whitespace-nowrap rounded-full border px-4 py-2 text-sm ${
                                printerReady
                                    ? "border-emerald-500/45 text-emerald-700 dark:text-emerald-200"
                                    : "border-rose-500/45 text-rose-700 dark:text-rose-200"
                            }`}
                            style={{
                                backgroundColor: printerReady
                                    ? "rgba(16, 185, 129, 0.11)"
                                    : "rgba(244, 63, 94, 0.11)",
                            }}
                        >
                            {printerReady ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                            ) : (
                                <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-300" />
                            )}
                            <span className="font-semibold">{printerStatusLabel}</span>
                        </div>
                        <div
                            className={`inline-flex items-center gap-2.5 whitespace-nowrap rounded-full border px-4 py-2 text-sm ${
                                !printerConnectionKnown
                                    ? "border-amber-500/45 text-amber-700 dark:text-amber-200"
                                    : printerConnectedNow
                                      ? "border-emerald-500/45 text-emerald-700 dark:text-emerald-200"
                                      : "border-rose-500/45 text-rose-700 dark:text-rose-200"
                            }`}
                            style={{
                                backgroundColor: !printerConnectionKnown
                                    ? "rgba(245, 158, 11, 0.11)"
                                    : printerConnectedNow
                                      ? "rgba(16, 185, 129, 0.11)"
                                      : "rgba(244, 63, 94, 0.11)",
                            }}
                            title={printerHealth?.printer_state_reason ?? undefined}
                        >
                            {printerConnectedNow ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                            ) : (
                                <AlertTriangle
                                    className={`h-4 w-4 ${
                                        !printerConnectionKnown
                                            ? "text-amber-600 dark:text-amber-300"
                                            : "text-rose-600 dark:text-rose-300"
                                    }`}
                                />
                            )}
                            <span className="font-semibold">{printerConnectionLabel}</span>
                        </div>
                    </div>
                </div>

                <div className="lg:hidden">
                    <div className="flex flex-wrap gap-2">
                        <div
                            className={`inline-flex items-center gap-2.5 rounded-full border px-4 py-2 text-sm ${
                                printerReady
                                    ? "border-emerald-500/45 text-emerald-700 dark:text-emerald-200"
                                    : "border-rose-500/45 text-rose-700 dark:text-rose-200"
                            }`}
                            style={{
                                backgroundColor: printerReady
                                    ? "rgba(16, 185, 129, 0.11)"
                                    : "rgba(244, 63, 94, 0.11)",
                            }}
                        >
                            {printerReady ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                            ) : (
                                <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-300" />
                            )}
                            <span className="font-semibold">{printerStatusLabel}</span>
                        </div>
                        <div
                            className={`inline-flex items-center gap-2.5 rounded-full border px-4 py-2 text-sm ${
                                !printerConnectionKnown
                                    ? "border-amber-500/45 text-amber-700 dark:text-amber-200"
                                    : printerConnectedNow
                                      ? "border-emerald-500/45 text-emerald-700 dark:text-emerald-200"
                                      : "border-rose-500/45 text-rose-700 dark:text-rose-200"
                            }`}
                            style={{
                                backgroundColor: !printerConnectionKnown
                                    ? "rgba(245, 158, 11, 0.11)"
                                    : printerConnectedNow
                                      ? "rgba(16, 185, 129, 0.11)"
                                      : "rgba(244, 63, 94, 0.11)",
                            }}
                            title={printerHealth?.printer_state_reason ?? undefined}
                        >
                            {printerConnectedNow ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                            ) : (
                                <AlertTriangle
                                    className={`h-4 w-4 ${
                                        !printerConnectionKnown
                                            ? "text-amber-600 dark:text-amber-300"
                                            : "text-rose-600 dark:text-rose-300"
                                    }`}
                                />
                            )}
                            <span className="font-semibold">{printerConnectionLabel}</span>
                        </div>
                    </div>
                </div>

            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {initialData && initialData.length > 0 && initialData.map((stat: Stats) => {
                    const trendMeta = getTrendMeta(stat.trend);
                    const TrendIcon = trendMeta.icon;

                    return (
                        <Card key={stat.title}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-card-foreground">{stat.title}</CardTitle>
                                <UserCheck2 className="h-4 w-4 text-foreground/55 dark:text-foreground/50" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                                <div className="flex items-center gap-2 text-xs text-foreground/70 dark:text-foreground/65">
                                    <span>{stat.description}</span>
                                    <div className={`flex items-center gap-1 ${trendMeta.className}`}>
                                        <TrendIcon className="h-3 w-3" />
                                        {stat.trend}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Nylig aktivitet</CardTitle>
                        <CardDescription>Siste commits fra gutta i IT</CardDescription>
                    </CardHeader>
                    <CardContent>
                            <div className="space-y-4">
                                {commits.map((activity, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center justify-between py-2 border-b border-border last:border-0"
                                    >
                                        <div>
                                            <p className="text-sm font-medium text-foreground">{activity.message}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {activity.author} - {activity.date ? new Date(activity.date).toLocaleString() : "Ukjent dato"}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Hurtighandlinger</CardTitle>
                        <CardDescription>Vanlige oppgaver i adminpanelet</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-2 sm:grid-cols-2">
                            <CreateUserDialog
                                trigger={
                                    <button
                                        type="button"
                                        className="group rounded-lg border border-border/70 p-3 text-left transition-colors hover:bg-accent/10"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Users className="h-4 w-4 text-foreground/65 transition-colors group-hover:text-foreground" />
                                            <span className="text-sm font-medium">Nytt medlem</span>
                                        </div>
                                        <p className="mt-1 text-xs text-muted-foreground">Åpne oppretting</p>
                                    </button>
                                }
                            />
                            {visibleQuickActions.map((action) => {
                                const Icon = action.icon;
                                return (
                                    <Link
                                        key={action.href}
                                        href={action.href}
                                        className="group rounded-lg border border-border/70 p-3 transition-colors hover:bg-accent/10"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Icon className="h-4 w-4 text-foreground/65 transition-colors group-hover:text-foreground" />
                                            <span className="text-sm font-medium">{action.label}</span>
                                        </div>
                                        <p className="mt-1 text-xs text-muted-foreground">{action.description}</p>
                                    </Link>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
