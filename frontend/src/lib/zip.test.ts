import { zipSync } from "fflate";

import { unzipAsync, zipAsync } from "./zip";

describe("zipAsync()", () => {
  it("compresses entries asynchronously", async () => {
    const archive = await zipAsync({
      "notes/readme.txt": new TextEncoder().encode("hello async zip"),
    });

    const extracted = await unzipAsync(archive);
    expect(new TextDecoder().decode(extracted["notes/readme.txt"])).toBe(
      "hello async zip"
    );
  }, 1000);
});

describe("unzipAsync()", () => {
  it("extracts zip entries asynchronously", async () => {
    const zipped = zipSync({
      "a.txt": new TextEncoder().encode("hello"),
    });

    const result = await unzipAsync(zipped);
    expect(new TextDecoder().decode(result["a.txt"])).toBe("hello");
  }, 1000);

  it("rejects when data is not a zip", async () => {
    await expect(unzipAsync(new Uint8Array([1, 2, 3]))).rejects.toBeInstanceOf(
      Error
    );
  }, 1000);
});
