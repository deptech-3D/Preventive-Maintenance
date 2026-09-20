import React, { useState, useEffect, useCallback } from "react";
import {
  Thermometer,
  CalendarClock,
  AlertTriangle,
  Clock,
  CheckCircle2,
  AlertCircle,
  Building2,
  ChevronRight,
  Filter,
  Plus,
  RefreshCw,
  Search,
  Check,
  Layers,
  Sparkles,
  Calendar,
} from "lucide-react";
import {
  ACCategory,
  AC_CATEGORIES,
  ACUnitScheduleStatus,
  AppSettings,
  ACMaintenanceLog,
} from "../types";
import {
  getACScheduleOverview,
  fetchAppSettings,
} from "../supabaseService";
import { ACLogEntryModal } from "./ACLogEntryModal";

interface ACScheduleNotificationPanelProps {
  onLogSaved?: (log: ACMaintenanceLog) => void;
}

export function ACScheduleNotificationPanel({
  onLogSaved,
}: ACScheduleNotificationPanelProps) {
  const [scheduleList, setScheduleList] = useState<ACUnitScheduleStatus[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<"all" | "urgent" | "overdue" | "approaching" | "safe">("all");
  const [categoryFilter, setCategoryFilter] = useState<ACCategory | "all">("all");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Modal State
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [targetUnitId, setTargetUnitId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [st, statuses] = await Promise.all([
        fetchAppSettings(),
        getACScheduleOverview(),
      ]);
      setSettings(st);
      setScheduleList(statuses);
    } catch (err) {
      console.error("Gagal memuat status jadwal AC:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
  };

  const handleOpenForm = (unitId?: string) => {
    setTargetUnitId(unitId || null);
    setModalOpen(true);
  };

  const handleSuccessSave = (log: ACMaintenanceLog) => {
    setModalOpen(false);
    loadData();
    if (onLogSaved) onLogSaved(log);
  };

  // KPIs
  const totalUnits = scheduleList.length;
  const overdueCount = scheduleList.filter((s) => s.status === "overdue").length;
  const approachingCount = scheduleList.filter((s) => s.status === "approaching").length;
  const safeCount = scheduleList.filter((s) => s.status === "safe").length;
  const urgentCount = overdueCount + approachingCount;

  // Filtered List
  const filteredList = scheduleList.filter((item) => {
    // Status Filter
    if (statusFilter === "urgent") {
      if (item.status !== "overdue" && item.status !== "approaching") return false;
    } else if (statusFilter !== "all" && item.status !== statusFilter) {
      return false;
    }

    // Category Filter
    if (categoryFilter !== "all" && item.unit.category !== categoryFilter) {
      return false;
    }

    // Search
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const matchName = item.unit.name.toLowerCase().includes(q);
      const matchCode = item.unit.code ? item.unit.code.toLowerCase().includes(q) : false;
      const matchCat = item.unit.category.toLowerCase().includes(q);
      if (!matchName && !matchCode && !matchCat) return false;
    }

    return true;
  });

  const cycleText = settings?.ac_maintenance_cycle || `${settings?.ac_maintenance_cycle_months || 1} Bulan Sekali`;

  return (
    <div className="space-y-4" id="ac-schedule-notification-panel">
      {/* KPI Cards Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-500/20 shrink-0">
              <CalendarClock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  Daftar AC & VRV Mendekati Waktu Cleaning
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
                  Siklus: {cycleText}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Monitoring rutin perawatan AC & Outdoor VRV per lantai secara otomatis
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl border border-slate-200 transition"
              title="Perbarui data"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
            <button
              id="btn-quick-record-ac"
              onClick={() => handleOpenForm()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-blue-500/20 flex items-center gap-1.5 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Catat Cuci AC</span>
            </button>
          </div>
        </div>

        {/* 4 Summary Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Overdue Card */}
          <div
            onClick={() => setStatusFilter(statusFilter === "overdue" ? "all" : "overdue")}
            className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
              statusFilter === "overdue"
                ? "bg-red-600 text-white border-red-600 shadow-md shadow-red-500/20"
                : overdueCount > 0
                ? "bg-red-50/70 border-red-200 text-red-900 hover:bg-red-100/70"
                : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold">Lewat Jadwal</span>
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black">{overdueCount}</span>
              <span className="text-[10px] font-semibold opacity-80">Wajib Segera Cuci</span>
            </div>
          </div>

          {/* Approaching Card */}
          <div
            onClick={() => setStatusFilter(statusFilter === "approaching" ? "all" : "approaching")}
            className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
              statusFilter === "approaching"
                ? "bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20"
                : approachingCount > 0
                ? "bg-amber-50/70 border-amber-200 text-amber-900 hover:bg-amber-100/70"
                : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold">Mendekati Waktu Cuci</span>
              <Clock className="w-3.5 h-3.5" />
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black">{approachingCount}</span>
              <span className="text-[10px] font-semibold opacity-80">&le; 7 Hari Lagi</span>
            </div>
          </div>

          {/* Safe Card */}
          <div
            onClick={() => setStatusFilter(statusFilter === "safe" ? "all" : "safe")}
            className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
              statusFilter === "safe"
                ? "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-500/20"
                : "bg-emerald-50/70 border-emerald-200 text-emerald-900 hover:bg-emerald-100/70"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold">Kondisi Aman</span>
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black">{safeCount}</span>
              <span className="text-[10px] font-semibold opacity-80">Jadwal Masih Jauh</span>
            </div>
          </div>

          {/* Total Units Card */}
          <div
            onClick={() => setStatusFilter("all")}
            className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
              statusFilter === "all"
                ? "bg-slate-900 text-white border-slate-900 shadow-md shadow-slate-900/20"
                : "bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold">Total Unit Master</span>
              <Building2 className="w-3.5 h-3.5" />
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black">{totalUnits}</span>
              <span className="text-[10px] font-semibold opacity-80">Unit AC & VRV</span>
            </div>
          </div>
        </div>

        {/* Filter Row: Category & Search */}
        <div className="pt-2 border-t border-slate-100 space-y-2.5">
          {/* Quick status tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 rounded-xl font-bold transition shrink-0 border cursor-pointer ${
                statusFilter === "all"
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
              }`}
            >
              Semua Status ({totalUnits})
            </button>

            <button
              onClick={() => setStatusFilter("urgent")}
              className={`px-3 py-1.5 rounded-xl font-bold transition shrink-0 border cursor-pointer flex items-center gap-1.5 ${
                statusFilter === "urgent"
                  ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                  : "bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100"
              }`}
            >
              <span>⚠️ Perlu Cuci Segera</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-200/80 text-rose-900">
                {urgentCount}
              </span>
            </button>

            <button
              onClick={() => setStatusFilter("overdue")}
              className={`px-3 py-1.5 rounded-xl font-bold transition shrink-0 border cursor-pointer ${
                statusFilter === "overdue"
                  ? "bg-red-600 text-white border-red-600 shadow-xs"
                  : "bg-red-50 text-red-800 border-red-200 hover:bg-red-100"
              }`}
            >
              🔴 Terlambat ({overdueCount})
            </button>

            <button
              onClick={() => setStatusFilter("approaching")}
              className={`px-3 py-1.5 rounded-xl font-bold transition shrink-0 border cursor-pointer ${
                statusFilter === "approaching"
                  ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                  : "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
              }`}
            >
              🟡 Mendekati ({approachingCount})
            </button>

            <button
              onClick={() => setStatusFilter("safe")}
              className={`px-3 py-1.5 rounded-xl font-bold transition shrink-0 border cursor-pointer ${
                statusFilter === "safe"
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                  : "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
              }`}
            >
              🟢 Aman ({safeCount})
            </button>
          </div>

          {/* 5 Categories Selector + Search Input */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none text-xs flex-1">
              <button
                onClick={() => setCategoryFilter("all")}
                className={`px-2.5 py-1 rounded-lg font-bold shrink-0 border cursor-pointer ${
                  categoryFilter === "all"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                }`}
              >
                Semua Kategori
              </button>
              {AC_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-2.5 py-1 rounded-lg font-bold shrink-0 border cursor-pointer ${
                    categoryFilter === cat
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="relative sm:w-64 shrink-0">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari ruangan atau lantai..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Table View */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span>Memperhitungkan jadwal perawatan AC...</span>
          </div>
        ) : filteredList.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 space-y-1.5">
            <Layers className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="font-bold text-slate-700">Tidak ada data unit yang sesuai filter</p>
            <p className="text-[11px]">Cobalah mengubah pilihan filter atau reset kata kunci pencarian.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4 w-10 text-center">Status</th>
                  <th className="py-3 px-4">Nama / Nomor Ruangan</th>
                  <th className="py-3 px-4">Kategori Area</th>
                  <th className="py-3 px-4">Terakhir Dicuci</th>
                  <th className="py-3 px-4">Jatuh Tempo Berikutnya</th>
                  <th className="py-3 px-4 text-center">Tenggat Waktu</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredList.map((item) => {
                  const isOverdue = item.status === "overdue";
                  const isApproaching = item.status === "approaching";

                  let statusBadgeClass = "bg-emerald-50 text-emerald-800 border-emerald-200";
                  let dotClass = "bg-emerald-500";
                  if (isOverdue) {
                    statusBadgeClass = "bg-red-100 text-red-800 border-red-300 font-bold";
                    dotClass = "bg-red-600 animate-pulse";
                  } else if (isApproaching) {
                    statusBadgeClass = "bg-amber-100 text-amber-800 border-amber-300 font-bold";
                    dotClass = "bg-amber-500";
                  }

                  const formatReadableDate = (isoStr: string | null) => {
                    if (!isoStr) return "Belum Pernah";
                    const d = new Date(isoStr);
                    return d.toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    });
                  };

                  return (
                    <tr
                      key={item.unit.id}
                      className={`hover:bg-slate-50 transition group ${
                        isOverdue
                          ? "bg-red-50/25"
                          : isApproaching
                          ? "bg-amber-50/25"
                          : ""
                      }`}
                    >
                      {/* Status Indicator Icon */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block w-3 h-3 rounded-full ${dotClass}`}
                          title={item.status_label}
                        />
                      </td>

                      {/* Unit Name & Code */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{item.unit.name}</div>
                        {item.unit.code && (
                          <span className="font-mono text-[10px] text-slate-500">
                            {item.unit.code}
                          </span>
                        )}
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                          {item.unit.category}
                        </span>
                      </td>

                      {/* Last Cleaned Date */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">
                          {formatReadableDate(item.last_cleaned_date)}
                        </div>
                        {item.last_log ? (
                          <div className="text-[10px] text-slate-400">
                            Oleh: {item.last_log.user_name}
                          </div>
                        ) : (
                          <span className="text-[10px] text-red-500 font-semibold">
                            Wajib cuci perdana
                          </span>
                        )}
                      </td>

                      {/* Next Due Date */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">
                          {item.next_due_date ? formatReadableDate(item.next_due_date) : "Segera"}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Siklus: {cycleText}
                        </div>
                      </td>

                      {/* Remaining Days Badge */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${statusBadgeClass}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
                          <span>{item.status_label}</span>
                        </span>
                      </td>

                      {/* Action Button */}
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleOpenForm(item.unit.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5 shadow-xs ${
                            isOverdue
                              ? "bg-red-600 hover:bg-red-700 text-white"
                              : isApproaching
                              ? "bg-amber-600 hover:bg-amber-700 text-white"
                              : "bg-blue-600 hover:bg-blue-700 text-white"
                          }`}
                        >
                          <Thermometer className="w-3.5 h-3.5" />
                          <span>Catat Cuci</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Technician Entry Modal */}
      {modalOpen && (
        <ACLogEntryModal
          initialUnitId={targetUnitId}
          onClose={() => setModalOpen(false)}
          onSuccess={handleSuccessSave}
        />
      )}
    </div>
  );
}
