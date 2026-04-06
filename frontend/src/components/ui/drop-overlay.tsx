interface DropOverlayProps {
  message: string;
}

export const DropOverlay = ({ message }: DropOverlayProps) => (
  <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-3xl border-2 border-dashed border-primary/45 bg-slate-900/10 backdrop-blur-sm">
    <div className="rounded-xl border border-primary/35 bg-card-surface/88 px-4 py-3 text-center shadow-lg">
      <p className="m-0 text-sm font-bold text-primary">{message}</p>
    </div>
  </div>
);
