import { describe, expect, it } from "vitest";

import { getSpreadStartIndex } from "./comic-viewer";

describe("viewer spread grouping", () => {
  it.each([
    {
      firstPageSpread: "right",
      pageCount: 0,
      readingDirection: "rtl",
      want: 0,
    },
    {
      firstPageSpread: "right",
      pageCount: 1,
      readingDirection: "rtl",
      want: 1,
    },
    {
      firstPageSpread: "center",
      pageCount: 2,
      readingDirection: "rtl",
      want: 1,
    },
    {
      firstPageSpread: "right",
      pageCount: 2,
      readingDirection: "rtl",
      want: 0,
    },
    { firstPageSpread: "left", pageCount: 2, readingDirection: "rtl", want: 1 },
    { firstPageSpread: "left", pageCount: 2, readingDirection: "ltr", want: 0 },
    {
      firstPageSpread: "right",
      pageCount: 2,
      readingDirection: "ltr",
      want: 1,
    },
  ] as const)(
    "returns $want for $readingDirection/$firstPageSpread with $pageCount pages",
    ({ firstPageSpread, pageCount, readingDirection, want }) => {
      expect(
        getSpreadStartIndex({
          firstPageSpread,
          pageCount,
          readingDirection,
        })
      ).toBe(want);
    }
  );
});
