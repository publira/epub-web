import { ComicViewer, useViewerContext } from "@publira/comic-viewer";
import type { ViewerPage } from "@publira/comic-viewer";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

import { Dialog } from "../ui/dialog";

interface ComicViewerDialogProps {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  onClose: () => void;
  pages: readonly ViewerPage[];
  readingDirection: "ltr" | "rtl";
  spreadStartIndex: number;
  title: string;
}

interface ReaderViewportProps {
  readingDirection: "ltr" | "rtl";
  spreadStartIndex: number;
}

const navigationButtonClassName =
  "absolute pointer-events-auto grid size-11 cursor-pointer place-items-center rounded-full border border-white/15 bg-slate-950/80 text-slate-50 shadow-lg backdrop-blur transition hover:bg-primary focus-visible:ring-2 focus-visible:ring-secondary focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40";

const readerViewportClassName =
  "flex min-h-0 min-w-0 flex-1 items-stretch overflow-hidden outline-none [&>.pcv-page]:flex [&>.pcv-page]:h-full [&>.pcv-page]:min-h-0 [&>.pcv-page]:min-w-0 [&>.pcv-page]:shrink [&>.pcv-page]:items-center [&>.pcv-page]:justify-center data-[view-mode=double]:[&>.pcv-page]:max-w-1/2 [&>.pcv-page>canvas]:h-full [&>.pcv-page>canvas]:max-h-full [&>.pcv-page>canvas]:w-auto [&>.pcv-page>canvas]:max-w-full [&>.pcv-page>canvas]:bg-slate-900 [&>.pcv-page>canvas]:object-contain";

const ReaderViewport = ({
  readingDirection,
  spreadStartIndex,
}: ReaderViewportProps) => {
  const { currentIndex, pages, viewMode } = useViewerContext();
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
      className={`${readerViewportClassName} ${alignmentClassName}`}
    />
  );
};

export const ComicViewerDialog = ({
  dialogRef,
  onClose,
  pages,
  readingDirection,
  spreadStartIndex,
  title,
}: ComicViewerDialogProps) => {
  const isRtl = readingDirection === "rtl";
  const previousPositionClassName = isRtl ? "right-3" : "left-3";
  const nextPositionClassName = isRtl ? "left-3" : "right-3";
  const PreviousIcon = isRtl ? ChevronRight : ChevronLeft;
  const NextIcon = isRtl ? ChevronLeft : ChevronRight;

  return (
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
          <ReaderViewport
            readingDirection={readingDirection}
            spreadStartIndex={spreadStartIndex}
          />
          <ComicViewer.PageNavigation
            aria-label="ページ移動"
            className="pointer-events-none absolute inset-0 z-10"
          >
            <ComicViewer.PreviousPageButton
              aria-label="前のページ"
              className={`${navigationButtonClassName} ${previousPositionClassName} top-1/2 -translate-y-1/2`}
            >
              <PreviousIcon aria-hidden="true" size={22} />
            </ComicViewer.PreviousPageButton>
            <ComicViewer.NextPageButton
              aria-label="次のページ"
              className={`${navigationButtonClassName} ${nextPositionClassName} top-1/2 -translate-y-1/2`}
            >
              <NextIcon aria-hidden="true" size={22} />
            </ComicViewer.NextPageButton>
            <ComicViewer.PageProgressTrigger
              aria-label="読書位置を表示"
              className="pointer-events-auto absolute inset-y-0 right-[30%] left-[30%] cursor-pointer border-0 bg-transparent"
            />
            <ComicViewer.PageProgress
              aria-label="読書の進行状況"
              className="pointer-events-none absolute inset-x-[20%] bottom-4 grid translate-y-2 gap-1 opacity-0 transition duration-200 aria-[hidden=false]:translate-y-0 aria-[hidden=false]:opacity-100 [&_.pcv-page-progress-track]:h-1 [&_.pcv-page-progress-track]:w-full [&_.pcv-page-progress-track]:overflow-hidden [&_.pcv-page-progress-track]:rounded-full [&_.pcv-page-progress-track]:accent-secondary"
            >
              <ComicViewer.PageStatus
                className="text-center text-xs text-slate-100"
                format={({ firstPage, lastPage, pageCount }) =>
                  firstPage === lastPage
                    ? `${firstPage} / ${pageCount} ページ`
                    : `${firstPage}–${lastPage} / ${pageCount} ページ`
                }
              />
            </ComicViewer.PageProgress>
          </ComicViewer.PageNavigation>
        </ComicViewer>
      </div>
    </Dialog>
  );
};
