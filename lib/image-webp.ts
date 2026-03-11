/**
 * Next.js-compatible image upload and conversion utilities.
 * Uses server-side sharp processing via API route.
 */

export type UploadImageOptions = {
  itemId?: string;
  oldImagePath?: string | null;
};

export type UploadImageResult = {
  success: boolean;
  imagePath?: string;
  error?: string;
};

/**
 * Uploads an image file to the server, which will:
 * 1. Convert it to WebP format using sharp
 * 2. Resize to max 1920x1920 (preserving aspect ratio)
 * 3. Rename old image to "(old)" if it exists
 * 4. Upload to Supabase storage
 * 5. Optionally update the item in database
 * 
 * @param file - The image file to upload
 * @param options - Optional itemId and oldImagePath
 * @returns Result with success status and new image path
 */
export async function uploadAndConvertImage(
  file: File,
  options: UploadImageOptions = {}
): Promise<UploadImageResult> {
  try {
    // Validate file type
    if (!file.type.startsWith("image/")) {
      return {
        success: false,
        error: "Kun bildefiler er tillatt",
      };
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return {
        success: false,
        error: "Bildet er for stort (maks 10MB)",
      };
    }

    const formData = new FormData();
    formData.append("file", file);
    
    if (options.itemId) {
      formData.append("itemId", options.itemId);
    }
    
    if (options.oldImagePath) {
      formData.append("oldImagePath", options.oldImagePath);
    }

    const response = await fetch("/api/equipment/upload-image", {
      method: "POST",
      body: formData,
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: result.error || "Bildeopplasting feilet",
      };
    }

    return {
      success: true,
      imagePath: result.imagePath,
    };
  } catch (error) {
    console.error("Error uploading image:", error);
    return {
      success: false,
      error: "En uventet feil oppstod ved bildeopplasting",
    };
  }
}

/**
 * Creates a preview URL for a selected file.
 * Use this to show a preview before uploading.
 */
export function createImagePreview(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      resolve(e.target?.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
