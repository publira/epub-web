import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FormattedMessage } from "react-intl";

import { ComicViewerDialog } from "../comic-viewer/comic-viewer-dialog";
import { Button } from "../ui/button";
import { ScrollRow } from "../ui/scroll-row";

interface ExtractedPreviewItem {
  key: string;
  mimeType: string;
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
  readingDirection: "ltr" | "rtl";
  spreadStartIndex: number;
  viewerTitle: string;
}

export const ExtractedImagesGallery = ({
  extractedCount,
  items,
  previewDimensions,
  onDownloadAllImages,
  onDownloadImage,
  readingDirection,
  spreadStartIndex,
  viewerTitle,
}: ExtractedImagesGalleryProps) => {
  const viewerDialogRef = useRef<HTMLDialogElement>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const viewerPages = useMemo(
    () =>
      items.map((image) => ({
        id: image.key,
        mimeType: image.mimeType,
        src: image.url,
        title: image.name,
      })),
    [items]
  );
  const handleOpenViewer = useCallback(() => {
    setIsViewerOpen(true);
  }, []);
  const handleCloseViewer = useCallback(() => {
    setIsViewerOpen(false);
  }, []);

  useEffect(() => {
    const dialog = viewerDialogRef.current;
    if (isViewerOpen && dialog && !dialog.open) {
      dialog.showModal();
    }
  }, [isViewerOpen]);

  return (
    <div className="mt-6 min-w-0 border-t border-border pt-6">
      <h3 className="mb-3 text-sm font-medium">
        <FormattedMessage
          id="gallery.heading"
          values={{ count: extractedCount }}
        />
      </h3>
      <div className="mb-3 flex flex-row-reverse flex-wrap items-center justify-between gap-2">
        <Button size="sm" variant="ghost" onClick={handleOpenViewer}>
          <FormattedMessage id="common.openInComicViewer" />
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={onDownloadAllImages}>
            <FormattedMessage id="gallery.downloadAll" />
          </Button>
        </div>
      </div>
      <ScrollRow>
        {items.map((image) => (
          <div key={image.key} className="group w-32 shrink-0 snap-start">
            <div className="mb-2 flex aspect-square items-center justify-center overflow-hidden rounded-control bg-muted">
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
            <p className="m-0 mt-1 text-[11px] text-muted-foreground/90">
              {image.sizeLabel} / {previewDimensions[image.key] ?? "..."}
            </p>
            <Button
              className="mt-2 w-full"
              data-image-key={image.key}
              size="sm"
              variant="outline"
              onClick={onDownloadImage}
            >
              <FormattedMessage id="gallery.download" />
            </Button>
          </div>
        ))}
      </ScrollRow>
      {isViewerOpen && (
        <ComicViewerDialog
          dialogRef={viewerDialogRef}
          onClose={handleCloseViewer}
          pages={viewerPages}
          readingDirection={readingDirection}
          spreadStartIndex={spreadStartIndex}
          title={viewerTitle}
        />
      )}
    </div>
  );
};
