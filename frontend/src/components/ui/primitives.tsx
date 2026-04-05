import { useCallback, useState } from "react";
import { twJoin, twMerge } from "tailwind-merge";

export const Card = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={twMerge(
      "rounded-3xl border border-primary/18 bg-card-surface shadow-card",
      className
    )}
    {...props}
  />
);

interface DropOverlayProps {
  message: string;
}

export const DropOverlay = ({ message }: DropOverlayProps) => (
  <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-3xl border-2 border-dashed border-primary/45 bg-slate-900/10 backdrop-blur-sm">
    <div className="rounded-xl border border-primary/35 bg-card-surface/88 px-4 py-3 text-center shadow-lg">
      <p className="m-0 text-sm font-bold text-primary">{message}</p>
    </div>
  </div>
);

export const Badge = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => (
  <span
    className={twMerge(
      "inline-block rounded-full bg-primary-tint px-3 py-1.5 text-sm font-bold uppercase tracking-wide text-primary font-heading",
      className
    )}
    {...props}
  />
);

interface TabButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "type"
> {
  active?: boolean;
  type?: "button" | "submit" | "reset";
}

export const TabButton = function TabButton({
  active = false,
  className,
  type = "button",
  ...props
}: TabButtonProps) {
  const classes = twMerge(
    twJoin(
      "cursor-pointer rounded-xl border border-primary/20 bg-tab px-4 py-3 font-bold transition hover:-translate-y-px hover:saturate-110",
      active && "border-primary/45 bg-linear-120 from-primary-tint to-white",
      className
    )
  );

  switch (type) {
    case "submit": {
      return <button className={classes} type="submit" {...props} />;
    }
    case "reset": {
      return <button className={classes} type="reset" {...props} />;
    }
    default: {
      return <button className={classes} type="button" {...props} />;
    }
  }
};

interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onValueChange?: (value: string) => void;
}

export const TextInput = ({
  className,
  onChange,
  onValueChange,
  ...props
}: TextInputProps) => {
  const handleChange = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (event) => {
      onChange?.(event);
      onValueChange?.(event.target.value);
    },
    [onChange, onValueChange]
  );

  return (
    <input
      className={twMerge(
        "w-full rounded-xl border border-primary/22 bg-input px-4 py-3 outline-none focus:ring-2 focus:ring-secondary/60 disabled:border-primary/10 disabled:text-foreground/35 disabled:cursor-not-allowed",
        className
      )}
      onChange={handleChange}
      {...props}
    />
  );
};

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

interface SelectInputProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  onValueChange?: (value: string) => void;
}

export const SelectInput = ({
  className,
  onChange,
  onValueChange,
  ...props
}: SelectInputProps) => {
  const handleChange = useCallback<React.ChangeEventHandler<HTMLSelectElement>>(
    (event) => {
      onChange?.(event);
      onValueChange?.(event.target.value);
    },
    [onChange, onValueChange]
  );

  return (
    <select
      className={twMerge(
        "w-full appearance-none rounded-xl border border-primary/22 bg-input px-4 py-3 outline-none focus:ring-2 focus:ring-secondary/60 disabled:border-primary/10 disabled:text-foreground/35 disabled:cursor-not-allowed",
        className
      )}
      onChange={handleChange}
      {...props}
    />
  );
};

interface PrimaryButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "type"
> {
  type?: "button" | "submit" | "reset";
}

export const PrimaryButton = function PrimaryButton({
  className,
  type = "button",
  ...props
}: PrimaryButtonProps) {
  const classes = twMerge(
    twJoin(
      "cursor-pointer rounded-xl border border-primary/22 bg-linear-120 from-primary to-primary-dark px-4 py-3 font-bold text-slate-50 transition hover:-translate-y-px hover:saturate-110 disabled:cursor-wait disabled:opacity-70",
      className
    )
  );

  switch (type) {
    case "submit": {
      return <button className={classes} type="submit" {...props} />;
    }
    case "reset": {
      return <button className={classes} type="reset" {...props} />;
    }
    default: {
      return <button className={classes} type="button" {...props} />;
    }
  }
};
