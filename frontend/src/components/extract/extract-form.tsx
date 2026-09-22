import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { useStore } from "@tanstack/react-store";
import {
  useEffectEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { FormattedMessage, useIntl } from "react-intl";

import {
  formatMiBFromBytes,
  formatSecondsFromMs,
  formatSizeLabel,
} from "#lib/format";
import { useAppConfig, useDrop, useImageDimensions } from "#lib/hooks";
import { localized } from "#lib/i18n";
import type { LocalizedText } from "#lib/i18n";
import type { ExtractedImage, ExtractResult } from "#lib/mutations";
import { extractMutationFn, getApiErrorMessage } from "#lib/mutations";
import { triggerDownload } from "#lib/utils";

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
    <Skeleton className="h-10" />
  </Card>
);

export const ExtractForm = () => {
  const intl = useIntl();
  const [extractedImages, setExtractedImages] = useState<ExtractedImage[]>([]);
  const [extractResult, setExtractResult] = useState<ExtractResult | null>(
    null
  );
  // Messages are kept as formatters, so they are set through an updater
  // function and re-rendered in the current locale.
  const [error, setError] = useState<LocalizedText | null>(null);
  const [isClientValidationBlocked, setIsClientValidationBlocked] =
    useState(false);
  const [shouldResetForm, setShouldResetForm] = useState(false);
  const [success, setSuccess] = useState<LocalizedText | null>(null);

  const { data: config } = useAppConfig();

  const getExtractClientValidationError = useCallback(
    (file: File | null): LocalizedText | null => {
      if (!file) {
        return localized("extract.error.selectEpub");
      }

      const isEpub =
        file.type === "application/epub+zip" || /\.epub$/iu.test(file.name);
      if (!isEpub) {
        return localized("error.missingEpubFile");
      }

      if (config.maxUploadMB > 0) {
        const maxUploadBytes = config.maxUploadMB * 1024 * 1024;
        if (file.size > maxUploadBytes) {
          return localized("error.requestTooLarge", {
            size: config.maxUploadMB,
          });
        }
      }

      return null;
    },
    [config.maxUploadMB]
  );

  const setClientValidationError = useCallback((message: LocalizedText) => {
    setError(() => message);
    setSuccess(null);
    setExtractedImages([]);
    setExtractResult(null);
    setIsClientValidationBlocked(true);
  }, []);

  const clearClientValidationBlock = useCallback(() => {
    setIsClientValidationBlocked(false);
  }, []);

  const mutation = useMutation({
    mutationFn: extractMutationFn,
    onError: (caughtError) => {
      clearClientValidationBlock();
      setError(() =>
        getApiErrorMessage(caughtError, {
          defaultMessageId: "error.extractFailed",
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
      setSuccess(() =>
        localized("extract.success", { count: result.images.length })
      );
      setShouldResetForm(true);
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
        setClientValidationError(localized("extract.error.selectEpub"));
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

  useEffect(() => {
    if (!shouldResetForm) {
      return;
    }

    form.reset();
    setShouldResetForm(false);
  }, [form, shouldResetForm]);

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
        /\.epub$/iu.test(file.name)
      );
      if (!droppedEpub) {
        setClientValidationError(localized("extract.dropEpub"));
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
        sizeLabel: formatSizeLabel(intl, image.blob.size),
      })),
    [extractedImages, intl]
  );

  const revalidateIfBlocked = useEffectEvent(() => {
    if (!isClientValidationBlocked) {
      return;
    }

    const validationError = getExtractClientValidationError(extractFile);
    if (validationError) {
      setError(() => validationError);
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
    limitItems.push(
      intl.formatMessage(
        { id: "limits.requestSize" },
        { size: config.maxUploadMB }
      )
    );
  }
  if (config.maxAssetBytes > 0) {
    limitItems.push(
      intl.formatMessage(
        { id: "limits.extractAssetSize" },
        { size: formatMiBFromBytes(intl, config.maxAssetBytes) }
      )
    );
  }
  if (config.maxImagePixels > 0) {
    limitItems.push(
      intl.formatMessage(
        { id: "limits.extractImagePixels" },
        { max: config.maxImagePixels }
      )
    );
  }
  if (config.requestTimeoutMs > 0) {
    limitItems.push(
      intl.formatMessage(
        { id: "limits.timeout" },
        {
          label: formatSecondsFromMs(intl, config.requestTimeoutMs),
          seconds: config.requestTimeoutMs / 1000,
        }
      )
    );
  }

  return (
    <Card className="relative min-w-0 space-y-2 p-fluid-sm" {...dragProps}>
      {isFormDragOver && (
        <DropOverlay
          message={intl.formatMessage({ id: "extract.dropOverlay" })}
        />
      )}

      <LimitNotes
        title={intl.formatMessage({ id: "extract.limits.title" })}
        items={limitItems}
      />

      <form className="grid gap-4" onSubmit={handleSubmit}>
        <form.Field
          name="extractFile"
          validators={{
            onSubmit: ({ value }) =>
              value ? undefined : localized("extract.error.selectEpub"),
          }}
        >
          {(field) => (
            <div className="grid gap-1.5 font-medium">
              <label
                id="extract-epub-label"
                className="m-0"
                htmlFor="extract-epub"
              >
                <FormattedMessage id="extract.epub" />{" "}
                <span className="text-destructive" aria-hidden="true">
                  *
                </span>
                <span className="sr-only">
                  <FormattedMessage id="common.required" />
                </span>
              </label>
              <FilePicker
                id="extract-epub"
                accept=".epub,application/epub+zip"
                ctaText={intl.formatMessage({ id: "extract.epubPicker.cta" })}
                helperText={intl.formatMessage({
                  id: "extract.epubPicker.helper",
                })}
                aria-labelledby="extract-epub-label"
                aria-required="true"
                disabled={isSubmitting}
                onFileChange={handleExtractFileChange}
              />
              {field.state.meta.errors.length > 0 && (
                <p className="m-0 text-sm font-medium text-destructive">
                  {field.state.meta.errors[0]?.(intl)}
                </p>
              )}
            </div>
          )}
        </form.Field>

        <p className="m-0 text-muted-foreground">
          <FormattedMessage
            id="extract.selected"
            values={{
              name:
                extractFilename ??
                intl.formatMessage({ id: "extract.selectedNone" }),
            }}
          />
        </p>

        <Button
          size="lg"
          type="submit"
          disabled={isSubmitting || isClientValidationBlocked}
        >
          {isSubmitting && (
            <span
              aria-hidden="true"
              className="size-4 animate-spin rounded-full border-2 border-primary-foreground/35 border-t-primary-foreground"
            />
          )}
          <span>
            <FormattedMessage
              id={isSubmitting ? "extract.submitting" : "extract.submit"}
            />
          </span>
        </Button>
      </form>

      {extractedImages.length > 0 && (
        <ExtractedImagesGallery
          extractedCount={extractedImages.length}
          items={extractedPreviewItems}
          previewDimensions={previewDimensions}
          onDownloadAllImages={handleDownloadAllImages}
          onDownloadImage={handleDownloadImage}
          readingDirection={extractResult?.readingDirection ?? "rtl"}
          spreadStartIndex={extractResult?.spreadStartIndex ?? 0}
          viewerTitle={extractResult?.title ?? "Untitled"}
        />
      )}
      {error && (
        <p className="mb-0 font-medium text-destructive">{error(intl)}</p>
      )}
      {success && (
        <p className="mb-0 font-medium text-success">{success(intl)}</p>
      )}
    </Card>
  );
};
