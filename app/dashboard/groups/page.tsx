import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Plus, Building2, Users, Calendar, MapPin } from "lucide-react"

const groups = [
  {
    id: 1,
    name: "Community Builders",
    description: "Focused on community development and infrastructure projects",
    leader: "Emma Davis",
    members: 45,
    activeProjects: 3,
    location: "Downtown District",
    established: "2022-03-15",
    status: "Active",
    category: "Construction",
  },
  {
    id: 2,
    name: "Green Team",
    description: "Environmental conservation and sustainability initiatives",
    leader: "Sarah Johnson",
    members: 32,
    activeProjects: 5,
    location: "City Parks",
    established: "2022-01-20",
    status: "Active",
    category: "Environmental",
  },
  {
    id: 3,
    name: "Tech Support",
    description: "Technology assistance and digital literacy programs",
    leader: "Mike Wilson",
    members: 18,
    activeProjects: 2,
    location: "Community Center",
    established: "2022-06-10",
    status: "Inactive",
    category: "Technology",
  },
  {
    id: 4,
    name: "Emergency Response",
    description: "Disaster relief and emergency preparedness training",
    leader: "Tom Anderson",
    members: 28,
    activeProjects: 1,
    location: "Fire Station",
    established: "2022-02-28",
    status: "Active",
    category: "Emergency",
  },
]

export default function GroupsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-balance">Groups</h1>
          <p className="text-muted-foreground text-pretty">Manage volunteer groups and their activities</p>
        </div>
        <Button className="bg-accent hover:bg-accent/90">
          <Plus className="mr-2 h-4 w-4" />
          Create Group
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        {[
          { title: "Total Groups", value: "12", change: "+2%" },
          { title: "Active Groups", value: "9", change: "+1%" },
          { title: "Total Members", value: "248", change: "+12%" },
          { title: "Active Projects", value: "23", change: "+18%" },
        ].map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-foreground">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.title}</p>
              <div className="text-xs text-accent mt-1">{stat.change}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Groups</CardTitle>
              <CardDescription>Volunteer groups and their information</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search groups..." className="pl-10 w-64" />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {groups.map((group) => (
              <div
                key={group.id}
                className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-card/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="bg-secondary/10 rounded-lg p-3">
                    <Building2 className="h-6 w-6 text-secondary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{group.name}</h3>
                    <p className="text-sm text-muted-foreground max-w-md text-pretty">{group.description}</p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {group.members} members
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {group.location}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Est. {new Date(group.established).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant={group.status === "Active" ? "default" : "secondary"}>{group.status}</Badge>
                      <Badge variant="outline">{group.category}</Badge>
                      <span className="text-xs text-muted-foreground">Leader: {group.leader}</span>
                      <span className="text-xs text-accent">{group.activeProjects} active projects</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm">
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm">
                    View
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
