"use client";

import { createClient } from "@/lib/supabase/client";
import type {
    AddEquipmentActionResult,
    DeleteEquipmentActionResult,
} from "@/lib/equipment/actions-types";

/**
 * Adds a new equipment item from the client.
 */
export async function addNewEquipment(
    formData: FormData,
): Promise<AddEquipmentActionResult> {
    try {
        const supabase = createClient();

        const variant = String(formData.get("variant") ?? "").trim();
        const itemdescription = String(formData.get("itemdescription") ?? "").trim();
        const parentTypeRaw = String(formData.get("parent_type") ?? "").trim();
        const images = formData.getAll("images") as File[];

        if (!variant || !parentTypeRaw) {
            return { success: false, error: "Type og kategori er påkrevd" };
        }

        const parent_type = Number.parseInt(parentTypeRaw, 10);
        if (!Number.isInteger(parent_type) || parent_type <= 0) {
            return { success: false, error: "Ugyldig kategori" };
        }

        const img_paths: string[] = [];
        for (const image of images) {
            if (!(image instanceof File) || image.size === 0) continue;
            if (!image.type.includes("webp")) {
                return { success: false, error: "Kun WEBP-bilder er tillatt" };
            }
            if (image.size > 5 * 1024 * 1024) {
                return { success: false, error: "Bildet er for stort (maks 5MB)" };
            }

            const fileName = `${Date.now()}-${crypto.randomUUID()}.webp`;
            const storagePath = `public/${fileName}`;
            const { error: uploadError } = await supabase.storage
                .from("equipment-images")
                .upload(storagePath, image);

            if (uploadError) {
                return { success: false, error: `Bildelast feilet: ${uploadError.message}` };
            }

            img_paths.push(`equipment-images/${storagePath}`);
        }

        const { error } = await supabase
            .schema("item_schema")
            .from("item")
            .insert({
                variant,
                itemdescription: itemdescription || null,
                parent_type,
                img_path: img_paths.length ? img_paths : null,
                is_active: true,
                is_rented: false,
            });

        if (error) {
            return { success: false, error: `Databasefeil: ${error.message}` };
        }

        return { success: true };
    } catch (error) {
        console.error("Error adding equipment:", error);
        return { success: false, error: "En uventet feil oppstod" };
    }
}

/**
 * Deletes an equipment item from the client.
 */
export async function deleteEquipment(
    id: string,
): Promise<DeleteEquipmentActionResult> {
    try {
        const supabase = createClient();

        if (!id) {
            return { success: false, error: "ID er påkrevd" };
        }

        const { data: item, error: getError } = await supabase
            .schema("item_schema")
            .from("item")
            .select("img_path")
            .eq("id", id)
            .single();

        if (getError) {
            return { success: false, error: "Kunne ikke finne utstyret" };
        }

        if (item?.img_path && Array.isArray(item.img_path) && item.img_path.length > 0) {
            const filesToDelete = item.img_path.map((path: string) =>
                path.replace("equipment-images/", ""),
            );
            await supabase.storage.from("equipment-images").remove(filesToDelete);
        }

        const { error: deleteError } = await supabase
            .schema("item_schema")
            .from("item")
            .delete()
            .eq("id", id);

        if (deleteError) {
            return { success: false, error: `Databasefeil: ${deleteError.message}` };
        }

        return { success: true };
    } catch (error) {
        console.error("Error deleting equipment:", error);
        return { success: false, error: "En uventet feil oppstod" };
    }
}
