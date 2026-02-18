"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Package, TrendingUp, UserCheck2 } from "lucide-react"
import Link from "next/link";
import { useState, useEffect } from "react";

interface Stats {
    title: string;
    value: string;
    description: string;
    icon: React.ElementType;
    trend: string;
}

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

export default function DashboardPage({ initialData }: { initialData: Stats[] }) {
    const [commits, setCommits] = useState<GitHubCommit[]>([]);

    useEffect(() => {
        getLatestCommitsFetch("Aalesundstudentsamfunn", "ass-admin").then((data) => {
            setCommits(data);
        });
    }, []);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-balance">Dashboard Overview</h1>
                <p className="text-muted-foreground text-pretty">Welcome to the volunteer equipment rental management system</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {initialData && initialData.length > 0 && initialData.map((stat: Stats) => (
                    <Card key={stat.title}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-card-foreground">{stat.title}</CardTitle>
                            <UserCheck2 className="h-4 w-4 text-muted" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>{stat.description}</span>
                                <div className="flex items-center gap-1 text-accent">
                                    <TrendingUp className="h-3 w-3" />
                                    {stat.trend}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
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
                        <CardTitle>Quick Actions</CardTitle>
                        <CardDescription>Common administrative tasks</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-3">
                            <Link href={"/dashboard/members"}>
                                <button className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent/10 transition-colors text-left">
                                    <Users className="h-5 w-5 text-accent" />
                                    <div>
                                        <p className="font-medium text-foreground">Legg til nytt Åss medlem</p>
                                        <p className="text-xs text-muted-foreground">Legg til nye medlemmer og print kort</p>
                                    </div>
                                </button>
                            </Link>
                            <Link href={"/dashboard/equipment"}>
                                <button className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent/10 transition-colors text-left">
                                    <Package className="h-5 w-5 text-accent" />
                                    <div>
                                        <p className="font-medium text-foreground">Legg til nytt utstyr</p>
                                        <p className="text-xs text-muted-foreground">Registrer nytt utstyrsobjekt</p>
                                    </div>
                                </button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
