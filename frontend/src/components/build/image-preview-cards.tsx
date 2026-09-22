import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { X } from "lucide-react";
import type { MouseEventHandler } from "react";
import { useIntl } from "react-intl";

import { formatLastModified } from "#lib/format";

export interface ImagePreview {
  id: string;
  mimeType: string;
  index: number;
  lastModified: number;
  name: string;
  url: string;
}

interface SortableImagePreviewCardProps {
  preview: ImagePreview;
  disabled?: boolean;
  onRemove: MouseEventHandler<HTMLButtonElement>;
}

export const ImagePreviewCard = ({ preview }: { preview: ImagePreview }) => {
  const intl = useIntl();

  return (
  <div className="w-32 shrink-0">
    <div className="mb-2 aspect-square flex cursor-grabbing items-center justify-center overflow-hidden rounded-control bg-muted shadow-floating ring-2 ring-ring">
      <img
        src={preview.url}
        alt={preview.name}
        className="h-full w-full object-cover"
      />
    </div>
    <p className="truncate text-xs text-muted-foreground" title={preview.name}>
      {preview.name}
    </p>
    <p className="mt-1 m-0 text-[11px] text-muted-foreground/70">
      {formatLastModified(intl, preview.lastModified)}
    </p>
  </div>
  );
};

export const SortableImagePreviewCard = ({
  preview,
  disabled,
  onRemove,
}: SortableImagePreviewCardProps) => {
  const intl = useIntl();
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
        className="relative mb-2 aspect-square flex cursor-grab items-center justify-center overflow-hidden rounded-control bg-muted active:cursor-grabbing"
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
            className="pointer-events-auto absolute inset-0 z-10 bg-background/50 backdrop-blur-xs"
            aria-hidden="true"
          />
        )}
        <button
          type="button"
          data-index={preview.index}
          className="absolute top-1.5 right-1.5 inline-flex size-7 cursor-pointer touch-none items-center justify-center rounded-control border border-border bg-card/90 text-foreground transition-colors duration-state ease-state hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          disabled={disabled}
          onClick={onRemove}
          aria-label={intl.formatMessage(
            { id: "build.removeImage" },
            { name: preview.name }
          )}
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
      <p className="mt-1 m-0 text-[11px] text-muted-foreground/70">
        {formatLastModified(intl, preview.lastModified)}
      </p>
    </div>
  );
};
