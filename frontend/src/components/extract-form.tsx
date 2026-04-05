import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { useStore } from "@tanstack/react-store";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  formatInteger,
  formatMiBFromBytes,
  formatSecondsFromMs,
  formatSizeLabel,
} from "../lib/format";
import { useAppConfig, useDrop } from "../lib/hooks";
import type { ExtractedImage } from "../lib/mutations";
import { extractMutationFn, getApiErrorMessage } from "../lib/mutations";
import { triggerDownload } from "../lib/utils";
import { LimitNotes } from "./limit-notes";
import { Card, DropOverlay, FilePicker, PrimaryButton } from "./ui/primitives";

export const ExtractFormSkeleton = () => (
  <Card className="min-w-0 p-fluid-sm animate-pulse">
    {/* ファイルピッカー */}
    <div className="mb-4 h-28 rounded-xl bg-muted" />
    {/* ボタン */}
    <div className="h-12 rounded-xl bg-muted" />
  </Card>
);

export const ExtractForm = () => {
  const [extractedImages, setExtractedImages] = useState<ExtractedImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { data: config } = useAppConfig();

  const resetFormRef = useRef<(() => void) | null>(null);

  const mutation = useMutation({
    mutationFn: extractMutationFn,
    onError: (caughtError) => {
      setError(
        getApiErrorMessage(caughtError, {
          defaultMessage: "画像抽出に失敗しました。",
          maxAssetBytes: config.maxAssetBytes,
          maxImagePixels: config.maxImagePixels,
          maxPages: config.maxPages,
          maxUploadMB: config.maxUploadMB,
          requestTimeoutMs: config.requestTimeoutMs,
        })
      );
      setSuccess(null);
      setExtractedImages([]);
    },
    onSuccess: (images) => {
      setExtractedImages(images);
      setSuccess(`${images.length} 個の画像を抽出しました。`);
      resetFormRef.current?.();
    },
  });

  const form = useForm({
    defaultValues: {
      extractFile: null as File | null,
    },
    onSubmit: async ({ value }) => {
      if (!value.extractFile) {
        return;
      }

      if (config.maxUploadMB > 0) {
        const maxUploadBytes = config.maxUploadMB * 1024 * 1024;
        if (value.extractFile.size > maxUploadBytes) {
          setError(`1リクエストあたり最大 ${config.maxUploadMB} MiB です。`);
          setSuccess(null);
          setExtractedImages([]);
          return;
        }
      }

      setError(null);
      setSuccess(null);
      setExtractedImages([]);
      await mutation.mutateAsync({ file: value.extractFile });
    },
  });

  resetFormRef.current = form.reset.bind(form);

  const extractFilename = useStore(
    form.store,
    (s) => s.values.extractFile?.name
  );
  const isSubmitting = useStore(form.store, (s) => s.isSubmitting);

  const handleSubmit = useCallback<React.SubmitEventHandler<HTMLFormElement>>(
    (e) => {
      e.preventDefault();
      form.handleSubmit();
    },
    [form]
  );

  const handleCardDropFiles = useCallback(
    (droppedFiles: readonly File[]) => {
      const droppedEpub = droppedFiles.find((file) =>
        /\.epub$/i.test(file.name)
      );
      if (!droppedEpub) {
        setError("ePubファイルをドロップしてください。");
        setSuccess(null);
        setExtractedImages([]);
        return;
      }

      if (config.maxUploadMB > 0) {
        const maxUploadBytes = config.maxUploadMB * 1024 * 1024;
        if (droppedEpub.size > maxUploadBytes) {
          setError(`1リクエストあたり最大 ${config.maxUploadMB} MiB です。`);
          setSuccess(null);
          setExtractedImages([]);
          return;
        }
      }

      setError(null);
      setSuccess(null);
      setExtractedImages([]);
      form.setFieldValue("extractFile", droppedEpub);
    },
    [config.maxUploadMB, form]
  );

  const { isDragOver: isFormDragOver, dragProps } =
    useDrop(handleCardDropFiles);

  const [previewDimensions, setPreviewDimensions] = useState<
    Record<string, string>
  >({});
  const extractedPreviewItems = useMemo(
    () =>
      extractedImages.map((image) => ({
        ...image,
        key: `${image.name}:${image.blob.size}`,
        sizeLabel: formatSizeLabel(image.blob.size),
      })),
    [extractedImages]
  );

  useEffect(() => {
    let cancelled = false;

    const loadDimensions = async () => {
      const next: Record<string, string> = {};

      for (const item of extractedPreviewItems) {
        try {
          const bitmap = await createImageBitmap(item.blob);
          next[item.key] = `${bitmap.width}x${bitmap.height}`;
          bitmap.close();
        } catch {
          next[item.key] = "-";
        }
      }

      if (!cancelled) {
        setPreviewDimensions(next);
      }
    };

    loadDimensions();

    return () => {
      cancelled = true;
    };
  }, [extractedPreviewItems]);

  const handleDownloadImage = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const { imageKey } = (e.currentTarget as HTMLButtonElement).dataset;
      const image = extractedPreviewItems.find((img) => img.key === imageKey);
      if (image) {
        triggerDownload(image.blob, image.name);
      }
    },
    [extractedPreviewItems]
  );

  const handleDownloadAllImages = useCallback(() => {
    for (const image of extractedImages) {
      triggerDownload(image.blob, image.name);
    }
  }, [extractedImages]);

  const limitItems: string[] = [];
  if (config.maxUploadMB > 0) {
    limitItems.push(`1リクエストあたり最大 ${config.maxUploadMB} MiB`);
  }
  if (config.maxAssetBytes > 0) {
    limitItems.push(
      `抽出対象の画像は1枚あたり最大 ${formatMiBFromBytes(config.maxAssetBytes)}`
    );
  }
  if (config.maxImagePixels > 0) {
    limitItems.push(
      `抽出対象の画像解像度は最大 ${formatInteger(config.maxImagePixels)} px`
    );
  }
  if (config.requestTimeoutMs > 0) {
    limitItems.push(
      `処理タイムアウト: 約 ${formatSecondsFromMs(config.requestTimeoutMs)} 秒`
    );
  }

  return (
    <Card
      className="relative min-w-0 space-y-2 animate-rise p-fluid-sm"
      {...dragProps}
    >
      {isFormDragOver && <DropOverlay message="ここにePubファイルをドロップ" />}

      <LimitNotes title="抽出時の制限" items={limitItems} />

      <form className="grid gap-4" onSubmit={handleSubmit}>
        <form.Field
          name="extractFile"
          validators={{
            onSubmit: ({ value }) =>
              value ? undefined : "抽出するePubファイルを選択してください。",
          }}
        >
          {(field) => (
            <label
              className="grid gap-1.5 font-semibold"
              htmlFor="extract-epub"
            >
              ePubファイル
              <FilePicker
                id="extract-epub"
                accept=".epub,application/epub+zip"
                ctaText="ePubファイルを選択"
                helperText="クリックまたはドラッグ＆ドロップでePubファイルを指定"
                disabled={isSubmitting}
                onFileChange={field.handleChange}
              />
              {field.state.meta.errors.length > 0 && (
                <p className="m-0 text-sm font-semibold text-error">
                  {field.state.meta.errors[0]}
                </p>
              )}
            </label>
          )}
        </form.Field>

        <p className="m-0 text-muted-foreground">
          選択中: {extractFilename ?? "未選択"}
        </p>

        <PrimaryButton
          className="inline-flex items-center justify-center gap-2"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting && (
            <span
              aria-hidden="true"
              className="size-4 animate-spin rounded-full border-2 border-slate-50/35 border-t-slate-50"
            />
          )}
          <span>{isSubmitting ? "抽出中..." : "画像を抽出"}</span>
        </PrimaryButton>
      </form>

      {extractedImages.length > 0 && (
        <div className="mt-6 border-t border-current/20 pt-6">
          <h3 className="mb-3 text-sm font-semibold">
            抽出された画像 ({extractedImages.length})
          </h3>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="cursor-pointer rounded-lg border border-primary/28 bg-primary-subtle px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary-subtle-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/75"
              onClick={handleDownloadAllImages}
            >
              全ダウンロード
            </button>
          </div>
          <div className="flex w-full max-w-full snap-x snap-mandatory gap-3 overflow-x-auto pb-2 touch-pan-x">
            {extractedPreviewItems.map((image) => (
              <div key={image.key} className="group w-32 shrink-0 snap-start">
                <div className="mb-2 aspect-square flex items-center justify-center overflow-hidden rounded-lg bg-muted">
                  <img
                    src={image.url}
                    alt={image.name}
                    className="h-full w-full object-cover"
                  />
                </div>
                <p
                  className="truncate text-xs text-muted-foreground"
                  title={image.name}
                >
                  {image.name}
                </p>
                <p className="mt-1 m-0 text-[11px] text-muted-foreground/90">
                  {image.sizeLabel} / {previewDimensions[image.key] ?? "..."}
                </p>
                <button
                  type="button"
                  data-image-key={image.key}
                  className="mt-2 w-full cursor-pointer rounded-lg border border-primary/28 bg-primary-subtle px-2 py-1 text-[11px] font-semibold text-primary transition hover:bg-primary-subtle-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/75"
                  onClick={handleDownloadImage}
                >
                  ダウンロード
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      {error && <p className="mb-0 font-semibold text-error">{error}</p>}
      {success && <p className="mb-0 font-semibold text-success">{success}</p>}
    </Card>
  );
};
