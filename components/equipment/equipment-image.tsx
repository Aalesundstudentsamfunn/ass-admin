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
  if (!imgPath) {
    return PLACEHOLDER_SRC;
  }

  if (/^https?:\/\//i.test(imgPath)) {
    return imgPath;
  }

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!baseUrl) {
    return PLACEHOLDER_SRC;
  }

  const normalizedBucketPath = bucketPath.replace(/^\/+|\/+$/g, "");
  let normalizedPath = imgPath.replace(/^\/+/, "");
  if (normalizedPath.startsWith(`${normalizedBucketPath}/`)) {
    normalizedPath = normalizedPath.slice(normalizedBucketPath.length + 1);
  }

  const hasExtension = /\.[a-z0-9]{2,8}$/i.test(
    normalizedPath.split("/").pop() ?? "",
  );
  const normalizedType =
    imgType?.trim().replace(/^image\//i, "").replace(/^\./, "") || "webp";

  const encodedPath = normalizedPath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");

  const suffix = hasExtension ? "" : `.${encodeURIComponent(normalizedType)}`;
  return `${baseUrl}/storage/v1/object/public/${normalizedBucketPath}/${encodedPath}${suffix}`;
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
      unoptimized={src !== PLACEHOLDER_SRC}
      onError={() => {
        if (src !== PLACEHOLDER_SRC) {
          setSrc(PLACEHOLDER_SRC);
        }
      }}
    />
  );
}
