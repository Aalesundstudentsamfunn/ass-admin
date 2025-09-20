import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Plus, Mail, Phone, Clock, MapPin } from "lucide-react"

const workers = [
  {
    id: 1,
    name: "Tom Anderson",
    email: "tom.anderson@volunteer.org",
    phone: "+1 (555) 111-2222",
    role: "Equipment Manager",
    department: "Operations",
    status: "On Duty",
    location: "Warehouse A",
    shift: "Morning (8AM-4PM)",
    experience: "3 years",
  },
  {
    id: 2,
    name: "Lisa Rodriguez",
    email: "lisa.rodriguez@volunteer.org",
    phone: "+1 (555) 222-3333",
    role: "Maintenance Tech",
    department: "Maintenance",
    status: "On Duty",
    location: "Workshop",
    shift: "Day (9AM-5PM)",
    experience: "5 years",
  },
  {
    id: 3,
    name: "James Kim",
    email: "james.kim@volunteer.org",
    phone: "+1 (555) 333-4444",
    role: "Logistics Coordinator",
    department: "Logistics",
    status: "Off Duty",
    location: "Office",
    shift: "Evening (2PM-10PM)",
    experience: "2 years",
  },
  {
    id: 4,
    name: "Maria Garcia",
    email: "maria.garcia@volunteer.org",
    phone: "+1 (555) 444-5555",
    role: "Safety Inspector",
    department: "Safety",
    status: "On Duty",
    location: "Field",
    shift: "Morning (8AM-4PM)",
    experience: "7 years",
  },
]

export default function WorkersPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-balance">Workers</h1>
          <p className="text-muted-foreground text-pretty">Manage volunteer workers and staff members</p>
        </div>
        <Button className="bg-accent hover:bg-accent/90">
          <Plus className="mr-2 h-4 w-4" />
          Add Worker
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        {[
          { title: "Total Workers", value: "89", change: "+3%" },
          { title: "On Duty", value: "67", change: "+5%" },
          { title: "Off Duty", value: "22", change: "-2%" },
          { title: "New This Month", value: "8", change: "+12%" },
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
              <CardTitle>All Workers</CardTitle>
              <CardDescription>Staff members and volunteer workers</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search workers..." className="pl-10 w-64" />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {workers.map((worker) => (
              <div
                key={worker.id}
                className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-card/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="bg-accent/10 rounded-full p-3">
                    <span className="text-accent font-semibold text-lg">
                      {worker.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{worker.name}</h3>
                    <p className="text-sm font-medium text-primary">{worker.role}</p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                      <div className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {worker.email}
                      </div>
                      <div className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {worker.phone}
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {worker.location}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {worker.shift}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant={worker.status === "On Duty" ? "default" : "secondary"}>{worker.status}</Badge>
                      <Badge variant="outline">{worker.department}</Badge>
                      <span className="text-xs text-muted-foreground">{worker.experience} experience</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm">
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm">
                    Schedule
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
