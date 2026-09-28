import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Calendar,
  Clock,
  User as UserIcon,
  Users,
  UserPlus,
  Thermometer,
  Wind,
  FileText,
  CheckCircle2,
  AlertCircle,
  Building2,
  Check,
  ChevronDown,
  ChevronUp,
  Search,
  RotateCcw,
  MapPin,
  Camera,
  ImageIcon,
  History as HistoryIcon,
} from "lucide-react";
import {
  ACCategory,
  ACUnitLocation,
  ACMaintenanceLog,
  ACUnitScheduleStatus,
  normalizeACCategory,
  REAL_FLOORS,
  resolveFloorFromUnit,
  formatUnitCycleLabel,
} from "../types";
import { useAuth } from "../auth";
import {
  fetchACUnits,
  getLocalACUnits,
  fetchACMaintenanceLogs,
  getLocalACLogs,
  fetchAppSettings,
  getLocalAppSettings,
  calculateACScheduleStatus,
  createACMaintenanceLog,
  fetchUsers,
  getRegisteredUserOptions,
  formatTechnicianNames,
} from "../supabaseService";
import { compressImageFile } from "../utils/imageCompressor";
import {
  getSmartUnitSuggestions,
  smartFilterAndSortUnits,
} from "../utils/smartSearch";
import { useBackHandler } from "../utils/backNavigation";

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
  const isAdmin = user?.role === "admin" || !user;

  // Registered Users / Technicians for selection (1 or 2 names)
  const [registeredUsers, setRegisteredUsers] = useState<
    Array<{ user_id: string; name: string; role: "admin" | "user" }>
  >(() => getRegisteredUserOptions());

  const [selectedTech1, setSelectedTech1] = useState<string>(() => {
    const opts = getRegisteredUserOptions();
    if (user?.name && user.name !== "Chief Engineer (Admin)") {
      return user.name;
    }
    return opts[0]?.name || user?.name || "Teknisi Engineering";
  });
  const [selectedTech2, setSelectedTech2] = useState<string>("");

  // Master Units, Maintenance Logs & Selection
  const [units, setUnits] = useState<ACUnitLocation[]>(() => getLocalACUnits());
  const [maintenanceLogs, setMaintenanceLogs] = useState<ACMaintenanceLog[]>(() => getLocalACLogs());
  const [defaultCycleMonths, setDefaultCycleMonths] = useState<number>(
    () => getLocalAppSettings().ac_maintenance_cycle_months || 1
  );
  const [selectedUnitId, setSelectedUnitId] = useState<string>(initialUnitId || "");
  const [category, setCategory] = useState<ACCategory>("Area Privat / Kamar Hotel");
  const [showAllUnitHistory, setShowAllUnitHistory] = useState<boolean>(false);

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

  // 3. Suhu Before & Suhu After (°C) — dikosongkan agar wajib diisi manual
  const [tempBefore, setTempBefore] = useState<string>("");
  const [tempAfter, setTempAfter] = useState<string>("");

  // 4. Anemometer Before & Anemometer After (m/s) — dikosongkan agar wajib diisi manual
  const [anemoBefore, setAnemoBefore] = useState<string>("");
  const [anemoAfter, setAnemoAfter] = useState<string>("");

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

  const [loadingUnits, setLoadingUnits] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load all units, logs, settings & registered users
  useEffect(() => {
    (async () => {
      try {
        const [data, fetchedLogs, fetchedSettings, fetchedUsers] = await Promise.all([
          fetchACUnits(),
          fetchACMaintenanceLogs().catch(() => getLocalACLogs()),
          fetchAppSettings().catch(() => getLocalAppSettings()),
          fetchUsers().catch(() => []),
        ]);
        setUnits(data);
        setMaintenanceLogs(fetchedLogs);
        if (fetchedSettings?.ac_maintenance_cycle_months) {
          setDefaultCycleMonths(fetchedSettings.ac_maintenance_cycle_months);
        }
        if (fetchedUsers.length > 0) {
          const opts = getRegisteredUserOptions(fetchedUsers);
          setRegisteredUsers(opts);
          setSelectedTech1((prev) => {
            if (!prev || prev === "Chief Engineer (Admin)" || prev === "Teknisi Engineering") {
              return opts[0]?.name || prev;
            }
            return prev;
          });
        }

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

    const handleUsersSynced = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      const opts = getRegisteredUserOptions(Array.isArray(detail) ? detail : undefined);
      setRegisteredUsers(opts);
    };
    const handleACDataSynced = () => {
      setUnits(getLocalACUnits());
      setMaintenanceLogs(getLocalACLogs());
      setDefaultCycleMonths(getLocalAppSettings().ac_maintenance_cycle_months || 1);
    };
    window.addEventListener("users-data-synced", handleUsersSynced);
    window.addEventListener("ac-data-synced", handleACDataSynced);
    window.addEventListener("app-settings-synced", handleACDataSynced);
    return () => {
      window.removeEventListener("users-data-synced", handleUsersSynced);
      window.removeEventListener("ac-data-synced", handleACDataSynced);
      window.removeEventListener("app-settings-synced", handleACDataSynced);
    };
  }, [initialUnitId]);

  const handleQuickToggleTech = (name: string) => {
    if (!isAdmin) {
      // Untuk user biasa, nama ke-1 tetap dirinya, klik nama lain akan mengisi/menghapus Teknisi 2
      if (name.toLowerCase() === selectedTech1.toLowerCase()) return;
      if (selectedTech2.toLowerCase() === name.toLowerCase()) {
        setSelectedTech2("");
      } else {
        setSelectedTech2(name);
      }
      return;
    }

    // Untuk Admin: bisa pilih 1 atau 2 nama dari daftar User/Teknisi terdaftar
    if (selectedTech1.toLowerCase() === name.toLowerCase()) {
      if (selectedTech2) {
        setSelectedTech1(selectedTech2);
        setSelectedTech2("");
      }
    } else if (selectedTech2.toLowerCase() === name.toLowerCase()) {
      setSelectedTech2("");
    } else if (!selectedTech1) {
      setSelectedTech1(name);
    } else if (!selectedTech2) {
      setSelectedTech2(name);
    } else {
      setSelectedTech2(name);
    }
  };

  const combinedTechnicianName = useMemo(
    () => formatTechnicianNames(selectedTech1 || user?.name || "Teknisi AC", selectedTech2),
    [selectedTech1, selectedTech2, user?.name]
  );

  // Selected unit entity
  const selectedUnit = useMemo(() => {
    return units.find((u) => u.id === selectedUnitId) || null;
  }, [units, selectedUnitId]);

  // Tombol Kembali (Back) di HP / Browser:
  // 1. Menutup modal Form Pencatatan AC
  useBackHandler(true, onClose, 20);
  // 2. Menutup daftar riwayat cuci terdahulu jika sedang dibuka
  useBackHandler(showAllUnitHistory, () => setShowAllUnitHistory(false), 24);
  // 3. Menutup menu pencarian "Ganti Kamar" kembali ke unit yang sudah dipilih
  useBackHandler(
    Boolean(selectedUnit && isChangingUnit),
    () => {
      setIsChangingUnit(false);
      setSearchQuery("");
    },
    25
  );

  // Schedule & Last Cleaning Map across all units
  const scheduleStatusMap = useMemo(() => {
    const statuses = calculateACScheduleStatus(units, maintenanceLogs, defaultCycleMonths);
    const map = new Map<string, ACUnitScheduleStatus>();
    statuses.forEach((s) => {
      map.set(s.unit.id, s);
    });
    return map;
  }, [units, maintenanceLogs, defaultCycleMonths]);

  // Map unit_id -> all historical cleaning logs sorted newest first
  const unitHistoryLogsMap = useMemo(() => {
    const map = new Map<string, ACMaintenanceLog[]>();
    units.forEach((unit) => {
      const unitLogs = maintenanceLogs
        .filter(
          (l) =>
            l.unit_id === unit.id ||
            l.unit_name.toLowerCase().trim() === unit.name.toLowerCase().trim()
        )
        .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime());
      if (unitLogs.length > 0) {
        map.set(unit.id, unitLogs);
      }
    });
    return map;
  }, [units, maintenanceLogs]);

  const selectedUnitSchedule = useMemo(() => {
    if (!selectedUnit) return null;
    return scheduleStatusMap.get(selectedUnit.id) || null;
  }, [selectedUnit, scheduleStatusMap]);

  const selectedUnitHistoryLogs = useMemo(() => {
    if (!selectedUnit) return [];
    return unitHistoryLogsMap.get(selectedUnit.id) || [];
  }, [selectedUnit, unitHistoryLogsMap]);

  const selectedUnitLastLog = useMemo(() => {
    return selectedUnitSchedule?.last_log || selectedUnitHistoryLogs[0] || null;
  }, [selectedUnitSchedule, selectedUnitHistoryLogs]);

  const formatDateFull = (isoStr?: string | null) => {
    if (!isoStr) return "-";
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatDateTimeFull = (isoStr?: string | null) => {
    if (!isoStr) return "-";
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return "-";
    const datePart = d.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    const timePart = d.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${datePart}, ${timePart}`;
  };

  const formatRelativeAgo = (isoStr?: string | null) => {
    if (!isoStr) return "";
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return "";
    const diffMs = Date.now() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHours <= 0) return "Baru saja hari ini";
      return `${diffHours} jam yang lalu`;
    }
    if (diffDays === 1) return "Kemarin (1 hari lalu)";
    return `${diffDays} hari yang lalu`;
  };

  // Extract available unique floors from units
  const availableFloors = useMemo(() => {
    const floorSet = new Set<string>();
    units.forEach((u) => {
      floorSet.add(resolveFloorFromUnit(u));
    });
    return REAL_FLOORS.filter((f) => floorSet.has(f));
  }, [units]);

  // Smart clickable suggestions across all units
  const smartSuggestions = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return getSmartUnitSuggestions(units, (u) => u, searchQuery, 8);
  }, [units, searchQuery]);

  // Filter units dynamically based on Smart Search and Floor Filter
  const searchResults = useMemo(() => {
    const floorFiltered =
      selectedFloorFilter === "all"
        ? units
        : units.filter((u) => resolveFloorFromUnit(u) === selectedFloorFilter);

    if (!searchQuery.trim()) return floorFiltered;

    const matched = smartFilterAndSortUnits(floorFiltered, (u) => u, searchQuery);
    if (matched.length === 0) {
      return smartFilterAndSortUnits(units, (u) => u, searchQuery);
    }
    return matched;
  }, [units, searchQuery, selectedFloorFilter]);

  // Calculations for delta comparison
  const parseManualNumber = (val: string): number => {
    const trimmed = val.trim().replace(",", ".");
    if (!trimmed) return NaN;
    return Number(trimmed);
  };

  const parsedTempBefore = parseManualNumber(tempBefore);
  const parsedTempAfter = parseManualNumber(tempAfter);
  const tempDelta =
    !isNaN(parsedTempBefore) && !isNaN(parsedTempAfter)
      ? Number((parsedTempBefore - parsedTempAfter).toFixed(1))
      : null;

  const parsedAnemoBefore = parseManualNumber(anemoBefore);
  const parsedAnemoAfter = parseManualNumber(anemoAfter);
  const anemoDelta =
    !isNaN(parsedAnemoBefore) && !isNaN(parsedAnemoAfter)
      ? Number((parsedAnemoAfter - parsedAnemoBefore).toFixed(2))
      : null;

  const isAllMeasurementsFilled =
    tempBefore.trim() !== "" &&
    !isNaN(parsedTempBefore) &&
    tempAfter.trim() !== "" &&
    !isNaN(parsedTempAfter) &&
    anemoBefore.trim() !== "" &&
    !isNaN(parsedAnemoBefore) &&
    anemoAfter.trim() !== "" &&
    !isNaN(parsedAnemoAfter);

  const isCanSubmit = Boolean(selectedUnitId && selectedUnit && isAllMeasurementsFilled);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedUnitId || !selectedUnit) {
      setErrorMsg("Harap pilih nama/nomor ruangan atau identifikasi AC melalui pencarian cepat!");
      return;
    }

    if (tempBefore.trim() === "" || tempAfter.trim() === "" || isNaN(parsedTempBefore) || isNaN(parsedTempAfter)) {
      setErrorMsg("Harap isi manual nilai Suhu BEFORE dan Suhu AFTER terlebih dahulu!");
      return;
    }

    if (anemoBefore.trim() === "" || anemoAfter.trim() === "" || isNaN(parsedAnemoBefore) || isNaN(parsedAnemoAfter)) {
      setErrorMsg("Harap isi manual nilai Anemometer BEFORE dan AFTER terlebih dahulu!");
      return;
    }

    try {
      setSubmitting(true);
      const newLog = await createACMaintenanceLog({
        recorded_at: new Date(recordedAt).toISOString(),
        user_id: user?.user_id || "usr_tech",
        user_name: combinedTechnicianName,
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

          {/* Section 1: Waktu & Pemilihan Nama User / Teknisi (Bisa 1 atau 2 Nama) */}
          <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

              {/* Ringkasan Nama Teknisi Terpilih */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-blue-600" />
                    {isAdmin ? "Teknisi Terpilih (1-2 Nama)" : "Nama Teknisi Bertugas"}
                  </span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                    {selectedTech2 ? "2 Teknisi" : "1 Teknisi"}
                  </span>
                </label>
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50/70 border border-blue-200 rounded-lg text-xs font-bold text-slate-900">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                  <span className="truncate">{combinedTechnicianName}</span>
                </div>
              </div>
            </div>

            {/* Pilihan Dropdown Teknisi 1 & Teknisi 2 (Khusus Admin bisa pilih keduanya, User bisa tambah rekan ke-2) */}
            <div className="pt-2 border-t border-slate-200/80 space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Dropdown Teknisi 1 */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1 flex items-center gap-1">
                    <UserIcon className="w-3 h-3 text-blue-600" />
                    <span>Nama User / Teknisi 1 {isAdmin ? "(Pilih Terdaftar)" : ""}</span>
                  </label>
                  {isAdmin ? (
                    <select
                      value={selectedTech1}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedTech1(val);
                        if (val.toLowerCase() === selectedTech2.toLowerCase()) {
                          setSelectedTech2("");
                        }
                      }}
                      className="w-full text-xs font-bold px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden cursor-pointer"
                    >
                      {registeredUsers.map((u) => (
                        <option key={`t1_${u.user_id}_${u.name}`} value={u.name}>
                          {u.name} ({u.role === "admin" ? "Admin" : "Teknisi"})
                        </option>
                      ))}
                      {selectedTech1 &&
                        !registeredUsers.some(
                          (u) => u.name.toLowerCase() === selectedTech1.toLowerCase()
                        ) && <option value={selectedTech1}>{selectedTech1}</option>}
                    </select>
                  ) : (
                    <div className="px-2.5 py-2 bg-slate-200/70 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 truncate">
                      {selectedTech1}
                    </div>
                  )}
                </div>

                {/* Dropdown Teknisi 2 (Opsional) */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <UserPlus className="w-3 h-3 text-indigo-600" />
                      <span>Tambah Nama Teknisi 2 (Opsional)</span>
                    </span>
                    {selectedTech2 && (
                      <button
                        type="button"
                        onClick={() => setSelectedTech2("")}
                        className="text-[10px] text-red-600 hover:underline font-bold cursor-pointer"
                      >
                        Hapus ke-2
                      </button>
                    )}
                  </label>
                  <select
                    value={selectedTech2}
                    onChange={(e) => setSelectedTech2(e.target.value)}
                    className="w-full text-xs font-bold px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden cursor-pointer"
                  >
                    <option value="">— Hanya 1 Teknisi (Tanpa Nama ke-2) —</option>
                    {registeredUsers
                      .filter((u) => u.name.toLowerCase() !== selectedTech1.toLowerCase())
                      .map((u) => (
                        <option key={`t2_${u.user_id}_${u.name}`} value={u.name}>
                          + {u.name} ({u.role === "admin" ? "Admin" : "Teknisi"})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Tombol Klik Cepat Daftar Nama User/Teknisi yang Sudah Terdaftar */}
              {registeredUsers.length > 0 && (
                <div className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-bold text-slate-600">
                      Klik Cepat Nama User / Teknisi Terdaftar (Bisa pilih sampai 2 nama):
                    </span>
                    {selectedTech2 && (
                      <button
                        type="button"
                        onClick={() => setSelectedTech2("")}
                        className="text-slate-500 hover:text-red-600 font-semibold cursor-pointer"
                      >
                        Reset 1 Nama
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {registeredUsers.map((u) => {
                      const isFirst = selectedTech1.toLowerCase() === u.name.toLowerCase();
                      const isSecond = selectedTech2.toLowerCase() === u.name.toLowerCase();
                      const isPicked = isFirst || isSecond;
                      return (
                        <button
                          key={`chip_${u.user_id}_${u.name}`}
                          type="button"
                          onClick={() => handleQuickToggleTech(u.name)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 border cursor-pointer ${
                            isFirst
                              ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                              : isSecond
                              ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                              : "bg-slate-50 text-slate-700 border-slate-200 hover:border-blue-400 hover:bg-blue-50/50"
                          }`}
                        >
                          {isPicked && (
                            <span className="w-4 h-4 rounded-full bg-white/25 text-white text-[10px] font-black flex items-center justify-center">
                              {isFirst ? "1" : "2"}
                            </span>
                          )}
                          <span>{u.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
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
              /* Selected Unit Card + Last Cleaning Info */
              <div className="space-y-3">
                <div className="bg-white p-3.5 rounded-xl border-2 border-blue-500 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>
                      <span className="text-sm font-black text-slate-900">{selectedUnit.name}</span>
                      {selectedUnit.code && (
                        <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                          {selectedUnit.code}
                        </span>
                      )}
                      {selectedUnitLastLog ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Sudah Pernah Cleaning ({selectedUnitHistoryLogs.length}x)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                          Belum Pernah Dicuci
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
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        <Clock className="w-2.5 h-2.5" />
                        Siklus: {formatUnitCycleLabel(selectedUnit, defaultCycleMonths)}
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

                {/* INFORMASI TERAKHIR DATA UNIT CUCI (JIKA SUDAH PERNAH DI-CLEANING) */}
                {selectedUnitLastLog ? (
                  <div className="bg-white rounded-xl border border-emerald-300 shadow-xs overflow-hidden">
                    <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-3.5 py-2 text-white flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold">
                        <HistoryIcon className="w-3.5 h-3.5 text-emerald-100 shrink-0" />
                        <span>Informasi Terakhir Data Unit Cuci (Riwayat Cleaning Terakhir)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {selectedUnitSchedule && (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              selectedUnitSchedule.status === "overdue"
                                ? "bg-red-100 text-red-800 border-red-300"
                                : selectedUnitSchedule.status === "approaching"
                                ? "bg-amber-100 text-amber-900 border-amber-300"
                                : "bg-white/20 text-white border-white/30"
                            }`}
                          >
                            {selectedUnitSchedule.status_label}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="p-3.5 space-y-3 bg-emerald-50/25">
                      {/* Baris 1: Tanggal Cuci Terakhir, Teknisi, & Jatuh Tempo */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div className="bg-white p-2.5 rounded-lg border border-slate-200/90">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                            Tanggal & Jam Cuci Terakhir
                          </span>
                          <span className="text-xs font-extrabold text-slate-900 block mt-0.5">
                            {formatDateTimeFull(selectedUnitLastLog.recorded_at)}
                          </span>
                          <span className="text-[10px] font-semibold text-emerald-700 block mt-0.5">
                            {formatRelativeAgo(selectedUnitLastLog.recorded_at)}
                          </span>
                        </div>

                        <div className="bg-white p-2.5 rounded-lg border border-slate-200/90">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                            Teknisi Pelaksana Terakhir
                          </span>
                          <span className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5 mt-0.5">
                            <UserIcon className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span className="truncate">{selectedUnitLastLog.user_name || "-"}</span>
                          </span>
                          <span className="text-[10px] text-slate-500 block mt-0.5">
                            Total riwayat: {selectedUnitHistoryLogs.length} kali dicuci
                          </span>
                        </div>

                        <div className="bg-white p-2.5 rounded-lg border border-slate-200/90">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                            Jadwal Cuci Berikutnya
                          </span>
                          <span
                            className={`text-xs font-extrabold block mt-0.5 ${
                              selectedUnitSchedule?.status === "overdue"
                                ? "text-red-600"
                                : selectedUnitSchedule?.status === "approaching"
                                ? "text-amber-600"
                                : "text-slate-900"
                            }`}
                          >
                            {formatDateFull(selectedUnitSchedule?.next_due_date)}
                          </span>
                          <span className="text-[10px] text-slate-500 block mt-0.5">
                            Siklus unit: {formatUnitCycleLabel(selectedUnit, defaultCycleMonths)}
                          </span>
                        </div>
                      </div>

                      {/* Baris 2: Parameter Pengukuran Terakhir (Suhu & Anemometer Before vs After) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {/* Suhu Terakhir */}
                        <div className="bg-amber-50/70 p-2.5 rounded-lg border border-amber-200 flex items-center justify-between gap-2">
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-bold text-amber-900 flex items-center gap-1">
                              <Thermometer className="w-3 h-3 text-amber-600" />
                              Data Suhu Cuci Terakhir (°C)
                            </span>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-slate-600">
                                Before: <strong className="text-slate-900">{selectedUnitLastLog.temp_before}°C</strong>
                              </span>
                              <span className="text-slate-400">→</span>
                              <span className="text-emerald-800">
                                After: <strong className="text-emerald-700">{selectedUnitLastLog.temp_after}°C</strong>
                              </span>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                            {Number((selectedUnitLastLog.temp_before - selectedUnitLastLog.temp_after).toFixed(1)) > 0
                              ? `Turun ${Number((selectedUnitLastLog.temp_before - selectedUnitLastLog.temp_after).toFixed(1))}°C`
                              : `${Number((selectedUnitLastLog.temp_before - selectedUnitLastLog.temp_after).toFixed(1))}°C`}
                          </span>
                        </div>

                        {/* Anemometer Terakhir */}
                        <div className="bg-cyan-50/70 p-2.5 rounded-lg border border-cyan-200 flex items-center justify-between gap-2">
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-bold text-cyan-900 flex items-center gap-1">
                              <Wind className="w-3 h-3 text-cyan-600" />
                              Data Anemometer Terakhir (m/s)
                            </span>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-slate-600">
                                Before: <strong className="text-slate-900">{selectedUnitLastLog.anemo_before} m/s</strong>
                              </span>
                              <span className="text-slate-400">→</span>
                              <span className="text-emerald-800">
                                After: <strong className="text-emerald-700">{selectedUnitLastLog.anemo_after} m/s</strong>
                              </span>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                            {Number((selectedUnitLastLog.anemo_after - selectedUnitLastLog.anemo_before).toFixed(2)) > 0
                              ? `+${Number((selectedUnitLastLog.anemo_after - selectedUnitLastLog.anemo_before).toFixed(2))} m/s`
                              : `${Number((selectedUnitLastLog.anemo_after - selectedUnitLastLog.anemo_before).toFixed(2))} m/s`}
                          </span>
                        </div>
                      </div>

                      {/* Baris 3: Catatan Terakhir */}
                      {selectedUnitLastLog.notes && (
                        <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-xs">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                            Catatan Kondisi Terakhir:
                          </span>
                          <p className="text-slate-700 italic leading-relaxed">
                            &ldquo;{selectedUnitLastLog.notes}&rdquo;
                          </p>
                        </div>
                      )}

                      {/* Baris 4: Riwayat Sebelumnya jika sudah dicuci > 1 kali */}
                      {selectedUnitHistoryLogs.length > 1 && (
                        <div className="pt-1 border-t border-emerald-200/70">
                          <button
                            type="button"
                            onClick={() => setShowAllUnitHistory((prev) => !prev)}
                            className="text-[11px] font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 cursor-pointer"
                          >
                            {showAllUnitHistory ? (
                              <>
                                <ChevronUp className="w-3.5 h-3.5" />
                                <span>Sembunyikan riwayat cuci sebelumnya</span>
                              </>
                            ) : (
                              <>
                                <ChevronDown className="w-3.5 h-3.5" />
                                <span>
                                  Lihat {selectedUnitHistoryLogs.length - 1} riwayat cuci terdahulu lainnya pada unit ini
                                </span>
                              </>
                            )}
                          </button>

                          {showAllUnitHistory && (
                            <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto pr-1">
                              {selectedUnitHistoryLogs.slice(1).map((hLog, idx) => (
                                <div
                                  key={hLog.log_id || idx}
                                  className="bg-white/90 px-2.5 py-2 rounded-lg border border-slate-200 text-[11px] flex flex-col sm:flex-row sm:items-center justify-between gap-1.5"
                                >
                                  <div>
                                    <span className="font-bold text-slate-800">
                                      {formatDateTimeFull(hLog.recorded_at)}
                                    </span>
                                    <span className="text-slate-400 mx-1.5">•</span>
                                    <span className="font-semibold text-blue-700">
                                      Oleh: {hLog.user_name}
                                    </span>
                                    {hLog.notes && (
                                      <p className="text-[10px] text-slate-500 italic mt-0.5">
                                        &ldquo;{hLog.notes}&rdquo;
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0 text-[10px] font-semibold">
                                    <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                                      Suhu: {hLog.temp_before}°C → {hLog.temp_after}°C
                                    </span>
                                    <span className="px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-800 border border-cyan-200">
                                      Anemo: {hLog.anemo_before} → {hLog.anemo_after} m/s
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50 px-3.5 py-2.5 rounded-xl border border-slate-200 flex items-center gap-2 text-xs text-slate-600">
                    <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>
                      Unit <strong>{selectedUnit.name}</strong> belum memiliki riwayat pencatatan cuci sebelumnya (Pencatatan Perdana).
                    </span>
                  </div>
                )}
              </div>
            ) : (
              /* Quick Search Bar & Live Results */
              <div className="space-y-2.5">
                {/* Search Bar Input */}
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                    <input
                      type="text"
                      autoFocus={isChangingUnit || !selectedUnitId}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Ketik nomor kamar saja (contoh: 502, 301, 06) atau nama area..."
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

                  {/* Smart Clickable Suggestions ("Persamaan Kamar / Unit untuk diklik") */}
                  {searchQuery.trim() && smartSuggestions.length > 0 && (
                    <div className="bg-blue-50/90 border border-blue-200 rounded-xl p-2 space-y-1.5">
                      <span className="text-[10px] font-bold text-blue-900 block">
                        Persamaan Kamar / Unit (Klik langsung untuk memilih):
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {smartSuggestions.map(({ unit: u, score }) => {
                          const uFloor = resolveFloorFromUnit(u);
                          const isPrimary = score >= 900;
                          const uSched = scheduleStatusMap.get(u.id);
                          const uLastLog = uSched?.last_log;
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
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 border cursor-pointer shadow-2xs ${
                                isPrimary
                                  ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
                                  : "bg-white text-slate-800 border-blue-200 hover:border-blue-500 hover:text-blue-700"
                              }`}
                            >
                              <span>{u.name}</span>
                              <span
                                className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                                  isPrimary ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {uFloor}
                              </span>
                              {uLastLog && (
                                <span
                                  className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                                    isPrimary
                                      ? "bg-emerald-400/30 text-emerald-100"
                                      : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  }`}
                                >
                                  Cuci: {formatDateFull(uLastLog.recorded_at)}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
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

                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 p-1">
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
                        const uSchedule = scheduleStatusMap.get(u.id);
                        const uLastLog = uSchedule?.last_log;
                        const uLogsCount = unitHistoryLogsMap.get(u.id)?.length || 0;
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
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-slate-900 truncate">
                                  {u.name}
                                </span>
                                {u.code && (
                                  <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-1 py-0.2 rounded">
                                    {u.code}
                                  </span>
                                )}
                                {uLastLog && (
                                  <span
                                    className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold border ${
                                      uSchedule?.status === "overdue"
                                        ? "bg-red-50 text-red-700 border-red-200"
                                        : uSchedule?.status === "approaching"
                                        ? "bg-amber-50 text-amber-800 border-amber-200"
                                        : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    }`}
                                  >
                                    <CheckCircle2 className="w-2.5 h-2.5" />
                                    <span>Sudah Pernah Cuci ({uLogsCount}x)</span>
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 flex-wrap">
                                <span className="font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded">
                                  {floorName}
                                </span>
                                <span>•</span>
                                <span className="truncate">{u.category}</span>
                              </div>
                              {uLastLog && (
                                <div className="bg-slate-50 border border-slate-200/80 rounded-md px-2 py-1 text-[10px] text-slate-600 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                  <span>
                                    Terakhir Cuci:{" "}
                                    <strong className="text-slate-800">
                                      {formatDateFull(uLastLog.recorded_at)}
                                    </strong>
                                  </span>
                                  <span>•</span>
                                  <span>
                                    Teknisi: <strong className="text-slate-800">{uLastLog.user_name}</strong>
                                  </span>
                                  <span>•</span>
                                  <span className="text-amber-800 font-semibold">
                                    Suhu: {uLastLog.temp_before}°C → {uLastLog.temp_after}°C
                                  </span>
                                  <span>•</span>
                                  <span className="text-cyan-800 font-semibold">
                                    Anemo: {uLastLog.anemo_before} → {uLastLog.anemo_after} m/s
                                  </span>
                                </div>
                              )}
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Thermometer className="w-4 h-4 text-amber-500" />
                2. Parameter Pengukuran (Before vs After)
              </h3>
              {selectedUnitLastLog && (
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  Referensi Cuci Terakhir ({formatDateFull(selectedUnitLastLog.recorded_at)}) Tersedia
                </span>
              )}
            </div>

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

                {selectedUnitLastLog && (
                  <div className="px-2.5 py-1.5 bg-white/90 border border-amber-200/90 rounded-lg text-[10px] text-amber-900 flex items-center justify-between">
                    <span className="font-semibold text-slate-500">Data Cuci Terakhir:</span>
                    <span className="font-bold">
                      Before {selectedUnitLastLog.temp_before}°C → After {selectedUnitLastLog.temp_after}°C
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-amber-800 mb-0.5">
                      Suhu BEFORE (°C) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={tempBefore}
                      onChange={(e) => setTempBefore(e.target.value)}
                      placeholder="Wajib isi..."
                      required
                      className="w-full text-xs font-bold px-2.5 py-2 bg-white border border-amber-300 rounded-lg placeholder:font-normal placeholder:text-slate-400 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-amber-800 mb-0.5">
                      Suhu AFTER (°C) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={tempAfter}
                      onChange={(e) => setTempAfter(e.target.value)}
                      placeholder="Wajib isi..."
                      required
                      className="w-full text-xs font-bold px-2.5 py-2 bg-white border border-amber-300 rounded-lg placeholder:font-normal placeholder:text-slate-400 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
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

                {selectedUnitLastLog && (
                  <div className="px-2.5 py-1.5 bg-white/90 border border-cyan-200/90 rounded-lg text-[10px] text-cyan-900 flex items-center justify-between">
                    <span className="font-semibold text-slate-500">Data Cuci Terakhir:</span>
                    <span className="font-bold">
                      Before {selectedUnitLastLog.anemo_before} m/s → After {selectedUnitLastLog.anemo_after} m/s
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-cyan-800 mb-0.5">
                      Anemo BEFORE (m/s) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={anemoBefore}
                      onChange={(e) => setAnemoBefore(e.target.value)}
                      placeholder="Wajib isi..."
                      required
                      className="w-full text-xs font-bold px-2.5 py-2 bg-white border border-cyan-300 rounded-lg placeholder:font-normal placeholder:text-slate-400 focus:ring-2 focus:ring-cyan-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-cyan-800 mb-0.5">
                      Anemo AFTER (m/s) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={anemoAfter}
                      onChange={(e) => setAnemoAfter(e.target.value)}
                      placeholder="Wajib isi..."
                      required
                      className="w-full text-xs font-bold px-2.5 py-2 bg-white border border-cyan-300 rounded-lg placeholder:font-normal placeholder:text-slate-400 focus:ring-2 focus:ring-cyan-500 focus:outline-hidden"
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
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-200">
            {!isCanSubmit ? (
              <p className="text-[11px] font-semibold text-amber-700 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>
                  {!selectedUnit
                    ? "Pilih kamar/unit AC dan isi seluruh angka Before & After untuk menyimpan."
                    : "Isi lengkap ke-4 angka Suhu & Anemo (Before & After) terlebih dahulu."}
                </span>
              </p>
            ) : (
              <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Seluruh data pengukuran lengkap & siap disimpan.</span>
              </span>
            )}
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={!isCanSubmit || submitting || loadingUnits}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 flex items-center gap-2 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                {submitting ? "Menyimpan Data..." : "Simpan Perawatan AC"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
