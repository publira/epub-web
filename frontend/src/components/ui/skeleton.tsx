import { twMerge } from "tailwind-merge";

export const Skeleton = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={twMerge(
      "rounded-control bg-muted motion-safe:animate-pulse",
      className
    )}
    {...props}
  />
);
