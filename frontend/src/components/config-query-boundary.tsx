import { QueryErrorResetBoundary } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";
import type { FallbackProps } from "react-error-boundary";
import { FormattedMessage, useIntl } from "react-intl";

import { getConfigFetchErrorMessage } from "#lib/hooks";

import { Button } from "./ui/button";
import { Card } from "./ui/card";

const ConfigErrorFallback = ({ error, resetErrorBoundary }: FallbackProps) => {
  const intl = useIntl();

  return (
    <Card className="grid gap-3 border-destructive/30 bg-destructive/10 p-fluid-sm">
      <div>
        <p className="m-0 text-sm font-medium text-destructive">
          {getConfigFetchErrorMessage(intl, error)}
        </p>
        <p className="mt-2 mb-0 text-sm text-muted-foreground">
          <FormattedMessage id="config.retryHint" />
        </p>
      </div>
      <div>
        <Button size="sm" variant="destructive" onClick={resetErrorBoundary}>
          <FormattedMessage id="config.retry" />
        </Button>
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
