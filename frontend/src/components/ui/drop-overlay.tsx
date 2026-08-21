interface DropOverlayProps {
  message: string;
}

export const DropOverlay = ({ message }: DropOverlayProps) => (
  <div className="border-primary/45 pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-3xl border-2 border-dashed bg-slate-900/10 backdrop-blur-sm">
    <div className="border-primary/35 bg-card-surface/88 rounded-xl border px-4 py-3 text-center shadow-lg">
      <p className="text-primary m-0 text-sm font-bold">{message}</p>
    </div>
  </div>
);
