import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Plus, Mail, Calendar, Activity } from "lucide-react"

const users = [
  {
    id: 1,
    name: "Alice Cooper",
    email: "alice.cooper@email.com",
    joinDate: "2023-01-20",
    status: "Active",
    lastLogin: "2024-01-15",
    rentals: 5,
    role: "User",
  },
  {
    id: 2,
    name: "Bob Martinez",
    email: "bob.martinez@email.com",
    joinDate: "2023-02-14",
    status: "Active",
    lastLogin: "2024-01-14",
    rentals: 12,
    role: "User",
  },
  {
    id: 3,
    name: "Carol White",
    email: "carol.white@email.com",
    joinDate: "2023-03-08",
    status: "Suspended",
    lastLogin: "2024-01-10",
    rentals: 2,
    role: "User",
  },
  {
    id: 4,
    name: "David Brown",
    email: "david.brown@email.com",
    joinDate: "2023-04-12",
    status: "Active",
    lastLogin: "2024-01-15",
    rentals: 8,
    role: "Premium",
  },
]

export default function UsersPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-balance">Users</h1>
          <p className="text-muted-foreground text-pretty">Manage platform users and their accounts</p>
        </div>
        <Button className="bg-accent hover:bg-accent/90">
          <Plus className="mr-2 h-4 w-4" />
          Add User
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        {[
          { title: "Total Users", value: "1,429", change: "+12%" },
          { title: "Active Users", value: "1,284", change: "+8%" },
          { title: "New This Month", value: "89", change: "+23%" },
          { title: "Suspended", value: "12", change: "-5%" },
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
              <CardTitle>All Users</CardTitle>
              <CardDescription>Platform users and their account information</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search users..." className="pl-10 w-64" />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-card/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="bg-secondary/10 rounded-full p-3">
                    <span className="text-secondary font-semibold text-lg">
                      {user.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{user.name}</h3>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {user.email}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Joined {new Date(user.joinDate).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-1">
                        <Activity className="h-3 w-3" />
                        Last login {new Date(user.lastLogin).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={user.status === "Active" ? "default" : "destructive"}>{user.status}</Badge>
                      <Badge variant="outline">{user.role}</Badge>
                      <span className="text-xs text-muted-foreground">{user.rentals} rentals</span>
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
