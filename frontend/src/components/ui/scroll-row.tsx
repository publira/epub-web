import { twMerge } from "tailwind-merge";

export const ScrollRow = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={twMerge(
      "flex min-w-0 snap-x snap-mandatory gap-3 overflow-x-auto pb-2 touch-pan-x",
      className
    )}
    {...props}
  />
);
