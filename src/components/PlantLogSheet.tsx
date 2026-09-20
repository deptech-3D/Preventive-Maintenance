import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  PlantLog,
  User,
  AppSettings,
} from "../types";
import { useAuth } from "../auth";
import {
  fetchPlantLogs,
  savePlantLog,
  updatePlantLog,
  deletePlantLog,
  evaluatePlantLogAlarm,
  exportPlantLogsToExcel,
  fetchAppSettings,
  determineShift,
} from "../supabaseService";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  ChevronRight,
  ClipboardList,
  Clock,
  Download,
  Filter,
  Flame,
  Gauge,
  Droplets,
  Layers,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  Upload,
  X,
  Zap,
  Eye,
  Camera,
  Pencil,
  FileSpreadsheet,
  AlertCircle,
  HelpCircle,
  Sun,
  Sunset,
  Moon,
} from "lucide-react";

interface PlantLogSheetProps {
  currentUser?: User | null;
  settings?: AppSettings | null;
  onNotification?: (msg: string, type: "success" | "error" | "info" | "warning") => void;
}

export const PlantLogSheet: React.FC<PlantLogSheetProps> = ({
  currentUser,
  settings,
  onNotification,
}) => {
  const { user: authUser } = useAuth();
  const activeUser = currentUser || authUser;
  const [internalSettings, setInternalSettings] = useState<AppSettings | null>(settings || null);
  const activeSettings = settings || internalSettings;

  // Form State
  const initialFormState: Partial<PlantLog> = {
    shift: "pagi",
    // LVMDP
    lvmdp_volt_rs: undefined,
    lvmdp_volt_st: undefined,
    lvmdp_volt_tr: undefined,
    lvmdp_volt_rn: undefined,
    lvmdp_volt_sn: undefined,
    lvmdp_volt_tn: undefined,
    lvmdp_ampere_total: undefined,
    lvmdp_frekuensi: undefined,
    lvmdp_cos_phi: undefined,
    lvmdp_step_aktif: "",
    lvmdp_suhu_kapasitor: "",
    trafo_level_oli: undefined,
    trafo_rembesan_oli: undefined,
    lvmdp_suhu_ruang: undefined,
    lvmdp_ac_status: undefined,
    lvmdp_kondisi_suara_bau: undefined,
    lvmdp_kebersihan_penerangan: undefined,
    lvmdp_pintu_tertutup: undefined,

    // Genset 1
    g1_solar_harian: undefined,
    g1_solar_bulanan: undefined,
    g1_meter_solar: undefined,
    g1_air_radiator: undefined,
    g1_oli_mesin: undefined,
    g1_volt_aki: undefined,
    g1_air_aki: undefined,
    g1_tgl_ganti_aki: "",
    g1_selector_switch: undefined,
    g1_running_hours: undefined,
    g1_kwh_total: undefined,
    g1_emergency_stop: undefined,
    g1_kebersihan_ventilasi: undefined,

    // Genset 2
    g2_solar_harian: undefined,
    g2_solar_bulanan: undefined,
    g2_meter_solar: undefined,
    g2_air_radiator: undefined,
    g2_oli_mesin: undefined,
    g2_volt_aki: undefined,
    g2_air_aki: undefined,
    g2_tgl_ganti_aki: "",
    g2_selector_switch: undefined,
    g2_running_hours: undefined,
    g2_kwh_total: undefined,
    g2_emergency_stop: undefined,
    g2_kebersihan_ventilasi: undefined,

    // Pompa Air Bersih
    level_rwt: undefined,
    level_cwt: undefined,
    level_gwt1: undefined,
    level_gwt2: undefined,
    transfer_selector: undefined,
    transfer_trip_status: undefined,
    transfer_pompa1: undefined,
    transfer_pompa2: undefined,
    pompa_mekanikal_status: undefined,

    // Pompa Hydrant
    hydrant_header_pressure: undefined,
    jockey_selector: undefined,
    jockey_auto_test: undefined,
    electric_selector: undefined,
    electric_power_indicator: undefined,
    diesel_selector: undefined,
    diesel_solar_level: undefined,
    hydrant_volt_aki: undefined,
    hydrant_air_aki: undefined,
    hydrant_tgl_ganti_aki: "",
    hydrant_key_switch: undefined,
    hydrant_main_valve: undefined,
    ruang_pompa_lantai: undefined,

    notes: "",
    photo_temuan_url: undefined,
  };

  const [formData, setFormData] = useState<Partial<PlantLog>>(initialFormState);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);

  const getDetectedShift = (cfg?: AppSettings | null): "pagi" | "sore" | "malam" => {
    const s = cfg || activeSettings;
    return determineShift(
      new Date(),
      s?.shift_pagi_start || "08:00",
      s?.shift_sore_start || "16:00",
      s?.shift_malam_start || "00:00"
    );
  };

  useEffect(() => {
    if (!settings) {
      fetchAppSettings()
        .then((s) => {
          setInternalSettings(s);
          setFormData((prev) => ({
            ...prev,
            shift: determineShift(
              new Date(),
              s?.shift_pagi_start || "08:00",
              s?.shift_sore_start || "16:00",
              s?.shift_malam_start || "00:00"
            ),
          }));
        })
        .catch(() => {});
    } else {
      setFormData((prev) => ({
        ...prev,
        shift: determineShift(
          new Date(),
          settings?.shift_pagi_start || "08:00",
          settings?.shift_sore_start || "16:00",
          settings?.shift_malam_start || "00:00"
        ),
      }));
    }
  }, [settings]);

  const [logs, setLogs] = useState<PlantLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<PlantLog | null>(null);

  // Filters
  const [filterShift, setFilterShift] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "alarm" | "normal">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Active form section
  const [activeTab, setActiveTab] = useState<"lvmdp" | "genset" | "pompa" | "temuan">("lvmdp");
  const [activeGenset, setActiveGenset] = useState<"g1" | "g2">("g1");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchPlantLogs({ limit: 200 });
      setLogs(data);
    } catch (err: any) {
      if (onNotification) onNotification("Gagal memuat log sheet: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  }, [onNotification]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Compute live alarm preview while user is typing in form
  const liveAlarmCheck = useMemo(() => {
    return evaluatePlantLogAlarm(formData, activeSettings || undefined);
  }, [formData, activeSettings]);

  const openModalForRoom = (room: "lvmdp" | "genset" | "pompa") => {
    setEditingLogId(null);
    const autoShift = getDetectedShift(activeSettings);
    setFormData({
      ...initialFormState,
      shift: autoShift,
    });
    setActiveTab(room);
    setIsModalOpen(true);
  };

  const handleEditLog = (log: PlantLog) => {
    setEditingLogId(log.log_id);
    setFormData({ ...log });
    setPhotoPreview(log.photo_temuan_url || null);
    setIsModalOpen(true);
  };

  const handleInputChange = (field: keyof PlantLog, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      if (onNotification) onNotification("Ukuran file maksimal 8MB", "warning");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setPhotoPreview(result);
      setFormData((prev) => ({ ...prev, photo_temuan_url: result }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingLogId) {
        const updated = await updatePlantLog(editingLogId, {
          ...formData,
          user_id: activeUser?.user_id || formData.user_id,
          user_name: activeUser?.name || formData.user_name,
          property_name: activeSettings?.property_name || formData.property_name,
        });
        setLogs((prev) => prev.map((l) => (l.log_id === editingLogId ? updated : l)));
        setIsModalOpen(false);
        setEditingLogId(null);
        setFormData({
          ...initialFormState,
          shift: getDetectedShift(activeSettings),
        });
        setPhotoPreview(null);
        if (onNotification) {
          onNotification("Log Sheet Ruang Mesin berhasil diperbarui!", "success");
        }
      } else {
        const saved = await savePlantLog({
          ...formData,
          user_id: activeUser?.user_id,
          user_name: activeUser?.name,
          property_name: activeSettings?.property_name,
        });
        setLogs((prev) => [saved, ...prev]);
        setIsModalOpen(false);
        setFormData({
          ...initialFormState,
          shift: getDetectedShift(activeSettings),
        });
        setPhotoPreview(null);
        if (onNotification) {
          if (saved.has_alarm) {
            onNotification(
              "Log Sheet berhasil disimpan dengan PERINGATAN ANOMALI!",
              "warning"
            );
          } else {
            onNotification("Log Sheet Ruang Mesin berhasil disimpan!", "success");
          }
        }
      }
    } catch (err: any) {
      if (onNotification) onNotification("Gagal menyimpan: " + err.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (log_id: string) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus catatan log sheet ini?")) {
      return;
    }
    try {
      await deletePlantLog(log_id);
      setLogs((prev) => prev.filter((l) => l.log_id !== log_id));
      if (selectedLog?.log_id === log_id) setSelectedLog(null);
      if (onNotification) onNotification("Log sheet berhasil dihapus", "success");
    } catch (err: any) {
      if (onNotification) onNotification("Gagal menghapus log: " + err.message, "error");
    }
  };

  // Filtered list
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (filterShift !== "all" && log.shift !== filterShift) return false;
      if (filterStatus === "alarm" && !log.has_alarm) return false;
      if (filterStatus === "normal" && log.has_alarm) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesUser = log.user_name?.toLowerCase().includes(q);
        const matchesNotes = log.notes?.toLowerCase().includes(q);
        const matchesAlarm = log.alarm_reasons?.some((r) => r.toLowerCase().includes(q));
        if (!matchesUser && !matchesNotes && !matchesAlarm) return false;
      }
      return true;
    });
  }, [logs, filterShift, filterStatus, searchQuery]);

  // Overall Quick Stats
  const stats = useMemo(() => {
    const total = logs.length;
    const alarmCount = logs.filter((l) => l.has_alarm).length;
    const latest = logs[0] || null;
    return { total, alarmCount, latest };
  }, [logs]);

  return (
    <div className="space-y-6" id="plant-log-sheet-container">
      {/* Header Bar with Action Controls */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 flex items-center justify-center font-bold">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                Pilih Ruangan Mesin
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Catat - Pilih ruangan mesin yang akan dicatat
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => exportPlantLogsToExcel(filteredLogs, activeSettings?.property_name || "Midtown Hotel Samarinda")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-lg hover:bg-emerald-100 transition-colors"
              title="Download Data Log Sheet ke format Microsoft Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              Export Excel
            </button>

            <button
              onClick={() => {
                const origin = typeof window !== "undefined" ? window.location.origin : "";
                const formula = `=IMPORTDATA("${origin}/api/export/plant-logs/csv")`;
                navigator.clipboard.writeText(formula);
                if (onNotification) {
                  onNotification("Formula Live Google Sheets Ruang Mesin berhasil disalin! Tempel di sel A1 spreadsheet.", "success");
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 transition-colors"
              title="Salin Formula Live Google Sheets Ruang Mesin (=IMPORTDATA)"
            >
              <FileSpreadsheet className="w-4 h-4 text-blue-600" />
              Live Sheets
            </button>

            <a
              href="/api/plant-logs/export/csv"
              download="LogSheet_Ruang_Mesin.csv"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
              title="Download CSV Ruang Mesin"
            >
              <Download className="w-4 h-4" />
              CSV
            </a>

            <button
              onClick={loadData}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 transition-colors"
              title="Perbarui Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* List Kartu Pilihan Masing-Masing Ruangan (Persis format Pilih Meter) */}
      <div className="space-y-2.5">
        {/* 1. LVMDP */}
        <button
          id="room-card-lvmdp"
          onClick={() => openModalForRoom("lvmdp")}
          className="w-full flex items-center gap-4 p-4 bg-white dark:bg-slate-900 hover:bg-blue-50/50 dark:hover:bg-blue-950/40 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-600 transition shadow-sm text-left group"
        >
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 flex items-center justify-center border border-blue-200 dark:border-blue-800 group-hover:bg-blue-600 group-hover:text-white transition shadow-xs">
            <Zap className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                LVMDP
              </h3>
              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300 text-[10px] font-bold rounded-full">
                Panel Utama & Trafo
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Pemeriksaan: <span className="font-semibold text-slate-700 dark:text-slate-300">Voltase, Ampere, Cos Phi</span> • Cap Bank, Level Oli Trafo, Suhu Ruangan
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition" />
        </button>

        {/* 2. Ruang Genset */}
        <button
          id="room-card-genset"
          onClick={() => openModalForRoom("genset")}
          className="w-full flex items-center gap-4 p-4 bg-white dark:bg-slate-900 hover:bg-amber-50/50 dark:hover:bg-amber-950/40 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-amber-400 dark:hover:border-amber-600 transition shadow-sm text-left group"
        >
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 flex items-center justify-center border border-amber-200 dark:border-amber-800 group-hover:bg-amber-600 group-hover:text-white transition shadow-xs">
            <Gauge className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                Ruang Genset
              </h3>
              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 text-[10px] font-bold rounded-full">
                Genset 1 & 2
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Pemeriksaan: <span className="font-semibold text-slate-700 dark:text-slate-300">Solar (Tangki Harian & Bulanan)</span> • Level Oli, Air Radiator, Tegangan Aki Charger, Jam Jalan
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-amber-600 group-hover:translate-x-1 transition" />
        </button>

        {/* 3. Ruang Pompa */}
        <button
          id="room-card-pompa"
          onClick={() => openModalForRoom("pompa")}
          className="w-full flex items-center gap-4 p-4 bg-white dark:bg-slate-900 hover:bg-teal-50/50 dark:hover:bg-teal-950/40 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-teal-400 dark:hover:border-teal-600 transition shadow-sm text-left group"
        >
          <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 flex items-center justify-center border border-teal-200 dark:border-teal-800 group-hover:bg-teal-600 group-hover:text-white transition shadow-xs">
            <Droplets className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                Ruang Pompa
              </h3>
              <span className="px-2 py-0.5 bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-300 text-[10px] font-bold rounded-full">
                CWT & Hydrant
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Pemeriksaan: <span className="font-semibold text-slate-700 dark:text-slate-300">Level CWT / RWT</span> • Pompa Transfer, Tekanan Main Header Hydrant
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-teal-600 group-hover:translate-x-1 transition" />
        </button>
      </div>

      {/* Quick Overview Badges */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3 shadow-sm">
        {/* Status Highlights Grid (Compact) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Total Log Sheet</span>
              <Activity className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 mt-0.5">
              {stats.total} Catatan
            </div>
          </div>

          <div className="px-2.5 py-1.5 bg-amber-50/70 dark:bg-amber-950/20 rounded-lg border border-amber-200/50 dark:border-amber-900/40">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">
                Peringatan / Alarm
              </span>
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="text-xs sm:text-sm font-bold text-amber-900 dark:text-amber-300 mt-0.5">
              {stats.alarmCount} Kejadian
            </div>
          </div>

          <div className="px-2.5 py-1.5 bg-blue-50/70 dark:bg-blue-950/20 rounded-lg border border-blue-200/50 dark:border-blue-900/40">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-blue-700 dark:text-blue-400 font-medium">
                Hydrant Header
              </span>
              <Flame className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-xs sm:text-sm font-bold text-blue-900 dark:text-blue-300 mt-0.5">
              {stats.latest?.hydrant_header_pressure != null
                ? `${stats.latest.hydrant_header_pressure} Bar`
                : "Standby"}
            </div>
          </div>

          <div className="px-2.5 py-1.5 bg-emerald-50/70 dark:bg-emerald-950/20 rounded-lg border border-emerald-200/50 dark:border-emerald-900/40">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">
                Kondisi Terakhir
              </span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-[11px] sm:text-xs font-semibold text-emerald-900 dark:text-emerald-300 mt-0.5 truncate">
              {stats.latest
                ? `${stats.latest.shift.toUpperCase()} - ${new Date(
                    stats.latest.recorded_at
                  ).toLocaleDateString("id-ID")}`
                : "Belum Ada"}
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari petugas, temuan, atau anomali..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <Filter className="w-3.5 h-3.5" />
            <span>Shift:</span>
          </div>
          <select
            value={filterShift}
            onChange={(e) => setFilterShift(e.target.value)}
            className="text-xs py-1.5 px-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
          >
            <option value="all">Semua Shift</option>
            <option value="pagi">Pagi</option>
            <option value="sore">Sore</option>
            <option value="malam">Malam</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="text-xs py-1.5 px-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
          >
            <option value="all">Semua Status</option>
            <option value="alarm">Hanya Ada Peringatan</option>
            <option value="normal">Normal Saja</option>
          </select>
        </div>
      </div>

      {/* Logs Table / Cards */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                <th className="py-3 px-4">Waktu & Shift</th>
                <th className="py-3 px-4">Petugas</th>
                <th className="py-3 px-4">LVMDP (Tegangan / Ampere / Suhu)</th>
                <th className="py-3 px-4">Genset 1 & 2</th>
                <th className="py-3 px-4">Pompa & Hydrant</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Tidak ada catatan log sheet yang sesuai filter.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const dateFormatted = new Date(log.recorded_at).toLocaleDateString("id-ID", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  });
                  const timeFormatted = new Date(log.recorded_at).toLocaleTimeString("id-ID", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <tr
                      key={log.log_id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                      onClick={() => setSelectedLog(log)}
                    >
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-800 dark:text-slate-100">
                          {dateFormatted}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          {timeFormatted} •{" "}
                          <span className="capitalize font-medium text-indigo-600 dark:text-indigo-400">
                            {log.shift}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
                        {log.user_name}
                      </td>

                      <td className="py-3 px-4">
                        <div className="text-slate-700 dark:text-slate-300">
                          {log.lvmdp_volt_rs || "-"} V / {log.lvmdp_ampere_total || "-"} A
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Suhu: {log.lvmdp_suhu_ruang ?? "-"}°C • PF: {log.lvmdp_cos_phi ?? "-"}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="text-slate-700 dark:text-slate-300">
                          G1: {log.g1_selector_switch} ({log.g1_volt_aki ?? "-"}V)
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          G2: {log.g2_selector_switch} ({log.g2_volt_aki ?? "-"}V)
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          Hydrant: {log.hydrant_header_pressure ?? "-"} Bar
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          CWT: {log.level_cwt ?? "-"}% • RWT: {log.level_rwt ?? "-"}%
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        {log.has_alarm ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                            <AlertTriangle className="w-3 h-3" />
                            Alarm / Temuan
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                            <CheckCircle2 className="w-3 h-3" />
                            Normal
                          </span>
                        )}
                      </td>

                      <td
                        className="py-3 px-4 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                            title="Lihat Detail"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {activeUser?.role === "admin" && (
                            <>
                              <button
                                onClick={() => handleEditLog(log)}
                                className="p-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded"
                                title="Koreksi / Edit Catatan (Admin)"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(log.log_id)}
                                className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded"
                                title="Hapus Catatan"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-3xl w-full border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden my-8">
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Detail Log Sheet Ruang Mesin
                </h3>
                <p className="text-xs text-slate-500">
                  ID: {selectedLog.log_id} • Shift: {selectedLog.shift.toUpperCase()} • Petugas:{" "}
                  {selectedLog.user_name}
                </p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* Alarm Banner if any */}
              {selectedLog.has_alarm && (
                <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-semibold text-xs mb-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    Peringatan Anomali & Temuan Tercatat:
                  </div>
                  <ul className="list-disc list-inside text-xs text-amber-900 dark:text-amber-200 space-y-1">
                    {selectedLog.alarm_reasons?.map((reason, idx) => (
                      <li key={idx}>{reason}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 1. LVMDP */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-800/30">
                <h4 className="font-semibold text-xs text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Zap className="w-4 h-4" />
                  1. Ruang LVMDP & Trafo
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Tegangan 3-Phase</span>
                    <span className="font-semibold">
                      R-S: {selectedLog.lvmdp_volt_rs}V | S-T: {selectedLog.lvmdp_volt_st}V | T-R:{" "}
                      {selectedLog.lvmdp_volt_tr}V
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Tegangan 1-Phase</span>
                    <span className="font-semibold">
                      R-N: {selectedLog.lvmdp_volt_rn}V | S-N: {selectedLog.lvmdp_volt_sn}V | T-N:{" "}
                      {selectedLog.lvmdp_volt_tn}V
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Ampere & Frekuensi</span>
                    <span className="font-semibold">
                      {selectedLog.lvmdp_ampere_total} A • {selectedLog.lvmdp_frekuensi} Hz
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Kapasitor Bank</span>
                    <span className="font-semibold">
                      Cos Phi: {selectedLog.lvmdp_cos_phi} • Step: {selectedLog.lvmdp_step_aktif} • Suhu:{" "}
                      {selectedLog.lvmdp_suhu_kapasitor}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Trafo</span>
                    <span className="font-semibold">
                      Oli: {selectedLog.trafo_level_oli} • Rembesan: {selectedLog.trafo_rembesan_oli}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Suhu & Kondisi Ruangan</span>
                    <span className="font-semibold">
                      {selectedLog.lvmdp_suhu_ruang}°C • AC: {selectedLog.lvmdp_ac_status} • Suara:{" "}
                      {selectedLog.lvmdp_kondisi_suara_bau}
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. Genset 1 & 2 */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-800/30">
                <h4 className="font-semibold text-xs text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Gauge className="w-4 h-4" />
                  2. Ruang Genset
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="font-bold text-slate-800 dark:text-slate-100 mb-2">
                      Genset 1
                    </div>
                    <div className="space-y-1 text-[11px]">
                      <div>
                        Solar Harian/Bulanan:{" "}
                        <strong>
                          {selectedLog.g1_solar_harian} L / {selectedLog.g1_solar_bulanan} L
                        </strong>
                      </div>
                      <div>
                        Meter Solar: <strong>{selectedLog.g1_meter_solar}</strong>
                      </div>
                      <div>
                        Air Radiator & Oli:{" "}
                        <strong>
                          {selectedLog.g1_air_radiator} • Oli {selectedLog.g1_oli_mesin}
                        </strong>
                      </div>
                      <div>
                        Aki Starter:{" "}
                        <strong
                          className={
                            (selectedLog.g1_volt_aki ?? 26) < 24 ? "text-rose-600" : "text-slate-900 dark:text-white"
                          }
                        >
                          {selectedLog.g1_volt_aki} V DC
                        </strong>{" "}
                        ({selectedLog.g1_air_aki})
                      </div>
                      <div>
                        Selector & Emergency:{" "}
                        <strong
                          className={
                            selectedLog.g1_selector_switch !== "AUTO"
                              ? "text-rose-600"
                              : "text-emerald-600"
                          }
                        >
                          {selectedLog.g1_selector_switch}
                        </strong>{" "}
                        • Stop: {selectedLog.g1_emergency_stop}
                      </div>
                      <div>
                        Running Hours: <strong>{selectedLog.g1_running_hours} Jam</strong> • kWh:{" "}
                        <strong>{selectedLog.g1_kwh_total}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="font-bold text-slate-800 dark:text-slate-100 mb-2">
                      Genset 2
                    </div>
                    <div className="space-y-1 text-[11px]">
                      <div>
                        Solar Harian/Bulanan:{" "}
                        <strong>
                          {selectedLog.g2_solar_harian} L / {selectedLog.g2_solar_bulanan} L
                        </strong>
                      </div>
                      <div>
                        Meter Solar: <strong>{selectedLog.g2_meter_solar}</strong>
                      </div>
                      <div>
                        Air Radiator & Oli:{" "}
                        <strong>
                          {selectedLog.g2_air_radiator} • Oli {selectedLog.g2_oli_mesin}
                        </strong>
                      </div>
                      <div>
                        Aki Starter:{" "}
                        <strong
                          className={
                            (selectedLog.g2_volt_aki ?? 26) < 24 ? "text-rose-600" : "text-slate-900 dark:text-white"
                          }
                        >
                          {selectedLog.g2_volt_aki} V DC
                        </strong>{" "}
                        ({selectedLog.g2_air_aki})
                      </div>
                      <div>
                        Selector & Emergency:{" "}
                        <strong
                          className={
                            selectedLog.g2_selector_switch !== "AUTO"
                              ? "text-rose-600"
                              : "text-emerald-600"
                          }
                        >
                          {selectedLog.g2_selector_switch}
                        </strong>{" "}
                        • Stop: {selectedLog.g2_emergency_stop}
                      </div>
                      <div>
                        Running Hours: <strong>{selectedLog.g2_running_hours} Jam</strong> • kWh:{" "}
                        <strong>{selectedLog.g2_kwh_total}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Pompa Air Bersih & Hydrant */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-800/30">
                <h4 className="font-semibold text-xs text-rose-600 dark:text-rose-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Flame className="w-4 h-4" />
                  3. Ruang Pompa Air Bersih & Pompa Hydrant
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Level Tangki Air</span>
                    <span className="font-semibold">
                      RWT: {selectedLog.level_rwt}% | CWT: {selectedLog.level_cwt}% | GWT1:{" "}
                      {selectedLog.level_gwt1}% | GWT2: {selectedLog.level_gwt2}%
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Pompa Transfer CWT</span>
                    <span className="font-semibold">
                      Selector: {selectedLog.transfer_selector} • Trip: {selectedLog.transfer_trip_status} • P1:{" "}
                      {selectedLog.transfer_pompa1} • P2: {selectedLog.transfer_pompa2}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Tekanan Header Hydrant</span>
                    <span
                      className={`font-bold text-sm ${
                        (selectedLog.hydrant_header_pressure ?? 8) < (activeSettings?.hydrant_min_pressure ?? 7)
                          ? "text-rose-600"
                          : "text-emerald-600"
                      }`}
                    >
                      {selectedLog.hydrant_header_pressure} Bar
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Jockey & Electric Pump</span>
                    <span className="font-semibold">
                      Jockey: {selectedLog.jockey_selector} • Electric: {selectedLog.electric_selector}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Diesel Fire Pump</span>
                    <span className="font-semibold">
                      Selector: {selectedLog.diesel_selector} • Solar: {selectedLog.diesel_solar_level} L • Aki:{" "}
                      {selectedLog.hydrant_volt_aki}V
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Main Valve & Lantai</span>
                    <span className="font-semibold">
                      Valve: {selectedLog.hydrant_main_valve} • Lantai: {selectedLog.ruang_pompa_lantai}
                    </span>
                  </div>
                </div>
              </div>

              {/* Photo & Notes */}
              {(selectedLog.photo_temuan_url || selectedLog.notes) && (
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-800/30">
                  <h4 className="font-semibold text-xs text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                    Foto Temuan & Catatan Khusus
                  </h4>
                  {selectedLog.notes && (
                    <p className="text-xs text-slate-700 dark:text-slate-300 mb-3 bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                      {selectedLog.notes}
                    </p>
                  )}
                  {selectedLog.photo_temuan_url && (
                    <div>
                      <span className="text-[11px] text-slate-400 block mb-1">Foto Temuan Anomali:</span>
                      <img
                        src={selectedLog.photo_temuan_url}
                        alt="Temuan"
                        className="max-h-64 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              {activeUser?.role === "admin" ? (
                <button
                  type="button"
                  onClick={() => {
                    const target = selectedLog;
                    setSelectedLog(null);
                    handleEditLog(target);
                  }}
                  className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm transition"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Koreksi / Edit Log Ini (Admin)</span>
                </button>
              ) : (
                <div />
              )}
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-600"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Input Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-4xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-6">
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className={`p-2 text-white rounded-lg transition-colors ${
                    activeTab === "lvmdp"
                      ? "bg-blue-600"
                      : activeTab === "genset"
                      ? "bg-amber-600"
                      : activeTab === "pompa"
                      ? "bg-teal-600"
                      : "bg-indigo-600"
                  }`}
                >
                  {activeTab === "lvmdp" && <Zap className="w-5 h-5" />}
                  {activeTab === "genset" && <Gauge className="w-5 h-5" />}
                  {activeTab === "pompa" && <Droplets className="w-5 h-5" />}
                  {activeTab === "temuan" && <Camera className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                    <span>
                      {editingLogId
                        ? `Koreksi Log Sheet Ruang Mesin — ${
                            activeTab === "lvmdp"
                              ? "LVMDP & Trafo"
                              : activeTab === "genset"
                              ? "Genset 1 & 2"
                              : activeTab === "pompa"
                              ? "Ruang Pompa"
                              : "Temuan & Foto"
                          }`
                        : activeTab === "lvmdp"
                        ? "Catat Log Sheet — Ruang LVMDP & Trafo"
                        : activeTab === "genset"
                        ? "Catat Log Sheet — Ruang Genset 1 & 2"
                        : activeTab === "pompa"
                        ? "Catat Log Sheet — Ruang Pompa CWT & Hydrant"
                        : "Catat Temuan & Foto Ruang Mesin"}
                    </span>
                    {editingLogId ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                        Mode Koreksi Admin
                      </span>
                    ) : (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          activeTab === "lvmdp"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300"
                            : activeTab === "genset"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300"
                            : activeTab === "pompa"
                            ? "bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300"
                            : "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300"
                        }`}
                      >
                        {activeTab === "lvmdp"
                          ? "Ruang LVMDP"
                          : activeTab === "genset"
                          ? "Ruang Genset"
                          : activeTab === "pompa"
                          ? "Ruang Pompa"
                          : "Foto Temuan"}
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {activeTab === "lvmdp" &&
                      "Pemeriksaan tegangan fasa, beban ampere, kapasitor bank, dan kondisi trafo"}
                    {activeTab === "genset" &&
                      "Pemeriksaan level solar, oli mesin, tegangan aki charger, dan jam jalan genset"}
                    {activeTab === "pompa" &&
                      "Pemeriksaan level CWT/RWT, pompa transfer air bersih, dan tekanan hydrant"}
                    {activeTab === "temuan" &&
                      "Dokumentasi foto temuan anomali dan catatan tindak lanjut"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* Shift & Petugas Header Row */}
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/70 dark:border-slate-700 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <span>Shift Kerja</span>
                        <span className="bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          Otomatis Aktif
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Otomatis dipilih sesuai jam saat ini ({activeSettings?.shift_pagi_start || "08:00"}, {activeSettings?.shift_sore_start || "16:00"}, {activeSettings?.shift_malam_start || "00:00"})
                      </div>
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 self-end sm:self-center">
                    Petugas: <span className="font-bold text-slate-800 dark:text-slate-200">{activeUser?.name || "Petugas"}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleInputChange("shift", "pagi")}
                    className={`py-2.5 px-2 rounded-xl border text-xs font-bold transition flex flex-col sm:flex-row items-center justify-center gap-1.5 ${
                      formData.shift === "pagi"
                        ? "bg-amber-500 text-white border-amber-600 shadow-sm ring-2 ring-amber-200 dark:ring-amber-900"
                        : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Sun className="w-4 h-4" />
                      <span>Pagi</span>
                    </div>
                    <span className={`text-[10px] font-normal ${formData.shift === "pagi" ? "text-amber-100" : "text-slate-400"}`}>
                      ({activeSettings?.shift_pagi_start || "08:00"}-{activeSettings?.shift_sore_start || "16:00"})
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleInputChange("shift", "sore")}
                    className={`py-2.5 px-2 rounded-xl border text-xs font-bold transition flex flex-col sm:flex-row items-center justify-center gap-1.5 ${
                      formData.shift === "sore"
                        ? "bg-orange-500 text-white border-orange-600 shadow-sm ring-2 ring-orange-200 dark:ring-orange-900"
                        : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Sunset className="w-4 h-4" />
                      <span>Sore</span>
                    </div>
                    <span className={`text-[10px] font-normal ${formData.shift === "sore" ? "text-orange-100" : "text-slate-400"}`}>
                      ({activeSettings?.shift_sore_start || "16:00"}-{activeSettings?.shift_malam_start || "00:00"})
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleInputChange("shift", "malam")}
                    className={`py-2.5 px-2 rounded-xl border text-xs font-bold transition flex flex-col sm:flex-row items-center justify-center gap-1.5 ${
                      formData.shift === "malam"
                        ? "bg-indigo-600 text-white border-indigo-700 shadow-sm ring-2 ring-indigo-200 dark:ring-indigo-900"
                        : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Moon className="w-4 h-4" />
                      <span>Malam</span>
                    </div>
                    <span className={`text-[10px] font-normal ${formData.shift === "malam" ? "text-indigo-200" : "text-slate-400"}`}>
                      ({activeSettings?.shift_malam_start || "00:00"}-{activeSettings?.shift_pagi_start || "08:00"})
                    </span>
                  </button>
                </div>
              </div>

              {/* Navigation Tabs for Form Sections */}
              <div className="flex border-b border-slate-200 dark:border-slate-700 overflow-x-auto gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("lvmdp")}
                  className={`pb-2.5 px-3 text-xs font-bold whitespace-nowrap transition-colors border-b-2 flex items-center gap-1.5 ${
                    activeTab === "lvmdp"
                      ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <Zap className="w-4 h-4" />
                  1. Ruang LVMDP & Trafo
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("genset")}
                  className={`pb-2.5 px-3 text-xs font-bold whitespace-nowrap transition-colors border-b-2 flex items-center gap-1.5 ${
                    activeTab === "genset"
                      ? "border-amber-600 text-amber-600 dark:text-amber-400"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <Gauge className="w-4 h-4" />
                  2. Ruang Genset (1 & 2)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("pompa")}
                  className={`pb-2.5 px-3 text-xs font-bold whitespace-nowrap transition-colors border-b-2 flex items-center gap-1.5 ${
                    activeTab === "pompa"
                      ? "border-rose-600 text-rose-600 dark:text-rose-400"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <Flame className="w-4 h-4" />
                  3. Pompa CWT & Hydrant
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("temuan")}
                  className={`pb-2.5 px-3 text-xs font-bold whitespace-nowrap transition-colors border-b-2 flex items-center gap-1.5 ${
                    activeTab === "temuan"
                      ? "border-slate-800 dark:border-slate-200 text-slate-800 dark:text-slate-200"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <Camera className="w-4 h-4" />
                  Foto Temuan & Catatan
                </button>
              </div>

              {/* TAB 1: LVMDP */}
              {activeTab === "lvmdp" && (
                <div className="space-y-4">
                  {/* Tegangan 3 Phase */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-2">
                      Tegangan Listrik 3-Phase (Volt)
                    </h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-[11px] text-slate-500 block mb-1">Volt R-S</label>
                        <input
                          type="number"
                          step="any"
                          value={formData.lvmdp_volt_rs ?? ""}
                          onChange={(e) => handleInputChange("lvmdp_volt_rs", e.target.value)}
                          placeholder="Contoh: 395"
                          className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-500 block mb-1">Volt S-T</label>
                        <input
                          type="number"
                          step="any"
                          value={formData.lvmdp_volt_st ?? ""}
                          onChange={(e) => handleInputChange("lvmdp_volt_st", e.target.value)}
                          placeholder="Contoh: 394"
                          className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-500 block mb-1">Volt T-R</label>
                        <input
                          type="number"
                          step="any"
                          value={formData.lvmdp_volt_tr ?? ""}
                          onChange={(e) => handleInputChange("lvmdp_volt_tr", e.target.value)}
                          placeholder="Contoh: 395"
                          className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Tegangan 1 Phase */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-2">
                      Tegangan Listrik 1-Phase (Volt)
                    </h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-[11px] text-slate-500 block mb-1">Volt R-N</label>
                        <input
                          type="number"
                          step="any"
                          value={formData.lvmdp_volt_rn ?? ""}
                          onChange={(e) => handleInputChange("lvmdp_volt_rn", e.target.value)}
                          placeholder="Contoh: 228"
                          className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-500 block mb-1">Volt S-N</label>
                        <input
                          type="number"
                          step="any"
                          value={formData.lvmdp_volt_sn ?? ""}
                          onChange={(e) => handleInputChange("lvmdp_volt_sn", e.target.value)}
                          placeholder="Contoh: 228"
                          className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-500 block mb-1">Volt T-N</label>
                        <input
                          type="number"
                          step="any"
                          value={formData.lvmdp_volt_tn ?? ""}
                          onChange={(e) => handleInputChange("lvmdp_volt_tn", e.target.value)}
                          placeholder="Contoh: 227"
                          className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Arus & Frekuensi */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                        Ampere Total (A)
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={formData.lvmdp_ampere_total ?? ""}
                        onChange={(e) => handleInputChange("lvmdp_ampere_total", e.target.value)}
                        placeholder="Contoh: 450"
                        className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                        Frekuensi (Hz)
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={formData.lvmdp_frekuensi ?? ""}
                        onChange={(e) => handleInputChange("lvmdp_frekuensi", e.target.value)}
                        placeholder="Contoh: 50.0"
                        className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                        Cos Phi (Power Factor)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.lvmdp_cos_phi ?? ""}
                        onChange={(e) => handleInputChange("lvmdp_cos_phi", e.target.value)}
                        placeholder="Contoh: 0.98"
                        className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                        Jumlah Step Aktif
                      </label>
                      <input
                        type="text"
                        value={formData.lvmdp_step_aktif ?? ""}
                        onChange={(e) => handleInputChange("lvmdp_step_aktif", e.target.value)}
                        placeholder="Contoh: 4 Step"
                        className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                      />
                    </div>
                  </div>

                  {/* Kapasitor & Trafo */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                        Suhu Kapasitor Bank
                      </label>
                      <select
                        value={formData.lvmdp_suhu_kapasitor || ""}
                        onChange={(e) => handleInputChange("lvmdp_suhu_kapasitor", e.target.value)}
                        className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                      >
                        <option value="">-- Pilih Suhu Kapasitor --</option>
                        <option value="Normal">Normal</option>
                        <option value="Hangat / Cukup Panas">Hangat / Cukup Panas</option>
                        <option value="Overheat / Sangat Panas">Overheat / Sangat Panas</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                        Level Oli Trafo
                      </label>
                      <select
                        value={formData.trafo_level_oli || ""}
                        onChange={(e) => handleInputChange("trafo_level_oli", e.target.value)}
                        className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                      >
                        <option value="">-- Pilih Level Oli Trafo --</option>
                        <option value="Normal">Normal</option>
                        <option value="Kurang / Rendah">Kurang / Rendah</option>
                        <option value="Kritis">Kritis</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                        Rembesan Oli Seal Input/Output
                      </label>
                      <select
                        value={formData.trafo_rembesan_oli || ""}
                        onChange={(e) => handleInputChange("trafo_rembesan_oli", e.target.value)}
                        className={`w-full text-xs p-2 bg-slate-50 dark:bg-slate-800 border rounded-lg ${
                          formData.trafo_rembesan_oli === "Ada Rembesan"
                            ? "border-rose-500 bg-rose-50 dark:bg-rose-950/30 text-rose-700"
                            : "border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        <option value="">-- Pilih Status Rembesan --</option>
                        <option value="Aman / Tidak Ada">Aman / Tidak Ada Rembesan</option>
                        <option value="Ada Rembesan">Ada Rembesan Oli (PERINGATAN)</option>
                      </select>
                    </div>
                  </div>

                  {/* Fisik & Lingkungan LVMDP */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                        Suhu Ruang Panel (°C)
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={formData.lvmdp_suhu_ruang ?? ""}
                        onChange={(e) => handleInputChange("lvmdp_suhu_ruang", e.target.value)}
                        placeholder="Contoh: 25"
                        className={`w-full text-xs p-2 bg-slate-50 dark:bg-slate-800 border rounded-lg ${
                          formData.lvmdp_suhu_ruang != null && formData.lvmdp_suhu_ruang !== ("" as any) && Number(formData.lvmdp_suhu_ruang) > (activeSettings?.lvmdp_max_room_temp ?? 32)
                            ? "border-rose-500 bg-rose-50 text-rose-700 font-bold"
                            : "border-slate-200 dark:border-slate-700"
                        }`}
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                        AC Ruang Panel
                      </label>
                      <select
                        value={formData.lvmdp_ac_status || ""}
                        onChange={(e) => handleInputChange("lvmdp_ac_status", e.target.value)}
                        className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                      >
                        <option value="">-- Pilih Status AC --</option>
                        <option value="Normal">Normal Berfungsi Dingin</option>
                        <option value="Mati / Tidak Dingin">Mati / Tidak Dingin</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                        Suara & Bau Anomali
                      </label>
                      <select
                        value={formData.lvmdp_kondisi_suara_bau || ""}
                        onChange={(e) => handleInputChange("lvmdp_kondisi_suara_bau", e.target.value)}
                        className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                      >
                        <option value="">-- Pilih Kondisi Suara & Bau --</option>
                        <option value="Normal">Normal (Tidak ada bau/suara anomali)</option>
                        <option value="Dengung Keras">Suara Dengung Keras</option>
                        <option value="Bau Terbakar / Sangit">Bau Terbakar / Sangit</option>
                        <option value="Alarm Trip Aktif">Indikator Alarm Trip Aktif</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                        Pintu Panel LVMDP
                      </label>
                      <select
                        value={formData.lvmdp_pintu_tertutup || ""}
                        onChange={(e) => handleInputChange("lvmdp_pintu_tertutup", e.target.value)}
                        className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                      >
                        <option value="">-- Pilih Posisi Pintu --</option>
                        <option value="Tertutup Rapat">Tertutup Rapat</option>
                        <option value="Terbuka">Terbuka (Perlu Ditutup)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: GENSET */}
              {activeTab === "genset" && (
                <div className="space-y-4">
                  <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg w-fit">
                    <button
                      type="button"
                      onClick={() => setActiveGenset("g1")}
                      className={`px-4 py-1.5 text-xs font-bold rounded-md transition-colors ${
                        activeGenset === "g1"
                          ? "bg-white dark:bg-slate-700 text-amber-700 dark:text-amber-300 shadow-sm"
                          : "text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      Genset 1
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveGenset("g2")}
                      className={`px-4 py-1.5 text-xs font-bold rounded-md transition-colors ${
                        activeGenset === "g2"
                          ? "bg-white dark:bg-slate-700 text-amber-700 dark:text-amber-300 shadow-sm"
                          : "text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      Genset 2
                    </button>
                  </div>

                  {/* Active Genset Fields */}
                  {activeGenset === "g1" ? (
                    <div className="space-y-4">
                      <div className="p-3 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/40 rounded-xl">
                        <h4 className="text-xs font-bold text-amber-900 dark:text-amber-300 mb-2">
                          Genset 1 - Bahan Bakar & Level Cairan
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="text-[11px] text-slate-500 block mb-1">
                              Solar Harian (Liter)
                            </label>
                            <input
                              type="number"
                              step="any"
                              value={formData.g1_solar_harian ?? ""}
                              onChange={(e) => handleInputChange("g1_solar_harian", e.target.value)}
                              placeholder="Contoh: 850"
                              className="w-full text-xs p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-slate-500 block mb-1">
                              Solar Bulanan (Liter)
                            </label>
                            <input
                              type="number"
                              step="any"
                              value={formData.g1_solar_bulanan ?? ""}
                              onChange={(e) => handleInputChange("g1_solar_bulanan", e.target.value)}
                              placeholder="Contoh: 1400"
                              className="w-full text-xs p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-slate-500 block mb-1">
                              Meter Solar Genset
                            </label>
                            <input
                              type="number"
                              step="any"
                              value={formData.g1_meter_solar ?? ""}
                              onChange={(e) => handleInputChange("g1_meter_solar", e.target.value)}
                              placeholder="Contoh: 12500"
                              className="w-full text-xs p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-slate-500 block mb-1">
                              Air Radiator
                            </label>
                            <select
                              value={formData.g1_air_radiator || ""}
                              onChange={(e) => handleInputChange("g1_air_radiator", e.target.value)}
                              className="w-full text-xs p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                            >
                              <option value="">-- Pilih Air Radiator --</option>
                              <option value="Penuh / Normal">Penuh / Normal</option>
                              <option value="Kurang">Kurang (Wajib Tambah)</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[11px] text-slate-500 block mb-1">
                              Level Oli Mesin (Dipstick)
                            </label>
                            <select
                              value={formData.g1_oli_mesin || ""}
                              onChange={(e) => handleInputChange("g1_oli_mesin", e.target.value)}
                              className="w-full text-xs p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                            >
                              <option value="">-- Pilih Level Oli Mesin --</option>
                              <option value="Normal">Normal (Antara Min & Max)</option>
                              <option value="Mendekati Min">Mendekati Min</option>
                              <option value="Kurang / Bawah Min">Kurang / Bawah Min</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[11px] text-slate-500 block mb-1">
                              Kebersihan & Ventilasi
                            </label>
                            <select
                              value={formData.g1_kebersihan_ventilasi || ""}
                              onChange={(e) =>
                                handleInputChange("g1_kebersihan_ventilasi", e.target.value)
                              }
                              className="w-full text-xs p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                            >
                              <option value="">-- Pilih Kondisi Ventilasi --</option>
                              <option value="Baik / Normal">Baik / Normal</option>
                              <option value="Kotor / Sirkulasi Terhambat">
                                Kotor / Sirkulasi Terhambat
                              </option>
                            </select>
                          </div>
                        </div>
                      </div>

                      <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-2">
                          Genset 1 - Starter Aki & Sistem Kontrol
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div>
                            <label className="text-[11px] text-slate-500 block mb-1">
                              Volt Aki Charger (V DC)
                            </label>
                            <input
                              type="number"
                              step="any"
                              value={formData.g1_volt_aki ?? ""}
                              onChange={(e) => handleInputChange("g1_volt_aki", e.target.value)}
                              placeholder="Contoh: 26.5"
                              className={`w-full text-xs p-2 bg-white dark:bg-slate-800 border rounded-lg ${
                                formData.g1_volt_aki != null && formData.g1_volt_aki !== ("" as any) && Number(formData.g1_volt_aki) < (activeSettings?.genset_min_battery_volt ?? 24)
                                  ? "border-rose-500 bg-rose-50 text-rose-700 font-bold"
                                  : "border-slate-200 dark:border-slate-700"
                              }`}
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-slate-500 block mb-1">
                              Level Air Aki
                            </label>
                            <select
                              value={formData.g1_air_aki || ""}
                              onChange={(e) => handleInputChange("g1_air_aki", e.target.value)}
                              className="w-full text-xs p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                            >
                              <option value="">-- Pilih Level Air Aki --</option>
                              <option value="Max">Max</option>
                              <option value="Middle">Middle</option>
                              <option value="Low">Low (Perlu Ditambah)</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[11px] text-slate-500 block mb-1">
                              Tgl Ganti Aki Terakhir
                            </label>
                            <input
                              type="date"
                              value={formData.g1_tgl_ganti_aki || ""}
                              onChange={(e) => handleInputChange("g1_tgl_ganti_aki", e.target.value)}
                              className="w-full text-xs p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-slate-500 block mb-1">
                              Posisi Selector Switch
                            </label>
                            <select
                              value={formData.g1_selector_switch || ""}
                              onChange={(e) =>
                                handleInputChange("g1_selector_switch", e.target.value)
                              }
                              className={`w-full text-xs p-2 bg-white dark:bg-slate-800 border rounded-lg font-bold ${
                                !formData.g1_selector_switch
                                  ? "border-slate-200 dark:border-slate-700 text-slate-700 font-normal"
                                  : formData.g1_selector_switch !== "AUTO"
                                  ? "border-rose-500 text-rose-700"
                                  : "border-emerald-500 text-emerald-700"
                              }`}
                            >
                              <option value="">-- Pilih Posisi Selector --</option>
                              <option value="AUTO">AUTO (Wajib Standby)</option>
                              <option value="MANUAL">MANUAL</option>
                              <option value="OFF">OFF</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3 mt-3">
                          <div>
                            <label className="text-[11px] text-slate-500 block mb-1">
                              Running Hours (Jam)
                            </label>
                            <input
                              type="number"
                              step="any"
                              value={formData.g1_running_hours ?? ""}
                              onChange={(e) => handleInputChange("g1_running_hours", e.target.value)}
                              placeholder="Contoh: 145.2"
                              className="w-full text-xs p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-slate-500 block mb-1">
                              kWh Total Genset 1
                            </label>
                            <input
                              type="number"
                              step="any"
                              value={formData.g1_kwh_total ?? ""}
                              onChange={(e) => handleInputChange("g1_kwh_total", e.target.value)}
                              placeholder="Contoh: 35400"
                              className="w-full text-xs p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-slate-500 block mb-1">
                              Emergency Stop Button
                            </label>
                            <select
                              value={formData.g1_emergency_stop || ""}
                              onChange={(e) =>
                                handleInputChange("g1_emergency_stop", e.target.value)
                              }
                              className={`w-full text-xs p-2 bg-white dark:bg-slate-800 border rounded-lg font-semibold ${
                                formData.g1_emergency_stop === "Tertekan"
                                  ? "border-rose-500 bg-rose-50 text-rose-700"
                                  : "border-slate-200 dark:border-slate-700"
                              }`}
                            >
                              <option value="">-- Pilih Status Emergency Stop --</option>
                              <option value="Normal">Normal (Release)</option>
                              <option value="Tertekan">Tertekan / Aktif (BAHAYA)</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Genset 2 */}
                      <div className="p-3 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/40 rounded-xl">
                        <h4 className="text-xs font-bold text-amber-900 dark:text-amber-300 mb-2">
                          Genset 2 - Bahan Bakar & Level Cairan
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="text-[11px] text-slate-500 block mb-1">
                              Solar Harian (Liter)
                            </label>
                            <input
                              type="number"
                              step="any"
                              value={formData.g2_solar_harian ?? ""}
                              onChange={(e) => handleInputChange("g2_solar_harian", e.target.value)}
                              placeholder="Contoh: 820"
                              className="w-full text-xs p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-slate-500 block mb-1">
                              Solar Bulanan (Liter)
                            </label>
                            <input
                              type="number"
                              step="any"
                              value={formData.g2_solar_bulanan ?? ""}
                              onChange={(e) => handleInputChange("g2_solar_bulanan", e.target.value)}
                              placeholder="Contoh: 1380"
                              className="w-full text-xs p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-slate-500 block mb-1">
                              Meter Solar Genset 2
                            </label>
                            <input
                              type="number"
                              step="any"
                              value={formData.g2_meter_solar ?? ""}
                              onChange={(e) => handleInputChange("g2_meter_solar", e.target.value)}
                              placeholder="Contoh: 9850"
                              className="w-full text-xs p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-slate-500 block mb-1">
                              Air Radiator
                            </label>
                            <select
                              value={formData.g2_air_radiator || ""}
                              onChange={(e) => handleInputChange("g2_air_radiator", e.target.value)}
                              className="w-full text-xs p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                            >
                              <option value="">-- Pilih Air Radiator --</option>
                              <option value="Penuh / Normal">Penuh / Normal</option>
                              <option value="Kurang">Kurang (Wajib Tambah)</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[11px] text-slate-500 block mb-1">
                              Level Oli Mesin (Dipstick)
                            </label>
                            <select
                              value={formData.g2_oli_mesin || ""}
                              onChange={(e) => handleInputChange("g2_oli_mesin", e.target.value)}
                              className="w-full text-xs p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                            >
                              <option value="">-- Pilih Level Oli Mesin --</option>
                              <option value="Normal">Normal (Antara Min & Max)</option>
                              <option value="Mendekati Min">Mendekati Min</option>
                              <option value="Kurang / Bawah Min">Kurang / Bawah Min</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[11px] text-slate-500 block mb-1">
                              Kebersihan & Ventilasi
                            </label>
                            <select
                              value={formData.g2_kebersihan_ventilasi || ""}
                              onChange={(e) =>
                                handleInputChange("g2_kebersihan_ventilasi", e.target.value)
                              }
                              className="w-full text-xs p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                            >
                              <option value="">-- Pilih Kondisi Ventilasi --</option>
                              <option value="Baik / Normal">Baik / Normal</option>
                              <option value="Kotor / Sirkulasi Terhambat">
                                Kotor / Sirkulasi Terhambat
                              </option>
                            </select>
                          </div>
                        </div>
                      </div>

                      <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-2">
                          Genset 2 - Starter Aki & Sistem Kontrol
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div>
                            <label className="text-[11px] text-slate-500 block mb-1">
                              Volt Aki Charger (V DC)
                            </label>
                            <input
                              type="number"
                              step="any"
                              value={formData.g2_volt_aki ?? ""}
                              onChange={(e) => handleInputChange("g2_volt_aki", e.target.value)}
                              placeholder="Contoh: 26.3"
                              className={`w-full text-xs p-2 bg-white dark:bg-slate-800 border rounded-lg ${
                                formData.g2_volt_aki != null && formData.g2_volt_aki !== ("" as any) && Number(formData.g2_volt_aki) < (activeSettings?.genset_min_battery_volt ?? 24)
                                  ? "border-rose-500 bg-rose-50 text-rose-700 font-bold"
                                  : "border-slate-200 dark:border-slate-700"
                              }`}
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-slate-500 block mb-1">
                              Level Air Aki
                            </label>
                            <select
                              value={formData.g2_air_aki || ""}
                              onChange={(e) => handleInputChange("g2_air_aki", e.target.value)}
                              className="w-full text-xs p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                            >
                              <option value="">-- Pilih Level Air Aki --</option>
                              <option value="Max">Max</option>
                              <option value="Middle">Middle</option>
                              <option value="Low">Low (Perlu Ditambah)</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[11px] text-slate-500 block mb-1">
                              Tgl Ganti Aki Terakhir
                            </label>
                            <input
                              type="date"
                              value={formData.g2_tgl_ganti_aki || ""}
                              onChange={(e) => handleInputChange("g2_tgl_ganti_aki", e.target.value)}
                              className="w-full text-xs p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-slate-500 block mb-1">
                              Posisi Selector Switch
                            </label>
                            <select
                              value={formData.g2_selector_switch || ""}
                              onChange={(e) =>
                                handleInputChange("g2_selector_switch", e.target.value)
                              }
                              className={`w-full text-xs p-2 bg-white dark:bg-slate-800 border rounded-lg font-bold ${
                                !formData.g2_selector_switch
                                  ? "border-slate-200 dark:border-slate-700 text-slate-700 font-normal"
                                  : formData.g2_selector_switch !== "AUTO"
                                  ? "border-rose-500 text-rose-700"
                                  : "border-emerald-500 text-emerald-700"
                              }`}
                            >
                              <option value="">-- Pilih Posisi Selector --</option>
                              <option value="AUTO">AUTO (Wajib Standby)</option>
                              <option value="MANUAL">MANUAL</option>
                              <option value="OFF">OFF</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3 mt-3">
                          <div>
                            <label className="text-[11px] text-slate-500 block mb-1">
                              Running Hours (Jam)
                            </label>
                            <input
                              type="number"
                              step="any"
                              value={formData.g2_running_hours ?? ""}
                              onChange={(e) => handleInputChange("g2_running_hours", e.target.value)}
                              placeholder="Contoh: 99.4"
                              className="w-full text-xs p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-slate-500 block mb-1">
                              kWh Total Genset 2
                            </label>
                            <input
                              type="number"
                              step="any"
                              value={formData.g2_kwh_total ?? ""}
                              onChange={(e) => handleInputChange("g2_kwh_total", e.target.value)}
                              placeholder="Contoh: 24300"
                              className="w-full text-xs p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-slate-500 block mb-1">
                              Emergency Stop Button
                            </label>
                            <select
                              value={formData.g2_emergency_stop || ""}
                              onChange={(e) =>
                                handleInputChange("g2_emergency_stop", e.target.value)
                              }
                              className={`w-full text-xs p-2 bg-white dark:bg-slate-800 border rounded-lg font-semibold ${
                                formData.g2_emergency_stop === "Tertekan"
                                  ? "border-rose-500 bg-rose-50 text-rose-700"
                                  : "border-slate-200 dark:border-slate-700"
                              }`}
                            >
                              <option value="">-- Pilih Status Emergency Stop --</option>
                              <option value="Normal">Normal (Release)</option>
                              <option value="Tertekan">Tertekan / Aktif (BAHAYA)</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: RUANG POMPA & HYDRANT */}
              {activeTab === "pompa" && (
                <div className="space-y-4">
                  {/* Pompa Air Bersih */}
                  <div className="p-3.5 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-900/40 rounded-xl">
                    <h4 className="text-xs font-bold text-blue-900 dark:text-blue-300 mb-2">
                      A. Pompa Air Bersih & Level Tangki
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="text-[11px] text-slate-500 block mb-1">Level RWT (%)</label>
                        <input
                          type="number"
                          step="any"
                          value={formData.level_rwt ?? ""}
                          onChange={(e) => handleInputChange("level_rwt", e.target.value)}
                          placeholder="Contoh: 85"
                          className="w-full text-xs p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-500 block mb-1">Level CWT (%)</label>
                        <input
                          type="number"
                          step="any"
                          value={formData.level_cwt ?? ""}
                          onChange={(e) => handleInputChange("level_cwt", e.target.value)}
                          placeholder="Contoh: 90"
                          className="w-full text-xs p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-500 block mb-1">Level GWT 1 (%)</label>
                        <input
                          type="number"
                          step="any"
                          value={formData.level_gwt1 ?? ""}
                          onChange={(e) => handleInputChange("level_gwt1", e.target.value)}
                          placeholder="Contoh: 85"
                          className="w-full text-xs p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-500 block mb-1">Level GWT 2 (%)</label>
                        <input
                          type="number"
                          step="any"
                          value={formData.level_gwt2 ?? ""}
                          onChange={(e) => handleInputChange("level_gwt2", e.target.value)}
                          placeholder="Contoh: 80"
                          className="w-full text-xs p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                      <div>
                        <label className="text-[11px] text-slate-500 block mb-1">
                          Selector Transfer CWT
                        </label>
                        <select
                          value={formData.transfer_selector || ""}
                          onChange={(e) => handleInputChange("transfer_selector", e.target.value)}
                          className="w-full text-xs p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-semibold"
                        >
                          <option value="">-- Pilih Selector Transfer --</option>
                          <option value="AUTO">AUTO</option>
                          <option value="MANUAL">MANUAL</option>
                          <option value="OFF">OFF</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-500 block mb-1">
                          Status Trip Pompa Transfer
                        </label>
                        <select
                          value={formData.transfer_trip_status || ""}
                          onChange={(e) => handleInputChange("transfer_trip_status", e.target.value)}
                          className={`w-full text-xs p-2 bg-white dark:bg-slate-800 border rounded-lg ${
                            formData.transfer_trip_status === "TRIP / Alarm"
                              ? "border-rose-500 bg-rose-50 text-rose-700 font-bold"
                              : "border-slate-200 dark:border-slate-700"
                          }`}
                        >
                          <option value="">-- Pilih Status Trip --</option>
                          <option value="Normal / Tidak Trip">Normal / Tidak Trip</option>
                          <option value="TRIP / Alarm">TRIP / Alarm (Anomali)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-500 block mb-1">Pompa 1</label>
                        <select
                          value={formData.transfer_pompa1 || ""}
                          onChange={(e) => handleInputChange("transfer_pompa1", e.target.value)}
                          className="w-full text-xs p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                        >
                          <option value="">-- Pilih Status Pompa 1 --</option>
                          <option value="Standby">Standby</option>
                          <option value="Running">Running</option>
                          <option value="Trouble">Trouble</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-500 block mb-1">Pompa 2</label>
                        <select
                          value={formData.transfer_pompa2 || ""}
                          onChange={(e) => handleInputChange("transfer_pompa2", e.target.value)}
                          className="w-full text-xs p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                        >
                          <option value="">-- Pilih Status Pompa 2 --</option>
                          <option value="Standby">Standby</option>
                          <option value="Running">Running</option>
                          <option value="Trouble">Trouble</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Pompa Hydrant */}
                  <div className="p-3.5 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/50 dark:border-rose-900/40 rounded-xl">
                    <h4 className="text-xs font-bold text-rose-900 dark:text-rose-300 mb-2">
                      B. Pompa Hydrant Pemadam Kebakaran
                    </h4>

                    {/* Tekanan Header */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                      <div className="sm:col-span-2">
                        <label className="text-[11px] font-bold text-slate-900 dark:text-white block mb-1">
                          Tekanan Header Hydrant Utama (Bar) — Batas Minimal:{" "}
                          <span className="text-rose-600 font-bold">
                            {activeSettings?.hydrant_min_pressure ?? 7.0} Bar
                          </span>
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={formData.hydrant_header_pressure ?? ""}
                          onChange={(e) =>
                            handleInputChange("hydrant_header_pressure", e.target.value)
                          }
                          placeholder="Contoh: 9.0"
                          className={`w-full text-sm font-bold p-2.5 bg-white dark:bg-slate-800 border rounded-lg ${
                            formData.hydrant_header_pressure == null || formData.hydrant_header_pressure === ("" as any)
                              ? "border-slate-200 dark:border-slate-700"
                              : Number(formData.hydrant_header_pressure) < (activeSettings?.hydrant_min_pressure ?? 7.0)
                              ? "border-rose-500 bg-rose-50 text-rose-700"
                              : "border-emerald-500 text-emerald-700"
                          }`}
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-900 dark:text-white block mb-1">
                          Status Main Valve Header
                        </label>
                        <select
                          value={formData.hydrant_main_valve || ""}
                          onChange={(e) => handleInputChange("hydrant_main_valve", e.target.value)}
                          className={`w-full text-xs p-2.5 bg-white dark:bg-slate-800 border rounded-lg font-bold ${
                            !formData.hydrant_main_valve
                              ? "border-slate-200 dark:border-slate-700 font-normal text-slate-700"
                              : formData.hydrant_main_valve !== "Full Open"
                              ? "border-rose-500 bg-rose-50 text-rose-700"
                              : "border-emerald-500 text-emerald-700"
                          }`}
                        >
                          <option value="">-- Pilih Posisi Main Valve --</option>
                          <option value="Full Open">Full Open (Buka Penuh)</option>
                          <option value="Sebagian Terbuka">Sebagian Terbuka (BAHAYA)</option>
                          <option value="Tertutup">Tertutup (BAHAYA KRITIS)</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="text-[11px] text-slate-500 block mb-1">
                          Jockey Pump Selector
                        </label>
                        <select
                          value={formData.jockey_selector || ""}
                          onChange={(e) => handleInputChange("jockey_selector", e.target.value)}
                          className="w-full text-xs p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                        >
                          <option value="">-- Pilih Posisi Jockey --</option>
                          <option value="AUTO">AUTO</option>
                          <option value="MANUAL">MANUAL</option>
                          <option value="OFF">OFF</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-500 block mb-1">
                          Electric Pump Selector
                        </label>
                        <select
                          value={formData.electric_selector || ""}
                          onChange={(e) => handleInputChange("electric_selector", e.target.value)}
                          className="w-full text-xs p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                        >
                          <option value="">-- Pilih Posisi Electric --</option>
                          <option value="AUTO">AUTO</option>
                          <option value="MANUAL">MANUAL</option>
                          <option value="OFF">OFF</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-500 block mb-1">
                          Diesel Fire Pump Selector
                        </label>
                        <select
                          value={formData.diesel_selector || ""}
                          onChange={(e) => handleInputChange("diesel_selector", e.target.value)}
                          className={`w-full text-xs p-2 bg-white dark:bg-slate-800 border rounded-lg font-bold ${
                            !formData.diesel_selector
                              ? "border-slate-200 dark:border-slate-700 text-slate-700 font-normal"
                              : formData.diesel_selector !== "AUTO"
                              ? "border-rose-500 text-rose-700"
                              : "border-emerald-500 text-emerald-700"
                          }`}
                        >
                          <option value="">-- Pilih Posisi Diesel --</option>
                          <option value="AUTO">AUTO (Wajib Standby)</option>
                          <option value="MANUAL">MANUAL</option>
                          <option value="OFF">OFF</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-500 block mb-1">
                          Solar Tangki Diesel (L)
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={formData.diesel_solar_level ?? ""}
                          onChange={(e) => handleInputChange("diesel_solar_level", e.target.value)}
                          placeholder="Contoh: 250"
                          className="w-full text-xs p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                      <div>
                        <label className="text-[11px] text-slate-500 block mb-1">
                          Aki Starter Diesel (V DC)
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={formData.hydrant_volt_aki ?? ""}
                          onChange={(e) => handleInputChange("hydrant_volt_aki", e.target.value)}
                          placeholder="Contoh: 26.0"
                          className={`w-full text-xs p-2 bg-white dark:bg-slate-800 border rounded-lg ${
                            formData.hydrant_volt_aki != null && formData.hydrant_volt_aki !== ("" as any) && Number(formData.hydrant_volt_aki) < 24
                              ? "border-rose-500 bg-rose-50 text-rose-700 font-bold"
                              : "border-slate-200 dark:border-slate-700"
                          }`}
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-500 block mb-1">
                          Level Air Aki Hydrant
                        </label>
                        <select
                          value={formData.hydrant_air_aki || ""}
                          onChange={(e) => handleInputChange("hydrant_air_aki", e.target.value)}
                          className="w-full text-xs p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                        >
                          <option value="">-- Pilih Level Air Aki --</option>
                          <option value="Max">Max</option>
                          <option value="Middle">Middle</option>
                          <option value="Low">Low</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-500 block mb-1">
                          Kunci Starter Panel
                        </label>
                        <select
                          value={formData.hydrant_key_switch || ""}
                          onChange={(e) => handleInputChange("hydrant_key_switch", e.target.value)}
                          className="w-full text-xs p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                        >
                          <option value="">-- Pilih Posisi Kunci --</option>
                          <option value="AUTO">Posisi AUTO</option>
                          <option value="MANUAL / OFF">Posisi MANUAL / OFF</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-500 block mb-1">
                          Lantai & Drainase
                        </label>
                        <select
                          value={formData.ruang_pompa_lantai || ""}
                          onChange={(e) => handleInputChange("ruang_pompa_lantai", e.target.value)}
                          className="w-full text-xs p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                        >
                          <option value="">-- Pilih Kondisi Lantai --</option>
                          <option value="Kering & Drain Lancar">Kering & Drain Lancar</option>
                          <option value="Ada Genangan Air">Ada Genangan Air</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: FOTO TEMUAN & CATATAN */}
              {activeTab === "temuan" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Catatan Temuan Lapangan
                    </label>
                    <textarea
                      rows={3}
                      value={formData.notes || ""}
                      onChange={(e) => handleInputChange("notes", e.target.value)}
                      placeholder="Tuliskan catatan kondisi visual, penanganan, atau catatan operasional mesin..."
                      className="w-full text-xs p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Upload Foto Bukti Temuan / Kerusakan (Kamera / File)
                    </label>
                    <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 dark:border-slate-700 border-dashed rounded-xl bg-slate-50/50 dark:bg-slate-800/30">
                      <div className="space-y-2 text-center">
                        {photoPreview ? (
                          <div className="relative inline-block">
                            <img
                              src={photoPreview}
                              alt="Preview"
                              className="max-h-48 rounded-lg mx-auto object-contain border border-slate-200"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setPhotoPreview(null);
                                handleInputChange("photo_temuan_url", undefined);
                              }}
                              className="absolute -top-2 -right-2 p-1 bg-rose-600 text-white rounded-full shadow-md"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <Camera className="mx-auto h-10 w-10 text-slate-400" />
                            <div className="flex text-xs text-slate-600 dark:text-slate-400 justify-center">
                              <label className="relative cursor-pointer rounded-md font-semibold text-indigo-600 hover:text-indigo-500 focus-within:outline-none">
                                <span>Ambil Foto atau Pilih File</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  capture="environment"
                                  className="sr-only"
                                  onChange={handlePhotoUpload}
                                />
                              </label>
                            </div>
                            <p className="text-[10px] text-slate-400">PNG, JPG, WEBP maks 8MB</p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Real-time Alarm Alert Box inside modal */}
              {liveAlarmCheck.has_alarm && (
                <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300 mb-1">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    Peringatan Otomatis Terdeteksi (Akan Ditandai sebagai Alarm):
                  </div>
                  <ul className="list-disc list-inside text-xs text-amber-900 dark:text-amber-200 space-y-0.5">
                    {liveAlarmCheck.alarm_reasons.map((r, idx) => (
                      <li key={idx}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Footer Buttons */}
              <div className="px-6 py-4 -mx-6 -mb-6 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="text-[11px] text-slate-500">
                  Semua data tersimpan aman ke database hotel.
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      setEditingLogId(null);
                    }}
                    className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-600"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`px-5 py-2 text-xs font-bold text-white rounded-lg disabled:opacity-50 flex items-center gap-1.5 shadow-sm transition-colors ${
                      activeTab === "lvmdp"
                        ? "bg-blue-600 hover:bg-blue-700"
                        : activeTab === "genset"
                        ? "bg-amber-600 hover:bg-amber-700"
                        : activeTab === "pompa"
                        ? "bg-teal-600 hover:bg-teal-700"
                        : "bg-indigo-600 hover:bg-indigo-700"
                    }`}
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Menyimpan Data...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>
                          {activeTab === "lvmdp" && "Simpan Data LVMDP"}
                          {activeTab === "genset" && "Simpan Data Genset"}
                          {activeTab === "pompa" && "Simpan Data Ruang Pompa"}
                          {activeTab === "temuan" && "Simpan Log Sheet & Temuan"}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
