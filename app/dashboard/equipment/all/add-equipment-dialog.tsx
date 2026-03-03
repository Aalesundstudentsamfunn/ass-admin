"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addNewEquipment } from "@/lib/equipment/client-actions";

type ImagePreview = {
    file: File;
    preview: string;
};

export function AddEquipmentDialog({
    open,
    onOpenChange,
    itemTypeOptions,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    itemTypeOptions: { id: string; title: string }[];
}) {
    const router = useRouter();
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [imagePreviews, setImagePreviews] = React.useState<ImagePreview[]>([]);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;

        const newPreviews: ImagePreview[] = [];

        for (const file of files) {
            // Validate file type
            if (!file.type.includes("webp")) {
                setError("Kun WEBP-bilder er tillatt");
                return;
            }

            // Validate file size
            if (file.size > 5 * 1024 * 1024) {
                setError("Bildet er for stort (maks 5MB)");
                return;
            }

            // Create preview
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreviews((prev) => [
                    ...prev,
                    {
                        file,
                        preview: reader.result as string,
                    },
                ]);
            };
            reader.readAsDataURL(file);
        }

        setError(null);
        // Clear the input so the same file can be selected again
        e.target.value = "";
    };

    const removeImage = (index: number) => {
        setImagePreviews((prev) => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const formData = new FormData(e.currentTarget);

            // Add all images
            for (const preview of imagePreviews) {
                formData.append("images", preview.file);
            }

            const result = await addNewEquipment(formData);

            if (!result.success) {
                setError(result.error || "En feil oppstod");
                return;
            }

            // Reset form
            e.currentTarget.reset();
            setImagePreviews([]);
            setError(null);
            onOpenChange(false);
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "En feil oppstod");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Legg til nytt utstyr</DialogTitle>
                    <DialogDescription>Fyll ut informasjonen om det nye utstyret</DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="variant">Type *</Label>
                        <Input
                            id="variant"
                            name="variant"
                            placeholder="f.eks. Projektor"
                            required
                            disabled={isLoading}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="parent_type">Kategori *</Label>
                        <select
                            id="parent_type"
                            name="parent_type"
                            required
                            disabled={isLoading}
                            className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                            defaultValue=""
                            title="Velg kategori"
                        >
                            <option value="" disabled>
                                Velg kategori
                            </option>
                            {itemTypeOptions.map((itemType) => (
                                <option key={itemType.id} value={itemType.id}>
                                    {itemType.title}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="itemdescription">Beskrivelse</Label>
                        <Input
                            id="itemdescription"
                            name="itemdescription"
                            placeholder="f.eks. 1080p projektor"
                            disabled={isLoading}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="images">Bilder (WEBP kun)</Label>
                        <div className="flex flex-col gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isLoading}
                                className="w-full"
                            >
                                <Upload className="mr-2 h-4 w-4" />
                                Velg bilder
                            </Button>
                            <input
                                ref={fileInputRef}
                                id="images"
                                name="images"
                                type="file"
                                accept=".webp"
                                multiple
                                onChange={handleImageChange}
                                className="hidden"
                                disabled={isLoading}
                            />
                            {imagePreviews.length > 0 && (
                                <div className="text-sm text-muted-foreground">
                                    {imagePreviews.length} bilde{imagePreviews.length !== 1 ? "r" : ""} valgt
                                </div>
                            )}
                            {imagePreviews.length > 0 && (
                                <div className="grid grid-cols-3 gap-2">
                                    {imagePreviews.map((preview, index) => (
                                        <div key={index} className="relative">
                                            <img
                                                src={preview.preview}
                                                alt={`Preview ${index + 1}`}
                                                className="h-24 w-24 rounded-lg object-cover"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removeImage(index)}
                                                className="absolute top-1 right-1 rounded-full bg-red-500 p-1 text-white hover:bg-red-600"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

                    <div className="flex gap-2 justify-end pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isLoading}
                        >
                            Avbryt
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? "Legger til..." : "Legg til"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
