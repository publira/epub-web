import { DndContext, DragOverlay, closestCenter } from "@dnd-kit/core";
import type {
  DragEndEvent,
  DragStartEvent,
  SensorDescriptor,
  SensorOptions,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useMemo } from "react";

import { buildFileKey } from "../../lib/build";
import {
  ImagePreviewCard,
  SortableImagePreviewCard,
} from "./image-preview-cards";
import type { ImagePreview } from "./image-preview-cards";

interface SortableImagePreviewListProps {
  sensors: SensorDescriptor<SensorOptions>[];
  imagePreviews: ImagePreview[];
  activePreview: ImagePreview | null;
  buildFiles: File[];
  previewDimensions: Record<string, string>;
  isSubmitting: boolean;
  onDragStart: (event: DragStartEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
  onRemoveImage: React.MouseEventHandler<HTMLButtonElement>;
}

export const SortableImagePreviewList = ({
  sensors,
  imagePreviews,
  activePreview,
  buildFiles,
  previewDimensions,
  isSubmitting,
  onDragStart,
  onDragEnd,
  onRemoveImage,
}: SortableImagePreviewListProps) => {
  const sortablePreviewIds = useMemo(
    () => imagePreviews.map((preview) => preview.id),
    [imagePreviews]
  );

  const getDimensionsLabel = (index: number): string => {
    const file = buildFiles[index];
    if (!file) {
      return "...";
    }
    return previewDimensions[buildFileKey(file)] ?? "...";
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
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
              dimensionsLabel={getDimensionsLabel(preview.index)}
              disabled={isSubmitting}
              onRemove={onRemoveImage}
            />
          ))}
        </div>
      </SortableContext>
      <DragOverlay>
        {activePreview !== null && (
          <ImagePreviewCard
            preview={activePreview}
            dimensionsLabel={getDimensionsLabel(activePreview.index)}
          />
        )}
      </DragOverlay>
    </DndContext>
  );
};
