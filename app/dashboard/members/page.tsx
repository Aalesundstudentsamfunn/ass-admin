import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Plus, Mail, Phone, Calendar } from "lucide-react"

const members = [
  {
    id: 1,
    name: "John Smith",
    email: "john.smith@email.com",
    phone: "+1 (555) 123-4567",
    joinDate: "2023-01-15",
    status: "Active",
    group: "Community Builders",
    rentals: 12,
  },
  {
    id: 2,
    name: "Sarah Johnson",
    email: "sarah.j@email.com",
    phone: "+1 (555) 234-5678",
    joinDate: "2023-03-22",
    status: "Active",
    group: "Green Team",
    rentals: 8,
  },
  {
    id: 3,
    name: "Mike Wilson",
    email: "mike.wilson@email.com",
    phone: "+1 (555) 345-6789",
    joinDate: "2023-02-10",
    status: "Inactive",
    group: "Tech Support",
    rentals: 3,
  },
  {
    id: 4,
    name: "Emma Davis",
    email: "emma.davis@email.com",
    phone: "+1 (555) 456-7890",
    joinDate: "2023-04-05",
    status: "Active",
    group: "Community Builders",
    rentals: 15,
  },
]

export default function MembersPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-balance">Members</h1>
          <p className="text-muted-foreground text-pretty">Manage volunteer members and their information</p>
        </div>
        <Button className="bg-accent hover:bg-accent/90">
          <Plus className="mr-2 h-4 w-4" />
          Add Member
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Members</CardTitle>
              <CardDescription>A list of all registered volunteer members</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search members..." className="pl-10 w-64" />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-card/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="bg-primary/10 rounded-full p-3">
                    <span className="text-primary font-semibold text-lg">
                      {member.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{member.name}</h3>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {member.email}
                      </div>
                      <div className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {member.phone}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Joined {new Date(member.joinDate).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={member.status === "Active" ? "default" : "secondary"}>{member.status}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {member.group} • {member.rentals} rentals
                      </span>
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
