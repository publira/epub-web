import { cva } from "class-variance-authority";
import { useCallback } from "react";
import { twMerge } from "tailwind-merge";

const selectInputStyles = cva(
  "h-10 w-full rounded-control border border-input bg-card px-3 py-2 text-sm text-foreground transition-colors duration-state ease-state outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
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
