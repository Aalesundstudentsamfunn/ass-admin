"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2, Plus } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "../../../../components/table/data-table";
import { AddEquipmentDialog } from "./add-equipment-dialog";
import { deleteEquipment } from "@/lib/equipment/client-actions";

export type EquipmentRow = {
    id: string;
    variant: string | null;
    type_label: string;
    itemdescription: string;
    img_path: string[];
    is_rented: boolean;
    is_active: boolean;
    parent_type: string;
    created_at: string | null;
};

export type ItemTypeOption = {
    id: string;
    title: string;
};

/**
 * Builds equipment table columns.
 */
function buildColumns({
    onDelete,
    isDeleting,
}: {
    onDelete: (id: string) => Promise<void>;
    isDeleting: boolean;
}): ColumnDef<EquipmentRow, unknown>[] {
    return [
        {
            accessorKey: "type_label",
            header: "Type",
            cell: ({ row }) => <span className="font-medium">{row.original.type_label}</span>,
        },
        {
            accessorKey: "itemdescription",
            header: "Beskrivelse",
            cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.itemdescription}</span>,
        },
        {
            accessorKey: "is_rented",
            header: "Utleid",
            cell: ({ row }) => (
                <span className={`text-sm font-medium ${row.original.is_rented ? "text-red-600" : "text-green-600"}`}>
                    {row.original.is_rented ? "Ja" : "Nei"}
                </span>
            ),
        },
        {
            accessorKey: "is_active",
            header: "Aktiv",
            cell: ({ row }) => (
                <span className={`text-sm font-medium ${row.original.is_active ? "text-green-600" : "text-gray-600"}`}>
                    {row.original.is_active ? "Ja" : "Nei"}
                </span>
            ),
        },
        {
            accessorKey: "img_path",
            header: "Bilder",
            cell: ({ row }) => (
                <span className="text-sm font-medium">
                    {row.original.img_path.length > 0 ? `${row.original.img_path.length}` : "—"}
                </span>
            ),
        },
        {
            id: "actions",
            header: () => <span className="sr-only">Handlinger</span>,
            cell: ({ row }) => {
                const equipment = row.original as EquipmentRow;
                return (
                    <div className="flex items-center justify-end gap-2">
                        <Button
                            variant="destructive"
                            size="sm"
                            className="rounded-lg"
                            disabled={isDeleting}
                            onClick={async (event) => {
                                event.stopPropagation();
                                await onDelete(equipment.id);
                            }}
                        >
                            <Trash2 className="mr-1 h-4 w-4" /> {isDeleting ? "Sletter..." : "Slett"}
                        </Button>
                    </div>
                );
            },
            enableHiding: false,
        },
    ];
}

/**
 * Client container for the equipment page.
 */
export default function EquipmentTablePage({
    initialData,
    itemTypeOptions,
}: {
    initialData: EquipmentRow[];
    itemTypeOptions: ItemTypeOption[];
}) {
    const router = useRouter();
    const [rows, setRows] = React.useState<EquipmentRow[]>(initialData);
    const [isDeleting, setIsDeleting] = React.useState(false);
    const [addDialogOpen, setAddDialogOpen] = React.useState(false);

    React.useEffect(() => {
        setRows(initialData);
    }, [initialData]);

    const handleDeleteEquipment = React.useCallback(
        async (id: string) => {
            if (!confirm("Er du sikker på at du vil slette dette utstyret?")) {
                return;
            }

            setIsDeleting(true);
            try {
                const result = await deleteEquipment(id);
                if (!result.success) {
                    alert(`Feil: ${result.error}`);
                } else {
                    setRows((prev) => prev.filter((row) => row.id !== id));
                    router.refresh();
                }
            } finally {
                setIsDeleting(false);
            }
        },
        [router]
    );

    const columns = React.useMemo(
        () =>
            buildColumns({
                onDelete: handleDeleteEquipment,
                isDeleting,
            }),
        [handleDeleteEquipment, isDeleting]
    );

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-balance">Utstyr</h1>
                <p className="text-muted-foreground text-pretty">Administrer utstyr og inventar</p>
            </div>

            <Card className="border-0 bg-transparent shadow-none">
                <CardHeader className="px-0 pt-0 flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Oversikt</CardTitle>
                        <CardDescription>Sorter, filtrer og håndter utstyr</CardDescription>
                    </div>
                    <Button onClick={() => setAddDialogOpen(true)} className="rounded-lg">
                        <Plus className="mr-2 h-4 w-4" />
                        Legg til utstyr
                    </Button>
                </CardHeader>
                <CardContent className="px-0">
                    <DataTable columns={columns} data={rows} />
                </CardContent>
            </Card>

            <AddEquipmentDialog
                open={addDialogOpen}
                onOpenChange={setAddDialogOpen}
                itemTypeOptions={itemTypeOptions}
            />
        </div>
    );
}
