import { twMerge } from "tailwind-merge";

export const Badge = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => (
  <span
    className={twMerge(
      "bg-primary-tint text-primary font-heading inline-block rounded-full px-3 py-1.5 text-sm font-bold tracking-wide uppercase",
      className
    )}
    {...props}
  />
);
