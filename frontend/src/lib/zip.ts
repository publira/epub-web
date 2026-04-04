import { unzip, zip } from "fflate";

export const zipAsync = (
  input: Record<string, Uint8Array>
): Promise<Uint8Array> => {
  const { promise, reject, resolve } = Promise.withResolvers<Uint8Array>();

  // fflate async API is callback-based by design.
  // eslint-disable-next-line promise/prefer-await-to-callbacks
  zip(input, (error, data) => {
    if (error) {
      reject(error);
      return;
    }

    resolve(data);
  });

  return promise;
};

export const unzipAsync = (
  input: Uint8Array
): Promise<Record<string, Uint8Array>> => {
  const { promise, reject, resolve } =
    Promise.withResolvers<Record<string, Uint8Array>>();

  // fflate async API is callback-based by design.
  // eslint-disable-next-line promise/prefer-await-to-callbacks
  unzip(input, (error, data) => {
    if (error) {
      reject(error);
      return;
    }

    resolve(data);
  });

  return promise;
};
