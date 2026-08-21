import { QueryErrorResetBoundary } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";
import type { FallbackProps } from "react-error-boundary";

import { toConfigFetchError } from "../lib/hooks";
import { Card } from "./ui/card";

const ConfigErrorFallback = ({ error, resetErrorBoundary }: FallbackProps) => {
  const normalizedError = toConfigFetchError(error);

  return (
    <Card className="border-error/35 bg-error/6 p-fluid-sm grid gap-3">
      <div>
        <p className="text-error m-0 text-sm font-semibold">
          {normalizedError.message}
        </p>
        <p className="text-muted-foreground mt-2 mb-0 text-sm">
          サーバーが復旧したら再取得してください。
        </p>
      </div>
      <div>
        <button
          type="button"
          className="border-error/35 bg-error/10 text-error hover:bg-error/15 focus-visible:ring-error/45 cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-semibold transition focus-visible:ring-2 focus-visible:outline-none"
          onClick={resetErrorBoundary}
        >
          設定を再取得
        </button>
      </div>
    </Card>
  );
};

interface ConfigQueryBoundaryProps {
  children: ReactNode;
}

export const ConfigQueryBoundary = ({ children }: ConfigQueryBoundaryProps) => (
  <QueryErrorResetBoundary>
    {({ reset }) => (
      <ErrorBoundary onReset={reset} fallbackRender={ConfigErrorFallback}>
        {children}
      </ErrorBoundary>
    )}
  </QueryErrorResetBoundary>
);
