import { twMerge } from "tailwind-merge";

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
