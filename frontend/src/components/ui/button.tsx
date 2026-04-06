import { cva } from "class-variance-authority";
import { twMerge } from "tailwind-merge";

const buttonStyles = cva("", {
  compoundVariants: [
    {
      active: true,
      className: "border-primary/45 bg-linear-120 from-primary-tint to-white",
      variant: "tab",
    },
  ],
  defaultVariants: {
    active: false,
    variant: "primary",
  },
  variants: {
    active: {
      false: "",
      true: "",
    },
    variant: {
      primary:
        "cursor-pointer rounded-xl border border-primary/22 bg-linear-120 from-primary to-primary-dark px-4 py-3 font-bold text-slate-50 transition hover:-translate-y-px hover:saturate-110 disabled:cursor-wait disabled:opacity-70",
      tab: "cursor-pointer rounded-xl border border-primary/20 bg-tab px-4 py-3 font-bold transition hover:-translate-y-px hover:saturate-110",
    },
  },
});

type ButtonType = "button" | "submit" | "reset";
type ButtonVariant = "primary" | "tab";

export interface ButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "type"
> {
  active?: boolean;
  type?: ButtonType;
  variant?: ButtonVariant;
}

export const Button = ({
  active = false,
  className,
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps) => {
  const classes = twMerge(buttonStyles({ active, variant }), className);

  // eslint-disable-next-line react/button-has-type
  return <button className={classes} type={type} {...props} />;
};
