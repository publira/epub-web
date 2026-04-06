import { setTimeout as delay } from "node:timers/promises";

import { mapConcurrent, getSafeImageConcurrency } from "./async";

describe("mapConcurrent()", () => {
  it("executes tasks in order", async () => {
    const results = await mapConcurrent([1, 2, 3], 2, (item) =>
      Promise.resolve(item * 2)
    );

    expect(results).toStrictEqual([2, 4, 6]);
  }, 1000);

  it("respects concurrency limit", async () => {
    let concurrent = 0;
    let maxConcurrent = 0;

    const task = (): Promise<void> => {
      concurrent += 1;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      return delay(10).then(() => {
        concurrent -= 1;
      });
    };

    await mapConcurrent([1, 2, 3, 4, 5], 2, task);

    expect(maxConcurrent).toBe(2);
  }, 1000);

  it("handles single item", async () => {
    const results = await mapConcurrent([42], 1, (item) =>
      Promise.resolve(item + 1)
    );

    expect(results).toStrictEqual([43]);
  }, 1000);

  it("handles empty array", async () => {
    const results = await mapConcurrent([], 2, (item: number) =>
      Promise.resolve(item * 2)
    );

    expect(results).toStrictEqual([]);
  }, 1000);

  it("propagates errors", async () => {
    await expect(
      mapConcurrent([1, 2, 3], 2, (item: number) => {
        if (item === 2) {
          return Promise.reject(new Error("test error"));
        }
        return Promise.resolve(item * 2);
      })
    ).rejects.toThrow("test error");
  }, 1000);
});

describe("getSafeImageConcurrency()", () => {
  it("returns 1 when window is undefined", () => {
    const originalWindow = globalThis.window;
    // @ts-expect-error - testing SSR case
    vi.stubGlobal("window");

    const concurrency = getSafeImageConcurrency();
    expect(concurrency).toBe(1);

    vi.stubGlobal("window", originalWindow);
  }, 1000);

  it("returns 1 for mobile devices", () => {
    vi.stubGlobal("navigator", {
      userAgent: "iPhone",
    } as unknown as Navigator);

    const concurrency = getSafeImageConcurrency();
    expect(concurrency).toBe(1);

    vi.unstubAllGlobals();
  }, 1000);

  it("returns value capped at 4 when cores are available", () => {
    // Note: In Node environment, the actual value depends on the system.
    // This test verifies the function returns a valid range (1-4)
    const concurrency = getSafeImageConcurrency();
    expect(concurrency).toBeGreaterThanOrEqual(1);
    expect(concurrency).toBeLessThanOrEqual(4);
  }, 1000);
});
