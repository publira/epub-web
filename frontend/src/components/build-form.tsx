import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { useStore } from "@tanstack/react-store";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  formatInteger,
  formatMiBFromBytes,
  formatSecondsFromMs,
  formatSizeLabel,
} from "../lib/format";
import { useAppConfig } from "../lib/hooks";
import { buildMutationFn, getApiErrorMessage } from "../lib/mutations";
import { triggerDownload } from "../lib/utils";
import { LimitNotes } from "./limit-notes";
import {
  Card,
  FilePicker,
  PrimaryButton,
  SelectInput,
  TextInput,
} from "./ui/primitives";

const getFileImagePixels = async (file: File): Promise<number> => {
  const bitmap = await createImageBitmap(file);
  const pixels = bitmap.width * bitmap.height;
  bitmap.close();
  return pixels;
};

export const BuildFormSkeleton = () => (
  <Card className="min-w-0 p-fluid-sm animate-pulse">
    <div className="mb-4">
      <div className="mb-1.5 h-4 w-16 rounded bg-muted" />
      <div className="h-10 rounded-xl bg-muted" />
    </div>
    <div className="mb-4 grid gap-3 md:grid-cols-2">
      <div>
        <div className="mb-1.5 h-4 w-20 rounded bg-muted" />
        <div className="h-10 rounded-xl bg-muted" />
      </div>
      <div>
        <div className="mb-1.5 h-4 w-20 rounded bg-muted" />
        <div className="h-10 rounded-xl bg-muted" />
      </div>
    </div>
    <div className="mb-4 h-28 rounded-xl bg-muted" />
    <div className="h-12 rounded-xl bg-muted" />
  </Card>
);

export const BuildForm = () => {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { data: config } = useAppConfig();

  const mutation = useMutation({
    mutationFn: buildMutationFn,
    onError: (caughtError) => {
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
      triggerDownload(blob, filename);
      setSuccess("ePubを生成してダウンロードしました。");
    },
  });

  const form = useForm({
    defaultValues: {
      buildFiles: [] as File[],
      direction: "rtl",
      spread: "right",
      title: "",
    },
    onSubmit: async ({ value }) => {
      setError(null);
      setSuccess(null);

      if (config.maxUploadMB > 0) {
        const totalBytes = value.buildFiles.reduce(
          (sum, file) => sum + file.size,
          0
        );
        const maxUploadBytes = config.maxUploadMB * 1024 * 1024;
        if (totalBytes > maxUploadBytes) {
          setError(`1リクエストあたり最大 ${config.maxUploadMB} MiB です。`);
          return;
        }
      }

      if (config.maxAssetBytes > 0) {
        const oversized = value.buildFiles.find(
          (file) => file.size > config.maxAssetBytes
        );
        if (oversized) {
          setError(
            `画像1枚あたり最大 ${formatMiBFromBytes(config.maxAssetBytes)} です。`
          );
          return;
        }
      }

      if (config.maxImagePixels > 0) {
        for (const file of value.buildFiles) {
          let pixels: number;
          try {
            pixels = await getFileImagePixels(file);
          } catch {
            setError(
              "画像の解像度を確認できませんでした。別の画像でお試しください。"
            );
            return;
          }

          if (pixels > config.maxImagePixels) {
            setError(
              `画像の解像度は最大 ${formatInteger(config.maxImagePixels)} px です。`
            );
            return;
          }
        }
      }

      await mutation.mutateAsync({
        direction: value.direction,
        files: value.buildFiles,
        spread: value.spread,
        title: value.title,
      });
    },
  });

  const buildFilesCount = useStore(
    form.store,
    (s) => s.values.buildFiles.length
  );
  const buildFiles = useStore(form.store, (s) => s.values.buildFiles);
  const isSubmitting = useStore(form.store, (s) => s.isSubmitting);

  const imagePreviews = useMemo(
    () =>
      buildFiles.map((file) => ({
        key: `${file.name}:${file.size}:${file.lastModified}`,
        name: file.name,
        sizeLabel: formatSizeLabel(file.size),
        url: URL.createObjectURL(file),
      })),
    [buildFiles]
  );
  const [previewDimensions, setPreviewDimensions] = useState<
    Record<string, string>
  >({});

  useEffect(
    () => () => {
      for (const preview of imagePreviews) {
        URL.revokeObjectURL(preview.url);
      }
    },
    [imagePreviews]
  );

  useEffect(() => {
    let cancelled = false;

    const loadDimensions = async () => {
      const next: Record<string, string> = {};

      for (const file of buildFiles) {
        const key = `${file.name}:${file.size}:${file.lastModified}`;
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
    <Card className="min-w-0 space-y-2 animate-rise p-fluid-sm">
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
              />
            </label>
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
              画像ファイル
              <FilePicker
                id="build-images"
                accept="image/*"
                multiple
                ctaText="画像を選択"
                helperText="クリックして画像を追加（複数選択可）"
                onFilesChange={field.handleChange}
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
          <div className="flex w-full max-w-full snap-x snap-mandatory gap-3 overflow-x-auto pb-2 touch-pan-x">
            {imagePreviews.map((preview) => (
              <div key={preview.key} className="group w-32 shrink-0 snap-start">
                <div className="mb-2 aspect-square flex items-center justify-center overflow-hidden rounded-lg bg-muted">
                  <img
                    src={preview.url}
                    alt={preview.name}
                    className="h-full w-full object-cover"
                  />
                </div>
                <p
                  className="truncate text-xs text-muted-foreground"
                  title={preview.name}
                >
                  {preview.name}
                </p>
                <p className="mt-1 m-0 text-[11px] text-muted-foreground/90">
                  {preview.sizeLabel} /{" "}
                  {previewDimensions[preview.key] ?? "..."}
                </p>
              </div>
            ))}
          </div>
        )}

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
