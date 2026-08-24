import * as ComicViewer from "@publira/comic-viewer";
import { useViewerContext } from "@publira/comic-viewer";
import type { ViewerPage } from "@publira/comic-viewer";
import { X } from "lucide-react";
import { twMerge } from "tailwind-merge";

import { Dialog } from "../ui/dialog";
import { ReaderPageNavigation, ReaderToolbar } from "./reader-page-navigation";

interface ComicViewerDialogProps {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  onClose: () => void;
  pages: readonly ViewerPage[];
  readingDirection: "ltr" | "rtl";
  spreadStartIndex: number;
  title: string;
}

const ReaderPage = () => (
  <ComicViewer.ViewportPage className="flex h-full min-h-0 min-w-0 flex-1 items-center justify-center">
    <ComicViewer.PageCanvas className="h-full max-h-full w-auto max-w-full bg-slate-900 object-contain" />
  </ComicViewer.ViewportPage>
);

const ReaderViewport = () => {
  const { currentIndex, pages, readingDirection, spreadStartIndex, viewMode } =
    useViewerContext();
  const isDoublePage = viewMode === "double";
  const isLeadingSinglePage = isDoublePage && currentIndex < spreadStartIndex;
  const hasTrailingSinglePage =
    isDoublePage &&
    pages.length > spreadStartIndex &&
    (pages.length - spreadStartIndex) % 2 === 1 &&
    currentIndex === pages.length - 1;
  let alignmentClassName = "justify-center";
  if (isLeadingSinglePage) {
    alignmentClassName = "justify-start";
  } else if (hasTrailingSinglePage) {
    alignmentClassName =
      readingDirection === "rtl" ? "justify-end" : "justify-start";
  }

  return (
    <ComicViewer.Viewport
      aria-label="コミックのページ"
      className="flex min-h-0 min-w-0 flex-1 overflow-hidden outline-none"
    >
      <ComicViewer.ViewportTrack className="flex h-full w-[300%] flex-none basis-[300%] transform-[translateX(-33.3333%)_translateX(var(--pcv-drag-offset,0px))] data-dragging:transition-none data-[transition-state=active]:transition-transform data-[transition-state=active]:duration-260 data-[transition-state=active]:ease-out data-[transition-state=active]:data-[slide-direction=left]:transform-[translateX(-66.6667%)_translateX(var(--pcv-drag-offset,0px))] data-[transition-state=active]:data-[slide-direction=right]:transform-[translateX(0)_translateX(var(--pcv-drag-offset,0px))] motion-reduce:transition-none">
        <ComicViewer.ViewportPageSet
          className={twMerge(
            "flex h-full min-w-0 flex-none basis-1/3 items-stretch",
            alignmentClassName
          )}
        >
          <ComicViewer.ViewportPageSlot className="flex min-w-0 flex-1 items-center justify-center data-[view-mode=double]:max-w-1/2 data-[view-mode=double]:flex-none data-[view-mode=double]:basis-1/2">
            <ReaderPage />
          </ComicViewer.ViewportPageSlot>
        </ComicViewer.ViewportPageSet>
      </ComicViewer.ViewportTrack>
    </ComicViewer.Viewport>
  );
};

export const ComicViewerDialog = ({
  dialogRef,
  onClose,
  pages,
  readingDirection,
  spreadStartIndex,
  title,
}: ComicViewerDialogProps) => (
  <Dialog
    aria-labelledby="comic-viewer-title"
    className="h-[min(92dvh,900px)] max-h-none w-[min(96vw,1280px)] max-w-none overflow-hidden rounded-xl border-primary/30 bg-slate-950 text-slate-50 shadow-2xl backdrop:bg-slate-950/70"
    dialogRef={dialogRef}
    onClose={onClose}
  >
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-white/15 bg-slate-900 px-4 py-3">
        <div className="min-w-0">
          <h2
            id="comic-viewer-title"
            className="m-0 truncate text-base font-bold"
          >
            {title}
          </h2>
          <p className="m-0 mt-0.5 text-xs text-slate-300">
            全 {pages.length} ページ
          </p>
        </div>
        <form method="dialog">
          <button
            aria-label="コミックビューアーを閉じる"
            className="grid size-10 cursor-pointer place-items-center rounded-full text-slate-100 transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-secondary focus-visible:outline-none"
            type="submit"
          >
            <X aria-hidden="true" size={22} />
          </button>
        </form>
      </header>

      <ComicViewer.Root
        className="relative flex min-h-0 flex-1 overflow-hidden bg-slate-950 text-slate-50"
        initialReadingDirection={readingDirection}
        initialViewMode="double"
        pages={pages}
        spreadStartIndex={spreadStartIndex}
      >
        <ReaderViewport />
        <ReaderToolbar />
        <ReaderPageNavigation />
      </ComicViewer.Root>
    </div>
  </Dialog>
);
