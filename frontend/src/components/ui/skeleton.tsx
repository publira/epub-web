import { twMerge } from "tailwind-merge";

export const Skeleton = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={twMerge(
      "border-primary/8 bg-primary/12 animate-pulse rounded-xl border",
      className
    )}
    {...props}
  />
);
