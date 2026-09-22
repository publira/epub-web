import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import { twMerge } from "tailwind-merge";

/**
 * A filled control moves its fill one step toward the ink on hover instead of
 * fading out, which would take the label down with it.
 */
export const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-control text-sm font-medium whitespace-nowrap transition-colors duration-state ease-state focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
  {
    compoundVariants: [
      {
        active: true,
        className: "border-primary bg-accent text-accent-foreground",
        variant: "tab",
      },
    ],
    defaultVariants: {
      active: false,
      size: "md",
      variant: "default",
    },
    variants: {
      active: {
        false: "",
        true: "",
      },
      size: {
        icon: "size-9",
        lg: "h-10 px-6",
        md: "h-9 px-4",
        sm: "h-8 px-3",
      },
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-[color-mix(in_oklab,var(--color-primary)_88%,var(--color-foreground))]",
        destructive:
          "border border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground",
        ghost: "text-foreground hover:bg-muted",
        outline: "border border-input bg-card text-foreground hover:bg-muted",
        tab: "border border-input bg-card text-foreground hover:bg-muted",
      },
    },
  }
);

type ButtonType = "button" | "submit" | "reset";

export interface ButtonProps
  extends
    Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type">,
    VariantProps<typeof buttonVariants> {
  type?: ButtonType;
}

export const Button = ({
  active,
  className,
  size,
  type = "button",
  variant,
  ...props
}: ButtonProps) => {
  const classes = twMerge(buttonVariants({ active, size, variant }), className);

  // eslint-disable-next-line react/button-has-type
  return <button className={classes} type={type} {...props} />;
};
