import { createClient } from "@/lib/supabase/server";
import DataTable from "@/app/dashboard/equipment/all/_wrapped_page";
import type { EquipmentRow, ItemTypeOption } from "@/app/dashboard/equipment/all/_wrapped_page";

/**
 * Maps raw equipment rows to the table shape.
 */
function mapToEquipmentRows(
    rows: Record<string, unknown>[],
    typeTitleById: Map<string, string>
): EquipmentRow[] {
    return rows.map((row): EquipmentRow => ({
        id: String(row.id ?? ""),
        variant: (row.variant as string | null | undefined) ?? null,
        type_label: (() => {
            const parentTypeId = String(row.parent_type ?? "");
            const title = typeTitleById.get(parentTypeId);
            const variant = String(row.variant ?? "").trim();
            if (title && variant) return `${title} (${variant})`;
            if (title) return title;
            if (variant) return variant;
            return "—";
        })(),
        itemdescription: String(row.itemdescription ?? ""),
        img_path: Array.isArray(row.img_path) ? (row.img_path as string[]) : [],
        is_rented: (row.is_rented as boolean | null | undefined) ?? false,
        is_active: (row.is_active as boolean | null | undefined) ?? true,
        parent_type: String(row.parent_type ?? ""),
        created_at: (row.created_at as string | null | undefined) ?? null,
    }));
}

/**
 * Loads equipment table data.
 */
export default async function EquipmentPage() {
    const supabase = await createClient();

    const { data, error } = await supabase
        .schema("item_schema")
        .from("item")
        .select("*")
        .order("created_at", { ascending: false });

    const { data: typeData } = await supabase
        .schema("item_schema")
        .from("item_type")
        .select("id, title");

    if (error) {
        return <div>Error: {error.message}</div>;
    }

    const typeTitleById = new Map(
        ((typeData ?? []) as Record<string, unknown>[]).map((typeRow) => [
            String(typeRow.id ?? ""),
            String(typeRow.title ?? ""),
        ])
    );

    const itemTypeOptions: ItemTypeOption[] = ((typeData ?? []) as Record<string, unknown>[]).map(
        (typeRow) => ({
            id: String(typeRow.id ?? ""),
            title: String(typeRow.title ?? ""),
        })
    );

    const rows = mapToEquipmentRows((data ?? []) as Record<string, unknown>[], typeTitleById);

    return (
        <DataTable initialData={rows} itemTypeOptions={itemTypeOptions} />
    );
}
