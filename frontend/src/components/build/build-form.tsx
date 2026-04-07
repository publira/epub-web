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

import { getSafeImageConcurrency, mapConcurrent } from "../../lib/async";
import {
  compareFilesByLastModified,
  compareFilesByName,
  getFileImagePixels,
  validateSelectedBuildFiles,
} from "../../lib/build";
import {
  formatInteger,
  formatLanguageName,
  formatMiBFromBytes,
  formatSecondsFromMs,
} from "../../lib/format";
import { useAppConfig, useDrop } from "../../lib/hooks";
import { compressImageFile } from "../../lib/image";
import { buildMutationFn, getApiErrorMessage } from "../../lib/mutations";
import { triggerDownload } from "../../lib/utils";
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

export const BuildForm = () => {
  const [error, setError] = useState<string | null>(null);
  const [isClientValidationBlocked, setIsClientValidationBlocked] =
    useState(false);
  const [success, setSuccess] = useState<string | null>(null);
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
    (files: File[]): string | null => {
      if (files.length === 0) {
        return "画像を1枚以上選択してください。";
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
    async (files: File[]): Promise<string | null> => {
      if (config.maxImagePixels <= 0) {
        return null;
      }

      for (const file of files) {
        let pixels: number;
        try {
          pixels = await getFileImagePixels(file);
        } catch {
          return "画像の解像度を確認できませんでした。別の画像でお試しください。";
        }

        if (pixels > config.maxImagePixels) {
          return `画像の解像度は最大 ${formatInteger(config.maxImagePixels)} px です。`;
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

  const setClientValidationError = useCallback((message: string) => {
    setError(message);
    setSuccess(null);
    setIsClientValidationBlocked(true);
  }, []);

  const clearClientValidationBlock = useCallback(() => {
    setIsClientValidationBlocked(false);
  }, []);

  const resetFormRef = useRef<(() => void) | null>(null);

  const mutation = useMutation({
    mutationFn: buildMutationFn,
    onError: (caughtError) => {
      clearClientValidationBlock();
      setError(
        getApiErrorMessage(caughtError, {
          defaultMessage: "ePubの生成に失敗しました。",
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
      setSuccess("ePubを生成してダウンロードしました。");
      resetFormRef.current?.();
    },
  });

  const [defaultLanguage] = config.supportedLanguages;

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
        setError("画像の圧縮処理中にエラーが発生しました。");
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

  resetFormRef.current = form.reset.bind(form);

  const buildFilesCount = useStore(
    form.store,
    (s) => s.values.buildFiles.length
  );
  const buildFiles = useStore(form.store, (s) => s.values.buildFiles);
  const isSubmitting = useStore(form.store, (s) => s.isSubmitting);

  const imagePreviews = useBuildImagePreviews(buildFiles);
  const [activeId, setActiveId] = useState<string | null>(null);

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
          /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i.test(file.name)
      );
      if (imageFiles.length === 0) {
        setError("画像ファイルを選択してください。");
        setSuccess(null);
        return;
      }

      const sortedImageFiles = imageFiles.toSorted(compareFilesByName);
      const nextFiles = [...buildFiles, ...sortedImageFiles];
      if (config.maxPages > 0 && nextFiles.length > config.maxPages) {
        setClientValidationError(
          `ページ数は最大 ${formatInteger(config.maxPages)} ページです。`
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
          /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i.test(file.name)
      );
      if (droppedImages.length === 0) {
        setClientValidationError("画像ファイルをドロップしてください。");
        return;
      }

      const sortedDroppedImages = droppedImages.toSorted(compareFilesByName);
      const nextFiles = [...buildFiles, ...sortedDroppedImages];

      if (config.maxPages > 0 && nextFiles.length > config.maxPages) {
        setClientValidationError(
          `ページ数は最大 ${formatInteger(config.maxPages)} ページです。`
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
      const indexNum = Number.parseInt(index || "0", 10);
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
          setError("画像の圧縮処理中にエラーが発生しました。");
        }
        return;
      }

      if (signal.aborted) {
        return;
      }

      const selectionError = getBuildClientValidationError(compressedFiles);
      if (selectionError) {
        if (!signal.aborted) {
          setError(selectionError);
        }
        return;
      }

      const pixelsError = await getImagePixelsValidationError(compressedFiles);
      if (signal.aborted) {
        return;
      }

      if (pixelsError) {
        setError(pixelsError);
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
    limitItems.push(`1リクエストあたり最大 ${config.maxUploadMB} MiB`);
  }
  if (config.maxPages > 0) {
    limitItems.push(`ePubは最大 ${formatInteger(config.maxPages)} ページ`);
  }
  if (config.maxAssetBytes > 0) {
    limitItems.push(
      `画像1枚あたり最大 ${formatMiBFromBytes(config.maxAssetBytes)}`
    );
  }
  if (config.maxImagePixels > 0) {
    limitItems.push(
      `画像の解像度は最大 ${formatInteger(config.maxImagePixels)} px`
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
      {isFormDragOver && <DropOverlay message="ここに画像ファイルをドロップ" />}

      <LimitNotes title="変換時の制限" items={limitItems} />

      <form className="grid gap-4" onSubmit={handleSubmit}>
        <form.Field name="title">
          {(field) => (
            <div className="grid gap-1.5">
              <label className="font-semibold" htmlFor="build-title">
                タイトル
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
              label="著者"
              items={field.state.value}
              addButtonLabel="追加"
              inputIdPrefix="build-author"
              placeholder="著者名を入力"
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
                  綴じ方向
                </label>
                <SelectInput
                  id="build-direction"
                  value={field.state.value}
                  onValueChange={field.handleChange}
                  disabled={isSubmitting}
                >
                  <option value="rtl">右綴じ (RTL)</option>
                  <option value="ltr">左綴じ (LTR)</option>
                </SelectInput>
              </div>
            )}
          </form.Field>

          <form.Field name="spread">
            {(field) => (
              <div className="grid gap-1.5">
                <label className="font-semibold" htmlFor="build-spread">
                  見開き開始
                </label>
                <SelectInput
                  id="build-spread"
                  value={field.state.value}
                  onValueChange={field.handleChange}
                  disabled={isSubmitting}
                >
                  <option value="right">右ページ</option>
                  <option value="left">左ページ</option>
                  <option value="center">中央</option>
                </SelectInput>
              </div>
            )}
          </form.Field>

          <form.Field name="language">
            {(field) => (
              <div className="grid gap-1.5">
                <label className="font-semibold" htmlFor="build-language">
                  言語
                </label>
                <SelectInput
                  id="build-language"
                  value={field.state.value}
                  onValueChange={field.handleChange}
                  disabled={isSubmitting}
                >
                  {config.supportedLanguages.map((code) => (
                    <option key={code} value={code}>
                      {formatLanguageName(code)}
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
                return "画像を1枚以上選択してください。";
              }
              if (config.maxPages > 0 && value.length > config.maxPages) {
                return `ページ数は最大 ${formatInteger(config.maxPages)} ページです。`;
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
                画像ファイル{" "}
                <span className="text-error" aria-hidden="true">
                  *
                </span>
                <span className="sr-only">必須</span>
              </label>
              <FilePicker
                id="build-images"
                accept="image/*"
                multiple
                ctaText="画像を選択"
                helperText="クリックまたはドラッグ＆ドロップで画像を追加（複数選択可）"
                aria-labelledby="build-images-label"
                aria-required="true"
                disabled={isSubmitting}
                onFilesChange={handleAddBuildFiles}
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
          選択中: {buildFilesCount} ファイル
        </p>

        {imagePreviews.length > 0 && (
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="cursor-pointer rounded-lg border border-error/35 bg-error/10 px-3 py-1.5 text-xs font-semibold text-error transition hover:bg-error/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/45 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isSubmitting}
                onClick={handleRemoveAllImages}
              >
                全削除
              </button>
              <div className="h-4 w-px bg-primary/20" />
              <button
                type="button"
                className="cursor-pointer rounded-lg border border-primary/25 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isSubmitting}
                onClick={handleSortByName}
              >
                名前順
              </button>
              <button
                type="button"
                className="cursor-pointer rounded-lg border border-primary/25 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isSubmitting}
                onClick={handleSortByDate}
              >
                更新日順
              </button>
              <p className="m-0 text-xs text-muted-foreground">
                画像をドラッグして順番を変更できます。
              </p>
            </div>

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
              1枚目を表紙にする
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
            {isSubmitting ? "生成中..." : "ePubを生成してダウンロード"}
          </span>
        </Button>
      </form>

      {error && <p className="mb-0 font-semibold text-error">{error}</p>}
      {success && <p className="mb-0 font-semibold text-success">{success}</p>}
    </Card>
  );
};
