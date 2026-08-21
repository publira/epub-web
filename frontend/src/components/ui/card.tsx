import { twMerge } from "tailwind-merge";

export const Card = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={twMerge(
      "border-primary/18 bg-card-surface shadow-card rounded-3xl border",
      className
    )}
    {...props}
  />
);
