/**
 * Image compressor & Anti-Culas verification utility for client-side image optimization.
 * - Resizes large camera photos (3MB-8MB) to ~40KB-80KB JPEG
 * - Computes an 8x8 perceptual pixel fingerprint (dHash) BEFORE watermarking to detect duplicate/reused photos
 * - Validates Gallery photo capture time (file.lastModified) so technicians cannot upload old photos from previous days
 * - Burns a permanent anti-cheat Watermark (Room, Stage Before/After, Technician, Real-time WITA, Source Camera/Gallery)
 */

export interface WatermarkOptions {
  stageLabel: string; // e.g. "SUHU BEFORE", "SUHU AFTER", "ANEMO BEFORE", "ANEMO AFTER"
  unitName?: string;
  technicianName?: string;
  sourceType?: "camera" | "gallery";
  fileLastModified?: number;
}

export interface CompressOptions {
  maxDimension?: number;
  quality?: number;
  mimeType?: string;
  watermark?: WatermarkOptions;
}

export interface VerifiedPhotoResult {
  ok: boolean;
  dataUrl: string;
  fingerprint: string;
  capturedAtIso: string;
  sourceType: "camera" | "gallery";
  error?: string;
}

function formatWitaDateTime(msOrDate: number | Date): string {
  const d = typeof msOrDate === "number" ? new Date(msOrDate) : msOrDate;
  if (isNaN(d.getTime())) return "-";
  try {
    const parts = new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Makassar",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(d);
    const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
    return `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")} WITA`;
  } catch {
    return d.toLocaleString("id-ID");
  }
}

/**
 * Computes a compact 8x8 perceptual grayscale hash from an HTMLImageElement
 * BEFORE any watermark is drawn, so uploading the same photo twice is caught immediately.
 */
function computePerceptualFingerprint(img: HTMLImageElement, fileSize?: number): string {
  try {
    const size = 8;
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d");
    if (!ctx) return `sz_${fileSize || 0}_${img.width}x${img.height}`;
    ctx.drawImage(img, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;
    const grays: number[] = [];
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      const g = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      grays.push(g);
      sum += g;
    }
    const avg = sum / grays.length;
    // Build 64-bit binary string + quantized color buckets
    const bits = grays.map((g) => (g >= avg ? "1" : "0")).join("");
    const hex = bits
      .match(/.{1,4}/g)
      ?.map((b) => parseInt(b, 2).toString(16))
      .join("") || "";
    return `ph_${hex}_${img.width}x${img.height}`;
  } catch {
    return `sz_${fileSize || 0}`;
  }
}

function drawAntiCheatWatermark(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  wm: WatermarkOptions
) {
  const barHeight = Math.max(46, Math.round(h * 0.11));
  const yStart = h - barHeight;

  // Semi-transparent dark banner at bottom
  ctx.fillStyle = "rgba(15, 23, 42, 0.82)";
  ctx.fillRect(0, yStart, w, barHeight);

  // Top accent line (Amber for BEFORE, Emerald for AFTER)
  const isBefore = wm.stageLabel.toUpperCase().includes("BEFORE");
  ctx.fillStyle = isBefore ? "#f59e0b" : "#10b981";
  ctx.fillRect(0, yStart, w, 3);

  const padX = Math.max(10, Math.round(w * 0.022));
  const titleFontPx = Math.max(12, Math.min(18, Math.round(barHeight * 0.36)));
  const subFontPx = Math.max(10, Math.min(14, Math.round(barHeight * 0.28)));

  // Line 1: Stage + Room Name
  ctx.fillStyle = isBefore ? "#fde68a" : "#6ee7b7";
  ctx.font = `bold ${titleFontPx}px sans-serif`;
  const roomText = wm.unitName ? `${wm.stageLabel} • ${wm.unitName}` : wm.stageLabel;
  ctx.fillText(roomText, padX, yStart + Math.round(barHeight * 0.44));

  // Line 2: Technician + Timestamp + Source
  ctx.fillStyle = "#f8fafc";
  ctx.font = `${subFontPx}px monospace`;
  const nowStr = formatWitaDateTime(Date.now());
  const srcLabel =
    wm.sourceType === "gallery"
      ? `GALERI (Foto: ${wm.fileLastModified ? formatWitaDateTime(wm.fileLastModified) : nowStr})`
      : `KAMERA (${nowStr})`;
  const techPart = wm.technicianName ? `${wm.technicianName} | ` : "";
  ctx.fillText(`${techPart}${srcLabel}`, padX, yStart + Math.round(barHeight * 0.82));
}

export async function compressImageFile(
  file: File,
  options: CompressOptions = {}
): Promise<string> {
  const { maxDimension = 960, quality = 0.72, mimeType = "image/jpeg", watermark } = options;

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
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, w, h);
          if (watermark) {
            drawAntiCheatWatermark(ctx, w, h, watermark);
          }
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

const RECENT_PHOTO_HASHES_KEY = "ac_recent_photo_hashes_v1";

interface RecentPhotoHashEntry {
  fingerprint: string;
  unitName: string;
  stageLabel: string;
  timestamp: number;
}

function getRecentSubmittedPhotoHashes(): RecentPhotoHashEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_PHOTO_HASHES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Hanya simpan riwayat sidik jari foto 3 hari terakhir
        const cutoff = Date.now() - 3 * 24 * 60 * 60 * 1000;
        return parsed.filter((item) => item && item.fingerprint && item.timestamp >= cutoff);
      }
    }
  } catch {}
  return [];
}

export function recordSubmittedPhotoFingerprints(
  unitName: string,
  fingerprints: Record<string, string>
): void {
  if (typeof localStorage === "undefined") return;
  try {
    const stageMap: Record<string, string> = {
      temp_before: "Suhu Before",
      temp_after: "Suhu After",
      anemo_before: "Anemo Before",
      anemo_after: "Anemo After",
    };
    const current = getRecentSubmittedPhotoHashes();
    const now = Date.now();
    for (const [slot, fp] of Object.entries(fingerprints)) {
      if (fp) {
        current.unshift({
          fingerprint: fp,
          unitName,
          stageLabel: stageMap[slot] || slot,
          timestamp: now,
        });
      }
    }
    localStorage.setItem(RECENT_PHOTO_HASHES_KEY, JSON.stringify(current.slice(0, 120)));
  } catch {}
}

/**
 * Compresses a photo, checks Gallery age (anti-old-photo cheat for non-admins),
 * checks duplicate fingerprint against existing photos in the form AND recent rooms, and adds an anti-cheat Watermark.
 */
export async function compressAndVerifyACPhoto(
  file: File,
  params: {
    stageLabel: string;
    unitName?: string;
    technicianName?: string;
    sourceType: "camera" | "gallery";
    isAdmin?: boolean;
    existingFingerprints?: Record<string, string>;
    currentSlotKey: string;
  }
): Promise<VerifiedPhotoResult> {
  const fileTime = file.lastModified || Date.now();
  const ageHours = (Date.now() - fileTime) / (1000 * 60 * 60);

  // 1. Jika dari Galeri & bukan Admin, tolak jika foto berumur lebih dari 18 jam (foto hari sebelumnya)
  if (params.sourceType === "gallery" && !params.isAdmin && ageHours > 18) {
    return {
      ok: false,
      dataUrl: "",
      fingerprint: "",
      capturedAtIso: new Date(fileTime).toISOString(),
      sourceType: params.sourceType,
      error: `Foto Galeri Ditolak (Anti-Culas): Foto ini diambil pada ${formatWitaDateTime(
        fileTime
      )} (${Math.floor(
        ageHours
      )} jam lalu). Teknisi hanya diizinkan mengunggah foto pengerjaan hari ini!`,
    };
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const fingerprint = computePerceptualFingerprint(img, file.size);

        // 2. Cek apakah foto ini kembar/identik dengan slot foto lain di form ini (misal foto Before dipakai lagi untuk After)
        if (params.existingFingerprints) {
          for (const [slot, fp] of Object.entries(params.existingFingerprints)) {
            if (slot !== params.currentSlotKey && fp && fp === fingerprint) {
              const slotNameMap: Record<string, string> = {
                temp_before: "Foto Suhu Before",
                temp_after: "Foto Suhu After",
                anemo_before: "Foto Anemo Before",
                anemo_after: "Foto Anemo After",
              };
              resolve({
                ok: false,
                dataUrl: "",
                fingerprint,
                capturedAtIso: new Date(fileTime).toISOString(),
                sourceType: params.sourceType,
                error: `Foto Ditolak (Terdeteksi Foto Kembar): Foto yang Anda pilih sama persis dengan ${
                  slotNameMap[slot] || slot
                } di kamar ini. Harap gunakan foto asli yang berbeda!`,
              });
              return;
            }
          }
        }

        // 3. Cek apakah foto ini sudah pernah dipakai di kamar lain sebelumnya (Anti-Reuse Antar Kamar)
        if (!params.isAdmin) {
          const recentHashes = getRecentSubmittedPhotoHashes();
          const reused = recentHashes.find((h) => h.fingerprint === fingerprint);
          if (reused) {
            resolve({
              ok: false,
              dataUrl: "",
              fingerprint,
              capturedAtIso: new Date(fileTime).toISOString(),
              sourceType: params.sourceType,
              error: `Foto Ditolak (Anti-Culas Antar Kamar): Foto ini terdeteksi sudah pernah digunakan pada "${reused.unitName}" (${reused.stageLabel}). Dilarang mengunggah foto yang sama!`,
            });
            return;
          }
        }

        const maxDimension = 960;
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
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, w, h);
          drawAntiCheatWatermark(ctx, w, h, {
            stageLabel: params.stageLabel,
            unitName: params.unitName,
            technicianName: params.technicianName,
            sourceType: params.sourceType,
            fileLastModified: fileTime,
          });
          const dataUrl = canvas.toDataURL("image/jpeg", 0.74);
          resolve({
            ok: true,
            dataUrl,
            fingerprint,
            capturedAtIso: new Date(fileTime).toISOString(),
            sourceType: params.sourceType,
          });
        } else {
          resolve({
            ok: true,
            dataUrl: (event.target?.result as string) || "",
            fingerprint,
            capturedAtIso: new Date(fileTime).toISOString(),
            sourceType: params.sourceType,
          });
        }
      };
      img.onerror = () =>
        resolve({
          ok: false,
          dataUrl: "",
          fingerprint: "",
          capturedAtIso: new Date().toISOString(),
          sourceType: params.sourceType,
          error: "Gagal membaca file gambar.",
        });
      img.src = (event.target?.result as string) || "";
    };
    reader.onerror = () =>
      resolve({
        ok: false,
        dataUrl: "",
        fingerprint: "",
        capturedAtIso: new Date().toISOString(),
        sourceType: params.sourceType,
        error: "Gagal membaca file gambar.",
      });
    reader.readAsDataURL(file);
  });
}
