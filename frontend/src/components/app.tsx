import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Activity, Suspense, useCallback, useRef, useState } from "react";
import * as z from "zod";

import { useSearchParamsState } from "../lib/hooks";
import { BuildForm, BuildFormSkeleton } from "./build/build-form";
import { ConfigQueryBoundary } from "./config-query-boundary";
import { ExtractForm, ExtractFormSkeleton } from "./extract/extract-form";
import { PrivacyDialog } from "./privacy-dialog";
import { TermsDialog } from "./terms-dialog";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

const modeSchema = z.enum(["build", "extract"]);

export const App = () => {
  const [queryClient] = useState(() => new QueryClient());
  const [mode, setMode] = useSearchParamsState("mode", modeSchema, "build");
  const termsDialogRef = useRef<HTMLDialogElement>(null);
  const privacyDialogRef = useRef<HTMLDialogElement>(null);

  const handleBuildMode = useCallback(() => setMode("build"), [setMode]);
  const handleExtractMode = useCallback(() => setMode("extract"), [setMode]);
  const handleOpenTerms = useCallback(() => {
    const dialog = termsDialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  }, []);
  const handleOpenPrivacy = useCallback(() => {
    const dialog = privacyDialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex min-h-dvh flex-col">
        <main className="mx-auto my-10 grid w-content flex-1 content-start gap-5 max-md:my-4 max-md:w-content-sm">
          <header>
            <Card className="animate-rise p-fluid">
              <Badge>EPUB Web</Badge>
              <h1 className="mt-2 mb-3 text-hero">
                画像をEPUBに、EPUBを画像に変換
              </h1>
              <p className="m-0 leading-7">
                画像ファイルからEPUBを作成したり、EPUBに含まれる画像をまとめて取り出したりできます。変換はサーバー側で処理され、結果はそのままダウンロードできます。
              </p>
            </Card>
          </header>

          <div
            className="grid grid-cols-2 gap-2"
            role="tablist"
            aria-label="変換モード"
          >
            <Button
              id="tab-build"
              type="button"
              variant="tab"
              active={mode === "build"}
              onClick={handleBuildMode}
              role="tab"
              aria-selected={mode === "build"}
              aria-controls="panel-build"
              tabIndex={mode === "build" ? 0 : -1}
            >
              画像からEPUB
            </Button>
            <Button
              id="tab-extract"
              type="button"
              variant="tab"
              active={mode === "extract"}
              onClick={handleExtractMode}
              role="tab"
              aria-selected={mode === "extract"}
              aria-controls="panel-extract"
              tabIndex={mode === "extract" ? 0 : -1}
            >
              EPUBから画像
            </Button>
          </div>

          <div
            id="panel-build"
            className="min-w-0"
            role="tabpanel"
            aria-labelledby="tab-build"
            hidden={mode !== "build"}
            tabIndex={0}
          >
            <Activity mode={mode === "build" ? "visible" : "hidden"}>
              <ConfigQueryBoundary>
                <Suspense fallback={<BuildFormSkeleton />}>
                  <BuildForm />
                </Suspense>
              </ConfigQueryBoundary>
            </Activity>
          </div>

          <div
            id="panel-extract"
            className="min-w-0"
            role="tabpanel"
            aria-labelledby="tab-extract"
            hidden={mode !== "extract"}
            tabIndex={0}
          >
            <Activity mode={mode === "extract" ? "visible" : "hidden"}>
              <ConfigQueryBoundary>
                <Suspense fallback={<ExtractFormSkeleton />}>
                  <ExtractForm />
                </Suspense>
              </ConfigQueryBoundary>
            </Activity>
          </div>

          <TermsDialog dialogRef={termsDialogRef} />
          <PrivacyDialog dialogRef={privacyDialogRef} />
        </main>

        <footer className="pb-4">
          <div className="mx-auto w-content rounded-2xl border border-primary/15 bg-card-surface px-4 py-4 text-sm text-muted-foreground max-md:w-content-sm">
            <p className="m-0 leading-6">
              このアプリは
              <a
                className="font-semibold text-primary underline underline-offset-4"
                href="https://pkg.go.dev/github.com/publira/epub"
                rel="noopener noreferrer"
                target="_blank"
              >
                github.com/publira/epub
              </a>
              のデモWebアプリです。
            </p>
            <p className="mt-2 mb-0 leading-6">
              本サービスの利用をもって、利用規約およびプライバシーポリシーに同意したものとみなします。
            </p>
            <div className="mt-3 flex flex-wrap justify-end gap-3">
              <a
                className="cursor-pointer text-sm font-semibold text-primary underline underline-offset-4"
                href="https://github.com/publira/epub-web"
                rel="noopener noreferrer"
                target="_blank"
              >
                ソースコード
              </a>
              <button
                className="cursor-pointer text-sm font-semibold text-primary underline underline-offset-4"
                onClick={handleOpenTerms}
                type="button"
              >
                利用規約
              </button>
              <button
                className="cursor-pointer text-sm font-semibold text-primary underline underline-offset-4"
                onClick={handleOpenPrivacy}
                type="button"
              >
                プライバシーポリシー
              </button>
            </div>
          </div>
        </footer>
      </div>
    </QueryClientProvider>
  );
};
