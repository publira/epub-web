interface DropOverlayProps {
  message: string;
}

export const DropOverlay = ({ message }: DropOverlayProps) => (
  <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center border-2 border-dashed border-primary bg-foreground/10 backdrop-blur-xs">
    <div className="rounded-surface border border-border bg-popover px-4 py-3 text-center text-popover-foreground shadow-floating">
      <p className="m-0 text-sm font-medium text-primary">{message}</p>
    </div>
  </div>
);
