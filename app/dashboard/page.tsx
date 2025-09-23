import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, UserCheck, HardHat, Package, Building2, TrendingUp, UserCheck2 } from "lucide-react"
import getStats from "./get_stats";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

interface Stats {
  title: string;
  value: string;
  description: string;
  icon: React.ElementType;
  trend: string;
}
/*
const stats = [
  {
    title: "Total Members",
    value: "248",
    description: "Active volunteer members",
    icon: Users,
    trend: "+12%",
  },
  {
    title: "Registered Users",
    value: "1,429",
    description: "Platform users",
    icon: UserCheck,
    trend: "+8%",
  },
  {
    title: "Active Workers",
    value: "89",
    description: "Currently working",
    icon: HardHat,
    trend: "+3%",
  },
  {
    title: "Equipment Items",
    value: "156",
    description: "Available for rent",
    icon: Package,
    trend: "+15%",
  },
  {
    title: "Groups",
    value: "12",
    description: "Volunteer groups",
    icon: Building2,
    trend: "+2%",
  },
]*/

export default async function DashboardPage() {
  const supabase = await createClient();
  //const { data } = await supabase.from("profiles").select("*");
  const { data: stats, error } = await supabase.rpc('volunteer_stats')
  const data2 = await supabase.rpc('admin_list_profiles');
  console.log("data2t", data2);
  console.log("stats", stats);
  if (stats && stats.error) {
    console.log("redirecting to not volunteer page");
    redirect("/not-volunteer");
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-balance">Dashboard Overview</h1>
        <p className="text-muted-foreground text-pretty">Welcome to the volunteer equipment rental management system</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {stats && stats.length > 0 && stats.map((stat: Stats) => (
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
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest equipment rentals and returns</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { action: "Test", item: "Power Drill Set", user: "John Smith", time: "2 hours ago" },
              ].map((activity, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{activity.action}</p>
                    <p className="text-xs text-muted-foreground">
                      {activity.item} - {activity.user}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">{activity.time}</span>
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
              <button className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent/10 transition-colors text-left">
                <Users className="h-5 w-5 text-accent" />
                <div>
                  <p className="font-medium text-foreground">Add New Member</p>
                  <p className="text-xs text-muted-foreground">Register a new volunteer</p>
                </div>
              </button>
              <button className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent/10 transition-colors text-left">
                <Package className="h-5 w-5 text-accent" />
                <div>
                  <p className="font-medium text-foreground">Add Equipment</p>
                  <p className="text-xs text-muted-foreground">Register new equipment item</p>
                </div>
              </button>
              <button className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent/10 transition-colors text-left">
                <Building2 className="h-5 w-5 text-accent" />
                <div>
                  <p className="font-medium text-foreground">Create Group</p>
                  <p className="text-xs text-muted-foreground">Set up new volunteer group</p>
                </div>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
