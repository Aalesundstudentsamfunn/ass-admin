import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Plus, Package, Calendar, DollarSign, MapPin } from "lucide-react"

const equipment = [
  {
    id: 1,
    name: "Power Drill Set",
    category: "Power Tools",
    status: "Available",
    condition: "Excellent",
    location: "Warehouse A - Shelf 12",
    value: "$150",
    lastMaintenance: "2024-01-10",
    totalRentals: 45,
    currentRenter: null,
  },
  {
    id: 2,
    name: "Extension Ladder 12ft",
    category: "Ladders",
    status: "Rented",
    condition: "Good",
    location: "Warehouse B - Bay 3",
    value: "$200",
    lastMaintenance: "2023-12-15",
    totalRentals: 32,
    currentRenter: "John Smith",
  },
  {
    id: 3,
    name: "Circular Saw",
    category: "Power Tools",
    status: "Maintenance",
    condition: "Fair",
    location: "Workshop - Repair Station",
    value: "$120",
    lastMaintenance: "2024-01-12",
    totalRentals: 67,
    currentRenter: null,
  },
  {
    id: 4,
    name: "Pressure Washer",
    category: "Cleaning",
    status: "Available",
    condition: "Excellent",
    location: "Warehouse A - Floor 2",
    value: "$300",
    lastMaintenance: "2024-01-08",
    totalRentals: 28,
    currentRenter: null,
  },
]

export default function EquipmentPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-balance">Equipment</h1>
          <p className="text-muted-foreground text-pretty">Manage equipment inventory and rental status</p>
        </div>
        <Button className="bg-accent hover:bg-accent/90">
          <Plus className="mr-2 h-4 w-4" />
          Add Equipment
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        {[
          { title: "Total Items", value: "156", change: "+15%" },
          { title: "Available", value: "98", change: "+8%" },
          { title: "Currently Rented", value: "45", change: "+12%" },
          { title: "In Maintenance", value: "13", change: "-3%" },
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
              <CardTitle>Equipment Inventory</CardTitle>
              <CardDescription>All equipment items and their current status</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search equipment..." className="pl-10 w-64" />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {equipment.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-card/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="bg-primary/10 rounded-lg p-3">
                    <Package className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{item.name}</h3>
                    <p className="text-sm text-muted-foreground">{item.category}</p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {item.location}
                      </div>
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        Value: {item.value}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Last maintained: {new Date(item.lastMaintenance).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge
                        variant={
                          item.status === "Available"
                            ? "default"
                            : item.status === "Rented"
                              ? "secondary"
                              : "destructive"
                        }
                      >
                        {item.status}
                      </Badge>
                      <Badge variant="outline">{item.condition}</Badge>
                      <span className="text-xs text-muted-foreground">{item.totalRentals} total rentals</span>
                      {item.currentRenter && (
                        <span className="text-xs text-accent">Rented by {item.currentRenter}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm">
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm">
                    History
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
