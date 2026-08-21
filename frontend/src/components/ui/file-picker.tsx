import { useCallback, useState } from "react";
import { twJoin, twMerge } from "tailwind-merge";

interface FilePickerProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type"
> {
  ctaText: string;
  helperText?: string;
  onFileChange?: (file: File | null) => void;
  onFilesChange?: (files: File[]) => void;
}

export const FilePicker = ({
  className,
  ctaText,
  helperText,
  onChange,
  onFileChange,
  onFilesChange,
  multiple,
  disabled,
  ...props
}: FilePickerProps) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const applyFiles = useCallback(
    (files: File[]) => {
      if (disabled) {
        return;
      }
      if (multiple) {
        onFilesChange?.(files);
        return;
      }

      onFileChange?.(files[0] ?? null);
    },
    [disabled, multiple, onFileChange, onFilesChange]
  );

  const handleChange = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (event) => {
      onChange?.(event);
      applyFiles([...(event.target.files ?? [])]);
    },
    [applyFiles, onChange]
  );

  const handleDragEnter = useCallback<React.DragEventHandler<HTMLLabelElement>>(
    (event) => {
      event.preventDefault();
      if (!disabled) {
        setIsDragOver(true);
      }
    },
    [disabled]
  );

  const handleDragOver = useCallback<React.DragEventHandler<HTMLLabelElement>>(
    (event) => {
      event.preventDefault();
      if (!disabled && !isDragOver) {
        setIsDragOver(true);
      }
    },
    [disabled, isDragOver]
  );

  const handleDragLeave = useCallback<React.DragEventHandler<HTMLLabelElement>>(
    (event) => {
      event.preventDefault();
      const nextTarget = event.relatedTarget;
      if (nextTarget && event.currentTarget.contains(nextTarget as Node)) {
        return;
      }
      setIsDragOver(false);
    },
    []
  );

  const handleDrop = useCallback<React.DragEventHandler<HTMLLabelElement>>(
    (event) => {
      event.preventDefault();
      setIsDragOver(false);
      applyFiles([...(event.dataTransfer.files ?? [])]);
    },
    [applyFiles]
  );

  return (
    // Drag-and-drop target is intentionally a label wrapping the file input.
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <label
      className={twMerge(
        twJoin(
          "border-primary/30 bg-primary-subtle block w-full rounded-xl border border-dashed px-4 py-4 transition",
          !disabled && "hover:bg-primary-subtle-hover cursor-pointer",
          disabled && "cursor-not-allowed opacity-50",
          isDragOver &&
            !disabled &&
            "border-primary/55 bg-primary-subtle-hover ring-secondary/50 ring-2"
        ),
        className
      )}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        className="sr-only"
        type="file"
        multiple={multiple}
        disabled={disabled}
        onChange={handleChange}
        {...props}
      />
      <span className="text-primary block text-sm font-semibold">
        {ctaText}
      </span>
      {helperText ? (
        <span className="text-muted-foreground mt-1 block text-xs">
          {helperText}
        </span>
      ) : null}
    </label>
  );
};
