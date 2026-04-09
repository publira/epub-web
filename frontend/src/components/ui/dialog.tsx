import { X } from "lucide-react";
import { twMerge } from "tailwind-merge";

import { useDialogScrollLock } from "../../lib/hooks";

interface DialogProps extends Omit<
  React.DialogHTMLAttributes<HTMLDialogElement>,
  "children" | "ref"
> {
  children: React.ReactNode;
  dialogRef: React.RefObject<HTMLDialogElement | null>;
}

interface DialogContentProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
}

interface DialogCloseProps {
  "aria-label": string;
  className?: string;
}

export const Dialog = ({
  children,
  className,
  dialogRef,
  ...props
}: DialogProps) => {
  useDialogScrollLock(dialogRef);

  return (
    <dialog
      className={twMerge(
        "fixed top-1/2 left-1/2 m-0 max-h-[80dvh] w-[min(680px,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-primary/20 bg-card-surface p-0 text-foreground shadow-card backdrop:bg-slate-900/40",
        className
      )}
      ref={dialogRef}
      {...props}
    >
      {children}
    </dialog>
  );
};

export const DialogContent = ({
  children,
  className,
  ...props
}: DialogContentProps) => (
  <article className={twMerge("p-6", className)} {...props}>
    {children}
  </article>
);

export const DialogClose = ({ className, ...props }: DialogCloseProps) => (
  <form
    className={twMerge("sticky top-4 z-10 ml-auto w-fit", className)}
    method="dialog"
  >
    <button
      className="grid size-9 place-items-center text-primary transition hover:rounded-full hover:bg-primary/10 focus-visible:rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 active:rounded-full active:bg-primary/10"
      type="submit"
      {...props}
    >
      <X aria-hidden="true" size={18} strokeWidth={2.25} />
    </button>
  </form>
);
