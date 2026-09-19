import React, { useState, useEffect, useCallback } from "react";
import {
  Download,
  Filter,
  Search,
  Calendar,
  Clock,
  User as UserIcon,
  AlertTriangle,
  FileSpreadsheet,
  RefreshCw,
  Eye,
  X,
  Droplet,
  Zap,
  Flame,
  Building2,
  Recycle,
  Gauge,
  Trash2,
  Camera,
  ExternalLink,
  Pencil,
  CheckCircle2,
  ClipboardList,
  Activity,
  ChevronRight,
  Info,
  Copy,
  Check,
} from "lucide-react";
import { Reading, MeterMenu, AppSettings, User, PlantLog } from "../types";
import { useAuth } from "../auth";
import { useI18n } from "../i18n";
import {
  fetchReadings,
  fetchMenus,
  deleteReading,
  fetchAppSettings,
  fetchUsers,
  fetchPlantLogs,
  deletePlantLog,
  exportPlantLogsToExcel,
  copyReadingsToClipboardAsTsv,
  copyPlantLogsToClipboardAsTsv,
} from "../supabaseService";
import { exportReadingsToExcel } from "../excelExport";
import { EditReadingModal } from "./EditReadingModal";
import { PlantLogDetailModal } from "./PlantLogDetailModal";

const METER_ICONS: Record<string, React.ElementType> = {
  Drop: Droplet,
  Lightning: Zap,
  Flame: Flame,
  Buildings: Building2,
  Recycle: Recycle,
  Gauge: Gauge,
};

export const resolvePhotoUrl = (path?: string): string => {
  if (!path) return "";
  if (
    path.startsWith("data:") ||
    path.startsWith("http://") ||
    path.startsWith("https://") ||
    path.startsWith("blob:")
  ) {
    return path;
  }
  return `/api/files/${path}`;
};

export function History() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const [historyType, setHistoryType] = useState<"meter" | "plant">("meter");
  const [readings, setReadings] = useState<Reading[]>([]);
  const [plantLogs, setPlantLogs] = useState<PlantLog[]>([]);
  const [menus, setMenus] = useState<MeterMenu[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Filters
  const [dateFilter, setDateFilter] = useState<"today" | "7d" | "30d" | "all">("7d");
  const [selectedShift, setSelectedShift] = useState<string>("all");
  const [selectedMeter, setSelectedMeter] = useState<string>("all");
  const [filterPlantStatus, setFilterPlantStatus] = useState<"all" | "alarm" | "normal">("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Photo viewer modal state (Meter)
  const [activeReadingModal, setActiveReadingModal] = useState<Reading | null>(null);

  // Detail modal state (Plant Log)
  const [selectedPlantLog, setSelectedPlantLog] = useState<PlantLog | null>(null);

  // Delete modal confirmation (Meter)
  const [deleteTarget, setDeleteTarget] = useState<Reading | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Delete modal confirmation (Plant Log)
  const [deletePlantTarget, setDeletePlantTarget] = useState<PlantLog | null>(null);
  const [deletingPlant, setDeletingPlant] = useState(false);
  const [deletePlantError, setDeletePlantError] = useState<string | null>(null);

  // Admin Edit modal state
  const [editTarget, setEditTarget] = useState<Reading | null>(null);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      let startStr = "";

      if (dateFilter === "today") {
        const d = new Date(now);
        d.setHours(0, 0, 0, 0);
        startStr = d.toISOString();
      } else if (dateFilter === "7d") {
        const d = new Date(now);
        d.setDate(d.getDate() - 7);
        startStr = d.toISOString();
      } else if (dateFilter === "30d") {
        const d = new Date(now);
        d.setDate(d.getDate() - 30);
        startStr = d.toISOString();
      }

      const [rData, mData, sData, pData] = await Promise.all([
        fetchReadings({
          start: startStr || undefined,
          shift: selectedShift !== "all" ? selectedShift : undefined,
          meter_id: selectedMeter !== "all" ? selectedMeter : undefined,
          limit: 500,
        }),
        fetchMenus(),
        fetchAppSettings(),
        fetchPlantLogs({
          start: startStr || undefined,
          shift: selectedShift !== "all" ? selectedShift : undefined,
          limit: 500,
        }),
      ]);

      setReadings(rData);
      setMenus(mData);
      setSettings(sData);
      setPlantLogs(pData);

      if (user?.role === "admin") {
        fetchUsers().then(setUsersList).catch(() => {});
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [dateFilter, selectedShift, selectedMeter, user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      if (historyType === "meter") {
        const dataToExport = filteredReadings.length > 0 ? filteredReadings : readings;
        exportReadingsToExcel(dataToExport, "Meter_Checklist_Report");
      } else {
        const dataToExport = filteredPlantLogs.length > 0 ? filteredPlantLogs : plantLogs;
        exportPlantLogsToExcel(dataToExport, settings?.property_name || "Midtown Hotel Samarinda");
      }
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Gagal membuat file Excel");
    } finally {
      setTimeout(() => setExporting(false), 800);
    }
  };

  const [copiedTable, setCopiedTable] = useState(false);
  const [copyToast, setCopyToast] = useState<string | null>(null);

  const handleCopyTable = async () => {
    try {
      if (historyType === "meter") {
        const dataToCopy = filteredReadings.length > 0 ? filteredReadings : readings;
        if (dataToCopy.length === 0) {
          alert("Tidak ada data untuk disalin.");
          return;
        }
        const res = await copyReadingsToClipboardAsTsv(dataToCopy, "complete");
        setCopiedTable(true);
        setCopyToast(`Berhasil menyalin ${res.rowCount} baris tabel meteran! Buka Google Sheets & tekan Ctrl+V.`);
        setTimeout(() => setCopiedTable(false), 3000);
        setTimeout(() => setCopyToast(null), 4000);
      } else {
        const dataToCopy = filteredPlantLogs.length > 0 ? filteredPlantLogs : plantLogs;
        if (dataToCopy.length === 0) {
          alert("Tidak ada data untuk disalin.");
          return;
        }
        const res = await copyPlantLogsToClipboardAsTsv(dataToCopy, "complete");
        setCopiedTable(true);
        setCopyToast(`Berhasil menyalin ${res.rowCount} baris tabel log mesin! Buka Google Sheets & tekan Ctrl+V.`);
        setTimeout(() => setCopiedTable(false), 3000);
        setTimeout(() => setCopyToast(null), 4000);
      }
    } catch (err: any) {
      alert(err?.message || "Gagal menyalin tabel");
    }
  };

  const filteredReadings = readings.filter((r) => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (
      r.meter_name.toLowerCase().includes(s) ||
      r.user_name.toLowerCase().includes(s) ||
      (r.notes && r.notes.toLowerCase().includes(s))
    );
  });

  const filteredPlantLogs = plantLogs.filter((p) => {
    if (filterPlantStatus === "alarm" && !p.has_alarm) return false;
    if (filterPlantStatus === "normal" && p.has_alarm) return false;
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (
      (p.user_name || "").toLowerCase().includes(s) ||
      (p.notes && p.notes.toLowerCase().includes(s)) ||
      (p.alarm_reasons && p.alarm_reasons.some((r) => r.toLowerCase().includes(s)))
    );
  });

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-24">
      {/* Header & Export Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{t("history")}</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {historyType === "meter"
              ? "Daftar audit dan riwayat pemakaian meter utilitas"
              : "Daftar rekaman pemeriksaan log sheet teknisi ruang mesin"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View Switcher Tabs */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200/70">
            <button
              id="history-tab-meter"
              type="button"
              onClick={() => setHistoryType("meter")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                historyType === "meter"
                  ? "bg-white text-blue-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Gauge className="w-3.5 h-3.5" />
              <span>Catat Meter</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200/80 text-slate-700 font-semibold">
                {filteredReadings.length}
              </span>
            </button>
            <button
              id="history-tab-plant"
              type="button"
              onClick={() => setHistoryType("plant")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                historyType === "plant"
                  ? "bg-white text-blue-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Ruang Mesin</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200/80 text-slate-700 font-semibold">
                {filteredPlantLogs.length}
              </span>
            </button>
          </div>

          <button
            onClick={loadData}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          <button
            id="export-excel-button"
            onClick={handleExportExcel}
            disabled={exporting}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-2 disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>
              {exporting
                ? "Mengunduh..."
                : historyType === "meter"
                ? t("export_excel")
                : "Export Excel Log Mesin"}
            </span>
          </button>

          <button
            id="copy-table-sheets-button"
            type="button"
            onClick={handleCopyTable}
            className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5 border border-slate-200 cursor-pointer"
            title="Salin tabel langsung ke clipboard (Ctrl+V ke Google Sheets) dengan urutan update baru di paling bawah"
          >
            {copiedTable ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">Tersalin!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-600" />
                <span>Salin Tabel (Sheets)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {copyToast && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-4 py-2.5 rounded-xl text-xs font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{copyToast}</span>
        </div>
      )}

      {/* Filter Controls Card */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Date range filter */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {(["today", "7d", "30d", "all"] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDateFilter(d)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  dateFilter === d
                    ? "bg-white text-blue-700 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {d === "today"
                  ? t("today")
                  : d === "7d"
                  ? t("last_7")
                  : d === "30d"
                  ? t("last_30")
                  : t("all")}
              </button>
            ))}
          </div>

          {/* Shift filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-slate-500">{t("shift")}:</span>
            <select
              value={selectedShift}
              onChange={(e) => setSelectedShift(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="all">{t("all")}</option>
              <option value="pagi">
                {t("pagi")} ({settings?.shift_pagi_start || "08:00"}-{settings?.shift_sore_start || "16:00"})
              </option>
              <option value="sore">
                {t("sore")} ({settings?.shift_sore_start || "16:00"}-{settings?.shift_malam_start || "00:00"})
              </option>
              <option value="malam">
                {t("malam")} ({settings?.shift_malam_start || "00:00"}-{settings?.shift_pagi_start || "08:00"})
              </option>
            </select>
          </div>

          {/* Conditional 3rd filter: Meter or Status */}
          {historyType === "meter" ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-slate-500">Meter:</span>
              <select
                value={selectedMeter}
                onChange={(e) => setSelectedMeter(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="all">{t("all")}</option>
                {menus.map((m) => (
                  <option key={m.menu_id} value={m.menu_id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-slate-500">Status:</span>
              <select
                value={filterPlantStatus}
                onChange={(e) => setFilterPlantStatus(e.target.value as any)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="all">Semua Status</option>
                <option value="alarm">Hanya Ada Anomali / Alarm</option>
                <option value="normal">Normal Saja</option>
              </select>
            </div>
          )}
        </div>

        {/* Search box */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={
              historyType === "meter"
                ? "Cari berdasarkan meter, teknisi, atau catatan..."
                : "Cari berdasarkan nama teknisi, catatan, atau anomali..."
            }
            className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>
      </div>

      {/* History List Content */}
      {historyType === "meter" ? (
        /* Reading List (Meter Checklist) */
        <div className="space-y-3">
          {loading ? (
            <div className="space-y-2.5">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-28 bg-slate-200 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : filteredReadings.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center border border-slate-200">
              <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <Calendar className="w-8 h-8" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">Tidak ada riwayat checklist meter ditemukan</h3>
              <p className="text-xs text-slate-500 mt-1">
                Coba sesuaikan filter rentang tanggal atau shift di atas.
              </p>
            </div>
          ) : (
            filteredReadings.map((r, idx) => {
              const d = new Date(r.recorded_at);
              const dateFmt = d.toLocaleDateString(lang === "id" ? "id-ID" : "en-US", {
                day: "numeric",
                month: "short",
                year: "numeric",
              });
              const timeFmt = d.toLocaleTimeString(lang === "id" ? "id-ID" : "en-US", {
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <div
                  key={r.reading_id}
                  id={`history-card-${idx}`}
                  className={`bg-white rounded-2xl p-4 sm:p-5 border transition-all shadow-sm ${
                    r.alarm
                      ? "border-amber-300 bg-amber-50/20 shadow-amber-100"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="text-base font-extrabold text-slate-900">{r.meter_name}</span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                          r.shift === "pagi"
                            ? "bg-blue-100 text-blue-700"
                            : r.shift === "sore"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-indigo-100 text-indigo-900"
                        }`}
                      >
                        {r.shift}
                      </span>
                      {r.alarm && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-red-100 text-red-700">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Lonjakan</span>
                        </span>
                      )}
                    </div>

                    {/* Total badge & Admin Edit / Delete Actions */}
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <span className="text-lg font-black text-blue-700">
                          +{r.total.toLocaleString("id-ID")}
                        </span>{" "}
                        <span className="text-xs font-semibold text-slate-500">{r.meter_unit}</span>
                      </div>

                      {user?.role === "admin" && (
                        <div className="flex items-center gap-1 ml-1">
                          <button
                            type="button"
                            onClick={() => setEditTarget(r)}
                            className="p-1.5 text-slate-400 hover:text-amber-600 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/40 transition"
                            title="Koreksi / Edit checklist ini (Admin)"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(r)}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition ml-0.5"
                            title="Hapus checklist ini (Admin)"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Sub row: Awal -> Akhir & Metadata */}
                  <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        {t("awal")}
                      </span>
                      <span className="font-mono font-semibold text-slate-700">{r.awal}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        {t("akhir")}
                      </span>
                      <span className="font-mono font-semibold text-slate-900">{r.akhir}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Petugas
                      </span>
                      <span className="font-semibold text-slate-700 truncate block">
                        {r.user_name}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Waktu
                      </span>
                      <span className="text-slate-600 font-medium">
                        {dateFmt}, {timeFmt}
                      </span>
                    </div>
                  </div>

                  {/* Detailed electrical parameters if PLN */}
                  {(r.voltase !== undefined ||
                    r.ampere !== undefined ||
                    r.lwbp !== undefined ||
                    r.lwbp_akhir !== undefined ||
                    r.wbp !== undefined ||
                    r.wbp_akhir !== undefined ||
                    r.kvar !== undefined ||
                    r.kvar_akhir !== undefined) && (
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap gap-2 text-[11px] text-slate-600">
                      {r.voltase !== undefined && (
                        <span className="bg-slate-50 border border-slate-200/80 px-2 py-0.5 rounded-md">
                          <strong className="text-slate-700">Volt:</strong> {r.voltase}V
                        </span>
                      )}
                      {r.ampere !== undefined && (
                        <span className="bg-slate-50 border border-slate-200/80 px-2 py-0.5 rounded-md">
                          <strong className="text-slate-700">Amp:</strong> {r.ampere}A
                        </span>
                      )}
                      {(r.lwbp_akhir ?? r.lwbp) !== undefined && (
                        <span className="bg-blue-50 border border-blue-200/60 px-2 py-0.5 rounded-md text-blue-950 font-medium">
                          <strong className="text-blue-800">LWBP:</strong> {(r.lwbp_akhir ?? r.lwbp)?.toLocaleString("id-ID")}
                        </span>
                      )}
                      {(r.wbp_akhir ?? r.wbp) !== undefined && (
                        <span className="bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-md text-amber-950 font-medium">
                          <strong className="text-amber-800">WBP:</strong> {(r.wbp_akhir ?? r.wbp)?.toLocaleString("id-ID")}
                        </span>
                      )}
                      {(r.kvar_akhir ?? r.kvar) !== undefined && (
                        <span className="bg-indigo-50 border border-indigo-200/60 px-2 py-0.5 rounded-md text-indigo-950 font-medium">
                          <strong className="text-indigo-800">kVARh:</strong> {(r.kvar_akhir ?? r.kvar)?.toLocaleString("id-ID")}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Notes or photo attachments */}
                  {(r.notes || r.photo_path) && (
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                      {r.notes ? (
                        <p className="italic text-slate-600 truncate flex-1 min-w-[140px]">
                          "{r.notes}"
                        </p>
                      ) : (
                        <div className="flex-1" />
                      )}

                      {r.photo_path && (
                        <button
                          type="button"
                          onClick={() => setActiveReadingModal(r)}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200/80 px-3 py-1.5 rounded-xl transition shadow-xs cursor-pointer ml-auto"
                          title="Klik untuk melihat foto meter"
                        >
                          <Camera className="w-3.5 h-3.5 text-blue-600" />
                          <span>Lihat Foto Meter</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* Plant Log List (Ruang Mesin) */
        <div className="space-y-3">
          {loading ? (
            <div className="space-y-2.5">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-28 bg-slate-200 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : filteredPlantLogs.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center border border-slate-200">
              <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <Activity className="w-8 h-8" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">Tidak ada rekaman ruang mesin ditemukan</h3>
              <p className="text-xs text-slate-500 mt-1">
                Belum ada log sheet ruang mesin yang sesuai dengan filter yang dipilih.
              </p>
            </div>
          ) : (
            filteredPlantLogs.map((log, idx) => {
              const d = new Date(log.recorded_at);
              const dateFmt = d.toLocaleDateString(lang === "id" ? "id-ID" : "en-US", {
                day: "numeric",
                month: "short",
                year: "numeric",
              });
              const timeFmt = d.toLocaleTimeString(lang === "id" ? "id-ID" : "en-US", {
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <div
                  key={log.log_id}
                  id={`plant-log-card-${idx}`}
                  className={`bg-white rounded-2xl p-4 sm:p-5 border transition-all shadow-sm ${
                    log.has_alarm
                      ? "border-amber-300 bg-amber-50/20 shadow-amber-100"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-200">
                        <Activity className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-base font-extrabold text-slate-900">
                            Log Sheet Ruang Mesin
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                              log.shift === "pagi"
                                ? "bg-blue-100 text-blue-700"
                                : log.shift === "sore"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-indigo-100 text-indigo-900"
                            }`}
                          >
                            {log.shift}
                          </span>
                          {log.has_alarm ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-red-100 text-red-700">
                              <AlertTriangle className="w-3 h-3" />
                              <span>{log.alarm_reasons?.length || 1} Anomali</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-700">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Normal</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Detail and Admin Action buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedPlantLog(log)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Lihat Detail</span>
                      </button>

                      {user?.role === "admin" && (
                        <button
                          type="button"
                          onClick={() => setDeletePlantTarget(log)}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition ml-0.5"
                          title="Hapus rekaman log ruang mesin ini (Admin)"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Sub row: Petugas, Waktu, & Ringkasan Utama */}
                  <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Petugas
                      </span>
                      <span className="font-semibold text-slate-800 truncate block">
                        {log.user_name}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Waktu Periksa
                      </span>
                      <span className="text-slate-600 font-medium">
                        {dateFmt}, {timeFmt}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        LVMDP (Volt / Ampere)
                      </span>
                      <span className="font-semibold text-slate-800 block">
                        {log.lvmdp_volt_rs != null ? `${log.lvmdp_volt_rs}V` : "-"} /{" "}
                        {log.lvmdp_ampere_total != null ? `${log.lvmdp_ampere_total}A` : "-"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Pompa & Hydrant
                      </span>
                      <span className="font-semibold text-slate-800 block">
                        Hydrant: {log.hydrant_header_pressure != null ? `${log.hydrant_header_pressure} Bar` : "-"}
                      </span>
                    </div>
                  </div>

                  {/* Parameter Badges Strip */}
                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap gap-2 text-[11px] text-slate-600">
                    <span className="bg-slate-50 border border-slate-200/80 px-2 py-0.5 rounded-md">
                      <strong className="text-slate-700">Suhu LVMDP:</strong>{" "}
                      {log.lvmdp_suhu_ruang != null ? `${log.lvmdp_suhu_ruang}°C` : "-"}
                    </span>
                    <span className="bg-slate-50 border border-slate-200/80 px-2 py-0.5 rounded-md">
                      <strong className="text-slate-700">PF Cos Phi:</strong>{" "}
                      {log.lvmdp_cos_phi != null ? log.lvmdp_cos_phi : "-"}
                    </span>
                    <span className="bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-md text-amber-950">
                      <strong className="text-amber-800">G1 Selector:</strong>{" "}
                      {log.g1_selector_switch || "-"} ({log.g1_volt_aki != null ? `${log.g1_volt_aki}V` : "-"})
                    </span>
                    <span className="bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-md text-amber-950">
                      <strong className="text-amber-800">G2 Selector:</strong>{" "}
                      {log.g2_selector_switch || "-"} ({log.g2_volt_aki != null ? `${log.g2_volt_aki}V` : "-"})
                    </span>
                    <span className="bg-teal-50 border border-teal-200/60 px-2 py-0.5 rounded-md text-teal-950">
                      <strong className="text-teal-800">CWT / RWT:</strong>{" "}
                      {log.level_cwt != null ? `${log.level_cwt}%` : "-"} / {log.level_rwt != null ? `${log.level_rwt}%` : "-"}
                    </span>
                  </div>

                  {/* Anomaly warning box if alarm present */}
                  {log.has_alarm && log.alarm_reasons && log.alarm_reasons.length > 0 && (
                    <div className="mt-2.5 p-2 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                      <div className="flex items-center gap-1 font-bold mb-0.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        <span>Peringatan / Anomali Tercatat:</span>
                      </div>
                      <div className="pl-4 text-[11px] text-amber-800 list-disc">
                        {log.alarm_reasons.map((r, i) => (
                          <div key={i}>• {r}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes or photo attachments */}
                  {(log.notes || log.photo_temuan_url) && (
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                      {log.notes ? (
                        <p className="italic text-slate-600 truncate flex-1 min-w-[140px]">
                          "{log.notes}"
                        </p>
                      ) : (
                        <div className="flex-1" />
                      )}

                      {log.photo_temuan_url && (
                        <button
                          type="button"
                          onClick={() => setSelectedPlantLog(log)}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200/80 px-3 py-1.5 rounded-xl transition shadow-xs cursor-pointer ml-auto"
                          title="Klik untuk melihat foto temuan"
                        >
                          <Camera className="w-3.5 h-3.5 text-blue-600" />
                          <span>Lihat Foto Temuan</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Delete Confirmation Modal (Meter) */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl border border-slate-200 space-y-3">
            <div className="flex items-center gap-2.5 text-red-600">
              <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Hapus Riwayat Checklist</h3>
                <span className="text-[11px] text-slate-500">Konfirmasi Admin</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Apakah Anda yakin ingin menghapus data checklist meter <strong>{deleteTarget.meter_name}</strong> oleh <strong>{deleteTarget.user_name}</strong> (Total: +{deleteTarget.total} {deleteTarget.meter_unit})?
            </p>

            {deleteError && (
              <p className="text-xs text-red-600 bg-red-50 p-2 rounded-lg font-medium">
                {deleteError}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteError(null);
                }}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={async () => {
                  setDeleting(true);
                  setDeleteError(null);
                  try {
                    await deleteReading(deleteTarget.reading_id);
                    setDeleteTarget(null);
                    await loadData();
                  } catch (err: any) {
                    setDeleteError(err?.message || "Gagal menghapus riwayat");
                  } finally {
                    setDeleting(false);
                  }
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50"
              >
                {deleting ? "Menghapus..." : "Ya, Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (Plant Log) */}
      {deletePlantTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl border border-slate-200 space-y-3">
            <div className="flex items-center gap-2.5 text-red-600">
              <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Hapus Log Ruang Mesin</h3>
                <span className="text-[11px] text-slate-500">Konfirmasi Admin</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Apakah Anda yakin ingin menghapus data log sheet ruang mesin oleh <strong>{deletePlantTarget.user_name}</strong> (Shift {deletePlantTarget.shift}, {new Date(deletePlantTarget.recorded_at).toLocaleDateString("id-ID")})?
            </p>

            {deletePlantError && (
              <p className="text-xs text-red-600 bg-red-50 p-2 rounded-lg font-medium">
                {deletePlantError}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={deletingPlant}
                onClick={() => {
                  setDeletePlantTarget(null);
                  setDeletePlantError(null);
                }}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={deletingPlant}
                onClick={async () => {
                  setDeletingPlant(true);
                  setDeletePlantError(null);
                  try {
                    await deletePlantLog(deletePlantTarget.log_id);
                    setDeletePlantTarget(null);
                    await loadData();
                  } catch (err: any) {
                    setDeletePlantError(err?.message || "Gagal menghapus log ruang mesin");
                  } finally {
                    setDeletingPlant(false);
                  }
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50"
              >
                {deletingPlant ? "Menghapus..." : "Ya, Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Preview & Detail Modal */}
      {activeReadingModal && activeReadingModal.photo_path && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative max-w-2xl w-full bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-700/80 flex flex-col max-h-[92vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-800/90 border-b border-slate-700 text-white">
              <div className="flex items-center gap-2 truncate pr-2">
                <Camera className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span className="text-sm font-bold truncate">{activeReadingModal.meter_name}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-700 text-slate-300 font-semibold uppercase flex-shrink-0">
                  Shift {activeReadingModal.shift}
                </span>
                {activeReadingModal.alarm && (
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-red-500/20 text-red-300 border border-red-500/40 font-bold flex-shrink-0">
                    ALARM
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setActiveReadingModal(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Photo Container */}
            <div className="flex-1 overflow-auto bg-black flex items-center justify-center p-2 min-h-[240px] max-h-[58vh]">
              <img
                src={resolvePhotoUrl(activeReadingModal.photo_path)}
                alt={`Foto meter ${activeReadingModal.meter_name}`}
                className="max-w-full max-h-full object-contain rounded-lg"
              />
            </div>

            {/* Reading Details Strip */}
            <div className="p-4 bg-slate-800 text-slate-200 border-t border-slate-700 text-xs space-y-2.5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-700/60">
                  <span className="text-[10px] text-slate-400 block font-medium">Petugas</span>
                  <div className="flex items-center gap-1.5 font-bold text-white mt-0.5 truncate">
                    <UserIcon className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                    <span className="truncate">{activeReadingModal.user_name}</span>
                  </div>
                </div>

                <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-700/60">
                  <span className="text-[10px] text-slate-400 block font-medium">Waktu Catat</span>
                  <div className="flex items-center gap-1 font-semibold text-slate-200 mt-0.5 truncate">
                    <Clock className="w-3 h-3 text-slate-400 flex-shrink-0" />
                    <span>
                      {new Date(activeReadingModal.recorded_at).toLocaleTimeString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-700/60">
                  <span className="text-[10px] text-slate-400 block font-medium">Stand Akhir</span>
                  <span className="font-bold text-white mt-0.5 block">
                    {activeReadingModal.akhir.toLocaleString("id-ID")} {activeReadingModal.meter_unit}
                  </span>
                </div>

                <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-700/60">
                  <span className="text-[10px] text-slate-400 block font-medium">Pemakaian</span>
                  <span className="font-bold text-amber-400 mt-0.5 block">
                    +{activeReadingModal.total.toLocaleString("id-ID")} {activeReadingModal.meter_unit}
                  </span>
                </div>
              </div>

              {/* Extra PLN parameters in modal if present */}
              {(activeReadingModal.voltase !== undefined ||
                activeReadingModal.ampere !== undefined ||
                activeReadingModal.lwbp !== undefined ||
                activeReadingModal.lwbp_akhir !== undefined ||
                activeReadingModal.wbp !== undefined ||
                activeReadingModal.wbp_akhir !== undefined ||
                activeReadingModal.kvar !== undefined ||
                activeReadingModal.kvar_akhir !== undefined) && (
                <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-700/60 space-y-1.5 text-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Pencatatan Parameter Listrik PLN
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                    {activeReadingModal.voltase !== undefined && (
                      <div className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/40">
                        <span className="text-slate-400 block text-[10px]">Voltase:</span>
                        <span className="font-bold text-white">{activeReadingModal.voltase} V</span>
                      </div>
                    )}
                    {activeReadingModal.ampere !== undefined && (
                      <div className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/40">
                        <span className="text-slate-400 block text-[10px]">Arus (Ampere):</span>
                        <span className="font-bold text-white">{activeReadingModal.ampere} A</span>
                      </div>
                    )}
                    {(activeReadingModal.lwbp_akhir ?? activeReadingModal.lwbp) !== undefined && (
                      <div className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/40">
                        <span className="text-blue-300 block text-[10px]">Stand Akhir LWBP:</span>
                        <span className="font-bold text-blue-100">
                          {(activeReadingModal.lwbp_akhir ?? activeReadingModal.lwbp)?.toLocaleString("id-ID")}
                        </span>
                      </div>
                    )}
                    {(activeReadingModal.wbp_akhir ?? activeReadingModal.wbp) !== undefined && (
                      <div className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/40">
                        <span className="text-amber-300 block text-[10px]">Stand Akhir WBP:</span>
                        <span className="font-bold text-amber-100">
                          {(activeReadingModal.wbp_akhir ?? activeReadingModal.wbp)?.toLocaleString("id-ID")}
                        </span>
                      </div>
                    )}
                    {(activeReadingModal.kvar_akhir ?? activeReadingModal.kvar) !== undefined && (
                      <div className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/40">
                        <span className="text-indigo-300 block text-[10px]">Stand Akhir kVARh:</span>
                        <span className="font-bold text-indigo-100">
                          {(activeReadingModal.kvar_akhir ?? activeReadingModal.kvar)?.toLocaleString("id-ID")}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeReadingModal.notes && (
                <div className="bg-slate-900/40 px-3 py-1.5 rounded-lg border border-slate-700/40 text-[11px] text-slate-300 italic">
                  Catatan: "{activeReadingModal.notes}"
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={resolvePhotoUrl(activeReadingModal.photo_path)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Buka Penuh</span>
                  </a>

                  <a
                    href={resolvePhotoUrl(activeReadingModal.photo_path)}
                    download={`foto-meter-${activeReadingModal.meter_name}-${activeReadingModal.reading_id}.jpg`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Unduh</span>
                  </a>

                  {user?.role === "admin" && (
                    <button
                      type="button"
                      onClick={() => {
                        const target = activeReadingModal;
                        setActiveReadingModal(null);
                        setEditTarget(target);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition shadow-sm"
                      title="Koreksi data checklist ini"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Koreksi Data (Admin)</span>
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setActiveReadingModal(null)}
                  className="px-4 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold transition ml-auto"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal for Plant Log */}
      {selectedPlantLog && (
        <PlantLogDetailModal
          log={selectedPlantLog}
          onClose={() => setSelectedPlantLog(null)}
        />
      )}

      {/* Edit Reading Modal for Admin */}
      {editTarget && (
        <EditReadingModal
          reading={editTarget}
          users={usersList}
          settings={settings}
          onClose={() => setEditTarget(null)}
          onSuccess={(updated) => {
            setReadings((prev) =>
              prev.map((r) => (r.reading_id === updated.reading_id ? updated : r))
            );
            setEditTarget(null);
            setToastMsg(`Pencatatan meter ${updated.meter_name} berhasil dikoreksi.`);
            setTimeout(() => setToastMsg(null), 4000);
          }}
        />
      )}

      {/* Floating Success Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 animate-in slide-in-from-bottom-3 duration-200 border border-emerald-500 text-xs font-semibold">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
}
