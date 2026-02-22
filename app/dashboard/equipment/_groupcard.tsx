/**
 * Dashboard client wrapper/presentation module.
 */
import { Card, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface GroupCardProps {
    id: number;
    name: string;
    description: string;
    group_leader: string;
    eq_ammount: number;
}

export default function GroupCard(GroupCardProps: GroupCardProps) {
    return (
        <div>
            <Card className="min-h-40 p-3">
                <CardTitle>{GroupCardProps.name}</CardTitle>
                <CardDescription className="max-w-80 mb-4">{GroupCardProps.description || "ingen beskrivelse"} har for øyeblikket ansvaret for ca {GroupCardProps.eq_ammount} enheter med utstyr og den nåværende lederen er {GroupCardProps.group_leader}.</CardDescription>
                <CardContent><Link href={`/dashboard/equipment/by-group/${GroupCardProps.id}`}><Button variant="outline">Se {GroupCardProps.name} sitt utstyr</Button></Link></CardContent>
            </Card>
        </div>
    );
}