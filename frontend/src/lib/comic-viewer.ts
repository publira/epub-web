export type ComicViewerReadingDirection = "ltr" | "rtl";
export type ComicViewerSpreadPosition = "center" | "left" | "right";

interface GetSpreadStartIndexOptions {
  pageCount: number;
  readingDirection: ComicViewerReadingDirection;
  firstPageSpread: ComicViewerSpreadPosition;
}

/**
 * Returns the zero-based page at which the viewer should begin pairing pages.
 * A first page on the reading side starts a spread immediately; otherwise the
 * first page is shown alone and pairing begins with the following page.
 */
export const getSpreadStartIndex = ({
  pageCount,
  readingDirection,
  firstPageSpread,
}: GetSpreadStartIndexOptions): number => {
  if (pageCount < 2) {
    return pageCount;
  }

  if (firstPageSpread === "center") {
    return 1;
  }

  const startsOnReadingSide =
    (readingDirection === "rtl" && firstPageSpread === "right") ||
    (readingDirection === "ltr" && firstPageSpread === "left");

  return startsOnReadingSide ? 0 : 1;
};
