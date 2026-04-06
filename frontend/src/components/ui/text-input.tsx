import { cva } from "class-variance-authority";
import { useCallback } from "react";
import { twMerge } from "tailwind-merge";

const textInputStyles = cva(
  "w-full rounded-xl border border-primary/22 bg-input px-4 py-3 outline-none focus:ring-2 focus:ring-secondary/60 disabled:border-primary/10 disabled:text-foreground/35 disabled:cursor-not-allowed"
);

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
      className={twMerge(textInputStyles(), className)}
      onChange={handleChange}
      {...props}
    />
  );
};
