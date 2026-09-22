import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
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
import { FormattedMessage, useIntl } from "react-intl";

import { getSafeImageConcurrency, mapConcurrent } from "#lib/async";
import {
  compareFilesByLastModified,
  compareFilesByName,
  getFileImagePixels,
  validateSelectedBuildFiles,
} from "#lib/build";
import {
  formatLanguageName,
  formatMiBFromBytes,
  formatSecondsFromMs,
} from "#lib/format";
import { getSpreadStartIndex } from "#lib/comic-viewer";
import type { ComicViewerSpreadPosition } from "#lib/comic-viewer";
import { useAppConfig, useDrop } from "#lib/hooks";
import { localized, resolveEpubLanguage } from "#lib/i18n";
import type { LocalizedText } from "#lib/i18n";
import { compressImageFile } from "#lib/image";
import { buildMutationFn, getApiErrorMessage } from "#lib/mutations";
import { triggerDownload } from "#lib/utils";
import { ComicViewerDialog } from "../comic-viewer/comic-viewer-dialog";
import { useLocale } from "../i18n/locale-provider";
import { LimitNotes } from "../limit-notes";
import { AddableSortableTextFields } from "../ui/addable-sortable-text-fields";
import type { SortableTextFieldItem } from "../ui/addable-sortable-text-fields";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { DropOverlay } from "../ui/drop-overlay";
import { FilePicker } from "../ui/file-picker";
import { SelectInput } from "../ui/select-input";
import { Skeleton } from "../ui/skeleton";
import { TextInput } from "../ui/text-input";
import { SortableImagePreviewList } from "./sortable-image-preview-list";
import { useBuildImagePreviews } from "./use-build-image-previews";

export const BuildFormSkeleton = () => (
  <Card className="min-w-0 p-fluid-sm">
    <div className="mb-4">
      <Skeleton className="mb-1.5 h-4 w-16 rounded-md" />
      <Skeleton className="h-10" />
    </div>
    <div className="mb-4 grid gap-3 md:grid-cols-2">
      <div>
        <Skeleton className="mb-1.5 h-4 w-20 rounded-md" />
        <Skeleton className="h-10" />
      </div>
      <div>
        <Skeleton className="mb-1.5 h-4 w-20 rounded-md" />
        <Skeleton className="h-10" />
      </div>
    </div>
    <Skeleton className="mb-4 h-28" />
    <Skeleton className="h-12" />
  </Card>
);

const getViewerFirstPageSpread = (
  cover: boolean,
  spread: string
): ComicViewerSpreadPosition => {
  if (cover || spread === "center") {
    return "center";
  }

  return spread === "left" ? "left" : "right";
};

export const BuildForm = () => {
  const intl = useIntl();
  const locale = useLocale();
  // Messages are kept as formatters, so they are set through an updater
  // function and re-rendered in the current locale.
  const [error, setError] = useState<LocalizedText | null>(null);
  const [isClientValidationBlocked, setIsClientValidationBlocked] =
    useState(false);
  const [shouldResetForm, setShouldResetForm] = useState(false);
  const [success, setSuccess] = useState<LocalizedText | null>(null);
  const authorIdRef = useRef(0);

  const createAuthorField = useCallback((name = ""): SortableTextFieldItem => {
    authorIdRef.current += 1;
    return { id: `author-${authorIdRef.current}`, value: name };
  }, []);

  const defaultAuthorFields = useMemo<SortableTextFieldItem[]>(
    () => [{ id: "author-1", value: "" }],
    []
  );

  useEffect(() => {
    authorIdRef.current = 1;
  }, []);

  const { data: config } = useAppConfig();

  const getBuildClientValidationError = useCallback(
    (files: File[]): LocalizedText | null => {
      if (files.length === 0) {
        return localized("error.noImagesProvided");
      }

      return validateSelectedBuildFiles(files, {
        maxAssetBytes: config.maxAssetBytes,
        maxPages: config.maxPages,
        maxUploadMB: config.maxUploadMB,
      });
    },
    [config.maxAssetBytes, config.maxPages, config.maxUploadMB]
  );

  const getImagePixelsValidationError = useCallback(
    async (files: File[]): Promise<LocalizedText | null> => {
      if (config.maxImagePixels <= 0) {
        return null;
      }

      for (const file of files) {
        let pixels: number;
        try {
          pixels = await getFileImagePixels(file);
        } catch {
          return localized("build.error.pixelsUnreadable");
        }

        if (pixels > config.maxImagePixels) {
          return localized("error.imagePixelsLimit", {
            max: config.maxImagePixels,
          });
        }
      }

      return null;
    },
    [config.maxImagePixels]
  );

  const compressBuildFiles = useCallback(
    (files: File[]): Promise<File[]> => {
      if (config.maxImageLongEdge <= 0) {
        return Promise.resolve([...files]);
      }

      const concurrency = getSafeImageConcurrency();
      return mapConcurrent(files, concurrency, (file) =>
        compressImageFile(file, config.maxImageLongEdge)
      );
    },
    [config.maxImageLongEdge]
  );

  const setClientValidationError = useCallback((message: LocalizedText) => {
    setError(() => message);
    setSuccess(null);
    setIsClientValidationBlocked(true);
  }, []);

  const clearClientValidationBlock = useCallback(() => {
    setIsClientValidationBlocked(false);
  }, []);

  const mutation = useMutation({
    mutationFn: buildMutationFn,
    onError: (caughtError) => {
      clearClientValidationBlock();
      setError(() =>
        getApiErrorMessage(caughtError, {
          defaultMessageId: "error.buildFailed",
          maxAssetBytes: config.maxAssetBytes,
          maxImageLongEdge: config.maxImageLongEdge,
          maxImagePixels: config.maxImagePixels,
          maxPages: config.maxPages,
          maxUploadMB: config.maxUploadMB,
          requestTimeoutMs: config.requestTimeoutMs,
        })
      );
      setSuccess(null);
    },
    onSuccess: ({ blob, filename }) => {
      clearClientValidationBlock();
      triggerDownload(blob, filename);
      setSuccess(() => localized("build.success"));
      setShouldResetForm(true);
    },
  });

  // The EPUB language follows the interface language until the user picks one.
  const defaultLanguage = resolveEpubLanguage(
    locale,
    config.supportedLanguages
  );
  const isLanguagePickedRef = useRef(false);

  const form = useForm({
    defaultValues: {
      authors: defaultAuthorFields,
      buildFiles: [] as File[],
      cover: true,
      direction: "rtl",
      language: defaultLanguage,
      spread: "right",
      title: "",
    },
    onSubmit: async ({ value }) => {
      setError(null);
      setSuccess(null);

      const title = value.title.trim();
      const authors = value.authors
        .map((author) => author.value.trim())
        .filter((name) => name.length > 0);

      let compressedFiles: File[] = [];
      try {
        compressedFiles = await compressBuildFiles(value.buildFiles);
      } catch {
        setError(() => localized("build.error.compressFailed"));
        return;
      }

      const selectionError = getBuildClientValidationError(compressedFiles);
      if (selectionError) {
        setClientValidationError(selectionError);
        return;
      }

      const pixelsError = await getImagePixelsValidationError(compressedFiles);
      if (pixelsError) {
        setClientValidationError(pixelsError);
        return;
      }

      clearClientValidationBlock();

      await mutation.mutateAsync({
        authors,
        cover: value.cover,
        direction: value.direction,
        files: compressedFiles,
        language: value.language,
        spread: value.spread,
        title,
      });
    },
  });

  useEffect(() => {
    if (!shouldResetForm) {
      return;
    }

    form.reset();
    isLanguagePickedRef.current = false;
    setShouldResetForm(false);
  }, [form, shouldResetForm]);

  useEffect(() => {
    if (!isLanguagePickedRef.current) {
      form.setFieldValue("language", defaultLanguage, { dontUpdateMeta: true });
    }
  }, [defaultLanguage, form]);

  const buildFilesCount = useStore(
    form.store,
    (s) => s.values.buildFiles.length
  );
  const buildFiles = useStore(form.store, (s) => s.values.buildFiles);
  const buildCover = useStore(form.store, (s) => s.values.cover);
  const buildDirection = useStore(form.store, (s) => s.values.direction);
  const buildSpread = useStore(form.store, (s) => s.values.spread);
  const buildTitle = useStore(form.store, (s) => s.values.title);
  const isSubmitting = useStore(form.store, (s) => s.isSubmitting);

  const imagePreviews = useBuildImagePreviews(buildFiles);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isPreviewViewerOpen, setIsPreviewViewerOpen] = useState(false);
  const previewViewerDialogRef = useRef<HTMLDialogElement>(null);
  const viewerReadingDirection = buildDirection === "ltr" ? "ltr" : "rtl";
  const viewerFirstPageSpread = getViewerFirstPageSpread(
    buildCover,
    buildSpread
  );
  const viewerSpreadStartIndex = useMemo(
    () =>
      getSpreadStartIndex({
        firstPageSpread: viewerFirstPageSpread,
        pageCount: imagePreviews.length,
        readingDirection: viewerReadingDirection,
      }),
    [imagePreviews.length, viewerFirstPageSpread, viewerReadingDirection]
  );
  const viewerPages = useMemo(
    () =>
      imagePreviews.map((preview) => ({
        id: preview.id,
        mimeType: preview.mimeType,
        src: preview.url,
        title: preview.name,
      })),
    [imagePreviews]
  );
  const handleOpenPreviewViewer = useCallback(() => {
    setIsPreviewViewerOpen(true);
  }, []);
  const handleClosePreviewViewer = useCallback(() => {
    setIsPreviewViewerOpen(false);
  }, []);

  useEffect(() => {
    const dialog = previewViewerDialogRef.current;
    if (isPreviewViewerOpen && dialog && !dialog.open) {
      dialog.showModal();
    }
  }, [isPreviewViewerOpen]);

  const activePreview = useMemo(() => {
    if (activeId === null) {
      return null;
    }

    return imagePreviews.find((preview) => preview.id === activeId) ?? null;
  }, [activeId, imagePreviews]);

  const handleSubmit = useCallback<React.SubmitEventHandler<HTMLFormElement>>(
    (e) => {
      e.preventDefault();
      form.handleSubmit();
    },
    [form]
  );

  const handleAddAuthorField = useCallback(() => {
    const currentAuthors = form.state.values.authors;
    form.setFieldValue("authors", [...currentAuthors, createAuthorField("")]);
  }, [createAuthorField, form]);

  const handleChangeAuthor = useCallback(
    (authorId: string, value: string) => {
      const currentAuthors = form.state.values.authors;
      form.setFieldValue(
        "authors",
        currentAuthors.map((author) =>
          author.id === authorId ? { ...author, value } : author
        )
      );
    },
    [form]
  );

  const handleRemoveAuthor = useCallback(
    (authorId: string) => {
      const currentAuthors = form.state.values.authors;
      if (currentAuthors.length <= 1) {
        form.setFieldValue("authors", [createAuthorField("")]);
        return;
      }
      form.setFieldValue(
        "authors",
        currentAuthors.filter((author) => author.id !== authorId)
      );
    },
    [createAuthorField, form]
  );

  const handleReorderAuthors = useCallback(
    (nextAuthors: SortableTextFieldItem[]) => {
      form.setFieldValue("authors", nextAuthors);
    },
    [form]
  );

  const handleAddBuildFiles = useCallback(
    (files: File[]) => {
      if (isSubmitting) {
        return;
      }

      const imageFiles = files.filter(
        (file) =>
          file.type.startsWith("image/") ||
          /\.(?<ext>png|jpe?g|gif|webp|avif|bmp|svg)$/iu.test(file.name)
      );
      if (imageFiles.length === 0) {
        setError(() => localized("build.error.selectImages"));
        setSuccess(null);
        return;
      }

      const sortedImageFiles = imageFiles.toSorted(compareFilesByName);
      const nextFiles = [...buildFiles, ...sortedImageFiles];
      if (config.maxPages > 0 && nextFiles.length > config.maxPages) {
        setClientValidationError(
          localized("error.pageLimit", { max: config.maxPages })
        );
        return;
      }

      clearClientValidationBlock();
      setError(null);
      setSuccess(null);
      form.setFieldValue("buildFiles", nextFiles);
    },
    [
      buildFiles,
      clearClientValidationBlock,
      config.maxPages,
      form,
      isSubmitting,
      setClientValidationError,
    ]
  );

  const handleCardDropFiles = useCallback(
    (droppedFiles: readonly File[]) => {
      if (isSubmitting) {
        return;
      }

      const droppedImages = droppedFiles.filter(
        (file) =>
          file.type.startsWith("image/") ||
          /\.(?<ext>png|jpe?g|gif|webp|avif|bmp|svg)$/iu.test(file.name)
      );
      if (droppedImages.length === 0) {
        setClientValidationError(localized("build.dropImages"));
        return;
      }

      const sortedDroppedImages = droppedImages.toSorted(compareFilesByName);
      const nextFiles = [...buildFiles, ...sortedDroppedImages];

      if (config.maxPages > 0 && nextFiles.length > config.maxPages) {
        setClientValidationError(
          localized("error.pageLimit", { max: config.maxPages })
        );
        return;
      }

      clearClientValidationBlock();
      setError(null);
      setSuccess(null);
      form.setFieldValue("buildFiles", nextFiles);
    },
    [
      buildFiles,
      clearClientValidationBlock,
      config.maxPages,
      form,
      isSubmitting,
      setClientValidationError,
    ]
  );

  const { isDragOver: isFormDragOver, dragProps } = useDrop(
    handleCardDropFiles,
    isSubmitting
  );

  const handleRemoveImage = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (isSubmitting) {
        return;
      }

      const { index } = (e.currentTarget as HTMLButtonElement).dataset;
      const indexNum = Math.trunc(Number(index || "0"));
      setError(null);
      setSuccess(null);
      form.setFieldValue(
        "buildFiles",
        buildFiles.filter((_, fileIndex) => fileIndex !== indexNum)
      );
    },
    [buildFiles, form, isSubmitting]
  );

  const handleRemoveAllImages = useCallback(() => {
    if (isSubmitting) {
      return;
    }

    setError(null);
    setSuccess(null);
    form.setFieldValue("buildFiles", []);
  }, [form, isSubmitting]);

  const handleSortByName = useCallback(() => {
    if (isSubmitting || buildFiles.length === 0) {
      return;
    }

    const sorted = buildFiles.toSorted(compareFilesByName);
    form.setFieldValue("buildFiles", sorted);
  }, [buildFiles, form, isSubmitting]);

  const handleSortByDate = useCallback(() => {
    if (isSubmitting || buildFiles.length === 0) {
      return;
    }

    const sorted = buildFiles.toSorted(compareFilesByLastModified);
    form.setFieldValue("buildFiles", sorted);
  }, [buildFiles, form, isSubmitting]);

  const handleCoverChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      form.setFieldValue("cover", e.target.checked);
    },
    [form]
  );

  const revalidateIfBlocked = useEffectEvent(
    async (nextBuildFiles: File[], signal: AbortSignal) => {
      if (!isClientValidationBlocked) {
        return;
      }

      let compressedFiles: File[] = [];
      try {
        compressedFiles = await compressBuildFiles(nextBuildFiles);
      } catch {
        if (!signal.aborted) {
          setError(() => localized("build.error.compressFailed"));
        }
        return;
      }

      if (signal.aborted) {
        return;
      }

      const selectionError = getBuildClientValidationError(compressedFiles);
      if (selectionError) {
        if (!signal.aborted) {
          setError(() => selectionError);
        }
        return;
      }

      const pixelsError = await getImagePixelsValidationError(compressedFiles);
      if (signal.aborted) {
        return;
      }

      if (pixelsError) {
        setError(() => pixelsError);
        return;
      }

      setIsClientValidationBlocked(false);
      setError(null);
    }
  );

  useEffect(() => {
    const controller = new AbortController();
    void revalidateIfBlocked(buildFiles, controller.signal);
    return () => {
      controller.abort();
    };
  }, [buildFiles]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = useCallback(
    ({ active }: DragStartEvent) => {
      if (isSubmitting) {
        return;
      }
      setActiveId(String(active.id));
    },
    [isSubmitting]
  );

  const handleDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      setActiveId(null);
      if (isSubmitting || !over || active.id === over.id) {
        return;
      }

      const oldIndex = imagePreviews.findIndex(
        (preview) => preview.id === active.id
      );
      const newIndex = imagePreviews.findIndex(
        (preview) => preview.id === over.id
      );

      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
        return;
      }

      setError(null);
      setSuccess(null);
      form.setFieldValue(
        "buildFiles",
        arrayMove(buildFiles, oldIndex, newIndex)
      );
    },
    [buildFiles, form, imagePreviews, isSubmitting]
  );

  const limitItems: string[] = [];
  if (config.maxUploadMB > 0) {
    limitItems.push(
      intl.formatMessage(
        { id: "limits.requestSize" },
        { size: config.maxUploadMB }
      )
    );
  }
  if (config.maxPages > 0) {
    limitItems.push(
      intl.formatMessage({ id: "limits.pages" }, { max: config.maxPages })
    );
  }
  if (config.maxAssetBytes > 0) {
    limitItems.push(
      intl.formatMessage(
        { id: "limits.assetSize" },
        { size: formatMiBFromBytes(intl, config.maxAssetBytes) }
      )
    );
  }
  if (config.maxImagePixels > 0) {
    limitItems.push(
      intl.formatMessage(
        { id: "limits.imagePixels" },
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
    <Card
      className="relative min-w-0 space-y-2 animate-rise p-fluid-sm"
      {...dragProps}
    >
      {isFormDragOver && (
        <DropOverlay message={intl.formatMessage({ id: "build.dropOverlay" })} />
      )}

      <LimitNotes
        title={intl.formatMessage({ id: "build.limits.title" })}
        items={limitItems}
      />

      <form className="grid gap-4" onSubmit={handleSubmit}>
        <form.Field name="title">
          {(field) => (
            <div className="grid gap-1.5">
              <label className="font-semibold" htmlFor="build-title">
                <FormattedMessage id="build.title" />
              </label>
              <TextInput
                id="build-title"
                type="text"
                value={field.state.value}
                onValueChange={field.handleChange}
                placeholder="Untitled"
                maxLength={120}
                disabled={isSubmitting}
              />
            </div>
          )}
        </form.Field>

        <form.Field name="authors">
          {(field) => (
            <AddableSortableTextFields
              label={intl.formatMessage({ id: "build.authors" })}
              items={field.state.value}
              addButtonLabel={intl.formatMessage({ id: "build.addAuthor" })}
              inputIdPrefix="build-author"
              placeholder={intl.formatMessage({
                id: "build.authorPlaceholder",
              })}
              disabled={isSubmitting}
              addDisabled={field.state.value.some(
                (author) => author.value.trim().length === 0
              )}
              onAdd={handleAddAuthorField}
              onChange={handleChangeAuthor}
              onRemove={handleRemoveAuthor}
              onReorder={handleReorderAuthors}
            />
          )}
        </form.Field>

        <div className="grid gap-3 md:grid-cols-3">
          <form.Field name="direction">
            {(field) => (
              <div className="grid gap-1.5">
                <label className="font-semibold" htmlFor="build-direction">
                  <FormattedMessage id="build.direction" />
                </label>
                <SelectInput
                  id="build-direction"
                  value={field.state.value}
                  onValueChange={field.handleChange}
                  disabled={isSubmitting}
                >
                  <option value="rtl">
                    {intl.formatMessage({ id: "build.direction.rtl" })}
                  </option>
                  <option value="ltr">
                    {intl.formatMessage({ id: "build.direction.ltr" })}
                  </option>
                </SelectInput>
              </div>
            )}
          </form.Field>

          <form.Field name="spread">
            {(field) => (
              <div className="grid gap-1.5">
                <label className="font-semibold" htmlFor="build-spread">
                  <FormattedMessage id="build.spread" />
                </label>
                <SelectInput
                  id="build-spread"
                  value={field.state.value}
                  onValueChange={field.handleChange}
                  disabled={isSubmitting}
                >
                  <option value="right">
                    {intl.formatMessage({ id: "build.spread.right" })}
                  </option>
                  <option value="left">
                    {intl.formatMessage({ id: "build.spread.left" })}
                  </option>
                  <option value="center">
                    {intl.formatMessage({ id: "build.spread.center" })}
                  </option>
                </SelectInput>
              </div>
            )}
          </form.Field>

          <form.Field name="language">
            {(field) => (
              <div className="grid gap-1.5">
                <label className="font-semibold" htmlFor="build-language">
                  <FormattedMessage id="build.language" />
                </label>
                <SelectInput
                  id="build-language"
                  value={field.state.value}
                  onValueChange={(value) => {
                    isLanguagePickedRef.current = true;
                    field.handleChange(value);
                  }}
                  disabled={isSubmitting}
                >
                  {config.supportedLanguages.map((code) => (
                    <option key={code} value={code}>
                      {formatLanguageName(intl, code)}
                    </option>
                  ))}
                </SelectInput>
              </div>
            )}
          </form.Field>
        </div>

        <form.Field
          name="buildFiles"
          validators={{
            onSubmit: ({ value }) => {
              if (value.length === 0) {
                return localized("error.noImagesProvided");
              }
              if (config.maxPages > 0 && value.length > config.maxPages) {
                return localized("error.pageLimit", { max: config.maxPages });
              }
            },
          }}
        >
          {(field) => (
            <div className="grid gap-1.5 font-semibold">
              <label
                id="build-images-label"
                className="m-0"
                htmlFor="build-images"
              >
                <FormattedMessage id="build.images" />{" "}
                <span className="text-error" aria-hidden="true">
                  *
                </span>
                <span className="sr-only">
                  <FormattedMessage id="common.required" />
                </span>
              </label>
              <FilePicker
                id="build-images"
                accept="image/*"
                multiple
                ctaText={intl.formatMessage({ id: "build.imagePicker.cta" })}
                helperText={intl.formatMessage({
                  id: "build.imagePicker.helper",
                })}
                aria-labelledby="build-images-label"
                aria-required="true"
                disabled={isSubmitting}
                onFilesChange={handleAddBuildFiles}
              />
              {field.state.meta.errors.length > 0 && (
                <p className="m-0 text-sm font-semibold text-error">
                  {field.state.meta.errors[0]?.(intl)}
                </p>
              )}
            </div>
          )}
        </form.Field>

        <p className="m-0 text-muted-foreground">
          <FormattedMessage
            id="build.selectedCount"
            values={{ count: buildFilesCount }}
          />
        </p>

        {imagePreviews.length > 0 && (
          <div className="grid gap-3">
            <div className="flex flex-row-reverse flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                className="cursor-pointer rounded-lg border border-primary/20 bg-transparent px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-primary-subtle hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isSubmitting}
                onClick={handleOpenPreviewViewer}
              >
                <FormattedMessage id="common.openInComicViewer" />
              </button>
              <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="cursor-pointer rounded-lg border border-error/35 bg-error/10 px-3 py-1.5 text-xs font-semibold text-error transition hover:bg-error/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/45 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isSubmitting}
                onClick={handleRemoveAllImages}
              >
                <FormattedMessage id="build.removeAll" />
              </button>
              <div className="h-4 w-px bg-primary/20" />
              <button
                type="button"
                className="cursor-pointer rounded-lg border border-primary/25 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isSubmitting}
                onClick={handleSortByName}
              >
                <FormattedMessage id="build.sortByName" />
              </button>
              <button
                type="button"
                className="cursor-pointer rounded-lg border border-primary/25 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isSubmitting}
                onClick={handleSortByDate}
              >
                <FormattedMessage id="build.sortByDate" />
              </button>
              </div>
            </div>
            <p className="m-0 text-xs text-muted-foreground">
              <FormattedMessage id="build.dragHint" />
              </p>

            <SortableImagePreviewList
              sensors={sensors}
              imagePreviews={imagePreviews}
              activePreview={activePreview}
              isSubmitting={isSubmitting}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onRemoveImage={handleRemoveImage}
            />
          </div>
        )}

        <form.Field name="cover">
          {(field) => (
            <label
              className="inline-flex items-center gap-2 font-semibold select-none"
              htmlFor="build-cover"
            >
              <input
                id="build-cover"
                type="checkbox"
                checked={field.state.value}
                onChange={handleCoverChange}
                disabled={isSubmitting}
                className="size-4 rounded border-border accent-primary"
              />
              <FormattedMessage id="build.cover" />
            </label>
          )}
        </form.Field>

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
          <span>
            <FormattedMessage
              id={isSubmitting ? "build.submitting" : "build.submit"}
            />
          </span>
        </Button>
      </form>

      {isPreviewViewerOpen && (
        <ComicViewerDialog
          dialogRef={previewViewerDialogRef}
          onClose={handleClosePreviewViewer}
          pages={viewerPages}
          readingDirection={viewerReadingDirection}
          spreadStartIndex={viewerSpreadStartIndex}
          title={buildTitle.trim() || "Untitled"}
        />
      )}

      {error && (
        <p className="mb-0 font-semibold text-error">{error(intl)}</p>
      )}
      {success && (
        <p className="mb-0 font-semibold text-success">{success(intl)}</p>
      )}
    </Card>
  );
};
