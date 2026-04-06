import { cva } from "class-variance-authority";
import { useCallback } from "react";
import { twMerge } from "tailwind-merge";

const selectInputStyles = cva(
  "w-full appearance-none rounded-xl border border-primary/22 bg-input px-4 py-3 outline-none focus:ring-2 focus:ring-secondary/60 disabled:border-primary/10 disabled:text-foreground/35 disabled:cursor-not-allowed"
);

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
      className={twMerge(selectInputStyles(), className)}
      onChange={handleChange}
      {...props}
    />
  );
};
