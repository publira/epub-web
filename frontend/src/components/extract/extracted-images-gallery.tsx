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
        className="border-primary/28 bg-primary-subtle text-primary hover:bg-primary-subtle-hover focus-visible:ring-secondary/75 cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-semibold transition focus-visible:ring-2 focus-visible:outline-none"
        onClick={onDownloadAllImages}
      >
        全ダウンロード
      </button>
    </div>
    <ScrollRow>
      {items.map((image) => (
        <div key={image.key} className="group w-32 shrink-0 snap-start">
          <div className="bg-muted mb-2 flex aspect-square items-center justify-center overflow-hidden rounded-lg">
            <img
              src={image.url}
              alt={image.name}
              className="h-full w-full object-cover"
            />
          </div>
          <p
            className="text-muted-foreground truncate text-xs"
            title={image.name}
          >
            {image.name}
          </p>
          <p className="text-muted-foreground/90 m-0 mt-1 text-[11px]">
            {image.sizeLabel} / {previewDimensions[image.key] ?? "..."}
          </p>
          <button
            type="button"
            data-image-key={image.key}
            className="border-primary/28 bg-primary-subtle text-primary hover:bg-primary-subtle-hover focus-visible:ring-secondary/75 mt-2 w-full cursor-pointer rounded-lg border px-2 py-1 text-[11px] font-semibold transition focus-visible:ring-2 focus-visible:outline-none"
            onClick={onDownloadImage}
          >
            ダウンロード
          </button>
        </div>
      ))}
    </ScrollRow>
  </div>
);
