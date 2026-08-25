import { useEffect, useRef, useState } from "react";

import { buildFileKey } from "#lib/build";
import { formatLastModified } from "#lib/format";
import type { ImagePreview } from "./image-preview-cards";

export const useBuildImagePreviews = (buildFiles: File[]): ImagePreview[] => {
  const objectUrlCacheRef = useRef<Map<string, string>>(new Map());
  const [imagePreviews, setImagePreviews] = useState<ImagePreview[]>([]);

  useEffect(() => {
    const cache = objectUrlCacheRef.current;
    const activeKeys = new Set<string>();

    const previews = buildFiles.map((file, index) => {
      const key = buildFileKey(file);
      activeKeys.add(key);

      let url = cache.get(key);
      if (!url) {
        url = URL.createObjectURL(file);
        cache.set(key, url);
      }

      return {
        id: `${key}:${index}`,
        index,
        lastModifiedLabel: formatLastModified(file.lastModified),
        mimeType: file.type,
        name: file.name,
        url,
      };
    });

    for (const [key, url] of cache) {
      if (!activeKeys.has(key)) {
        URL.revokeObjectURL(url);
        cache.delete(key);
      }
    }

    setImagePreviews(previews);
  }, [buildFiles]);

  useEffect(() => {
    const cache = objectUrlCacheRef.current;
    return () => {
      for (const url of cache.values()) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  return imagePreviews;
};
