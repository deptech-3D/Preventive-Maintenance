import React, { useState, useEffect, useRef } from "react";
import {
  Download,
  Upload,
  Copy,
  Check,
  Globe,
  RefreshCw,
  X,
  CloudDownload,
  CloudUpload,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { ACUnitLocation } from "../types";
import {
  fetchACUnits,
  exportACUnitsToJSON,
  copyACUnitsToClipboard,
  importACUnitsFromJSON,
  syncWithRemoteLiveApp,
  pushCurrentDataToRemote,
} from "../supabaseService";

interface ACDataBackupSyncCardProps {
  onDataChanged?: () => void;
}

export function ACDataBackupSyncCard({ onDataChanged }: ACDataBackupSyncCardProps) {
  const [units, setUnits] = useState<ACUnitLocation[]>([]);
  const [copiedCode, setCopiedCode] = useState(false);
  const [pasteModalOpen, setPasteModalOpen] = useState(false);
  const [pasteCode, setPasteCode] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Live URL Sync state
  const [syncingRemote, setSyncingRemote] = useState<boolean>(false);
  const [liveUrlInput, setLiveUrlInput] = useState<string>("https://preventive-maint-eng.ai.studio");
  const [remoteSyncModalOpen, setRemoteSyncModalOpen] = useState<boolean>(false);

  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadUnits = async () => {
    try {
      const data = await fetchACUnits();
      setUnits(data);
    } catch (err) {
      console.error("Gagal memuat unit:", err);
    }
  };

  useEffect(() => {
    loadUnits();
  }, []);

  const handleSyncFromLive = async (customUrl?: string) => {
    const target = (customUrl || liveUrlInput || "https://preventive-maint-eng.ai.studio").trim();
    try {
      setSyncingRemote(true);
      setErrorMsg(null);
      const result = await syncWithRemoteLiveApp(target);
      setSuccessMsg(result.message);
      await loadUnits();
      onDataChanged?.();
      setRemoteSyncModalOpen(false);
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal menyinkronkan data dari live server");
    } finally {
      setSyncingRemote(false);
    }
  };

  const handlePushToLive = async (customUrl?: string) => {
    const target = (customUrl || liveUrlInput || "https://preventive-maint-eng.ai.studio").trim();
    try {
      setSyncingRemote(true);
      setErrorMsg(null);
      const result = await pushCurrentDataToRemote(target);
      setSuccessMsg(result.message);
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal mengirim data ke live server");
    } finally {
      setSyncingRemote(false);
    }
  };

  return (
    <div className="space-y-2">
      {/* Toast Feedback */}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-800 flex items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-red-500 hover:text-red-700"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* CADANGAN & SINKRONISASI DATA AC PERLANTAI */}
      <div className="bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-slate-50 p-4 rounded-2xl border border-blue-200/80 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4 text-blue-700" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                Cadangkan & Ekspor Data AC Perlantai
              </h3>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Total <strong>{units.length} unit AC</strong> tersimpan. Unduh file cadangan atau salin kode data agar unit yang Anda input bisa diterapkan di HP / link share.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Tarik Data dari Live URL */}
            <button
              type="button"
              onClick={() => handleSyncFromLive()}
              disabled={syncingRemote}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition min-h-[36px] cursor-pointer disabled:opacity-50"
              title="Tarik langsung seluruh data AC, user, dan pengaturan dari https://preventive-maint-eng.ai.studio"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingRemote ? "animate-spin" : ""}`} />
              <span>{syncingRemote ? "Menyinkronkan..." : "Tarik dari Live (preventive-maint-eng.ai.studio)"}</span>
            </button>

            {/* Hubungkan URL Live */}
            <button
              type="button"
              onClick={() => setRemoteSyncModalOpen(true)}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition min-h-[36px] cursor-pointer"
              title="Buka opsi sinkronisasi URL Live"
            >
              <Globe className="w-3.5 h-3.5 text-blue-600" />
              <span>Hubungkan URL Live</span>
            </button>

            {/* Unduh JSON */}
            <button
              type="button"
              onClick={() => {
                exportACUnitsToJSON();
                setSuccessMsg("File data AC perlantai berhasil diunduh!");
                setTimeout(() => setSuccessMsg(null), 3500);
              }}
              className="px-3 py-1.5 bg-white hover:bg-blue-50 border border-blue-200 text-blue-700 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition min-h-[36px]"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh File JSON</span>
            </button>

            {/* Salin JSON */}
            <button
              type="button"
              onClick={() => {
                const ok = copyACUnitsToClipboard();
                if (ok) {
                  setCopiedCode(true);
                  setSuccessMsg("Kode data AC berhasil disalin! Anda bisa kirim lewat WA atau tempel di chat.");
                  setTimeout(() => {
                    setCopiedCode(false);
                    setSuccessMsg(null);
                  }, 4000);
                }
              }}
              className="px-3 py-1.5 bg-white hover:bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition min-h-[36px]"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCode ? "Kode Disalin!" : "2. Salin Teks JSON"}</span>
            </button>

            {/* Unggah File */}
            <input
              type="file"
              ref={fileInputRef}
              accept=".json"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const text = await file.text();
                  const res = importACUnitsFromJSON(text);
                  setSuccessMsg(`Berhasil memulihkan ${res.count} unit AC perlantai!`);
                  await loadUnits();
                  onDataChanged?.();
                  setTimeout(() => setSuccessMsg(null), 4000);
                } catch (err: any) {
                  setErrorMsg(err.message || "Gagal membaca file JSON");
                }
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 bg-white hover:bg-amber-50 border border-amber-200 text-amber-700 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition min-h-[36px]"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>3. Unggah File</span>
            </button>

            {/* Tempel Kode */}
            <button
              type="button"
              onClick={() => setPasteModalOpen(true)}
              className="px-3 py-1.5 bg-white hover:bg-purple-50 border border-purple-200 text-purple-700 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition min-h-[36px]"
            >
              <span>Tempel Kode</span>
            </button>
          </div>
        </div>
      </div>

      {/* MODAL TEMPEL KODE JSON */}
      {pasteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <h3 className="text-xs font-bold flex items-center gap-2">
                <Upload className="w-4 h-4 text-purple-400" />
                <span>Tempel Kode Cadangan Data AC</span>
              </h3>
              <button
                type="button"
                onClick={() => setPasteModalOpen(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs text-slate-700">
              <p className="text-slate-600">
                Tempelkan (Paste) kode teks JSON data unit AC perlantai yang sudah Anda salin dari web live atau perangkat lain:
              </p>

              <textarea
                value={pasteCode}
                onChange={(e) => setPasteCode(e.target.value)}
                placeholder='[{"id":"unit_km_301","floor":"Lantai 3","name":"Kamar 301",...}]'
                rows={7}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[11px] text-slate-900 focus:bg-white focus:ring-2 focus:ring-purple-500 focus:outline-hidden resize-none"
              />

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPasteModalOpen(false)}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={!pasteCode.trim()}
                  onClick={async () => {
                    try {
                      const res = importACUnitsFromJSON(pasteCode.trim());
                      setPasteModalOpen(false);
                      setPasteCode("");
                      setSuccessMsg(`Berhasil memulihkan ${res.count} unit AC perlantai!`);
                      await loadUnits();
                      onDataChanged?.();
                      setTimeout(() => setSuccessMsg(null), 4000);
                    } catch (err: any) {
                      setErrorMsg(err.message || "Format JSON tidak valid");
                    }
                  }}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  Terapkan Data AC
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SINKRONISASI LIVE URL */}
      {remoteSyncModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <h3 className="text-xs font-bold flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-400" />
                <span>Sinkronisasi Antara Live & Preview</span>
              </h3>
              <button
                type="button"
                onClick={() => setRemoteSyncModalOpen(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs text-slate-700">
              <p className="text-slate-600">
                Fitur ini memungkinkan data master AC, urutan kamar, riwayat perawatan, akun teknisi/admin, dan pengaturan yang Anda ubah di <strong>https://preventive-maint-eng.ai.studio</strong> langsung ditarik ke lingkungan preview ini.
              </p>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Alamat URL Server Live:
                </label>
                <input
                  type="url"
                  value={liveUrlInput}
                  onChange={(e) => setLiveUrlInput(e.target.value)}
                  placeholder="https://preventive-maint-eng.ai.studio"
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Target default: <strong>https://preventive-maint-eng.ai.studio</strong>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  disabled={syncingRemote}
                  onClick={() => handleSyncFromLive()}
                  className="p-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-900 rounded-xl flex flex-col items-center gap-1.5 text-center font-bold transition cursor-pointer disabled:opacity-50"
                >
                  <CloudDownload className={`w-5 h-5 text-blue-600 ${syncingRemote ? "animate-bounce" : ""}`} />
                  <span>Tarik Data dari Live ke Preview</span>
                  <span className="text-[10px] font-normal text-blue-600">Ambil perubahan terbaru dari situs live</span>
                </button>

                <button
                  type="button"
                  disabled={syncingRemote}
                  onClick={() => handlePushToLive()}
                  className="p-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 rounded-xl flex flex-col items-center gap-1.5 text-center font-bold transition cursor-pointer disabled:opacity-50"
                >
                  <CloudUpload className="w-5 h-5 text-emerald-600" />
                  <span>Kirim Data Preview ke Live</span>
                  <span className="text-[10px] font-normal text-emerald-600">Unggah unit dari preview ini ke server live</span>
                </button>
              </div>

              <div className="pt-2 flex items-center justify-end border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRemoteSyncModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
