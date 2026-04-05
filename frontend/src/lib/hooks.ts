import { useSuspenseQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
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
