import React, { useState, useEffect } from "react";
import {
  X,
  Calendar,
  Clock,
  User as UserIcon,
  Thermometer,
  Wind,
  FileText,
  CheckCircle2,
  AlertCircle,
  Building2,
  Check,
  ChevronDown,
} from "lucide-react";
import {
  ACCategory,
  AC_CATEGORIES,
  ACUnitLocation,
  ACMaintenanceLog,
} from "../types";
import { useAuth } from "../auth";
import {
  fetchACUnits,
  createACMaintenanceLog,
} from "../supabaseService";

interface ACLogEntryModalProps {
  initialUnitId?: string | null;
  onClose: () => void;
  onSuccess: (newLog: ACMaintenanceLog) => void;
}

export function ACLogEntryModal({
  initialUnitId,
  onClose,
  onSuccess,
}: ACLogEntryModalProps) {
  const { user } = useAuth();

  // 1. Kategori Dropdown dinamis
  const [category, setCategory] = useState<ACCategory>("Kamar Hotel");
  const [units, setUnits] = useState<ACUnitLocation[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string>("");

  // 2. Tanggal & Jam (otomatis mendeteksi waktu saat ini)
  const getNowLocalString = () => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const min = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  };

  const [recordedAt, setRecordedAt] = useState<string>(getNowLocalString());

  // 3. Suhu Before & Suhu After (°C)
  const [tempBefore, setTempBefore] = useState<string>("26.5");
  const [tempAfter, setTempAfter] = useState<string>("20.2");

  // 4. Anemometer Before & Anemometer After (m/s)
  const [anemoBefore, setAnemoBefore] = useState<string>("1.8");
  const [anemoAfter, setAnemoAfter] = useState<string>("3.5");

  // 5. Catatan Tambahan (Kondisi sebelum dan sesudah)
  const [notes, setNotes] = useState<string>("");

  const [loadingUnits, setLoadingUnits] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load all units and set initial selection
  useEffect(() => {
    (async () => {
      try {
        setLoadingUnits(true);
        const data = await fetchACUnits();
        setUnits(data);

        if (initialUnitId) {
          const match = data.find((u) => u.id === initialUnitId);
          if (match) {
            setCategory(match.category);
            setSelectedUnitId(match.id);
          }
        }
      } catch (err) {
        console.error("Gagal memuat master unit:", err);
      } finally {
        setLoadingUnits(false);
      }
    })();
  }, [initialUnitId]);

  // Filter units according to selected category
  const filteredUnits = units.filter((u) => u.category === category);

  // Auto-select first unit of category when category changes
  useEffect(() => {
    if (filteredUnits.length > 0) {
      const exists = filteredUnits.some((u) => u.id === selectedUnitId);
      if (!exists) {
        setSelectedUnitId(filteredUnits[0].id);
      }
    } else {
      setSelectedUnitId("");
    }
  }, [category, units, filteredUnits, selectedUnitId]);

  // Calculations for delta comparison
  const parsedTempBefore = parseFloat(tempBefore);
  const parsedTempAfter = parseFloat(tempAfter);
  const tempDelta =
    !isNaN(parsedTempBefore) && !isNaN(parsedTempAfter)
      ? Number((parsedTempBefore - parsedTempAfter).toFixed(1))
      : null;

  const parsedAnemoBefore = parseFloat(anemoBefore);
  const parsedAnemoAfter = parseFloat(anemoAfter);
  const anemoDelta =
    !isNaN(parsedAnemoBefore) && !isNaN(parsedAnemoAfter)
      ? Number((parsedAnemoAfter - parsedAnemoBefore).toFixed(2))
      : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedUnitId) {
      setErrorMsg("Harap pilih nama/nomor ruangan atau identifikasi lantai VRV!");
      return;
    }

    if (isNaN(parsedTempBefore) || isNaN(parsedTempAfter)) {
      setErrorMsg("Harap isi nilai Suhu Before dan Suhu After dengan angka valid!");
      return;
    }

    if (isNaN(parsedAnemoBefore) || isNaN(parsedAnemoAfter)) {
      setErrorMsg("Harap isi nilai Anemometer Before dan After dengan angka valid!");
      return;
    }

    const currentUnit = units.find((u) => u.id === selectedUnitId);
    if (!currentUnit) {
      setErrorMsg("Unit yang dipilih tidak valid.");
      return;
    }

    try {
      setSubmitting(true);
      const newLog = await createACMaintenanceLog({
        recorded_at: new Date(recordedAt).toISOString(),
        user_id: user?.user_id || "usr_tech",
        user_name: user?.name || "Teknisi AC",
        category,
        unit_id: currentUnit.id,
        unit_name: currentUnit.name,
        temp_before: parsedTempBefore,
        temp_after: parsedTempAfter,
        anemo_before: parsedAnemoBefore,
        anemo_after: parsedAnemoAfter,
        notes: notes.trim(),
      });

      onSuccess(newLog);
    } catch (err: any) {
      console.error("Gagal menyimpan log perawatan AC:", err);
      setErrorMsg(err.message || "Gagal menyimpan log perawatan. Silakan coba lagi.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 px-5 py-4 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
              <Thermometer className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold leading-tight">
                Form Pencatatan Perawatan AC Rutin
              </h2>
              <p className="text-xs text-blue-100">
                Pencatatan suhu, anemometer & kondisi unit AC / VRV
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-5 flex-1 text-slate-800">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Section 1: Locked Meta Info (Waktu & Teknisi) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            {/* Tanggal & Jam */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  Tanggal & Jam Perawatan
                </span>
                <button
                  type="button"
                  onClick={() => setRecordedAt(getNowLocalString())}
                  className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold"
                >
                  Waktu Sekarang
                </button>
              </label>
              <input
                type="datetime-local"
                value={recordedAt}
                onChange={(e) => setRecordedAt(e.target.value)}
                required
                className="w-full text-xs font-semibold px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            {/* Nama Teknisi (Locked from Session) */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1.5">
                <UserIcon className="w-3.5 h-3.5 text-blue-600" />
                Nama Teknisi (Terkunci)
              </label>
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-200/80 border border-slate-300 rounded-lg text-xs font-bold text-slate-800">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span className="truncate">{user?.name || "Teknisi Engineering"}</span>
                <span className="ml-auto text-[10px] uppercase font-bold text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                  {user?.role || "user"}
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Kategori & Unit Dinamis */}
          <div className="space-y-3 bg-blue-50/40 p-4 rounded-xl border border-blue-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-blue-600" />
              1. Pemilihan Kategori & Unit Lokasi
            </h3>

            {/* 5 Kategori Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Kategori Area (5 Kategori)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {AC_CATEGORIES.map((cat) => {
                  const isActive = category === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold text-left transition border flex items-center justify-between ${
                        isActive
                          ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                          : "bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50/50"
                      }`}
                    >
                      <span className="truncate">{cat}</span>
                      {isActive && <Check className="w-3.5 h-3.5 shrink-0 ml-1" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dynamic Dropdown Unit/Ruangan */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nama / Nomor Ruangan / Identifikasi Lantai VRV{" "}
                <span className="text-red-500">*</span>
              </label>

              {loadingUnits ? (
                <div className="h-10 bg-slate-200 animate-pulse rounded-lg" />
              ) : filteredUnits.length === 0 ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                  Belum ada daftar ruangan/unit untuk kategori <strong>{category}</strong>.
                  Admin dapat menambahkannya melalui menu <em>Settings → Master Lokasi/Unit</em>.
                </div>
              ) : (
                <div className="relative">
                  <select
                    value={selectedUnitId}
                    onChange={(e) => setSelectedUnitId(e.target.value)}
                    required
                    className="w-full text-xs font-semibold px-3 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden appearance-none pr-8 cursor-pointer"
                  >
                    {filteredUnits.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} {u.code ? `(${u.code})` : ""}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Data Pengukuran Suhu & Anemometer */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Thermometer className="w-4 h-4 text-amber-500" />
              2. Parameter Pengukuran (Before vs After)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Suhu Box */}
              <div className="p-3.5 bg-amber-50/50 border border-amber-200 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                    <Thermometer className="w-4 h-4 text-amber-600" />
                    <span>Suhu AC (°C)</span>
                  </div>
                  {tempDelta !== null && (
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        tempDelta > 0
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {tempDelta > 0 ? `Turun ${tempDelta} °C` : `${tempDelta} °C`}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-amber-800 mb-0.5">
                      Suhu BEFORE (°C)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={tempBefore}
                      onChange={(e) => setTempBefore(e.target.value)}
                      placeholder="Contoh: 26.5"
                      required
                      className="w-full text-xs font-bold px-2.5 py-2 bg-white border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-amber-800 mb-0.5">
                      Suhu AFTER (°C)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={tempAfter}
                      onChange={(e) => setTempAfter(e.target.value)}
                      placeholder="Contoh: 20.2"
                      required
                      className="w-full text-xs font-bold px-2.5 py-2 bg-white border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-amber-700 italic">
                  *Suhu diukur menggunakan thermometer probe di kisi-kisi hembusan evaporator.
                </p>
              </div>

              {/* Anemometer Box */}
              <div className="p-3.5 bg-cyan-50/50 border border-cyan-200 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-900">
                    <Wind className="w-4 h-4 text-cyan-600" />
                    <span>Kecepatan Angin (m/s)</span>
                  </div>
                  {anemoDelta !== null && (
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        anemoDelta > 0
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {anemoDelta > 0 ? `+${anemoDelta} m/s` : `${anemoDelta} m/s`}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-cyan-800 mb-0.5">
                      Anemo BEFORE (m/s)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={anemoBefore}
                      onChange={(e) => setAnemoBefore(e.target.value)}
                      placeholder="Contoh: 1.8"
                      required
                      className="w-full text-xs font-bold px-2.5 py-2 bg-white border border-cyan-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-cyan-800 mb-0.5">
                      Anemo AFTER (m/s)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={anemoAfter}
                      onChange={(e) => setAnemoAfter(e.target.value)}
                      placeholder="Contoh: 3.5"
                      required
                      className="w-full text-xs font-bold px-2.5 py-2 bg-white border border-cyan-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-hidden"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-cyan-700 italic">
                  *Kecepatan hembusan angin sebelum & sesudah filter/evaporator dibersihkan.
                </p>
              </div>
            </div>
          </div>

          {/* Section 4: Catatan Tambahan */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              Catatan Tambahan (Kondisi Area/Unit Sebelum & Sesudah)
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Sebelum dibersihkan filter debu tebal, sirip evaporator kotor. Sesudah dibersihkan aliran air drain lancar, unit tidak bergetar dan wangi."
              className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting || loadingUnits}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 flex items-center gap-2 transition disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              {submitting ? "Menyimpan Data..." : "Simpan Perawatan AC"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
