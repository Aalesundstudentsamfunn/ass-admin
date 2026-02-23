"use client";

import * as React from "react";
import Image from "next/image";

const PLACEHOLDER_SRC = "/images/equipment-placeholder.webp";

type EquipmentImageProps = {
  imgPath?: string | null;
  imgType?: string | null;
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
  imgPath?: string | null,
  imgType?: string | null,
  bucketPath = "items",
) {
  if (!imgPath || !imgType) {
    return PLACEHOLDER_SRC;
  }
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!baseUrl) {
    return PLACEHOLDER_SRC;
  }

  const normalizedBucketPath = bucketPath.replace(/^\/+|\/+$/g, "");
  return `${baseUrl}/storage/v1/object/public/${normalizedBucketPath}/${imgPath}.${imgType}`;
}

/**
 * Equipment image with safe fallback.
 *
 * Shows local placeholder when:
 * - image path/type is missing
 * - configured remote URL fails to load
 */
export function EquipmentImage({
  imgPath,
  imgType,
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
    buildEquipmentImageUrl(imgPath, imgType, bucketPath),
  );

  React.useEffect(() => {
    setSrc(buildEquipmentImageUrl(imgPath, imgType, bucketPath));
  }, [imgPath, imgType, bucketPath]);

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
      onError={() => {
        if (src !== PLACEHOLDER_SRC) {
          setSrc(PLACEHOLDER_SRC);
        }
      }}
    />
  );
}

