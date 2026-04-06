import { QueryErrorResetBoundary } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";
import type { FallbackProps } from "react-error-boundary";

import { toConfigFetchError } from "../lib/hooks";
import { Card } from "./ui/card";

const ConfigErrorFallback = ({ error, resetErrorBoundary }: FallbackProps) => {
  const normalizedError = toConfigFetchError(error);

  return (
    <Card className="grid gap-3 border-error/35 bg-error/6 p-fluid-sm">
      <div>
        <p className="m-0 text-sm font-semibold text-error">
          {normalizedError.message}
        </p>
        <p className="mt-2 mb-0 text-sm text-muted-foreground">
          サーバーが復旧したら再取得してください。
        </p>
      </div>
      <div>
        <button
          type="button"
          className="cursor-pointer rounded-lg border border-error/35 bg-error/10 px-3 py-1.5 text-xs font-semibold text-error transition hover:bg-error/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/45"
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
