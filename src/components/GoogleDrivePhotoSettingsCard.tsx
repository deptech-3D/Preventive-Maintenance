import React, { useState, useEffect, useRef } from "react";
import {
  FolderOpen,
  Link2,
  CheckCircle2,
  AlertTriangle,
  Save,
  Copy,
  Check,
  ExternalLink,
  Upload,
  Code2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  HardDrive,
  FileSpreadsheet,
  Smartphone,
  X,
  RefreshCw,
} from "lucide-react";
import { AppSettings } from "../types";
import { fetchAppSettings, getLocalAppSettings, updateAppSettings } from "../supabaseService";
import {
  extractGoogleDriveFolderId,
  uploadPhotoToGoogleDrive,
  getPhotoDisplayUrl,
  GOOGLE_APPS_SCRIPT_BRIDGE_CODE,
  scanUnmigratedPhotosCount,
  migrateAllOldPhotosToGoogleDrive,
} from "../utils/googleDrivePhoto";

interface GoogleDrivePhotoSettingsCardProps {
  onSaved?: (updated: AppSettings) => void;
}

export function GoogleDrivePhotoSettingsCard({ onSaved }: GoogleDrivePhotoSettingsCardProps = {}) {
  const [folderInput, setFolderInput] = useState<string>(() => {
    if (typeof localStorage !== "undefined") {
      const saved = localStorage.getItem("meter_gdrive_folder_id");
      if (saved !== null && saved !== "") return saved;
    }
    return getLocalAppSettings().gdrive_folder_id || "";
  });

  const [scriptUrl, setScriptUrl] = useState<string>(() => {
    if (typeof localStorage !== "undefined") {
      const saved = localStorage.getItem("meter_gdrive_script_url");
      if (saved !== null && saved !== "") return saved;
    }
    return getLocalAppSettings().gdrive_script_url || "";
  });

  const userEditedFolderRef = useRef<boolean>(false);
  const userEditedScriptRef = useRef<boolean>(false);

  const [saving, setSaving] = useState<boolean>(false);
  const [testing, setTesting] = useState<boolean>(false);
  const [migrating, setMigrating] = useState<boolean>(false);
  const [migrationProgress, setMigrationProgress] = useState<{
    current: number;
    total: number;
    label: string;
  } | null>(null);
  const [photoScanStats, setPhotoScanStats] = useState<{
    totalCount: number;
    acPhotosCount: number;
    meterPhotosCount: number;
    plantPhotosCount: number;
    migratedDriveCount: number;
  }>({
    totalCount: 0,
    acPhotosCount: 0,
    meterPhotosCount: 0,
    plantPhotosCount: 0,
    migratedDriveCount: 0,
  });
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [showScriptGuide, setShowScriptGuide] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<{
    text: string;
    kind: "ok" | "err";
    testLink?: string;
  } | null>(null);

  const refreshPhotoScanStats = () => {
    scanUnmigratedPhotosCount()
      .then((res) => setPhotoScanStats(res))
      .catch(() => {});
  };

  const persistLocalDraft = (nextFolder: string, nextScript: string) => {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem("meter_gdrive_folder_id", nextFolder);
      localStorage.setItem("meter_gdrive_script_url", nextScript);
      const current = getLocalAppSettings();
      const updated = {
        ...current,
        gdrive_folder_id: nextFolder,
        gdrive_script_url: nextScript,
        gdrive_enabled: Boolean(nextScript.trim()),
      };
      localStorage.setItem("meter_app_settings", JSON.stringify(updated));
    } catch {}
  };

  const handleFolderInputChange = (val: string) => {
    userEditedFolderRef.current = true;
    setFolderInput(val);
    persistLocalDraft(val, scriptUrl);
  };

  const handleScriptUrlChange = (val: string) => {
    userEditedScriptRef.current = true;
    setScriptUrl(val);
    persistLocalDraft(folderInput, val);
  };

  useEffect(() => {
    fetchAppSettings()
      .then((s) => {
        if (!userEditedFolderRef.current && s.gdrive_folder_id) {
          setFolderInput((prev) => prev || s.gdrive_folder_id || "");
        }
        if (!userEditedScriptRef.current && s.gdrive_script_url) {
          setScriptUrl((prev) => prev || s.gdrive_script_url || "");
        }
      })
      .catch(() => {});

    const handleSynced = (e: Event) => {
      const s = (e as CustomEvent)?.detail;
      if (s) {
        if (!userEditedFolderRef.current && s.gdrive_folder_id) {
          setFolderInput((prev) => prev || s.gdrive_folder_id || "");
        }
        if (!userEditedScriptRef.current && s.gdrive_script_url) {
          setScriptUrl((prev) => prev || s.gdrive_script_url || "");
        }
      }
    };
    window.addEventListener("app-settings-synced", handleSynced);
    refreshPhotoScanStats();
    return () => window.removeEventListener("app-settings-synced", handleSynced);
  }, []);

  const extractedFolderId = extractGoogleDriveFolderId(folderInput);
  const isConfigured = Boolean(
    scriptUrl.trim() && scriptUrl.trim().startsWith("https://script.google.com/")
  );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMsg(null);
    try {
      const cleanFolderId = extractGoogleDriveFolderId(folderInput);
      const cleanScript = scriptUrl.trim();

      await updateAppSettings({
        gdrive_folder_id: cleanFolderId,
        gdrive_script_url: cleanScript,
        gdrive_enabled: Boolean(cleanScript),
      });

      setFolderInput(cleanFolderId);
      if (onSaved) {
        onSaved(getLocalAppSettings());
      }
      setStatusMsg({
        text: cleanScript
          ? "Pengaturan Google Drive berhasil disimpan! Semua foto baru dari HP petugas otomatis dikirim ke Google Drive Admin."
          : "Pengaturan Google Drive berhasil diperbarui.",
        kind: "ok",
      });
    } catch (err: any) {
      setStatusMsg({
        text: err?.message || "Gagal menyimpan pengaturan Google Drive.",
        kind: "err",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCopyScriptCode = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_BRIDGE_CODE);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 3500);
  };

  const generateSampleTestImage = (): string => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    // Background
    const grad = ctx.createLinearGradient(0, 0, 640, 360);
    grad.addColorStop(0, "#0f172a");
    grad.addColorStop(1, "#1e3a8a");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 640, 360);

    // Border
    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 6;
    ctx.strokeRect(16, 16, 608, 328);

    // Text
    ctx.fillStyle = "#34d399";
    ctx.font = "bold 22px sans-serif";
    ctx.fillText("TES KONEKSI GOOGLE DRIVE BERHASIL", 44, 85);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 28px sans-serif";
    ctx.fillText("Midtown Hotel Samarinda", 44, 135);

    ctx.fillStyle = "#93c5fd";
    ctx.font = "18px sans-serif";
    ctx.fillText("Sistem Preventive Maintenance AC & Checklist Meter", 44, 175);

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "16px monospace";
    ctx.fillText(`Waktu Tes : ${new Date().toLocaleString("id-ID")}`, 44, 235);
    ctx.fillText(`Folder ID : ${extractedFolderId || "Default (Otomatis)"}`, 44, 265);

    return canvas.toDataURL("image/jpeg", 0.85);
  };

  const handleTestUpload = async () => {
    const cleanScript = scriptUrl.trim();
    if (!cleanScript || !cleanScript.startsWith("https://script.google.com/")) {
      setStatusMsg({
        text: "Harap isi URL Jembatan Google Apps Script (https://script.google.com/macros/s/.../exec) terlebih dahulu.",
        kind: "err",
      });
      return;
    }

    setTesting(true);
    setStatusMsg(null);

    try {
      const cleanFolderId = extractGoogleDriveFolderId(folderInput);
      // Simpan dulu agar sinkron
      await updateAppSettings({
        gdrive_folder_id: cleanFolderId,
        gdrive_script_url: cleanScript,
        gdrive_enabled: true,
      });

      const sampleDataUrl = generateSampleTestImage();
      const nowStr = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
      const fileName = `Tes_GoogleDrive_MidtownHotel_${nowStr}.jpg`;

      const res = await uploadPhotoToGoogleDrive({
        dataUrl: sampleDataUrl,
        fileName,
        scriptUrlOverride: cleanScript,
        folderIdOverride: cleanFolderId,
      });

      if (res.ok && res.uploadedToDrive && res.viewUrl) {
        setStatusMsg({
          text: `Koneksi Sukses! Foto tes "${fileName}" berhasil masuk ke Folder Google Drive Admin.`,
          kind: "ok",
          testLink: res.viewUrl,
        });
      } else {
        setStatusMsg({
          text:
            res.error ||
            "Gagal mengunggah ke Google Drive. Pastikan Deployment Google Script sudah disetel ke 'Siapa saja' (Anyone).",
          kind: "err",
        });
      }
    } catch (err: any) {
      setStatusMsg({
        text: err?.message || "Gagal menguji koneksi Google Drive.",
        kind: "err",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleMigrateOldPhotos = async () => {
    const cleanScript = scriptUrl.trim();
    if (!cleanScript || !cleanScript.startsWith("https://script.google.com/")) {
      setStatusMsg({
        text: "Harap isi URL Jembatan Google Apps Script (https://script.google.com/macros/s/.../exec) terlebih dahulu sebelum memindahkan foto lama.",
        kind: "err",
      });
      return;
    }

    setMigrating(true);
    setMigrationProgress(null);
    setStatusMsg(null);

    try {
      const cleanFolderId = extractGoogleDriveFolderId(folderInput);
      await updateAppSettings({
        gdrive_folder_id: cleanFolderId,
        gdrive_script_url: cleanScript,
        gdrive_enabled: true,
      });

      const res = await migrateAllOldPhotosToGoogleDrive({
        scriptUrlOverride: cleanScript,
        folderIdOverride: cleanFolderId,
        onProgress: (info) => {
          setMigrationProgress(info);
        },
      });

      setStatusMsg({
        text: res.message,
        kind: res.ok ? "ok" : "err",
      });
      refreshPhotoScanStats();
    } catch (err: any) {
      setStatusMsg({
        text: err?.message || "Gagal memindahkan foto lama ke Google Drive.",
        kind: "err",
      });
    } finally {
      setMigrating(false);
      setMigrationProgress(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl border-2 border-emerald-200 shadow-sm overflow-hidden">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-cyan-800 px-5 py-4 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
            <HardDrive className="w-5 h-5 text-emerald-200" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-extrabold">
                Penyimpanan Foto Otomatis ke Google Drive
              </h2>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                  isConfigured
                    ? "bg-emerald-400/25 text-emerald-100 border-emerald-300/40"
                    : "bg-amber-400/25 text-amber-100 border-amber-300/40"
                }`}
              >
                {isConfigured ? "Google Drive Aktif" : "Belum Dikonfigurasi"}
              </span>
            </div>
            <p className="text-xs text-emerald-100 mt-0.5">
              Semua foto meteran & perawatan AC tersimpan di Google Drive Admin — Database Supabase tetap hemat & cepat
            </p>
          </div>
        </div>

        {extractedFolderId && (
          <a
            href={`https://drive.google.com/drive/folders/${extractedFolderId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 bg-white/15 hover:bg-white/25 text-white border border-white/25 rounded-xl text-xs font-bold transition flex items-center gap-1.5 self-start sm:self-auto shrink-0"
          >
            <FolderOpen className="w-3.5 h-3.5 text-emerald-200" />
            <span>Buka Folder Drive</span>
            <ExternalLink className="w-3 h-3 opacity-80" />
          </a>
        )}
      </div>

      <form onSubmit={handleSave} className="p-5 space-y-5">
        {/* Ringkasan 3 Alur Kerja Otomatis */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
              <FolderOpen className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>1. Folder Drive Admin</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Admin cukup membuat folder di Google Drive (misal: <em>"Foto Meter Midtown Hotel"</em>) dan menempelkan ID Folder & URL Google Script di bawah.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900">
              <Smartphone className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>2. Upload Otomatis dari HP</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Saat petugas memotret meteran/AC dan menekan <strong>Simpan</strong>, foto otomatis terkirim & diberi nama sesuai <strong>Titik Meter/Unit, Shift, dan Tanggal</strong>.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900">
              <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span>3. Tampil di Riwayat & Sheets</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Link foto Google Drive otomatis tersimpan di database sehingga langsung tampil di menu <strong>Riwayat</strong> & bisa diklik dari <strong>Google Sheets</strong>.
            </p>
          </div>
        </div>

        {/* Status Message */}
        {statusMsg && (
          <div
            className={`p-3.5 rounded-xl text-xs font-semibold flex flex-col sm:flex-row sm:items-center justify-between gap-2 border ${
              statusMsg.kind === "ok"
                ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                : "bg-red-50 text-red-800 border-red-300"
            }`}
          >
            <div className="flex items-start gap-2">
              {statusMsg.kind === "ok" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              )}
              <span>{statusMsg.text}</span>
            </div>

            {statusMsg.testLink && (
              <div className="flex items-center gap-2 shrink-0">
                <img
                  src={getPhotoDisplayUrl(statusMsg.testLink)}
                  alt="Hasil Tes Drive"
                  className="w-10 h-10 rounded-lg object-cover border border-emerald-300 bg-slate-900"
                />
                <a
                  href={statusMsg.testLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 transition shadow-2xs"
                >
                  <span>Lihat Foto Tes di Drive</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>
        )}

        {/* Input Form Fields */}
        <div className="space-y-4">
          {/* Field 1: ID Folder / Link Folder Google Drive */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
              <label
                htmlFor="gdrive-folder-input"
                className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5"
              >
                <FolderOpen className="w-3.5 h-3.5 text-emerald-600" />
                <span>1. ID Folder / Link Folder Google Drive Admin</span>
              </label>
              <div className="flex items-center gap-1.5">
                {extractedFolderId && (
                  <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    ID Terdeteksi: {extractedFolderId}
                  </span>
                )}
                {folderInput && (
                  <button
                    type="button"
                    onClick={() => handleFolderInputChange("")}
                    className="text-[10px] font-bold text-red-600 hover:text-red-800 px-1.5 py-0.5 rounded bg-red-50 border border-red-200 flex items-center gap-0.5 cursor-pointer"
                    title="Kosongkan kolom 1"
                  >
                    <X className="w-2.5 h-2.5" />
                    <span>Hapus</span>
                  </button>
                )}
              </div>
            </div>
            <input
              id="gdrive-folder-input"
              name="gdrive_folder_id"
              type="text"
              autoComplete="off"
              value={folderInput}
              onChange={(e) => handleFolderInputChange(e.target.value)}
              placeholder="Tempel Link Folder Google Drive (https://drive.google.com/drive/folders/...) atau ID Folder"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white focus:outline-hidden"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Anda bisa menempelkan <strong>Link URL Folder Google Drive lengkap</strong> maupun <strong>ID Folder</strong> saja. Sistem akan otomatis mengenali ID foldernya.
            </p>
          </div>

          {/* Field 2: URL Jembatan Google Apps Script */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
              <label
                htmlFor="gdrive-script-input"
                className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5"
              >
                <Link2 className="w-3.5 h-3.5 text-blue-600" />
                <span>2. URL Jembatan Google Script (Web App URL)</span>
              </label>
              <div className="flex items-center gap-2">
                {scriptUrl && (
                  <button
                    type="button"
                    onClick={() => handleScriptUrlChange("")}
                    className="text-[10px] font-bold text-red-600 hover:text-red-800 px-1.5 py-0.5 rounded bg-red-50 border border-red-200 flex items-center gap-0.5 cursor-pointer"
                    title="Kosongkan kolom 2"
                  >
                    <X className="w-2.5 h-2.5" />
                    <span>Hapus</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowScriptGuide((prev) => !prev)}
                  className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>
                    {showScriptGuide
                      ? "Sembunyikan Kode & Panduan Google Script"
                      : "Belum punya URL Script? Lihat Kode & Cara Buat (1 Menit)"}
                  </span>
                  {showScriptGuide ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
            <input
              id="gdrive-script-input"
              name="gdrive_script_url"
              type="text"
              autoComplete="off"
              value={scriptUrl}
              onChange={(e) => handleScriptUrlChange(e.target.value)}
              placeholder="https://script.google.com/macros/s/AKfycb.../exec"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white focus:outline-hidden"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Tempelkan URL Web App dari Google Apps Script yang berakhiran <code>/exec</code>.
            </p>
          </div>

          {/* Contoh Format Penamaan Otomatis */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Format Penamaan File Foto Otomatis di Google Drive:</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div className="bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 font-mono text-slate-700 truncate">
                <span className="text-blue-600 font-bold">Meter:</span> Meter_PLN_Shift_PAGI_2026-09-29_08-15.jpg
              </div>
              <div className="bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 font-mono text-slate-700 truncate">
                <span className="text-emerald-600 font-bold">AC:</span> AC_Kamar_502_Shift_PAGI_2026-09-29_Suhu_Before.jpg
              </div>
            </div>
          </div>

          {/* Panduan & Kode Google Apps Script */}
          {showScriptGuide && (
            <div className="p-4 bg-slate-900 text-slate-100 rounded-2xl border border-slate-700 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <Code2 className="w-4 h-4" />
                    <span>Kode Jembatan Google Apps Script (Siap Pakai)</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Salin kode ini ke <strong>script.google.com</strong> pada akun Google Admin Anda
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href="https://script.google.com/home/start"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-lg text-[11px] font-bold flex items-center gap-1 transition"
                  >
                    <span>Buka Google Script</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <button
                    type="button"
                    onClick={handleCopyScriptCode}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                  >
                    {copiedCode ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Kode Tersalin!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Salin Kode Script</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <ol className="text-[11px] text-slate-300 space-y-1 list-decimal list-inside leading-relaxed">
                <li>
                  Buka <strong>script.google.com</strong> lalu klik <strong>Project Baru (New Project)</strong>.
                </li>
                <li>
                  Hapus kode bawaan, lalu klik tombol <strong>Salin Kode Script</strong> di atas dan <strong>Paste</strong> ke editor.
                </li>
                <li>
                  Klik tombol biru <strong>Terapkan (Deploy)</strong> di kanan atas &rarr; pilih <strong>Deployment baru (New deployment)</strong>.
                </li>
                <li>
                  Pilih jenis: <strong>Aplikasi Web (Web app)</strong>, bagian <em>Jalankan sebagai</em> pilih <strong>Saya (Me)</strong>, dan bagian <em>Siapa yang memiliki akses</em> wajib pilih <strong>Siapa saja (Anyone)</strong>.
                </li>
                <li>
                  Klik <strong>Terapkan (Deploy)</strong>, berikan izin akses Google Drive, lalu salin <strong>URL Aplikasi Web (.../exec)</strong> ke kolom nomor 2 di atas.
                </li>
              </ol>

              <pre className="p-3 bg-slate-950 text-emerald-300 rounded-xl border border-slate-800 text-[10px] font-mono overflow-x-auto max-h-56 leading-relaxed">
                {GOOGLE_APPS_SCRIPT_BRIDGE_CODE}
              </pre>
            </div>
          )}
        </div>

        {/* Action Buttons & Migrasi Foto Lama */}
        <div className="pt-3 border-t border-slate-200 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Tombol 1: Tes Upload Foto ke Google Drive */}
              <button
                type="button"
                disabled={testing || saving || migrating}
                onClick={handleTestUpload}
                className="px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-2xs"
              >
                <Upload className={`w-3.5 h-3.5 text-blue-600 ${testing ? "animate-bounce" : ""}`} />
                <span>
                  {testing ? "Mengirim Foto Tes..." : "Tes Upload Foto ke Google Drive"}
                </span>
              </button>

              {/* Tombol 2: Pindahkan Foto Lama ke Google Drive */}
              <button
                type="button"
                disabled={migrating || testing || saving}
                onClick={handleMigrateOldPhotos}
                className="px-4 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-2xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-amber-700 ${migrating ? "animate-spin" : ""}`} />
                <span>
                  {migrating
                    ? migrationProgress
                      ? `Memindahkan (${migrationProgress.current}/${migrationProgress.total}): ${migrationProgress.label}...`
                      : "Memindai & Memindahkan Foto Lama..."
                    : photoScanStats.totalCount > 0
                    ? `Pindahkan Foto Lama ke Google Drive (${photoScanStats.totalCount} Foto)`
                    : "Pindahkan Foto Lama ke Google Drive"}
                </span>
              </button>
            </div>

            <button
              type="submit"
              disabled={saving || testing || migrating}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? "Menyimpan..." : "Simpan Pengaturan Google Drive"}</span>
            </button>
          </div>

          {/* Status Beban Database Supabase */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-emerald-500 text-white font-bold text-[10px]">
                ✓
              </span>
              {photoScanStats.totalCount === 0 ? (
                <span className="font-medium text-slate-600">
                  Database Supabase hemat (0 beban foto baru
                  {photoScanStats.migratedDriveCount > 0
                    ? ` • ${photoScanStats.migratedDriveCount} foto tersimpan di Google Drive`
                    : ""}
                  )
                </span>
              ) : (
                <span className="font-medium text-amber-800">
                  Terdeteksi <strong>{photoScanStats.totalCount} foto lama</strong> di Supabase/Database (
                  {photoScanStats.acPhotosCount > 0 ? `${photoScanStats.acPhotosCount} AC ` : ""}
                  {photoScanStats.meterPhotosCount > 0 ? `${photoScanStats.meterPhotosCount} Meter ` : ""}
                  {photoScanStats.plantPhotosCount > 0 ? `${photoScanStats.plantPhotosCount} Ruang Mesin` : ""}
                  ) — Klik <strong>"Pindahkan Foto Lama ke Google Drive"</strong> agar database hemat.
                </span>
              )}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
