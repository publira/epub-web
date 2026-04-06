export const compressImageFile = async (
  file: File,
  maxDimension = 1920,
  quality = 0.85
): Promise<File> => {
  if (!file.type.startsWith("image/")) {
    return file;
  }

  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;

  if (width <= maxDimension && height <= maxDimension) {
    bitmap.close();
    return file;
  }

  if (width > height) {
    height = Math.round((height * maxDimension) / width);
    width = maxDimension;
  } else {
    width = Math.round((width * maxDimension) / height);
    height = maxDimension;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }

  const outType = file.type === "image/png" ? "image/png" : "image/jpeg";

  if (outType === "image/jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  }

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // oxlint-disable-next-line promise/avoid-new
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(
      resolve,
      outType,
      outType === "image/jpeg" ? quality : undefined
    );
  });

  if (!blob) {
    return file;
  }

  // 拡張子を新しいMIMEタイプに合わせる
  const ext = outType === "image/png" ? ".png" : ".jpg";
  const newName = file.name.replace(/\.[^/.]+$/, "") + ext;

  return new File([blob], newName, {
    lastModified: Date.now(),
    type: outType,
  });
};
