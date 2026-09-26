/**
 * Image compressor utility for client-side image optimization.
 * Resizes large camera photos (3MB-8MB) to ~40KB-80KB WebP/JPEG,
 * ensuring high visual clarity while keeping storage and data transfer minimal.
 */

export interface CompressOptions {
  maxDimension?: number;
  quality?: number;
  mimeType?: string;
}

export async function compressImageFile(
  file: File,
  options: CompressOptions = {}
): Promise<string> {
  const { maxDimension = 960, quality = 0.72, mimeType = "image/jpeg" } = options;

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;

        if (w > maxDimension || h > maxDimension) {
          if (w > h) {
            h = Math.round((h * maxDimension) / w);
            w = maxDimension;
          } else {
            w = Math.round((w * maxDimension) / h);
            h = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");

        if (ctx) {
          // Smooth resizing
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL(mimeType, quality));
        } else {
          resolve((event.target?.result as string) || "");
        }
      };

      img.onerror = () => resolve((event.target?.result as string) || "");
      img.src = (event.target?.result as string) || "";
    };

    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}
