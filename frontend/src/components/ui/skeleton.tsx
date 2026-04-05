import { twMerge } from "tailwind-merge";

export const Skeleton = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={twMerge("animate-pulse rounded-xl bg-muted", className)}
    {...props}
  />
);
