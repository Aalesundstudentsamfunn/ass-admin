import { NextRequest, NextResponse } from "next/server";
import { assertPermission } from "@/lib/server/assert-permission";

const ALLOWED_UPDATE_FIELDS = new Set(["variant", "itemdescription", "is_active"]);

export async function POST(request: NextRequest) {
    try {
        const permission = await assertPermission({ requirement: "dashboardAccess" });
        if (!permission.ok) {
            return permission.response;
        }
        const { supabase } = permission;

        const body = await request.json();
        const { itemId, updates } = body;

        if (!itemId) {
            return NextResponse.json(
                { error: "Item ID er påkrevd" },
                { status: 400 }
            );
        }

        if (!updates || Object.keys(updates).length === 0) {
            return NextResponse.json(
                { error: "Ingen endringer å lagre" },
                { status: 400 }
            );
        }

        const sanitizedUpdates = Object.fromEntries(
            Object.entries(updates).filter(([key]) => ALLOWED_UPDATE_FIELDS.has(key))
        );

        if (Object.keys(sanitizedUpdates).length === 0) {
            return NextResponse.json(
                { error: "Ingen gyldige felter å oppdatere" },
                { status: 400 }
            );
        }

        const { error } = await supabase
            .schema("item_schema")
            .from("item")
            .update(sanitizedUpdates)
            .eq("id", itemId);

        if (error) {
            console.error("Error updating item:", error);
            return NextResponse.json(
                { error: `Feil ved oppdatering: ${error.message}` },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
        });
    } catch (error) {
        console.error("Error updating equipment:", error);
        return NextResponse.json(
            { error: "En uventet feil oppstod" },
            { status: 500 }
        );
    }
}
