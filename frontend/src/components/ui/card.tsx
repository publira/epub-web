import { twMerge } from "tailwind-merge";

/**
 * An in-flow surface: a step from the page to `card` and one hairline, not a
 * radius or a shadow, which belong to layers that float above the page.
 */
export const Card = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={twMerge(
      "border border-border bg-card text-card-foreground",
      className
    )}
    {...props}
  />
);
