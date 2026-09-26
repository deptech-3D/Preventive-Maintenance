import React, { useState, useEffect, useMemo } from "react";
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
  Search,
  RotateCcw,
  MapPin,
  Camera,
  ImageIcon,
} from "lucide-react";
import {
  ACCategory,
  ACUnitLocation,
  ACMaintenanceLog,
  normalizeACCategory,
  REAL_FLOORS,
  resolveFloorFromUnit,
} from "../types";
import { useAuth } from "../auth";
import {
  fetchACUnits,
  createACMaintenanceLog,
} from "../supabaseService";
import { compressImageFile } from "../utils/imageCompressor";

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

  // Master Units & Selection
  const [units, setUnits] = useState<ACUnitLocation[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string>("");
  const [category, setCategory] = useState<ACCategory>("Area Privat / Kamar Hotel");

  // Quick Search States
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedFloorFilter, setSelectedFloorFilter] = useState<string>("all");
  const [isChangingUnit, setIsChangingUnit] = useState<boolean>(false);

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

  // 6. Foto Dokumentasi Before & After (4 Foto: 1. Before/After Suhu, 2. Before/After Anemometer)
  const [photoTempBefore, setPhotoTempBefore] = useState<string>("");
  const [photoTempAfter, setPhotoTempAfter] = useState<string>("");
  const [photoAnemoBefore, setPhotoAnemoBefore] = useState<string>("");
  const [photoAnemoAfter, setPhotoAnemoAfter] = useState<string>("");
  const [processingPhoto, setProcessingPhoto] = useState<Record<string, boolean>>({});

  const handlePhotoUpload = async (
    key: "temp_before" | "temp_after" | "anemo_before" | "anemo_after",
    setter: (val: string) => void,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setProcessingPhoto((prev) => ({ ...prev, [key]: true }));
      const compressed = await compressImageFile(file, { maxDimension: 900, quality: 0.72 });
      if (compressed) {
        setter(compressed);
      }
    } catch (err) {
      console.error(`Gagal kompres foto ${key}:`, err);
    } finally {
      setProcessingPhoto((prev) => ({ ...prev, [key]: false }));
      e.target.value = "";
    }
  };

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
            setCategory(normalizeACCategory(match.category));
            setSelectedUnitId(match.id);
            setIsChangingUnit(false);
          }
        }
      } catch (err) {
        console.error("Gagal memuat master unit:", err);
      } finally {
        setLoadingUnits(false);
      }
    })();
  }, [initialUnitId]);

  // Selected unit entity
  const selectedUnit = useMemo(() => {
    return units.find((u) => u.id === selectedUnitId) || null;
  }, [units, selectedUnitId]);

  // Extract available unique floors from units
  const availableFloors = useMemo(() => {
    const floorSet = new Set<string>();
    units.forEach((u) => {
      floorSet.add(resolveFloorFromUnit(u));
    });
    return REAL_FLOORS.filter((f) => floorSet.has(f));
  }, [units]);

  // Filter units dynamically based on Quick Search and Floor Filter
  const searchResults = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return units.filter((u) => {
      const uFloor = resolveFloorFromUnit(u);
      if (selectedFloorFilter !== "all" && uFloor !== selectedFloorFilter) {
        return false;
      }
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        (u.code && u.code.toLowerCase().includes(q)) ||
        uFloor.toLowerCase().includes(q) ||
        u.category.toLowerCase().includes(q)
      );
    });
  }, [units, searchQuery, selectedFloorFilter]);

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

    if (!selectedUnitId || !selectedUnit) {
      setErrorMsg("Harap pilih nama/nomor ruangan atau identifikasi AC melalui pencarian cepat!");
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

    try {
      setSubmitting(true);
      const newLog = await createACMaintenanceLog({
        recorded_at: new Date(recordedAt).toISOString(),
        user_id: user?.user_id || "usr_tech",
        user_name: user?.name || "Teknisi AC",
        category: normalizeACCategory(selectedUnit.category),
        unit_id: selectedUnit.id,
        unit_name: selectedUnit.name,
        temp_before: parsedTempBefore,
        temp_after: parsedTempAfter,
        anemo_before: parsedAnemoBefore,
        anemo_after: parsedAnemoAfter,
        notes: notes.trim(),
        photo_temp_before: photoTempBefore || undefined,
        photo_temp_after: photoTempAfter || undefined,
        photo_anemo_before: photoAnemoBefore || undefined,
        photo_anemo_after: photoAnemoAfter || undefined,
        photo_before: photoTempBefore || undefined,
        photo_after: photoTempAfter || undefined,
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
                  className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
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

          {/* Section 2: PENCARIAN CEPAT UNIT / RUANGAN AC */}
          <div className="space-y-3 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-slate-50 p-4 rounded-xl border border-blue-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                <Search className="w-4 h-4 text-blue-600" />
                1. Pencarian Cepat Unit / Ruangan AC <span className="text-red-500">*</span>
              </h3>
              {selectedUnit && !isChangingUnit && (
                <button
                  type="button"
                  onClick={() => {
                    setIsChangingUnit(true);
                    setSearchQuery("");
                  }}
                  className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-blue-100/80 transition cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Ganti / Cari Ulang</span>
                </button>
              )}
            </div>

            {selectedUnit && !isChangingUnit ? (
              /* Selected Unit Card */
              <div className="bg-white p-3.5 rounded-xl border-2 border-blue-500 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>
                    <span className="text-sm font-black text-slate-900">{selectedUnit.name}</span>
                    {selectedUnit.code && (
                      <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                        {selectedUnit.code}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      <MapPin className="w-2.5 h-2.5" />
                      {resolveFloorFromUnit(selectedUnit)}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                      {selectedUnit.category}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsChangingUnit(true);
                    setSearchQuery("");
                  }}
                  className="px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer self-start sm:self-auto shrink-0 shadow-2xs"
                >
                  <Search className="w-3.5 h-3.5 text-blue-600" />
                  <span>Ganti Kamar</span>
                </button>
              </div>
            ) : (
              /* Quick Search Bar & Live Results */
              <div className="space-y-2.5">
                {/* Search Bar Input */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type="text"
                    autoFocus={isChangingUnit || !selectedUnitId}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Ketik nomor kamar / unit (contoh: 301, Resto, Lobby, VRV, AHU)..."
                    className="w-full pl-9 pr-9 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-hidden shadow-2xs"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Quick Floor Filter Pills */}
                {availableFloors.length > 0 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] scrollbar-thin">
                    <button
                      type="button"
                      onClick={() => setSelectedFloorFilter("all")}
                      className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition cursor-pointer ${
                        selectedFloorFilter === "all"
                          ? "bg-blue-600 text-white shadow-2xs"
                          : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      Semua Lantai ({units.length})
                    </button>
                    {availableFloors.map((floor) => {
                      const count = units.filter((u) => resolveFloorFromUnit(u) === floor).length;
                      return (
                        <button
                          key={floor}
                          type="button"
                          onClick={() => setSelectedFloorFilter(floor)}
                          className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition cursor-pointer ${
                            selectedFloorFilter === floor
                              ? "bg-blue-600 text-white shadow-2xs"
                              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          {floor} ({count})
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Search Results / Suggestion List */}
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  <div className="p-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-[11px] font-bold text-slate-500">
                    <span>
                      {searchQuery
                        ? `Hasil Pencarian: "${searchQuery}" (${searchResults.length} unit)`
                        : selectedFloorFilter !== "all"
                        ? `Unit di ${selectedFloorFilter} (${searchResults.length} unit)`
                        : `Pilih Unit AC (${searchResults.length} unit total)`}
                    </span>
                    {selectedUnit && (
                      <button
                        type="button"
                        onClick={() => setIsChangingUnit(false)}
                        className="text-blue-600 hover:underline cursor-pointer"
                      >
                        Batal
                      </button>
                    )}
                  </div>

                  <div className="max-h-52 overflow-y-auto divide-y divide-slate-100 p-1">
                    {loadingUnits ? (
                      <div className="p-4 text-center text-xs text-slate-400">
                        Memuat data kamar & unit AC...
                      </div>
                    ) : searchResults.length === 0 ? (
                      <div className="p-6 text-center space-y-1">
                        <p className="text-xs font-bold text-slate-700">
                          Tidak ditemukan kamar/unit dengan kata kunci "{searchQuery}"
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Coba periksa ejaan nomor kamar atau pilih "Semua Lantai"
                        </p>
                      </div>
                    ) : (
                      searchResults.map((u) => {
                        const isCurrent = u.id === selectedUnitId;
                        const floorName = resolveFloorFromUnit(u);
                        return (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => {
                              setSelectedUnitId(u.id);
                              setCategory(normalizeACCategory(u.category));
                              setIsChangingUnit(false);
                              setSearchQuery("");
                            }}
                            className={`w-full text-left p-2.5 rounded-lg flex items-center justify-between gap-3 transition cursor-pointer group ${
                              isCurrent
                                ? "bg-blue-50 border border-blue-300"
                                : "hover:bg-blue-50/60 border border-transparent"
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-900 truncate">
                                  {u.name}
                                </span>
                                {u.code && (
                                  <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-1 py-0.2 rounded">
                                    {u.code}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-500">
                                <span className="font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded">
                                  {floorName}
                                </span>
                                <span>•</span>
                                <span className="truncate">{u.category}</span>
                              </div>
                            </div>

                            <div className="shrink-0 flex items-center">
                              {isCurrent ? (
                                <span className="px-2 py-0.5 bg-blue-600 text-white rounded text-[10px] font-bold flex items-center gap-1">
                                  <Check className="w-3 h-3" /> Dipilih
                                </span>
                              ) : (
                                <span className="text-xs text-blue-600 font-bold group-hover:underline">
                                  Pilih →
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}
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

          {/* Section 3: Dokumentasi Foto (4 Foto Bersandingan) */}
          <div className="space-y-3 bg-slate-50/90 p-3.5 rounded-xl border border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-0.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-blue-600" />
                3. Dokumentasi Foto (Before & After)
              </h3>
              <span className="text-[10px] text-slate-500 italic">
                *Foto lama di kamar ini otomatis terhapus saat cuci berikutnya
              </span>
            </div>

            {/* 1. Foto Before & After Suhu */}
            <div className="bg-amber-50/40 p-2.5 rounded-xl border border-amber-200/80 space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-900">
                <Thermometer className="w-3.5 h-3.5 text-amber-600" />
                <span>1. Foto Before & After Suhu (°C)</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {/* Before Suhu */}
                <div className="bg-white p-2 rounded-lg border border-amber-200 space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-bold text-amber-800">
                    <span className="flex items-center gap-1 truncate">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                      Before Suhu
                    </span>
                    {photoTempBefore && (
                      <button
                        type="button"
                        onClick={() => setPhotoTempBefore("")}
                        className="text-[10px] text-red-600 hover:text-red-800 font-semibold cursor-pointer"
                      >
                        Hapus
                      </button>
                    )}
                  </div>
                  {photoTempBefore ? (
                    <div className="relative rounded-md overflow-hidden border border-slate-200 group bg-slate-900 h-20 flex items-center justify-center">
                      <img
                        src={photoTempBefore}
                        alt="Before Suhu"
                        className="w-full h-full object-cover"
                      />
                      <label className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition flex items-center justify-center cursor-pointer">
                        <span className="px-2 py-0.5 bg-white text-slate-800 text-[10px] font-bold rounded-md shadow-xs">
                          Ganti
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={(e) => handlePhotoUpload("temp_before", setPhotoTempBefore, e)}
                          className="hidden"
                        />
                      </label>
                    </div>
                  ) : (
                    <label className="border border-dashed border-amber-300 hover:border-amber-500 rounded-md h-20 px-2 flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-amber-50/40 transition text-center">
                      {processingPhoto["temp_before"] ? (
                        <div className="w-3.5 h-3.5 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <Camera className="w-4 h-4 text-amber-600" />
                          <span className="text-[10px] font-bold text-slate-700 leading-tight">
                            Foto Before Suhu
                          </span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => handlePhotoUpload("temp_before", setPhotoTempBefore, e)}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                {/* After Suhu */}
                <div className="bg-white p-2 rounded-lg border border-emerald-200 space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-bold text-emerald-800">
                    <span className="flex items-center gap-1 truncate">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      After Suhu
                    </span>
                    {photoTempAfter && (
                      <button
                        type="button"
                        onClick={() => setPhotoTempAfter("")}
                        className="text-[10px] text-red-600 hover:text-red-800 font-semibold cursor-pointer"
                      >
                        Hapus
                      </button>
                    )}
                  </div>
                  {photoTempAfter ? (
                    <div className="relative rounded-md overflow-hidden border border-slate-200 group bg-slate-900 h-20 flex items-center justify-center">
                      <img
                        src={photoTempAfter}
                        alt="After Suhu"
                        className="w-full h-full object-cover"
                      />
                      <label className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition flex items-center justify-center cursor-pointer">
                        <span className="px-2 py-0.5 bg-white text-slate-800 text-[10px] font-bold rounded-md shadow-xs">
                          Ganti
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={(e) => handlePhotoUpload("temp_after", setPhotoTempAfter, e)}
                          className="hidden"
                        />
                      </label>
                    </div>
                  ) : (
                    <label className="border border-dashed border-emerald-300 hover:border-emerald-500 rounded-md h-20 px-2 flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-emerald-50/40 transition text-center">
                      {processingPhoto["temp_after"] ? (
                        <div className="w-3.5 h-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <Camera className="w-4 h-4 text-emerald-600" />
                          <span className="text-[10px] font-bold text-slate-700 leading-tight">
                            Foto After Suhu
                          </span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => handlePhotoUpload("temp_after", setPhotoTempAfter, e)}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>

            {/* 2. Foto Before & After Anemometer */}
            <div className="bg-cyan-50/40 p-2.5 rounded-xl border border-cyan-200/80 space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-cyan-900">
                <Wind className="w-3.5 h-3.5 text-cyan-600" />
                <span>2. Foto Before & After Anemometer (m/s)</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {/* Before Anemo */}
                <div className="bg-white p-2 rounded-lg border border-cyan-200 space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-bold text-cyan-800">
                    <span className="flex items-center gap-1 truncate">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 shrink-0" />
                      Before Anemo
                    </span>
                    {photoAnemoBefore && (
                      <button
                        type="button"
                        onClick={() => setPhotoAnemoBefore("")}
                        className="text-[10px] text-red-600 hover:text-red-800 font-semibold cursor-pointer"
                      >
                        Hapus
                      </button>
                    )}
                  </div>
                  {photoAnemoBefore ? (
                    <div className="relative rounded-md overflow-hidden border border-slate-200 group bg-slate-900 h-20 flex items-center justify-center">
                      <img
                        src={photoAnemoBefore}
                        alt="Before Anemometer"
                        className="w-full h-full object-cover"
                      />
                      <label className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition flex items-center justify-center cursor-pointer">
                        <span className="px-2 py-0.5 bg-white text-slate-800 text-[10px] font-bold rounded-md shadow-xs">
                          Ganti
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={(e) => handlePhotoUpload("anemo_before", setPhotoAnemoBefore, e)}
                          className="hidden"
                        />
                      </label>
                    </div>
                  ) : (
                    <label className="border border-dashed border-cyan-300 hover:border-cyan-500 rounded-md h-20 px-2 flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-cyan-50/40 transition text-center">
                      {processingPhoto["anemo_before"] ? (
                        <div className="w-3.5 h-3.5 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <Camera className="w-4 h-4 text-cyan-600" />
                          <span className="text-[10px] font-bold text-slate-700 leading-tight">
                            Foto Before Anemo
                          </span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => handlePhotoUpload("anemo_before", setPhotoAnemoBefore, e)}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                {/* After Anemo */}
                <div className="bg-white p-2 rounded-lg border border-emerald-200 space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-bold text-emerald-800">
                    <span className="flex items-center gap-1 truncate">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      After Anemo
                    </span>
                    {photoAnemoAfter && (
                      <button
                        type="button"
                        onClick={() => setPhotoAnemoAfter("")}
                        className="text-[10px] text-red-600 hover:text-red-800 font-semibold cursor-pointer"
                      >
                        Hapus
                      </button>
                    )}
                  </div>
                  {photoAnemoAfter ? (
                    <div className="relative rounded-md overflow-hidden border border-slate-200 group bg-slate-900 h-20 flex items-center justify-center">
                      <img
                        src={photoAnemoAfter}
                        alt="After Anemometer"
                        className="w-full h-full object-cover"
                      />
                      <label className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition flex items-center justify-center cursor-pointer">
                        <span className="px-2 py-0.5 bg-white text-slate-800 text-[10px] font-bold rounded-md shadow-xs">
                          Ganti
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={(e) => handlePhotoUpload("anemo_after", setPhotoAnemoAfter, e)}
                          className="hidden"
                        />
                      </label>
                    </div>
                  ) : (
                    <label className="border border-dashed border-emerald-300 hover:border-emerald-500 rounded-md h-20 px-2 flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-emerald-50/40 transition text-center">
                      {processingPhoto["anemo_after"] ? (
                        <div className="w-3.5 h-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <Camera className="w-4 h-4 text-emerald-600" />
                          <span className="text-[10px] font-bold text-slate-700 leading-tight">
                            Foto After Anemo
                          </span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => handlePhotoUpload("anemo_after", setPhotoAnemoAfter, e)}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
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
