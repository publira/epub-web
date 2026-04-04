import { useSuspenseQuery } from "@tanstack/react-query";

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
