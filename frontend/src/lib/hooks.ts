import { useSuspenseQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import type * as z from "zod";

import { configSchema } from "./mutations";

export const useAppConfig = () =>
  useSuspenseQuery({
    queryFn: async () => {
      const res = await fetch("/api/config");
      if (!res.ok) {
        throw new Error("Failed to fetch config");
      }

      return configSchema.parse(await res.json());
    },
    queryKey: ["config"],
    staleTime: Infinity,
  });

export const useSearchParamsState = <T extends string>(
  key: string,
  schema: z.ZodType<T>,
  defaultValue: T
): [T, (newValue: T) => void] => {
  const [state, setState] = useState<T>(() => {
    if (typeof window === "undefined") {
      return defaultValue;
    }

    const params = new URLSearchParams(window.location.search);
    const value = params.get(key);

    const result = schema.safeParse(value);

    return result.success ? result.data : defaultValue;
  });

  const setParamState = useCallback(
    (newValue: T) => {
      setState(newValue);

      const url = new URL(window.location.href);

      if (newValue === defaultValue) {
        url.searchParams.delete(key);
      } else {
        url.searchParams.set(key, newValue);
      }

      window.history.replaceState(null, "", url.toString());
    },
    [key, defaultValue]
  );

  return [state, setParamState];
};

export const useDrop = (
  onDropFiles: (files: readonly File[]) => void,
  disabled = false
): {
  isDragOver: boolean;
  dragProps: {
    onDragEnter: React.DragEventHandler<HTMLDivElement>;
    onDragLeave: React.DragEventHandler<HTMLDivElement>;
    onDragOver: React.DragEventHandler<HTMLDivElement>;
    onDrop: React.DragEventHandler<HTMLDivElement>;
  };
} => {
  const [isDragOver, setIsDragOver] = useState(false);
  const dragDepthRef = useRef(0);

  const onDragOver = useCallback<React.DragEventHandler<HTMLDivElement>>(
    (event) => {
      event.preventDefault();
      if (disabled) {
        return;
      }

      if (!isDragOver) {
        setIsDragOver(true);
      }
    },
    [disabled, isDragOver]
  );

  const onDragEnter = useCallback<React.DragEventHandler<HTMLDivElement>>(
    (event) => {
      event.preventDefault();
      if (disabled) {
        return;
      }

      dragDepthRef.current += 1;
      if (!isDragOver) {
        setIsDragOver(true);
      }
    },
    [disabled, isDragOver]
  );

  const onDragLeave = useCallback<React.DragEventHandler<HTMLDivElement>>(
    (event) => {
      event.preventDefault();
      if (disabled) {
        return;
      }

      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) {
        setIsDragOver(false);
      }
    },
    [disabled]
  );

  const onDrop = useCallback<React.DragEventHandler<HTMLDivElement>>(
    (event) => {
      event.preventDefault();
      dragDepthRef.current = 0;
      setIsDragOver(false);
      if (disabled) {
        return;
      }

      onDropFiles([...(event.dataTransfer.files ?? [])]);
    },
    [disabled, onDropFiles]
  );

  useEffect(() => {
    if (!disabled) {
      return;
    }
    dragDepthRef.current = 0;
    setIsDragOver(false);
  }, [disabled]);

  return {
    dragProps: {
      onDragEnter,
      onDragLeave,
      onDragOver,
      onDrop,
    },
    isDragOver,
  };
};
