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
    <label
      className={twMerge(
        twJoin(
          "block w-full rounded-xl border border-dashed border-primary/30 bg-primary-subtle px-4 py-4 transition",
          !disabled && "cursor-pointer hover:bg-primary-subtle-hover",
          disabled && "cursor-not-allowed opacity-50",
          isDragOver &&
            !disabled &&
            "border-primary/55 bg-primary-subtle-hover ring-2 ring-secondary/50"
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
      <span className="block text-sm font-semibold text-primary">
        {ctaText}
      </span>
      {helperText ? (
        <span className="mt-1 block text-xs text-muted-foreground">
          {helperText}
        </span>
      ) : null}
    </label>
  );
};
