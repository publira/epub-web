import * as ComicViewer from "@publira/comic-viewer";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { twMerge } from "tailwind-merge";

interface ReaderNavigationButtonProps {
  children: ReactNode;
  className: string;
  direction: "next" | "previous";
}

interface ReaderNavigationIconProps {
  direction: "next" | "previous";
}

const ReaderNavigationButton = ({
  children,
  className,
  direction,
}: ReaderNavigationButtonProps) => {
  const buttonClassName = twMerge(
    "pointer-events-auto absolute top-1/2 grid size-11 -translate-y-1/2 cursor-pointer place-items-center rounded-full border border-white/15 bg-slate-950/80 text-slate-50 shadow-lg backdrop-blur transition hover:bg-primary focus-visible:ring-2 focus-visible:ring-secondary focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40",
    className
  );

  return direction === "previous" ? (
    <ComicViewer.PreviousPageButton
      aria-label="前のページ"
      className={buttonClassName}
    >
      {children}
    </ComicViewer.PreviousPageButton>
  ) : (
    <ComicViewer.NextPageButton
      aria-label="次のページ"
      className={buttonClassName}
    >
      {children}
    </ComicViewer.NextPageButton>
  );
};

const ReaderNavigationIcon = ({ direction }: ReaderNavigationIconProps) =>
  direction === "previous" ? (
    <>
      <ChevronLeft aria-hidden="true" className="rtl:hidden" size={22} />
      <ChevronRight aria-hidden="true" className="hidden rtl:block" size={22} />
    </>
  ) : (
    <>
      <ChevronRight aria-hidden="true" className="rtl:hidden" size={22} />
      <ChevronLeft aria-hidden="true" className="hidden rtl:block" size={22} />
    </>
  );

export const ReaderPageNavigation = () => (
  <ComicViewer.PageNavigation
    aria-label="ページ移動"
    className="pointer-events-none absolute inset-0 z-10 transition duration-200 aria-hidden:translate-y-2 aria-hidden:opacity-0 motion-reduce:transition-none"
  >
    <ReaderNavigationButton
      className="left-3 rtl:right-3 rtl:left-auto"
      direction="previous"
    >
      <ReaderNavigationIcon direction="previous" />
    </ReaderNavigationButton>
    <ReaderNavigationButton
      className="right-3 rtl:right-auto rtl:left-3"
      direction="next"
    >
      <ReaderNavigationIcon direction="next" />
    </ReaderNavigationButton>
  </ComicViewer.PageNavigation>
);

export const ReaderToolbar = () => (
  <ComicViewer.Toolbar className="absolute inset-x-0 bottom-0 z-10 flex items-center bg-linear-to-t from-black/80 via-black/55 to-transparent px-4 pt-8 pb-4 transition duration-200 aria-hidden:pointer-events-none aria-hidden:translate-y-2 aria-hidden:opacity-0 motion-reduce:transition-none">
    <ComicViewer.PageProgress
      aria-label="読書の進行状況"
      className="pointer-events-none mx-auto grid w-3/5 min-w-0 gap-1"
    >
      <ComicViewer.PageProgressTrack className="h-1 w-full overflow-hidden rounded-full bg-black/65 accent-secondary [&::-moz-progress-bar]:bg-secondary [&::-webkit-progress-bar]:bg-transparent [&::-webkit-progress-value]:bg-secondary" />
      <ComicViewer.PageStatus
        className="text-center text-xs text-slate-100"
        format={({ firstPage, lastPage, pageCount }) =>
          firstPage === lastPage
            ? `${firstPage} / ${pageCount} ページ`
            : `${firstPage}–${lastPage} / ${pageCount} ページ`
        }
      />
    </ComicViewer.PageProgress>
  </ComicViewer.Toolbar>
);
