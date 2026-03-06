"use client";

import * as React from "react";
import Image from "next/image";

const PLACEHOLDER_SRC = "/images/equipment-placeholder.webp";

type EquipmentImageProps = {
  imgPath?: string[] | string | null;
  alt: string;
  bucketPath?: string;
  className?: string;
  sizes?: string;
  fill?: boolean;
  width?: number;
  height?: number;
  priority?: boolean;
};

function buildEquipmentImageUrl(
  imgPath?: string[] | string | null,
  bucketPath = "items",
) {
  // Handle array - use first image
  const pathString = Array.isArray(imgPath) ? imgPath[0] : imgPath;
  
  if (!pathString) {
    return PLACEHOLDER_SRC;
  }

  if (/^https?:\/\//i.test(pathString)) {
    return pathString;
  }

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  
  if (!baseUrl) {
    return PLACEHOLDER_SRC;
  }

  return `${baseUrl}/storage/v1/object/public/${bucketPath}/${pathString}`;
}

/**
 * Equipment image with safe fallback.
 *
 * Shows local placeholder when:
 * - image path is missing
 * - configured remote URL fails to load
 */
export function EquipmentImage({
  imgPath,
  alt,
  bucketPath = "items",
  className,
  sizes,
  fill,
  width,
  height,
  priority,
}: EquipmentImageProps) {
  const [src, setSrc] = React.useState(() =>
    buildEquipmentImageUrl(imgPath, bucketPath),
  );

  React.useEffect(() => {
    setSrc(buildEquipmentImageUrl(imgPath, bucketPath));
  }, [imgPath, bucketPath]);

  return (
    <Image
      src={src}
      alt={alt}
      className={className}
      sizes={sizes}
      fill={fill}
      width={width}
      height={height}
      priority={priority}
      unoptimized={src !== PLACEHOLDER_SRC}
      onError={() => {
        if (src !== PLACEHOLDER_SRC) {
          setSrc(PLACEHOLDER_SRC);
        }
      }}
    />
  );
}
