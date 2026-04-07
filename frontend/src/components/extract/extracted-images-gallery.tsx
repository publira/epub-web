import { ScrollRow } from "../ui/scroll-row";

interface ExtractedPreviewItem {
  key: string;
  name: string;
  sizeLabel: string;
  url: string;
}

interface ExtractedImagesGalleryProps {
  extractedCount: number;
  items: ExtractedPreviewItem[];
  previewDimensions: Record<string, string>;
  onDownloadAllImages: () => void;
  onDownloadImage: React.MouseEventHandler<HTMLButtonElement>;
}

export const ExtractedImagesGallery = ({
  extractedCount,
  items,
  previewDimensions,
  onDownloadAllImages,
  onDownloadImage,
}: ExtractedImagesGalleryProps) => (
  <div className="mt-6 min-w-0 border-t border-current/20 pt-6">
    <h3 className="mb-3 text-sm font-semibold">
      抽出された画像 ({extractedCount})
    </h3>
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="cursor-pointer rounded-lg border border-primary/28 bg-primary-subtle px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary-subtle-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/75"
        onClick={onDownloadAllImages}
      >
        全ダウンロード
      </button>
    </div>
    <ScrollRow>
      {items.map((image) => (
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
            onClick={onDownloadImage}
          >
            ダウンロード
          </button>
        </div>
      ))}
    </ScrollRow>
  </div>
);
