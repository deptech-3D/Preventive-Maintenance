import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Camera,
  Image as ImageIcon,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Upload,
  Loader2,
  Info,
  Clock,
  Sun,
  Sunset,
  Moon,
} from "lucide-react";
import { MeterMenu, Reading } from "../types";
import { apiFetch, useAuth } from "../auth";
import { useI18n } from "../i18n";
import { fetchMenus, fetchLastReading, createReading, fetchAppSettings, determineShift } from "../supabaseService";

interface LogEntryModalProps {
  meterId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function LogEntryModal({ meterId, onClose, onSuccess }: LogEntryModalProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [menu, setMenu] = useState<MeterMenu | null>(null);
  const [awal, setAwal] = useState("");
  const [akhir, setAkhir] = useState("");
  const [voltase, setVoltase] = useState("");
  const [ampere, setAmpere] = useState("");

  // PLN Stand Awal & Akhir registers
  const [lwbpAwal, setLwbpAwal] = useState("");
  const [lwbpAkhir, setLwbpAkhir] = useState("");
  const [wbpAwal, setWbpAwal] = useState("");
  const [wbpAkhir, setWbpAkhir] = useState("");
  const [kvarAwal, setKvarAwal] = useState("");
  const [kvarAkhir, setKvarAkhir] = useState("");

  const [notes, setNotes] = useState("");

  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [prevReading, setPrevReading] = useState<Reading | null>(null);
  const [notification, setNotification] = useState<{ msg: string; kind: "ok" | "err" | "alarm" } | null>(null);
  const [selectedShift, setSelectedShift] = useState<"pagi" | "sore" | "malam">("pagi");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const [menus, lastReading, settings] = await Promise.all([
          fetchMenus(),
          fetchLastReading(meterId),
          fetchAppSettings(),
        ]);
        const detected = determineShift(
          new Date(),
          settings.shift_pagi_start,
          settings.shift_sore_start,
          settings.shift_malam_start
        );
        setSelectedShift(detected);

        const m = menus.find((x) => x.menu_id === meterId);
        setMenu(m || null);
        if (lastReading) {
          setPrevReading(lastReading);
          setAwal(String(lastReading.akhir));

          // Set default awal for PLN registers if available
          if (lastReading.lwbp_akhir !== undefined) {
            setLwbpAwal(String(lastReading.lwbp_akhir));
          } else if (lastReading.lwbp !== undefined) {
            setLwbpAwal(String(lastReading.lwbp));
          }

          if (lastReading.wbp_akhir !== undefined) {
            setWbpAwal(String(lastReading.wbp_akhir));
          } else if (lastReading.wbp !== undefined) {
            setWbpAwal(String(lastReading.wbp));
          }

          if (lastReading.kvar_akhir !== undefined) {
            setKvarAwal(String(lastReading.kvar_akhir));
          } else if (lastReading.kvar !== undefined) {
            setKvarAwal(String(lastReading.kvar));
          }
        } else {
          setAwal("0");
          setLwbpAwal("0");
          setWbpAwal("0");
          setKvarAwal("0");
        }
      } catch (e) {
        console.error(e);
      }
    })();
  }, [meterId]);

  // Calculations for PLN registers
  const lwbpUsed = (() => {
    const a = parseFloat(lwbpAwal || "0");
    const b = parseFloat(lwbpAkhir || "0");
    if (isNaN(a) || isNaN(b) || !lwbpAkhir) return 0;
    return Math.max(0, Math.round((b - a) * 1000) / 1000);
  })();

  const wbpUsed = (() => {
    const a = parseFloat(wbpAwal || "0");
    const b = parseFloat(wbpAkhir || "0");
    if (isNaN(a) || isNaN(b) || !wbpAkhir) return 0;
    return Math.max(0, Math.round((b - a) * 1000) / 1000);
  })();

  const kvarUsed = (() => {
    const a = parseFloat(kvarAwal || "0");
    const b = parseFloat(kvarAkhir || "0");
    if (isNaN(a) || isNaN(b) || !kvarAkhir) return 0;
    return Math.max(0, Math.round((b - a) * 1000) / 1000);
  })();

  // If PLN and user entered both LWBP and WBP, auto-suggest or link Total
  const total = (() => {
    if (menu?.kind === "pln" && (lwbpUsed > 0 || wbpUsed > 0) && (!akhir || akhir === awal)) {
      return Math.round((lwbpUsed + wbpUsed) * 1000) / 1000;
    }
    const a = parseFloat(awal || "0");
    const b = parseFloat(akhir || "0");
    if (isNaN(a) || isNaN(b)) return 0;
    return Math.max(0, Math.round((b - a) * 1000) / 1000);
  })();

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 1200;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL("image/jpeg", 0.8));
          } else {
            resolve(event.target?.result as string);
          }
        };
        img.onerror = () => resolve(event.target?.result as string);
        img.src = event.target?.result as string;
      };
      reader.onerror = () => resolve("");
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoFile(file);
    const url = URL.createObjectURL(file);
    setPhotoPreview(url);

    // Compress client-side first
    const compressed = await compressImage(file);
    if (compressed) {
      setPhotoPreview(compressed);
      setPhotoPath(compressed); // Immediate offline-safe fallback
    }

    // Auto upload photo to server
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await apiFetch<{ path: string }>("/api/upload", {
        method: "POST",
        body: form,
      });
      if (res?.path) {
        setPhotoPath(res.path);
      }
      setNotification({ msg: t("upload_success"), kind: "ok" });
    } catch {
      // If server upload failed, compressed image is already set in photoPath!
      setNotification({ msg: "Foto siap disimpan bersama checklist", kind: "ok" });
    } finally {
      setUploading(false);
    }
  };

  const handleRunOcr = async () => {
    if (!photoFile) {
      setNotification({ msg: "Ambil atau pilih foto terlebih dahulu", kind: "err" });
      return;
    }
    setOcrLoading(true);
    setNotification({ msg: t("ocr_processing"), kind: "ok" });
    try {
      const form = new FormData();
      form.append("file", photoFile);
      const res = await apiFetch<{ value: number | null; raw: string }>("/api/ocr", {
        method: "POST",
        body: form,
      });

      if (res.value !== null && res.value !== undefined) {
        setAkhir(String(res.value));
        setNotification({
          msg: `OCR berhasil: ${res.value} ${menu?.unit || ""}`,
          kind: "ok",
        });
      } else {
        setNotification({
          msg: "Angka tidak terdeteksi jelas pada foto. Silakan ketik angka manual.",
          kind: "err",
        });
      }
    } catch (err: any) {
      setNotification({ msg: err?.message || "OCR gagal", kind: "err" });
    } finally {
      setOcrLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!akhir) {
      setNotification({ msg: "Angka meter akhir wajib diisi", kind: "err" });
      return;
    }

    const a = parseFloat(awal);
    const b = parseFloat(akhir);
    if (b < a) {
      setNotification({
        msg: "Angka akhir tidak boleh lebih kecil dari angka awal",
        kind: "err",
      });
      return;
    }

    setSubmitting(true);
    try {
      const activeUser = user || {
        user_id: "usr_guest",
        name: "Petugas",
        email: "guest@meter.local",
        role: "user" as const,
      };

      const res = await createReading({
        meter_id: meterId,
        awal: a,
        akhir: b,
        user: activeUser,
        shift: selectedShift,
        photo_path: photoPath || undefined,
        voltase: voltase ? parseFloat(voltase) : undefined,
        ampere: ampere ? parseFloat(ampere) : undefined,
        lwbp: lwbpAkhir ? parseFloat(lwbpAkhir) : (lwbpAwal ? parseFloat(lwbpAwal) : undefined),
        lwbp_awal: lwbpAwal ? parseFloat(lwbpAwal) : undefined,
        lwbp_akhir: lwbpAkhir ? parseFloat(lwbpAkhir) : undefined,
        wbp: wbpAkhir ? parseFloat(wbpAkhir) : (wbpAwal ? parseFloat(wbpAwal) : undefined),
        wbp_awal: wbpAwal ? parseFloat(wbpAwal) : undefined,
        wbp_akhir: wbpAkhir ? parseFloat(wbpAkhir) : undefined,
        kvar: kvarAkhir ? parseFloat(kvarAkhir) : (kvarAwal ? parseFloat(kvarAwal) : undefined),
        kvar_awal: kvarAwal ? parseFloat(kvarAwal) : undefined,
        kvar_akhir: kvarAkhir ? parseFloat(kvarAkhir) : undefined,
        notes: notes || undefined,
      });

      if (res.alarm) {
        alert(t("alarm_triggered"));
      }
      onSuccess();
    } catch (err: any) {
      setNotification({ msg: err?.message || "Gagal menyimpan pencatatan", kind: "err" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {t("log")} - {menu?.name || "Meter"}
            </h2>
            <p className="text-xs text-slate-500">
              Satuan: <span className="font-semibold text-slate-700">{menu?.unit}</span>
              {menu?.kind === "pln" ? " • Panel Listrik PLN" : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-full transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {notification && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 border font-medium ${
                notification.kind === "ok"
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-red-50 text-red-800 border-red-200"
              }`}
            >
              {notification.kind === "ok" ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              )}
              <span>{notification.msg}</span>
            </div>
          )}

          {/* Photo & OCR Block */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                {t("photo")}
              </label>
              <span className="text-[11px] text-slate-500 font-medium">Kamera atau Galeri</span>
            </div>

            {/* Hidden native inputs: one with capture for direct camera, one standard for gallery file picker */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />

            {photoPreview ? (
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 group">
                <img src={photoPreview} alt="Preview" className="w-full h-48 object-cover opacity-95" />
                
                {/* Overlay actions when photo is present */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent flex flex-col justify-end p-3">
                  <div className="flex items-center justify-between text-white text-xs mb-2">
                    <span className="font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      Foto Terpilih
                    </span>
                    {uploading && (
                      <span className="flex items-center gap-1 text-[11px] text-amber-300">
                        <Loader2 className="w-3 h-3 animate-spin" /> Mengunggah...
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="py-2 px-2.5 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Foto Ulang</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      className="py-2 px-2.5 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition"
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>Pilih Galeri</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/60 hover:border-blue-400 transition">
                <div className="text-center mb-3">
                  <div className="w-11 h-11 rounded-full bg-blue-100 text-blue-600 mx-auto flex items-center justify-center mb-2">
                    <Camera className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-800">Lampirkan Bukti Foto Fisik</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Ambil foto langsung atau ambil dari galeri HP (Maks. 10MB)</p>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="py-2.5 px-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Buka Kamera</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    className="py-2.5 px-3 bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition"
                  >
                    <ImageIcon className="w-4 h-4 text-slate-600" />
                    <span>Dari Galeri</span>
                  </button>
                </div>
              </div>
            )}

            {/* OCR action button */}
            {photoPreview && (
              <div className="mt-2.5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRunOcr}
                  disabled={ocrLoading}
                  className="flex-1 py-2 px-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition disabled:opacity-50"
                >
                  {ocrLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  <span>{t("ocr_scan")}</span>
                </button>
              </div>
            )}
          </div>

          {/* Shift Selector */}
          <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                <span>Shift Kerja Petugas</span>
              </label>
              <span className="text-[11px] text-slate-500 font-medium">
                Pilih shift pencatatan
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSelectedShift("pagi")}
                className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  selectedShift === "pagi"
                    ? "bg-amber-500 text-white border-amber-600 shadow-sm"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                <span>Pagi</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedShift("sore")}
                className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  selectedShift === "sore"
                    ? "bg-orange-500 text-white border-orange-600 shadow-sm"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
              >
                <Sunset className="w-3.5 h-3.5" />
                <span>Sore</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedShift("malam")}
                className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  selectedShift === "malam"
                    ? "bg-indigo-600 text-white border-indigo-700 shadow-sm"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                <span>Malam</span>
              </button>
            </div>
          </div>

          {/* Reading Inputs: Awal & Akhir */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                {t("awal")} ({menu?.unit})
              </label>
              <input
                type="number"
                step="any"
                required
                value={awal}
                onChange={(e) => setAwal(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              {prevReading !== null && (
                <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-1">
                  <Info className="w-3 h-3 text-blue-500" />
                  <span>Sebelumnya: {prevReading.akhir} {menu?.unit}</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                {t("akhir")} ({menu?.unit}) *
              </label>
              <input
                type="number"
                step="any"
                required
                value={akhir}
                onChange={(e) => setAkhir(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2.5 bg-white border border-blue-400 rounded-xl text-sm font-bold text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          {/* Total Box */}
          <div className="bg-blue-50 border border-blue-200/80 rounded-2xl p-4 text-center">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
              {t("total")} ({t("total_used")})
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold text-blue-900 mt-1">
              {total.toLocaleString("id-ID")}{" "}
              <span className="text-sm font-semibold text-blue-600">{menu?.unit}</span>
            </div>
            <p className="text-[11px] text-blue-600/80 mt-0.5">Dihitung otomatis: Akhir - Awal</p>
          </div>

          {/* Extra Fields for PLN */}
          {menu?.kind === "pln" && (
            <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <span>Register Meter PLN (LWBP & WBP)</span>
                </h4>
                <span className="text-[10px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                  Awal & Akhir per Shift
                </span>
              </div>

              {/* LWBP Section */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    LWBP (Luar Waktu Beban Puncak)
                  </span>
                  <span className="text-xs font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                    Pakai: +{lwbpUsed.toLocaleString("id-ID")} kWh
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                      Stand Awal LWBP
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={lwbpAwal}
                      onChange={(e) => setLwbpAwal(e.target.value)}
                      placeholder="0"
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                      Stand Akhir LWBP
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={lwbpAkhir}
                      onChange={(e) => setLwbpAkhir(e.target.value)}
                      placeholder="0"
                      className="w-full px-2.5 py-1.5 bg-white border border-blue-300 rounded-lg text-xs font-mono font-bold text-blue-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* WBP Section */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    WBP (Waktu Beban Puncak)
                  </span>
                  <span className="text-xs font-extrabold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">
                    Pakai: +{wbpUsed.toLocaleString("id-ID")} kWh
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                      Stand Awal WBP
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={wbpAwal}
                      onChange={(e) => setWbpAwal(e.target.value)}
                      placeholder="0"
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-medium focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                      Stand Akhir WBP
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={wbpAkhir}
                      onChange={(e) => setWbpAkhir(e.target.value)}
                      placeholder="0"
                      className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-mono font-bold text-amber-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* kVARh Section */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-500" />
                    kVARh (Daya Reaktif)
                  </span>
                  <span className="text-xs font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                    Pakai: +{kvarUsed.toLocaleString("id-ID")} kVARh
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                      Stand Awal kVARh
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={kvarAwal}
                      onChange={(e) => setKvarAwal(e.target.value)}
                      placeholder="0"
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                      Stand Akhir kVARh
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={kvarAkhir}
                      onChange={(e) => setKvarAkhir(e.target.value)}
                      placeholder="0"
                      className="w-full px-2.5 py-1.5 bg-white border border-indigo-300 rounded-lg text-xs font-mono font-bold text-indigo-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Volt & Ampere */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Voltase (V)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={voltase}
                    onChange={(e) => setVoltase(e.target.value)}
                    placeholder="380"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Ampere (A)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={ampere}
                    onChange={(e) => setAmpere(e.target.value)}
                    placeholder="120"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Notes Field */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              {t("notes")}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan kondisi meter, kebocoran, atau tekanan..."
              rows={2}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {/* Sticky Bottom Save Action */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{t("submit")}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
