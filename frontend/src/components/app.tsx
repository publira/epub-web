import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Activity, Suspense, useCallback, useEffect, useRef } from "react";
import * as z from "zod";

import { useSearchParamsState } from "../lib/hooks";
import { BuildForm, BuildFormSkeleton } from "./build-form";
import { ExtractForm, ExtractFormSkeleton } from "./extract-form";
import { PrivacyDialog } from "./privacy-dialog";
import { TermsDialog } from "./terms-dialog";
import { Badge, Card, TabButton } from "./ui/primitives";

const modeSchema = z.enum(["build", "extract"]);

export const App = () => {
  const queryClient = new QueryClient();
  const [mode, setMode] = useSearchParamsState("mode", modeSchema, "build");
  const termsDialogRef = useRef<HTMLDialogElement>(null);
  const privacyDialogRef = useRef<HTMLDialogElement>(null);

  const lockBodyScroll = useCallback(() => {
    document.body.style.overflow = "hidden";
  }, []);
  const unlockBodyScroll = useCallback(() => {
    const isAnyDialogOpen =
      termsDialogRef.current?.open || privacyDialogRef.current?.open;
    if (!isAnyDialogOpen) {
      document.body.style.overflow = "";
    }
  }, []);

  const handleBuildMode = useCallback(() => setMode("build"), [setMode]);
  const handleExtractMode = useCallback(() => setMode("extract"), [setMode]);
  const handleOpenTerms = useCallback(() => {
    const dialog = termsDialogRef.current;
    if (dialog && !dialog.open) {
      lockBodyScroll();
      dialog.showModal();
    }
  }, [lockBodyScroll]);
  const handleOpenPrivacy = useCallback(() => {
    const dialog = privacyDialogRef.current;
    if (dialog && !dialog.open) {
      lockBodyScroll();
      dialog.showModal();
    }
  }, [lockBodyScroll]);
  const handleTermsClose = useCallback(() => {
    unlockBodyScroll();
  }, [unlockBodyScroll]);
  const handlePrivacyClose = useCallback(() => {
    unlockBodyScroll();
  }, [unlockBodyScroll]);

  useEffect(
    () => () => {
      document.body.style.overflow = "";
    },
    []
  );

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex min-h-dvh flex-col">
        <main className="mx-auto my-10 grid w-content flex-1 content-start gap-5 max-md:my-4 max-md:w-content-sm">
          <header>
            <Card className="animate-rise p-fluid">
              <Badge>ePub Web</Badge>
              <h1 className="mt-2 mb-3 text-hero">
                画像とePubを、速く正確に変換
              </h1>
              <p className="m-0 leading-7">
                画像からePubを組み立てる、またはePubから画像を抽出できます。
                ファイルはサーバーで変換処理され、生成結果はブラウザですぐにダウンロードできます。
              </p>
            </Card>
          </header>

          <div
            className="grid grid-cols-2 gap-2"
            role="tablist"
            aria-label="変換モード"
          >
            <TabButton
              type="button"
              active={mode === "build"}
              onClick={handleBuildMode}
              role="tab"
              aria-selected={mode === "build"}
              aria-controls="panel-build"
            >
              画像からePub
            </TabButton>
            <TabButton
              type="button"
              active={mode === "extract"}
              onClick={handleExtractMode}
              role="tab"
              aria-selected={mode === "extract"}
              aria-controls="panel-extract"
            >
              ePubから画像
            </TabButton>
          </div>

          <Activity mode={mode === "build" ? "visible" : "hidden"}>
            <Suspense fallback={<BuildFormSkeleton />}>
              <BuildForm />
            </Suspense>
          </Activity>

          <Activity mode={mode === "extract" ? "visible" : "hidden"}>
            <Suspense fallback={<ExtractFormSkeleton />}>
              <ExtractForm />
            </Suspense>
          </Activity>

          <TermsDialog dialogRef={termsDialogRef} onClose={handleTermsClose} />
          <PrivacyDialog
            dialogRef={privacyDialogRef}
            onClose={handlePrivacyClose}
          />
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
