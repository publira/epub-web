export const mapConcurrent = async <T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> => {
  const results: R[] = Array.from({ length: items.length });
  let currentIndex = 0;

  const worker = async () => {
    while (currentIndex < items.length) {
      const index = currentIndex;
      results[index] = await fn(items[index]);
      currentIndex += 1;
    }
  };

  const workers = Array.from({ length: Math.min(limit, items.length) }, () =>
    worker()
  );

  await Promise.all(workers);

  return results;
};

export const getSafeImageConcurrency = (): number => {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return 1;
  }

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (isMobile) {
    return 1;
  }

  const cores = navigator.hardwareConcurrency || 2;

  return Math.min(cores, 4);
};
