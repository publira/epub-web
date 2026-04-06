import { twMerge } from "tailwind-merge";

export const Badge = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => (
  <span
    className={twMerge(
      "inline-block rounded-full bg-primary-tint px-3 py-1.5 text-sm font-bold uppercase tracking-wide text-primary font-heading",
      className
    )}
    {...props}
  />
);
