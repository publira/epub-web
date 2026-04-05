import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import {
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  SortableContext,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { useStore } from "@tanstack/react-store";
import { X } from "lucide-react";
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
} from "../lib/format";
import { useAppConfig, useDrop } from "../lib/hooks";
import { buildMutationFn, getApiErrorMessage } from "../lib/mutations";
import { triggerDownload } from "../lib/utils";
import { LimitNotes } from "./limit-notes";
import { AddableSortableTextFields } from "./ui/addable-sortable-text-fields";
import type { SortableTextFieldItem } from "./ui/addable-sortable-text-fields";
import {
  Card,
  DropOverlay,
  FilePicker,
  PrimaryButton,
  SelectInput,
  TextInput,
} from "./ui/primitives";
import { Skeleton } from "./ui/skeleton";

const getFileImagePixels = async (file: File): Promise<number> => {
  const bitmap = await createImageBitmap(file);
  const pixels = bitmap.width * bitmap.height;
  bitmap.close();
  return pixels;
};

const buildFileKey = (file: File) =>
  `${file.name}:${file.size}:${file.lastModified}`;

const validateSelectedBuildFiles = (
  files: File[],
  options: {
    maxPages: number;
    maxUploadMB: number;
    maxAssetBytes: number;
  }
): string | null => {
  if (options.maxPages > 0 && files.length > options.maxPages) {
    return `ページ数は最大 ${formatInteger(options.maxPages)} ページです。`;
  }

  if (options.maxUploadMB > 0) {
    const maxUploadBytes = options.maxUploadMB * 1024 * 1024;
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    if (totalBytes > maxUploadBytes) {
      return `1リクエストあたり最大 ${options.maxUploadMB} MiB です。`;
    }
  }

  if (options.maxAssetBytes > 0) {
    const oversized = files.find((file) => file.size > options.maxAssetBytes);
    if (oversized) {
      return `画像1枚あたり最大 ${formatMiBFromBytes(options.maxAssetBytes)} です。`;
    }
  }

  return null;
};

interface ImagePreview {
  id: string;
  index: number;
  name: string;
  sizeLabel: string;
  url: string;
}

interface SortableImagePreviewCardProps {
  preview: ImagePreview;
  dimensionsLabel: string;
  disabled?: boolean;
  onRemove: React.MouseEventHandler<HTMLButtonElement>;
}

const ImagePreviewCard = ({
  preview,
  dimensionsLabel,
}: {
  preview: ImagePreview;
  dimensionsLabel: string;
}) => (
  <div className="w-32 shrink-0">
    <div className="mb-2 aspect-square flex cursor-grabbing items-center justify-center overflow-hidden rounded-lg bg-muted shadow-lg ring-2 ring-primary/30">
      <img
        src={preview.url}
        alt={preview.name}
        className="h-full w-full object-cover"
      />
    </div>
    <p className="truncate text-xs text-muted-foreground" title={preview.name}>
      {preview.name}
    </p>
    <p className="mt-1 m-0 text-[11px] text-muted-foreground/90">
      {preview.sizeLabel} / {dimensionsLabel}
    </p>
  </div>
);

const SortableImagePreviewCard = ({
  preview,
  dimensionsLabel,
  disabled,
  onRemove,
}: SortableImagePreviewCardProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ disabled, id: preview.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group w-32 shrink-0 snap-start"
    >
      <div
        className="relative mb-2 aspect-square flex cursor-grab items-center justify-center overflow-hidden rounded-lg bg-muted active:cursor-grabbing"
        style={{ opacity: isDragging ? 0.3 : 1 }}
        {...attributes}
        {...listeners}
      >
        <img
          src={preview.url}
          alt={preview.name}
          className="h-full w-full object-cover"
        />
        {disabled && (
          <div
            className="pointer-events-auto absolute inset-0 z-10 rounded-lg bg-background/50 backdrop-blur-xs"
            aria-hidden="true"
          />
        )}
        <button
          type="button"
          data-index={preview.index}
          className="absolute top-1.5 right-1.5 inline-flex size-7 cursor-pointer touch-none items-center justify-center rounded-full border border-slate-900/20 bg-slate-50/90 text-slate-700 shadow-sm transition hover:scale-105 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/75 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={disabled}
          onClick={onRemove}
          aria-label={`${preview.name} を選択から削除`}
        >
          <X aria-hidden="true" size={14} strokeWidth={2.25} />
        </button>
      </div>
      <p
        className="truncate text-xs text-muted-foreground"
        title={preview.name}
      >
        {preview.name}
      </p>
      <p className="mt-1 m-0 text-[11px] text-muted-foreground/90">
        {preview.sizeLabel} / {dimensionsLabel}
      </p>
    </div>
  );
};

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

  const form = useForm({
    defaultValues: {
      authors: defaultAuthorFields,
      buildFiles: [] as File[],
      direction: "rtl",
      spread: "right",
      title: "",
    },
    onSubmit: async ({ value }) => {
      setError(null);
      setSuccess(null);

      const title = value.title.trim();
      const selectedFiles = [...value.buildFiles];

      const selectionError = getBuildClientValidationError(selectedFiles);
      if (selectionError) {
        setClientValidationError(selectionError);
        return;
      }

      const pixelsError = await getImagePixelsValidationError(selectedFiles);
      if (pixelsError) {
        setClientValidationError(pixelsError);
        return;
      }

      clearClientValidationBlock();

      const authors = value.authors
        .map((author) => author.value.trim())
        .filter((name) => name.length > 0);

      await mutation.mutateAsync({
        authors,
        direction: value.direction,
        files: selectedFiles,
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

  const objectUrlCacheRef = useRef<Map<string, string>>(new Map());
  const [activeId, setActiveId] = useState<string | null>(null);

  const imagePreviews = useMemo(() => {
    const cache = objectUrlCacheRef.current;
    const activeKeys = new Set<string>();

    const previews = buildFiles.map((file, index) => {
      const key = buildFileKey(file);
      activeKeys.add(key);

      let url = cache.get(key);
      if (!url) {
        url = URL.createObjectURL(file);
        cache.set(key, url);
      }

      return {
        id: `${key}:${index}`,
        index,
        name: file.name,
        sizeLabel: formatSizeLabel(file.size),
        url,
      };
    });

    for (const [key, url] of cache) {
      if (!activeKeys.has(key)) {
        URL.revokeObjectURL(url);
        cache.delete(key);
      }
    }

    return previews;
  }, [buildFiles]);
  const sortablePreviewIds = useMemo(
    () => imagePreviews.map((preview) => preview.id),
    [imagePreviews]
  );
  const activePreview = useMemo(() => {
    if (activeId === null) {
      return null;
    }

    return imagePreviews.find((preview) => preview.id === activeId) ?? null;
  }, [activeId, imagePreviews]);
  const [previewDimensions, setPreviewDimensions] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    const cache = objectUrlCacheRef.current;
    return () => {
      for (const url of cache.values()) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadDimensions = async () => {
      const next: Record<string, string> = {};

      for (const file of buildFiles) {
        const key = buildFileKey(file);
        try {
          const bitmap = await createImageBitmap(file);
          next[key] = `${bitmap.width}x${bitmap.height}`;
          bitmap.close();
        } catch {
          next[key] = "-";
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
  }, [buildFiles]);

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

      const nextFiles = [...buildFiles, ...imageFiles];
      const validationError = validateSelectedBuildFiles(nextFiles, {
        maxAssetBytes: config.maxAssetBytes,
        maxPages: config.maxPages,
        maxUploadMB: config.maxUploadMB,
      });
      if (validationError) {
        setClientValidationError(validationError);
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
      config.maxAssetBytes,
      config.maxPages,
      config.maxUploadMB,
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

      const nextFiles = [...buildFiles, ...droppedImages];

      const validationError = validateSelectedBuildFiles(nextFiles, {
        maxAssetBytes: config.maxAssetBytes,
        maxPages: config.maxPages,
        maxUploadMB: config.maxUploadMB,
      });
      if (validationError) {
        setClientValidationError(validationError);
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
      config.maxAssetBytes,
      config.maxPages,
      config.maxUploadMB,
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

  const revalidateIfBlocked = useEffectEvent(
    async (isCancelled: () => boolean) => {
      if (!isClientValidationBlocked) {
        return;
      }

      const selectionError = getBuildClientValidationError(buildFiles);
      if (selectionError) {
        if (!isCancelled()) {
          setError(selectionError);
        }
        return;
      }

      const pixelsError = await getImagePixelsValidationError(buildFiles);
      if (isCancelled()) {
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
    let cancelled = false;
    void revalidateIfBlocked(() => cancelled);
    return () => {
      cancelled = true;
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
            <label className="grid gap-1.5 font-semibold" htmlFor="build-title">
              タイトル
              <TextInput
                id="build-title"
                type="text"
                value={field.state.value}
                onValueChange={field.handleChange}
                placeholder="Untitled"
                maxLength={120}
                disabled={isSubmitting}
              />
            </label>
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

        <div className="grid gap-3 md:grid-cols-2">
          <form.Field name="direction">
            {(field) => (
              <label
                className="grid gap-1.5 font-semibold"
                htmlFor="build-direction"
              >
                綴じ方向
                <SelectInput
                  id="build-direction"
                  value={field.state.value}
                  onValueChange={field.handleChange}
                  disabled={isSubmitting}
                >
                  <option value="rtl">右綴じ (RTL)</option>
                  <option value="ltr">左綴じ (LTR)</option>
                </SelectInput>
              </label>
            )}
          </form.Field>

          <form.Field name="spread">
            {(field) => (
              <label
                className="grid gap-1.5 font-semibold"
                htmlFor="build-spread"
              >
                見開き開始
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
              </label>
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
            <label
              className="grid gap-1.5 font-semibold"
              htmlFor="build-images"
            >
              <span>
                画像ファイル{" "}
                <span className="text-error" aria-hidden="true">
                  *
                </span>
                <span className="sr-only">必須</span>
              </span>
              <FilePicker
                id="build-images"
                accept="image/*"
                multiple
                ctaText="画像を選択"
                helperText="クリックまたはドラッグ＆ドロップで画像を追加（複数選択可）"
                aria-label="画像ファイル（必須）"
                aria-required="true"
                disabled={isSubmitting}
                onFilesChange={handleAddBuildFiles}
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
              <p className="m-0 text-xs text-muted-foreground">
                画像をドラッグして順番を変更できます。
              </p>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={sortablePreviewIds}
                strategy={horizontalListSortingStrategy}
              >
                <div className="flex w-full max-w-full snap-x snap-mandatory gap-3 overflow-x-auto pb-2 touch-pan-x">
                  {imagePreviews.map((preview) => (
                    <SortableImagePreviewCard
                      key={preview.id}
                      preview={preview}
                      dimensionsLabel={
                        previewDimensions[
                          buildFileKey(buildFiles[preview.index])
                        ] ?? "..."
                      }
                      disabled={isSubmitting}
                      onRemove={handleRemoveImage}
                    />
                  ))}
                </div>
              </SortableContext>
              <DragOverlay>
                {activePreview !== null && (
                  <ImagePreviewCard
                    preview={activePreview}
                    dimensionsLabel={
                      previewDimensions[
                        buildFileKey(buildFiles[activePreview.index])
                      ] ?? "..."
                    }
                  />
                )}
              </DragOverlay>
            </DndContext>
          </div>
        )}

        <PrimaryButton
          className="inline-flex items-center justify-center gap-2"
          type="submit"
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
        </PrimaryButton>
      </form>

      {error && <p className="mb-0 font-semibold text-error">{error}</p>}
      {success && <p className="mb-0 font-semibold text-success">{success}</p>}
    </Card>
  );
};
