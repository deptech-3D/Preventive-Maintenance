import { supabase } from "../supabase";
import {
  getLocalAppSettings,
  apiUrl,
  determineShift,
  getLocalACLogs,
  fetchACMaintenanceLogs,
  updateACMaintenanceLog,
  fetchReadings,
  getLocalReadingsCache,
  saveLocalReadingsCache,
  fetchPlantLogs,
  updatePlantLog,
} from "../supabaseService";

/**
 * Mengekstrak ID Folder Google Drive dari input berupa URL lengkap maupun ID langsung.
 * Contoh URL: https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz?usp=sharing
 */
export function extractGoogleDriveFolderId(input?: string | null): string {
  if (!input) return "";
  const trimmed = input.trim();
  if (!trimmed) return "";

  // Match /folders/FOLDER_ID
  const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch && folderMatch[1]) {
    return folderMatch[1];
  }

  // Match id=FOLDER_ID
  const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch && idMatch[1]) {
    return idMatch[1];
  }

  // If it's already a clean ID (alphanumeric, -, _)
  if (/^[a-zA-Z0-9_-]{10,}$/.test(trimmed)) {
    return trimmed;
  }

  return trimmed;
}

/**
 * Mengekstrak File ID dari berbagai format link Google Drive
 */
export function extractGoogleDriveFileId(urlOrId?: string | null): string | null {
  if (!urlOrId || typeof urlOrId !== "string") return null;
  const trimmed = urlOrId.trim();
  if (!trimmed || trimmed.startsWith("data:") || trimmed.startsWith("blob:")) {
    return null;
  }

  // Format: https://drive.google.com/file/d/FILE_ID/view...
  const fileDMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileDMatch && fileDMatch[1]) {
    return fileDMatch[1];
  }

  // Format: https://lh3.googleusercontent.com/d/FILE_ID...
  const lh3Match = trimmed.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/);
  if (lh3Match && lh3Match[1]) {
    return lh3Match[1];
  }

  // Format: https://drive.google.com/uc?id=FILE_ID atau thumbnail?id=FILE_ID atau open?id=FILE_ID
  if (trimmed.includes("drive.google.com") || trimmed.includes("docs.google.com")) {
    const idParam = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (idParam && idParam[1]) {
      return idParam[1];
    }
  }

  return null;
}

/**
 * Mengecek apakah string foto adalah URL Google Drive
 */
export function isGoogleDriveUrl(src?: string | null): boolean {
  return Boolean(extractGoogleDriveFileId(src));
}

export function isGoogleDrivePhotoUrl(src?: string | null): boolean {
  return isGoogleDriveUrl(src);
}

/**
 * Mengubah link Google Drive (atau data URL) menjadi URL gambar yang bisa langsung tampil di tag <img> aplikasi
 */
export function getPhotoDisplayUrl(src?: string | null): string {
  if (!src) return "";
  const trimmed = src.trim();
  if (!trimmed) return "";

  const fileId = extractGoogleDriveFileId(trimmed);
  if (fileId) {
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1200`;
  }

  return trimmed;
}

/**
 * Mengambil link klik Google Drive (untuk dibuka di tab baru atau ditempel ke Google Sheets / Excel)
 */
export function getPhotoViewLink(src?: string | null): string {
  if (!src) return "";
  const trimmed = src.trim();
  if (!trimmed) return "";

  const fileId = extractGoogleDriveFileId(trimmed);
  if (fileId) {
    return `https://drive.google.com/file/d/${fileId}/view`;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  return "";
}

/**
 * Membuat nama file otomatis sesuai Titik Meter / Unit AC, Shift, dan Tanggal-Jam
 */
export function buildAutoPhotoFileName(params: {
  categoryPrefix: "Meter" | "AC" | "RuangMesin" | "Tes";
  itemName: string;
  shift?: string;
  photoLabel?: string;
  recordedAt?: string | Date;
}): string {
  const settings = getLocalAppSettings();
  const d = params.recordedAt ? new Date(params.recordedAt) : new Date();
  const validDate = isNaN(d.getTime()) ? new Date() : d;

  const shiftName = (
    params.shift ||
    determineShift(
      validDate,
      settings.shift_pagi_start,
      settings.shift_sore_start,
      settings.shift_malam_start
    )
  ).toUpperCase();

  const pad = (n: number) => String(n).padStart(2, "0");
  const datePart = `${validDate.getFullYear()}-${pad(validDate.getMonth() + 1)}-${pad(validDate.getDate())}`;
  const timePart = `${pad(validDate.getHours())}-${pad(validDate.getMinutes())}`;

  const cleanItem = (params.itemName || "Unit")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");

  const cleanLabel = params.photoLabel
    ? `_${params.photoLabel.replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "")}`
    : "";

  return `${params.categoryPrefix}_${cleanItem}_Shift_${shiftName}_${datePart}_${timePart}${cleanLabel}.jpg`;
}

/**
 * Mengecek apakah integrasi penyimpanan foto Google Drive sudah dikonfigurasi oleh Admin
 */
export function isGoogleDriveConfigured(): boolean {
  const settings = getLocalAppSettings();
  const scriptUrl = (settings.gdrive_script_url || "").trim();
  return Boolean(scriptUrl && scriptUrl.startsWith("https://script.google.com/"));
}

export function isGoogleDriveConfigureReady(): boolean {
  return isGoogleDriveConfigured();
}

/**
 * Mengunggah foto secara otomatis ke folder Google Drive Admin jika sudah dikonfigurasi,
 * dengan penamaan otomatis sesuai Titik Meter / Unit AC, Shift, dan Tanggal.
 * Mengembalikan URL Google Drive (atau dataUrl asli jika belum dikonfigurasi / gagal).
 */
export async function uploadPhotoToGoogleDriveIfConfigured(
  dataUrl: string,
  meta: {
    pointName: string;
    photoType?: string;
    shift?: string;
    recordedAt?: string | Date;
    userName?: string;
  }
): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith("data:")) {
    return dataUrl;
  }
  if (!isGoogleDriveConfigured()) {
    return dataUrl;
  }

  const categoryPrefix: "Meter" | "AC" | "RuangMesin" =
    meta.photoType === "Meter"
      ? "Meter"
      : meta.photoType === "Temuan"
      ? "RuangMesin"
      : "AC";

  const fileName = buildAutoPhotoFileName({
    categoryPrefix,
    itemName: meta.pointName || "Unit",
    shift: meta.shift,
    photoLabel: meta.photoType,
    recordedAt: meta.recordedAt,
  });

  const res = await uploadPhotoToGoogleDrive({
    dataUrl,
    fileName,
  });

  return res.url || dataUrl;
}

/**
 * Mengunggah foto (base64 / data URL) ke folder Google Drive Admin melalui jembatan Google Apps Script.
 * Mengembalikan URL Google Drive yang siap disimpan ke database Supabase & ditampilkan di aplikasi / Google Sheets.
 */
export async function uploadPhotoToGoogleDrive(params: {
  dataUrl: string;
  fileName: string;
  subfolder?: string;
  scriptUrlOverride?: string;
  folderIdOverride?: string;
}): Promise<{
  ok: boolean;
  url: string;
  viewUrl: string;
  fileId?: string;
  uploadedToDrive: boolean;
  error?: string;
}> {
  const { dataUrl, fileName, subfolder } = params;
  if (!dataUrl) {
    return { ok: false, url: "", viewUrl: "", uploadedToDrive: false, error: "Data foto kosong" };
  }

  // Jika sudah berupa URL http/https (misal sudah terupload ke Google Drive sebelumnya), langsung kembalikan
  if (dataUrl.startsWith("http://") || dataUrl.startsWith("https://")) {
    const viewUrl = getPhotoViewLink(dataUrl) || dataUrl;
    return {
      ok: true,
      url: viewUrl,
      viewUrl,
      fileId: extractGoogleDriveFileId(dataUrl) || undefined,
      uploadedToDrive: true,
    };
  }

  const settings = getLocalAppSettings();
  const scriptUrl = (params.scriptUrlOverride ?? settings.gdrive_script_url ?? "").trim();
  const rawFolderId = (params.folderIdOverride ?? settings.gdrive_folder_id ?? "").trim();
  const folderId = extractGoogleDriveFolderId(rawFolderId);

  // Jika Admin belum mengatur URL jembatan Google Script, kembalikan dataUrl terkompresi sebagai fallback
  if (!scriptUrl || !scriptUrl.startsWith("http")) {
    return {
      ok: true,
      url: dataUrl,
      viewUrl: "",
      uploadedToDrive: false,
      error: "URL Google Script belum dikonfigurasi di Pengaturan",
    };
  }

  // Pisahkan header data:image/jpeg;base64, dari isi base64 murni
  let mimeType = "image/jpeg";
  let base64Data = dataUrl;
  const commaIdx = dataUrl.indexOf(",");
  if (commaIdx !== -1) {
    const header = dataUrl.slice(0, commaIdx);
    base64Data = dataUrl.slice(commaIdx + 1);
    const mimeMatch = header.match(/data:([^;]+);/);
    if (mimeMatch && mimeMatch[1]) {
      mimeType = mimeMatch[1];
    }
  }

  const payload = {
    action: "upload_photo",
    fileName,
    mimeType,
    base64: base64Data,
    folderId,
    subfolder: subfolder || "",
    propertyName: settings.property_name || "Midtown Hotel Samarinda",
  };

  // 1. Coba unggah melalui Server Proxy (/api/gdrive/upload) untuk menghindari kendala CORS
  try {
    const res = await fetch(apiUrl("/api/gdrive/upload"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        scriptUrl,
      }),
    });

    if (res.ok) {
      const json = await res.json();
      if (json.ok && (json.fileId || json.viewUrl || json.directUrl)) {
        const fid = json.fileId || extractGoogleDriveFileId(json.viewUrl || json.directUrl);
        const finalViewUrl = fid
          ? `https://drive.google.com/file/d/${fid}/view`
          : json.viewUrl || json.directUrl;
        return {
          ok: true,
          url: finalViewUrl,
          viewUrl: finalViewUrl,
          fileId: fid || undefined,
          uploadedToDrive: true,
        };
      } else if (json.error) {
        console.warn("Google Drive proxy upload notice:", json.error);
      }
    }
  } catch (proxyErr) {
    console.warn("Server proxy upload fallback to direct client fetch:", proxyErr);
  }

  // 2. Fallback: Kirim langsung dari browser/HP ke URL Google Apps Script menggunakan Content-Type text/plain
  try {
    const directRes = await fetch(scriptUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify(payload),
    });

    if (directRes.ok) {
      const json = await directRes.json();
      if (json.ok && (json.fileId || json.viewUrl || json.directUrl)) {
        const fid = json.fileId || extractGoogleDriveFileId(json.viewUrl || json.directUrl);
        const finalViewUrl = fid
          ? `https://drive.google.com/file/d/${fid}/view`
          : json.viewUrl || json.directUrl;
        return {
          ok: true,
          url: finalViewUrl,
          viewUrl: finalViewUrl,
          fileId: fid || undefined,
          uploadedToDrive: true,
        };
      }
      return {
        ok: false,
        url: dataUrl,
        viewUrl: "",
        uploadedToDrive: false,
        error: json.error || "Gagal menyimpan ke Google Drive",
      };
    }
  } catch (directErr: any) {
    return {
      ok: false,
      url: dataUrl,
      viewUrl: "",
      uploadedToDrive: false,
      error: directErr?.message || "Gagal menghubungi Google Apps Script",
    };
  }

  return {
    ok: false,
    url: dataUrl,
    viewUrl: "",
    uploadedToDrive: false,
    error: "Respons Google Script tidak valid",
  };
}

/**
 * Kode Google Apps Script (Code.gs) siap pakai untuk jembatan upload foto otomatis ke Google Drive Admin
 */
export const GOOGLE_APPS_SCRIPT_BRIDGE_CODE = `/**
 * JEMBATAN UPLOAD FOTO OTOMATIS KE GOOGLE DRIVE
 * Sistem Preventive Maintenance & Checklist Meter - Midtown Hotel Samarinda
 *
 * Cara Pasang (Hanya 1 Menit):
 * 1. Buka https://script.google.com lalu klik "Project Baru" (New Project).
 * 2. Hapus semua kode yang ada, lalu Tempel (Paste) seluruh kode ini.
 * 3. Klik tombol "Terapkan" (Deploy) > "Deployment baru" (New deployment).
 * 4. Pilih jenis: "Aplikasi Web" (Web app).
 * 5. Pada "Jalankan sebagai" (Execute as): pilih "Saya" (Me).
 * 6. Pada "Siapa yang memiliki akses" (Who has access): WAJIB pilih "Siapa saja" (Anyone).
 * 7. Klik "Terapkan" (Deploy), berikan izin akses Google Drive, lalu salin URL Web App (/exec) ke menu Pengaturan Aplikasi.
 */

function doGet(e) {
  return ContentService.createTextOutput(
    JSON.stringify({
      ok: true,
      message: "Jembatan Google Drive Engineering Aktif & Siap Menerima Foto!",
      timestamp: new Date().toISOString()
    })
  ).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var raw = e.postData && e.postData.contents ? e.postData.contents : "{}";
    var data = JSON.parse(raw);

    var base64 = data.base64 || "";
    var mimeType = data.mimeType || "image/jpeg";
    var fileName = data.fileName || ("Foto_Engineering_" + new Date().getTime() + ".jpg");
    var folderId = (data.folderId || "").trim();
    var subfolderName = (data.subfolder || "").trim();

    if (!base64) {
      return ContentService.createTextOutput(
        JSON.stringify({ ok: false, error: "Data gambar (base64) kosong" })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    // 1. Tentukan Folder Utama di Google Drive
    var targetFolder;
    if (folderId) {
      try {
        targetFolder = DriveApp.getFolderById(folderId);
      } catch (errFolder) {
        targetFolder = getOrCreateDefaultFolder("Foto Meter & AC Midtown Hotel");
      }
    } else {
      targetFolder = getOrCreateDefaultFolder("Foto Meter & AC Midtown Hotel");
    }

    // 2. Jika ada nama subfolder (misal "Meteran" atau "Perawatan AC"), buat/buka subfoldernya
    if (subfolderName) {
      var subIter = targetFolder.getFoldersByName(subfolderName);
      if (subIter.hasNext()) {
        targetFolder = subIter.next();
      } else {
        targetFolder = targetFolder.createFolder(subfolderName);
      }
    }

    // 3. Simpan file foto ke dalam folder Google Drive
    var decoded = Utilities.base64Decode(base64);
    var blob = Utilities.newBlob(decoded, mimeType, fileName);
    var file = targetFolder.createFile(blob);

    // 4. Atur izin agar foto bisa langsung tampil di Aplikasi & diklik dari Google Sheets
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (permErr) {}

    var fileId = file.getId();
    var viewUrl = "https://drive.google.com/file/d/" + fileId + "/view";
    var directUrl = "https://drive.google.com/thumbnail?id=" + fileId + "&sz=w1200";

    return ContentService.createTextOutput(
      JSON.stringify({
        ok: true,
        fileId: fileId,
        fileName: fileName,
        viewUrl: viewUrl,
        directUrl: directUrl,
        folderName: targetFolder.getName()
      })
    ).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({
        ok: false,
        error: err && err.message ? err.message : String(err)
      })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

function getOrCreateDefaultFolder(name) {
  var iter = DriveApp.getFoldersByName(name);
  if (iter.hasNext()) {
    return iter.next();
  }
  return DriveApp.createFolder(name);
}
`;

/**
 * Mengecek apakah sebuah nilai foto adalah foto lama (tersimpan di Supabase / Base64 / Server lokal)
 * yang BELUM dipindahkan ke Google Drive.
 */
export function isLegacyUnmigratedPhoto(val?: string | null): boolean {
  if (!val || typeof val !== "string") return false;
  const trimmed = val.trim();
  if (!trimmed || trimmed === "-") return false;
  if (isGoogleDriveUrl(trimmed)) return false;
  // Base64 image, local /api/files/, Supabase storage URL, atau nama file lokal
  return (
    trimmed.startsWith("data:image/") ||
    trimmed.startsWith("/api/files/") ||
    trimmed.includes("supabase.co/storage") ||
    /\.(jpg|jpeg|png|webp)$/i.test(trimmed)
  );
}

/**
 * Mengonversi sumber foto lama (Base64, URL Supabase Storage, atau /api/files/...) menjadi dataURL base64
 * agar siap dikirim ke Google Drive.
 */
async function resolveLegacyPhotoToDataUrl(src: string): Promise<string | null> {
  const trimmed = src.trim();
  if (trimmed.startsWith("data:image/")) {
    return trimmed;
  }

  let fetchTarget = trimmed;
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://") && !trimmed.startsWith("/")) {
    fetchTarget = `/api/files/${trimmed}`;
  }

  try {
    const res = await fetch(fetchTarget);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(typeof reader.result === "string" ? reader.result : null);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Menghitung jumlah foto lama di Supabase / Database Lokal yang belum dipindahkan ke Google Drive
 */
export async function scanUnmigratedPhotosCount(): Promise<{
  totalCount: number;
  acPhotosCount: number;
  meterPhotosCount: number;
  plantPhotosCount: number;
  migratedDriveCount: number;
}> {
  let acPhotosCount = 0;
  let meterPhotosCount = 0;
  let plantPhotosCount = 0;
  let migratedDriveCount = 0;

  try {
    const [acLogs, readings, plantLogs] = await Promise.all([
      fetchACMaintenanceLogs().catch(() => getLocalACLogs()),
      fetchReadings({ limit: 500 }).catch(() => getLocalReadingsCache()),
      fetchPlantLogs({ limit: 500 }).catch(() => []),
    ]);

    // 1. Cek AC Logs
    for (const log of acLogs) {
      const pTempBefore = log.photo_temp_before || log.photo_before;
      const pTempAfter = log.photo_temp_after || log.photo_after;
      const pAnemoBefore = log.photo_anemo_before;
      const pAnemoAfter = log.photo_anemo_after;

      [pTempBefore, pTempAfter, pAnemoBefore, pAnemoAfter].forEach((p) => {
        if (isLegacyUnmigratedPhoto(p)) acPhotosCount++;
        else if (isGoogleDriveUrl(p)) migratedDriveCount++;
      });
    }

    // 2. Cek Meter Readings (Supabase)
    for (const r of readings) {
      if (isLegacyUnmigratedPhoto(r.photo_path)) meterPhotosCount++;
      else if (isGoogleDriveUrl(r.photo_path)) migratedDriveCount++;
    }

    // 3. Cek Plant Logs (Ruang Mesin)
    for (const pl of plantLogs) {
      if (isLegacyUnmigratedPhoto(pl.photo_temuan_url)) plantPhotosCount++;
      else if (isGoogleDriveUrl(pl.photo_temuan_url)) migratedDriveCount++;
    }
  } catch {}

  return {
    totalCount: acPhotosCount + meterPhotosCount + plantPhotosCount,
    acPhotosCount,
    meterPhotosCount,
    plantPhotosCount,
    migratedDriveCount,
  };
}

/**
 * Memindahkan seluruh foto lama dari Supabase & Database Lokal ke Folder Google Drive Admin,
 * lalu mengganti data di Supabase/Database dengan link Google Drive agar database hemat kuota.
 */
export async function migrateAllOldPhotosToGoogleDrive(options?: {
  scriptUrlOverride?: string;
  folderIdOverride?: string;
  onProgress?: (info: { current: number; total: number; label: string }) => void;
}): Promise<{
  ok: boolean;
  migratedCount: number;
  totalFound: number;
  failedCount: number;
  message: string;
}> {
  const settings = getLocalAppSettings();
  const scriptUrl = (options?.scriptUrlOverride ?? settings.gdrive_script_url ?? "").trim();
  const folderId = extractGoogleDriveFolderId(options?.folderIdOverride ?? settings.gdrive_folder_id ?? "");

  if (!scriptUrl || !scriptUrl.startsWith("https://script.google.com/")) {
    return {
      ok: false,
      migratedCount: 0,
      totalFound: 0,
      failedCount: 0,
      message: "Harap isi URL Jembatan Google Script (/exec) terlebih dahulu sebelum memindahkan foto lama.",
    };
  }

  const [acLogs, readings, plantLogs] = await Promise.all([
    fetchACMaintenanceLogs().catch(() => getLocalACLogs()),
    fetchReadings({ limit: 500 }).catch(() => getLocalReadingsCache()),
    fetchPlantLogs({ limit: 500 }).catch(() => []),
  ]);

  // Selain dari fetchACMaintenanceLogs, tarik juga dari tabel Supabase ac_maintenance_logs jika ada foto base64 di sana
  try {
    const { data: supaAcLogs } = await supabase
      .from("ac_maintenance_logs")
      .select("*")
      .order("recorded_at", { ascending: false })
      .limit(300);
    if (Array.isArray(supaAcLogs)) {
      const map = new Map(acLogs.map((l) => [l.log_id, l]));
      for (const sl of supaAcLogs) {
        if (sl && sl.log_id) {
          const existing = map.get(sl.log_id);
          if (!existing) {
            acLogs.push(sl as any);
          } else {
            // Gabungkan jika di Supabase ada foto yang belum ada di lokal
            if (!existing.photo_temp_before && sl.photo_temp_before) existing.photo_temp_before = sl.photo_temp_before;
            if (!existing.photo_temp_after && sl.photo_temp_after) existing.photo_temp_after = sl.photo_temp_after;
            if (!existing.photo_anemo_before && sl.photo_anemo_before) existing.photo_anemo_before = sl.photo_anemo_before;
            if (!existing.photo_anemo_after && sl.photo_anemo_after) existing.photo_anemo_after = sl.photo_anemo_after;
            if (!existing.photo_before && sl.photo_before) existing.photo_before = sl.photo_before;
            if (!existing.photo_after && sl.photo_after) existing.photo_after = sl.photo_after;
          }
        }
      }
    }
  } catch {}

  // Hitung total foto yang perlu dipindah
  let totalFound = 0;
  for (const log of acLogs) {
    if (isLegacyUnmigratedPhoto(log.photo_temp_before || log.photo_before)) totalFound++;
    if (isLegacyUnmigratedPhoto(log.photo_temp_after || log.photo_after)) totalFound++;
    if (isLegacyUnmigratedPhoto(log.photo_anemo_before)) totalFound++;
    if (isLegacyUnmigratedPhoto(log.photo_anemo_after)) totalFound++;
  }
  for (const r of readings) {
    if (isLegacyUnmigratedPhoto(r.photo_path)) totalFound++;
  }
  for (const pl of plantLogs) {
    if (isLegacyUnmigratedPhoto(pl.photo_temuan_url)) totalFound++;
  }

  if (totalFound === 0) {
    return {
      ok: true,
      migratedCount: 0,
      totalFound: 0,
      failedCount: 0,
      message: "Semua foto sudah berada di Google Drive (0 beban foto lama di Supabase).",
    };
  }

  let currentStep = 0;
  let migratedCount = 0;
  let failedCount = 0;

  // 1. Pindahkan Foto Perawatan AC
  for (const log of acLogs) {
    const patch: Record<string, any> = {};
    let changed = false;

    const pTempBefore = log.photo_temp_before || log.photo_before;
    if (isLegacyUnmigratedPhoto(pTempBefore)) {
      currentStep++;
      options?.onProgress?.({
        current: currentStep,
        total: totalFound,
        label: `AC ${log.unit_name} (Suhu Before)`,
      });
      const dataUrl = await resolveLegacyPhotoToDataUrl(pTempBefore!);
      if (dataUrl) {
        const fileName = buildAutoPhotoFileName({
          categoryPrefix: "AC",
          itemName: log.unit_name,
          photoLabel: "Suhu-Before",
          recordedAt: log.recorded_at,
        });
        const up = await uploadPhotoToGoogleDrive({
          dataUrl,
          fileName,
          scriptUrlOverride: scriptUrl,
          folderIdOverride: folderId,
        });
        if (up.ok && up.uploadedToDrive && up.viewUrl) {
          patch.photo_temp_before = up.viewUrl;
          patch.photo_before = up.viewUrl;
          changed = true;
          migratedCount++;
        } else {
          failedCount++;
        }
      } else {
        failedCount++;
      }
    }

    const pTempAfter = log.photo_temp_after || log.photo_after;
    if (isLegacyUnmigratedPhoto(pTempAfter)) {
      currentStep++;
      options?.onProgress?.({
        current: currentStep,
        total: totalFound,
        label: `AC ${log.unit_name} (Suhu After)`,
      });
      const dataUrl = await resolveLegacyPhotoToDataUrl(pTempAfter!);
      if (dataUrl) {
        const fileName = buildAutoPhotoFileName({
          categoryPrefix: "AC",
          itemName: log.unit_name,
          photoLabel: "Suhu-After",
          recordedAt: log.recorded_at,
        });
        const up = await uploadPhotoToGoogleDrive({
          dataUrl,
          fileName,
          scriptUrlOverride: scriptUrl,
          folderIdOverride: folderId,
        });
        if (up.ok && up.uploadedToDrive && up.viewUrl) {
          patch.photo_temp_after = up.viewUrl;
          patch.photo_after = up.viewUrl;
          changed = true;
          migratedCount++;
        } else {
          failedCount++;
        }
      } else {
        failedCount++;
      }
    }

    if (isLegacyUnmigratedPhoto(log.photo_anemo_before)) {
      currentStep++;
      options?.onProgress?.({
        current: currentStep,
        total: totalFound,
        label: `AC ${log.unit_name} (Anemo Before)`,
      });
      const dataUrl = await resolveLegacyPhotoToDataUrl(log.photo_anemo_before!);
      if (dataUrl) {
        const fileName = buildAutoPhotoFileName({
          categoryPrefix: "AC",
          itemName: log.unit_name,
          photoLabel: "Anemo-Before",
          recordedAt: log.recorded_at,
        });
        const up = await uploadPhotoToGoogleDrive({
          dataUrl,
          fileName,
          scriptUrlOverride: scriptUrl,
          folderIdOverride: folderId,
        });
        if (up.ok && up.uploadedToDrive && up.viewUrl) {
          patch.photo_anemo_before = up.viewUrl;
          changed = true;
          migratedCount++;
        } else {
          failedCount++;
        }
      } else {
        failedCount++;
      }
    }

    if (isLegacyUnmigratedPhoto(log.photo_anemo_after)) {
      currentStep++;
      options?.onProgress?.({
        current: currentStep,
        total: totalFound,
        label: `AC ${log.unit_name} (Anemo After)`,
      });
      const dataUrl = await resolveLegacyPhotoToDataUrl(log.photo_anemo_after!);
      if (dataUrl) {
        const fileName = buildAutoPhotoFileName({
          categoryPrefix: "AC",
          itemName: log.unit_name,
          photoLabel: "Anemo-After",
          recordedAt: log.recorded_at,
        });
        const up = await uploadPhotoToGoogleDrive({
          dataUrl,
          fileName,
          scriptUrlOverride: scriptUrl,
          folderIdOverride: folderId,
        });
        if (up.ok && up.uploadedToDrive && up.viewUrl) {
          patch.photo_anemo_after = up.viewUrl;
          changed = true;
          migratedCount++;
        } else {
          failedCount++;
        }
      } else {
        failedCount++;
      }
    }

    if (changed) {
      try {
        await updateACMaintenanceLog(log.log_id, patch);
      } catch {}
    }
  }

  // 2. Pindahkan Foto Checklist Meter (Supabase readings)
  let readingsUpdated = false;
  const updatedReadingsList = [...readings];
  for (let i = 0; i < updatedReadingsList.length; i++) {
    const r = updatedReadingsList[i];
    if (isLegacyUnmigratedPhoto(r.photo_path)) {
      currentStep++;
      options?.onProgress?.({
        current: currentStep,
        total: totalFound,
        label: `Meter ${r.meter_name || r.meter_id}`,
      });
      const dataUrl = await resolveLegacyPhotoToDataUrl(r.photo_path!);
      if (dataUrl) {
        const fileName = buildAutoPhotoFileName({
          categoryPrefix: "Meter",
          itemName: r.meter_name || r.meter_id,
          shift: r.shift,
          photoLabel: "Meter",
          recordedAt: r.recorded_at,
        });
        const up = await uploadPhotoToGoogleDrive({
          dataUrl,
          fileName,
          scriptUrlOverride: scriptUrl,
          folderIdOverride: folderId,
        });
        if (up.ok && up.uploadedToDrive && up.viewUrl) {
          updatedReadingsList[i] = { ...r, photo_path: up.viewUrl };
          readingsUpdated = true;
          migratedCount++;
          try {
            await supabase
              .from("readings")
              .update({ photo_path: up.viewUrl })
              .eq("reading_id", r.reading_id);
          } catch {}
        } else {
          failedCount++;
        }
      } else {
        failedCount++;
      }
    }
  }
  if (readingsUpdated) {
    saveLocalReadingsCache(updatedReadingsList);
  }

  // 3. Pindahkan Foto Ruang Mesin (Plant Logs)
  for (const pl of plantLogs) {
    if (isLegacyUnmigratedPhoto(pl.photo_temuan_url)) {
      currentStep++;
      options?.onProgress?.({
        current: currentStep,
        total: totalFound,
        label: `Ruang Mesin (${pl.shift.toUpperCase()})`,
      });
      const dataUrl = await resolveLegacyPhotoToDataUrl(pl.photo_temuan_url!);
      if (dataUrl) {
        const fileName = buildAutoPhotoFileName({
          categoryPrefix: "RuangMesin",
          itemName: "LogSheet",
          shift: pl.shift,
          photoLabel: "Temuan",
          recordedAt: pl.recorded_at,
        });
        const up = await uploadPhotoToGoogleDrive({
          dataUrl,
          fileName,
          scriptUrlOverride: scriptUrl,
          folderIdOverride: folderId,
        });
        if (up.ok && up.uploadedToDrive && up.viewUrl) {
          migratedCount++;
          try {
            await updatePlantLog(pl.log_id, { photo_temuan_url: up.viewUrl });
          } catch {}
        } else {
          failedCount++;
        }
      } else {
        failedCount++;
      }
    }
  }

  return {
    ok: migratedCount > 0 || failedCount === 0,
    migratedCount,
    totalFound,
    failedCount,
    message:
      migratedCount > 0
        ? `Berhasil memindahkan ${migratedCount} foto lama dari Supabase/Database ke Folder Google Drive Admin! Database kini lebih ringan & hemat.`
        : "Gagal memindahkan foto lama. Pastikan URL Jembatan Google Script sudah benar dan disetel 'Siapa saja' (Anyone).",
  };
}
