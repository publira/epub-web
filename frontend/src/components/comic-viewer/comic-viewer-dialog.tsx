import { ComicViewer, useViewerContext } from "@publira/comic-viewer";
import type { ViewerPage } from "@publira/comic-viewer";
import { X } from "lucide-react";

import { Dialog } from "../ui/dialog";
import { ReaderPageNavigation } from "./reader-page-navigation";

interface ComicViewerDialogProps {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  onClose: () => void;
  pages: readonly ViewerPage[];
  readingDirection: "ltr" | "rtl";
  spreadStartIndex: number;
  title: string;
}

interface ReaderPageProps {
  isDoublePage: boolean;
}

const ReaderPage = ({ isDoublePage }: ReaderPageProps) => (
  <ComicViewer.ViewportPage
    className={
      isDoublePage
        ? "flex h-full min-h-0 max-w-1/2 min-w-0 flex-1 items-center justify-center"
        : "flex h-full min-h-0 min-w-0 flex-1 items-center justify-center"
    }
  >
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
      className={`flex min-h-0 min-w-0 flex-1 items-stretch overflow-hidden outline-none ${alignmentClassName}`}
    >
      <ReaderPage isDoublePage={isDoublePage} />
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

      <ComicViewer
        className="relative flex min-h-0 flex-1 overflow-hidden bg-slate-950 text-slate-50"
        initialReadingDirection={readingDirection}
        initialViewMode="double"
        pages={pages}
        spreadStartIndex={spreadStartIndex}
      >
        <ReaderViewport />
        <ReaderPageNavigation />
      </ComicViewer>
    </div>
  </Dialog>
);
