import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();

        // Check authentication
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const formData = await request.formData();
        const file = formData.get("file") as File;
        const itemId = formData.get("itemId") as string;
        const oldImagePath = formData.get("oldImagePath") as string | null;

        if (!file) {
            return NextResponse.json(
                { error: "Ingen fil lastet opp" },
                { status: 400 }
            );
        }

        if (!itemId) {
            return NextResponse.json(
                { error: "Item ID er påkrevd" },
                { status: 400 }
            );
        }

        // Fetch item to determine bucket
        const { data: item, error: itemError } = await supabase
            .schema("item_schema")
            .from("item")
            .select("id, parent_type")
            .eq("id", itemId)
            .single();

        if (itemError) {
            console.error("Error fetching item:", itemError);
            return NextResponse.json(
                { error: `Kunne ikke finne utstyr: ${itemError.message}` },
                { status: 404 }
            );
        }

        if (!item) {
            return NextResponse.json(
                { error: "Utstyr ikke funnet (ingen data returnert)" },
                { status: 404 }
            );
        }

        // Fetch item_type to get activity group
        let groupFolderName = null;
        if (item.parent_type) {
            const { data: itemType } = await supabase
                .schema("item_schema")
                .from("item_type")
                .select("responsible_activity_group")
                .eq("id", item.parent_type)
                .single();
            
            if (itemType?.responsible_activity_group) {
                // Fetch activity group to get folder name
                const { data: activityGroup } = await supabase
                    .from("activity_group")
                    .select("img_folder")
                    .eq("id", itemType.responsible_activity_group)
                    .single();
                
                // Use img_folder field as folder name (e.g., "Surf", "Dykking")
                groupFolderName = activityGroup?.img_folder?.trim();
            }
        }

        if (!groupFolderName) {
            return NextResponse.json(
                { error: "Kunne ikke finne gruppemappe for dette utstyret" },
                { status: 400 }
            );
        }

        // Determine bucket and folder structure
        // Bucket: items, Folder: img_folder from activity_group (e.g., "Surf")
        const bucketName = "items";
        
        // Create folder structure: img_folder/filename.webp
        const folderPrefix = `${groupFolderName}/`;

        // Convert file to buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Convert to WebP using sharp
        const webpBuffer = await sharp(buffer)
            .resize(1920, 1920, {
                fit: "inside",
                withoutEnlargement: true,
            })
            .webp({ quality: 85 })
            .toBuffer();

        // Generate new filename with group folder
        const fileName = `${Date.now()}-${crypto.randomUUID()}.webp`;
        const storagePath = `${folderPrefix}${fileName}`;

        // Use admin client for storage operations to bypass RLS
        const adminSupabase = createAdminClient();

        // Handle old image if exists
        if (oldImagePath) {
            try {
                // Path format in DB: "Surf/Surfebrett_blå.webp"
                const oldFileName = oldImagePath.split("/").pop();
                const oldFileNameWithoutExt = oldFileName?.replace(/\.[^/.]+$/, "");
                
                if (oldFileNameWithoutExt && oldFileName) {
                    // Rename old file by moving it
                    const newOldPath = oldImagePath.replace(oldFileName, oldFileNameWithoutExt + " (old).webp");
                    
                    // Download old file
                    const { data: oldFile } = await adminSupabase.storage
                        .from(bucketName)
                        .download(oldImagePath);

                    if (oldFile) {
                        // Upload with new name
                        await adminSupabase.storage
                            .from(bucketName)
                            .upload(newOldPath, oldFile, {
                                upsert: true,
                            });

                        // Delete original
                        await adminSupabase.storage
                            .from(bucketName)
                            .remove([oldImagePath]);
                    }
                }
            } catch (error) {
                console.error("Error handling old image:", error);
                // Continue even if old image handling fails
            }
        }

        // Upload new WebP image using admin client
        const { error: uploadError } = await adminSupabase.storage
            .from(bucketName)
            .upload(storagePath, webpBuffer, {
                contentType: "image/webp",
                upsert: false,
            });

        if (uploadError) {
            return NextResponse.json(
                { error: `Opplasting feilet: ${uploadError.message}` },
                { status: 500 }
            );
        }

        // Format for DB: "Surf/filename.webp" (without bucket prefix)
        const newImagePath = storagePath;

        // Update item in database
        const { error: updateError } = await supabase
            .schema("item_schema")
            .from("item")
            .update({ img_path: [newImagePath] })
            .eq("id", itemId);

        if (updateError) {
            console.error("Error updating item:", updateError);
            return NextResponse.json(
                { error: `Databaseoppdatering feilet: ${updateError.message}` },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            imagePath: newImagePath,
            bucketName: bucketName,
            groupFolder: groupFolderName,
        });
    } catch (error) {
        console.error("Error uploading image:", error);
        return NextResponse.json(
            { error: "En uventet feil oppstod" },
            { status: 500 }
        );
    }
}
