import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { useStore } from "@tanstack/react-store";
import {
  useEffectEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  formatInteger,
  formatMiBFromBytes,
  formatSecondsFromMs,
  formatSizeLabel,
} from "../../lib/format";
import { useAppConfig, useDrop, useImageDimensions } from "../../lib/hooks";
import type { ExtractedImage, ExtractResult } from "../../lib/mutations";
import { extractMutationFn, getApiErrorMessage } from "../../lib/mutations";
import { triggerDownload } from "../../lib/utils";
import { LimitNotes } from "../limit-notes";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { DropOverlay } from "../ui/drop-overlay";
import { FilePicker } from "../ui/file-picker";
import { Skeleton } from "../ui/skeleton";
import { ExtractedImagesGallery } from "./extracted-images-gallery";

export const ExtractFormSkeleton = () => (
  <Card className="min-w-0 p-fluid-sm">
    <Skeleton className="mb-4 h-28" />
    <Skeleton className="h-12" />
  </Card>
);

export const ExtractForm = () => {
  const [extractedImages, setExtractedImages] = useState<ExtractedImage[]>([]);
  const [extractResult, setExtractResult] = useState<ExtractResult | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [isClientValidationBlocked, setIsClientValidationBlocked] =
    useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const { data: config } = useAppConfig();

  const getExtractClientValidationError = useCallback(
    (file: File | null): string | null => {
      if (!file) {
        return "抽出するEPUBファイルを選択してください。";
      }

      const isEpub =
        file.type === "application/epub+zip" || /\.epub$/i.test(file.name);
      if (!isEpub) {
        return "EPUBファイルを選択してください。";
      }

      if (config.maxUploadMB > 0) {
        const maxUploadBytes = config.maxUploadMB * 1024 * 1024;
        if (file.size > maxUploadBytes) {
          return `1リクエストあたり最大 ${config.maxUploadMB} MiB です。`;
        }
      }

      return null;
    },
    [config.maxUploadMB]
  );

  const setClientValidationError = useCallback((message: string) => {
    setError(message);
    setSuccess(null);
    setExtractedImages([]);
    setExtractResult(null);
    setIsClientValidationBlocked(true);
  }, []);

  const clearClientValidationBlock = useCallback(() => {
    setIsClientValidationBlocked(false);
  }, []);

  const resetFormRef = useRef<(() => void) | null>(null);

  const mutation = useMutation({
    mutationFn: extractMutationFn,
    onError: (caughtError) => {
      clearClientValidationBlock();
      setError(
        getApiErrorMessage(caughtError, {
          defaultMessage: "画像抽出に失敗しました。",
          maxAssetBytes: config.maxAssetBytes,
          maxImageLongEdge: config.maxImageLongEdge,
          maxImagePixels: config.maxImagePixels,
          maxPages: config.maxPages,
          maxUploadMB: config.maxUploadMB,
          requestTimeoutMs: config.requestTimeoutMs,
        })
      );
      setSuccess(null);
      setExtractedImages([]);
      setExtractResult(null);
    },
    onSuccess: (result) => {
      clearClientValidationBlock();
      setExtractedImages(result.images);
      setExtractResult(result);
      setSuccess(`${result.images.length} 個の画像を抽出しました。`);
      resetFormRef.current?.();
    },
  });

  const form = useForm({
    defaultValues: {
      extractFile: null as File | null,
    },
    onSubmit: async ({ value }) => {
      const validationError = getExtractClientValidationError(
        value.extractFile
      );
      if (validationError) {
        setClientValidationError(validationError);
        return;
      }

      const selectedFile = value.extractFile;
      if (!selectedFile) {
        setClientValidationError("抽出するEPUBファイルを選択してください。");
        return;
      }

      clearClientValidationBlock();
      setError(null);
      setSuccess(null);
      setExtractedImages([]);
      setExtractResult(null);
      await mutation.mutateAsync({ file: selectedFile });
    },
  });

  resetFormRef.current = form.reset.bind(form);

  const extractFilename = useStore(
    form.store,
    (s) => s.values.extractFile?.name
  );
  const extractFile = useStore(form.store, (s) => s.values.extractFile);
  const isSubmitting = useStore(form.store, (s) => s.isSubmitting);

  const handleSubmit = useCallback<React.SubmitEventHandler<HTMLFormElement>>(
    (e) => {
      e.preventDefault();
      form.handleSubmit();
    },
    [form]
  );

  const handleExtractFileChange = useCallback(
    (file: File | null) => {
      form.setFieldValue("extractFile", file);

      const validationError = getExtractClientValidationError(file);
      if (validationError) {
        setClientValidationError(validationError);
        return;
      }

      clearClientValidationBlock();
      setError(null);
      setSuccess(null);
      setExtractedImages([]);
      setExtractResult(null);
    },
    [
      clearClientValidationBlock,
      form,
      getExtractClientValidationError,
      setClientValidationError,
    ]
  );

  const handleCardDropFiles = useCallback(
    (droppedFiles: readonly File[]) => {
      const droppedEpub = droppedFiles.find((file) =>
        /\.epub$/i.test(file.name)
      );
      if (!droppedEpub) {
        setClientValidationError("EPUBファイルをドロップしてください。");
        return;
      }

      const validationError = getExtractClientValidationError(droppedEpub);
      if (validationError) {
        setClientValidationError(validationError);
        return;
      }

      clearClientValidationBlock();
      setError(null);
      setSuccess(null);
      setExtractedImages([]);
      setExtractResult(null);
      form.setFieldValue("extractFile", droppedEpub);
    },
    [
      clearClientValidationBlock,
      form,
      getExtractClientValidationError,
      setClientValidationError,
    ]
  );

  const { isDragOver: isFormDragOver, dragProps } =
    useDrop(handleCardDropFiles);

  const extractedPreviewItems = useMemo(
    () =>
      extractedImages.map((image) => ({
        ...image,
        key: `${image.name}:${image.blob.size}`,
        sizeLabel: formatSizeLabel(image.blob.size),
      })),
    [extractedImages]
  );

  const revalidateIfBlocked = useEffectEvent(() => {
    if (!isClientValidationBlocked) {
      return;
    }

    const validationError = getExtractClientValidationError(extractFile);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsClientValidationBlocked(false);
    setError(null);
  });

  useEffect(() => {
    revalidateIfBlocked();
  }, [extractFile]);
  const dimensionTargets = useMemo(
    () =>
      extractedPreviewItems.map((item) => ({ blob: item.blob, key: item.key })),
    [extractedPreviewItems]
  );
  const previewDimensions = useImageDimensions(dimensionTargets);

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
    if (extractResult) {
      triggerDownload(extractResult.zipBlob, extractResult.zipFilename);
    }
  }, [extractResult]);

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
      {isFormDragOver && <DropOverlay message="ここにEPUBファイルをドロップ" />}

      <LimitNotes title="抽出時の制限" items={limitItems} />

      <form className="grid gap-4" onSubmit={handleSubmit}>
        <form.Field
          name="extractFile"
          validators={{
            onSubmit: ({ value }) =>
              value ? undefined : "抽出するEPUBファイルを選択してください。",
          }}
        >
          {(field) => (
            <div className="grid gap-1.5 font-semibold">
              <label
                id="extract-epub-label"
                className="m-0"
                htmlFor="extract-epub"
              >
                EPUBファイル{" "}
                <span className="text-error" aria-hidden="true">
                  *
                </span>
                <span className="sr-only">必須</span>
              </label>
              <FilePicker
                id="extract-epub"
                accept=".epub,application/epub+zip"
                ctaText="EPUBファイルを選択"
                helperText="クリックまたはドラッグ＆ドロップでEPUBファイルを指定"
                aria-labelledby="extract-epub-label"
                aria-required="true"
                disabled={isSubmitting}
                onFileChange={handleExtractFileChange}
              />
              {field.state.meta.errors.length > 0 && (
                <p className="m-0 text-sm font-semibold text-error">
                  {field.state.meta.errors[0]}
                </p>
              )}
            </div>
          )}
        </form.Field>

        <p className="m-0 text-muted-foreground">
          選択中: {extractFilename ?? "未選択"}
        </p>

        <Button
          className="inline-flex items-center justify-center gap-2"
          type="submit"
          variant="primary"
          disabled={isSubmitting || isClientValidationBlocked}
        >
          {isSubmitting && (
            <span
              aria-hidden="true"
              className="size-4 animate-spin rounded-full border-2 border-slate-50/35 border-t-slate-50"
            />
          )}
          <span>{isSubmitting ? "抽出中..." : "画像を抽出"}</span>
        </Button>
      </form>

      {extractedImages.length > 0 && (
        <ExtractedImagesGallery
          extractedCount={extractedImages.length}
          items={extractedPreviewItems}
          previewDimensions={previewDimensions}
          onDownloadAllImages={handleDownloadAllImages}
          onDownloadImage={handleDownloadImage}
        />
      )}
      {error && <p className="mb-0 font-semibold text-error">{error}</p>}
      {success && <p className="mb-0 font-semibold text-success">{success}</p>}
    </Card>
  );
};
