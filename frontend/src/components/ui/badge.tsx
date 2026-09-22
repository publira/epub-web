import { twMerge } from "tailwind-merge";

export const Badge = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => (
  <span
    className={twMerge(
      "inline-flex max-w-full items-center gap-1.5 rounded-control border border-border bg-muted px-2.5 py-0.5 text-xs leading-5 font-medium text-foreground",
      className
    )}
    {...props}
  />
);
