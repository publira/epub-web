import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X } from "lucide-react";
import { useCallback, useMemo } from "react";
import { useIntl } from "react-intl";

import { Button } from "./button";
import { TextInput } from "./text-input";

export interface SortableTextFieldItem {
  id: string;
  value: string;
}

interface SortableTextFieldRowProps {
  item: SortableTextFieldItem;
  index: number;
  inputId: string;
  inputAriaLabelledBy: string;
  rowLabelId: string;
  rowLabelText: string;
  disabled?: boolean;
  canRemove?: boolean;
  placeholder?: string;
  onChange: (id: string, value: string) => void;
  onRemove: (id: string) => void;
}

const SortableTextFieldRow = ({
  item,
  index,
  inputId,
  inputAriaLabelledBy,
  rowLabelId,
  rowLabelText,
  disabled,
  canRemove,
  placeholder,
  onChange,
  onRemove,
}: SortableTextFieldRowProps) => {
  const intl = useIntl();
  const itemName =
    item.value ||
    intl.formatMessage({ id: "sortableFields.item" }, { index: index + 1 });
  const dragDisabled = disabled || item.value.trim().length === 0;
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ disabled: dragDisabled, id: item.id });

  const handleValueChange = useCallback(
    (nextValue: string) => {
      onChange(item.id, nextValue);
    },
    [item.id, onChange]
  );

  const handleRemoveClick = useCallback(() => {
    onRemove(item.id);
  }, [item.id, onRemove]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-1">
      <button
        type="button"
        className="inline-flex h-10 w-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-control text-muted-foreground transition-colors duration-state ease-state hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50"
        disabled={dragDisabled}
        aria-label={intl.formatMessage(
          { id: "sortableFields.reorder" },
          { name: itemName }
        )}
        {...attributes}
        {...listeners}
      >
        <GripVertical aria-hidden="true" size={18} strokeWidth={2.25} />
      </button>
      <TextInput
        id={inputId}
        className="pr-3 pl-2"
        type="text"
        value={item.value}
        aria-labelledby={inputAriaLabelledBy}
        onValueChange={handleValueChange}
        placeholder={placeholder}
        maxLength={120}
        disabled={disabled}
      />
      <span id={rowLabelId} className="sr-only">
        {rowLabelText}
      </span>
      <Button
        className="ml-1 size-10 shrink-0"
        size="icon"
        variant="destructive"
        onClick={handleRemoveClick}
        disabled={disabled || !canRemove}
        aria-label={intl.formatMessage(
          { id: "sortableFields.remove" },
          { name: itemName }
        )}
      >
        <X aria-hidden="true" size={18} strokeWidth={2.25} />
      </Button>
    </div>
  );
};

interface AddableSortableTextFieldsProps {
  label: string;
  items: SortableTextFieldItem[];
  addButtonLabel: string;
  inputIdPrefix?: string;
  placeholder?: string;
  disabled?: boolean;
  addDisabled?: boolean;
  onAdd: () => void;
  onChange: (id: string, value: string) => void;
  onRemove: (id: string) => void;
  onReorder: (items: SortableTextFieldItem[]) => void;
}

export const AddableSortableTextFields = ({
  label,
  items,
  addButtonLabel,
  inputIdPrefix = "sortable-text-field",
  placeholder,
  disabled,
  addDisabled,
  onAdd,
  onChange,
  onRemove,
  onReorder,
}: AddableSortableTextFieldsProps) => {
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

  const sortableIds = useMemo(() => items.map((item) => item.id), [items]);

  const handleDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      if (!over || active.id === over.id) {
        return;
      }

      const oldIndex = sortableIds.indexOf(String(active.id));
      const newIndex = sortableIds.indexOf(String(over.id));

      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
        return;
      }

      onReorder(arrayMove(items, oldIndex, newIndex));
    },
    [items, onReorder, sortableIds]
  );

  const groupLabelId = `${inputIdPrefix}-group-label`;
  const lastInputId =
    items.length > 0 ? `${inputIdPrefix}-${items.length - 1}` : undefined;

  return (
    <div className="grid gap-1.5 font-medium">
      {lastInputId ? (
        <label id={groupLabelId} className="m-0" htmlFor={lastInputId}>
          {label}
        </label>
      ) : (
        <p id={groupLabelId} className="m-0">
          {label}
        </p>
      )}
      {items.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sortableIds}
            strategy={verticalListSortingStrategy}
          >
            <div className="mt-1 grid gap-2">
              {items.map((item, index) => {
                const rowLabelId = `${inputIdPrefix}-${index}-label`;
                const rowLabelText = `${label} ${index + 1}`;

                return (
                  <SortableTextFieldRow
                    key={item.id}
                    item={item}
                    index={index}
                    inputId={`${inputIdPrefix}-${index}`}
                    inputAriaLabelledBy={`${groupLabelId} ${rowLabelId}`}
                    rowLabelId={rowLabelId}
                    rowLabelText={rowLabelText}
                    disabled={disabled}
                    canRemove={items.length > 1}
                    placeholder={placeholder}
                    onChange={onChange}
                    onRemove={onRemove}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}
      <div className="mt-1 flex items-center gap-1">
        <div className="h-10 w-8 shrink-0" aria-hidden="true" />
        <Button
          className="shrink-0"
          variant="outline"
          onClick={onAdd}
          disabled={disabled || addDisabled}
        >
          {addButtonLabel}
        </Button>
      </div>
    </div>
  );
};
