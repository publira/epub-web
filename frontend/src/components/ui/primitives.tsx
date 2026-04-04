import { useCallback } from "react";
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

export const Badge = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => (
  <span
    className={twMerge(
      "inline-block rounded-full bg-primary-tint px-3 py-1.5 text-sm font-bold uppercase tracking-badge text-primary font-heading",
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
        "w-full rounded-xl border border-primary/22 bg-input px-4 py-3 outline-none focus:ring-2 focus:ring-secondary/60",
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
  ...props
}: FilePickerProps) => {
  const handleChange = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (event) => {
      onChange?.(event);
      if (multiple) {
        onFilesChange?.([...(event.target.files ?? [])]);
        return;
      }

      onFileChange?.(event.target.files?.[0] ?? null);
    },
    [multiple, onChange, onFileChange, onFilesChange]
  );

  return (
    <label
      className={twMerge(
        "block w-full cursor-pointer rounded-xl border border-dashed border-primary/30 bg-primary-subtle px-4 py-4 transition hover:bg-primary-subtle-hover",
        className
      )}
    >
      <input
        className="sr-only"
        type="file"
        multiple={multiple}
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
        "w-full rounded-xl border border-primary/22 bg-input px-4 py-3 outline-none focus:ring-2 focus:ring-secondary/60",
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
