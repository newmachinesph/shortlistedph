/** Browser-only image helper — no server imports, safe in client components. */

/**
 * Center-crop an image file to a square of `size`px, re-encoded in its own
 * type. Keeps PNG transparency; JPEG/WebP re-encode at 0.9 quality.
 */
export async function cropSquare(file: File, size = 512): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    size,
    size,
  );
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not process the image"))),
      file.type,
      0.9,
    );
  });
}
