import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  CalendarClock,
  Clock,
  CheckCircle2,
  Building2,
  ChevronDown,
  ChevronUp,
  Search,
  X,
  Plus,
  AlertCircle,
  User as UserIcon,
  Thermometer,
  Wind,
  Layers,
  ExternalLink,
  Copy,
  Check,
  Key,
  Eye,
  EyeOff,
  Server,
} from "lucide-react";
import {
  ACUnitScheduleStatus,
  ACMaintenanceLog,
  REAL_FLOORS,
  RealFloor,
  resolveFloorFromUnit,
  formatUnitCycleLabel,
} from "../types";
import {
  getACScheduleOverview,
  getLocalACScheduleOverview,
  getLocalAppSettings,
} from "../supabaseService";
import { useBackHandler } from "../utils/backNavigation";

interface ACScheduleNotificationPanelProps {
  onLogSaved?: (log: ACMaintenanceLog) => void;
  onOpenACLog?: (unitId?: string) => void;
}

type ColumnKey = "overdue" | "approaching" | "safe" | "all";

export function ACScheduleNotificationPanel({
  onLogSaved: _onLogSaved,
  onOpenACLog,
}: ACScheduleNotificationPanelProps) {
  const [scheduleList, setScheduleList] = useState<ACUnitScheduleStatus[]>(() =>
    getLocalACScheduleOverview()
  );
  const [defaultCycleMonths, setDefaultCycleMonths] = useState<number>(
    () => getLocalAppSettings().ac_maintenance_cycle_months || 1
  );
  const [controllerUrl, setControllerUrl] = useState<string>(
    () => getLocalAppSettings().ac_controller_url || "http://36.91.27.90:57777/"
  );
  const [controllerLabel, setControllerLabel] = useState<string>(
    () => getLocalAppSettings().ac_controller_label || "Daikin ITM Controller"
  );
  const [controllerUser, setControllerUser] = useState<string>(
    () => getLocalAppSettings().ac_controller_user ?? ""
  );
  const [controllerPass, setControllerPass] = useState<string>(
    () => getLocalAppSettings().ac_controller_pass ?? ""
  );
  const [showControllerModal, setShowControllerModal] = useState<boolean>(false);
  const [copiedField, setCopiedField] = useState<"credential" | "user" | "pass" | null>(null);
  const [showModalPass, setShowModalPass] = useState<boolean>(false);

  // Active clicked column ("overdue" | "approaching" | "safe" | "all" | null)
  const [selectedColumn, setSelectedColumn] = useState<ColumnKey | null>(null);
  const [floorFilter, setFloorFilter] = useState<RealFloor | "all">("all");
  const [subStatusFilter, setSubStatusFilter] = useState<
    "all" | "overdue" | "approaching" | "safe" | "never"
  >("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Tombol Kembali (Back) untuk menutup modal dan daftar kolom jadwal
  useBackHandler(showControllerModal, () => setShowControllerModal(false), 20);
  useBackHandler(selectedColumn !== null, () => setSelectedColumn(null), 15);

  const loadData = useCallback(async () => {
    try {
      const statuses = await getACScheduleOverview();
      setScheduleList(statuses);
      const curSettings = getLocalAppSettings();
      setDefaultCycleMonths(curSettings.ac_maintenance_cycle_months || 1);
      setControllerUrl(curSettings.ac_controller_url || "http://36.91.27.90:57777/");
      setControllerLabel(curSettings.ac_controller_label || "Daikin ITM Controller");
      setControllerUser(curSettings.ac_controller_user ?? "");
      setControllerPass(curSettings.ac_controller_pass ?? "");
    } catch (err) {
      console.error("Gagal memuat status jadwal AC:", err);
    }
  }, []);

  useEffect(() => {
    loadData();

    const handleSynced = () => {
      setScheduleList(getLocalACScheduleOverview());
      const curSettings = getLocalAppSettings();
      setDefaultCycleMonths(curSettings.ac_maintenance_cycle_months || 1);
      setControllerUrl(curSettings.ac_controller_url || "http://36.91.27.90:57777/");
      setControllerLabel(curSettings.ac_controller_label || "Daikin ITM Controller");
      setControllerUser(curSettings.ac_controller_user ?? "");
      setControllerPass(curSettings.ac_controller_pass ?? "");
    };

    window.addEventListener("ac-data-synced", handleSynced);
    window.addEventListener("app-settings-synced", handleSynced);
    return () => {
      window.removeEventListener("ac-data-synced", handleSynced);
      window.removeEventListener("app-settings-synced", handleSynced);
    };
  }, [loadData]);

  // Lists per column
  const overdueUnits = useMemo(
    () => scheduleList.filter((s) => s.status === "overdue"),
    [scheduleList]
  );
  const approachingUnits = useMemo(
    () => scheduleList.filter((s) => s.status === "approaching"),
    [scheduleList]
  );
  const safeUnits = useMemo(
    () => scheduleList.filter((s) => s.status === "safe"),
    [scheduleList]
  );
  const neverUnits = useMemo(
    () => scheduleList.filter((s) => s.status === "never"),
    [scheduleList]
  );

  // KPIs
  const totalUnits = scheduleList.length;
  const overdueCount = overdueUnits.length;
  const approachingCount = approachingUnits.length;
  const safeCount = safeUnits.length;
  const neverCount = neverUnits.length;

  const handleSelectColumn = (col: ColumnKey) => {
    if (selectedColumn === col) {
      setSelectedColumn(null);
    } else {
      setSelectedColumn(col);
      setFloorFilter("all");
      setSubStatusFilter("all");
      setSearchQuery("");
    }
  };

  const handleHeaderClick = () => {
    if (selectedColumn !== null) {
      setSelectedColumn(null);
      return;
    }
    if (overdueCount > 0) {
      handleSelectColumn("overdue");
    } else if (approachingCount > 0) {
      handleSelectColumn("approaching");
    } else if (safeCount > 0) {
      handleSelectColumn("safe");
    } else {
      handleSelectColumn("all");
    }
  };

  // Base items for the currently clicked column
  const columnBaseItems = useMemo(() => {
    if (!selectedColumn) return [];
    switch (selectedColumn) {
      case "overdue":
        return overdueUnits;
      case "approaching":
        return approachingUnits;
      case "safe":
        return safeUnits;
      case "all":
        return scheduleList;
    }
  }, [selectedColumn, overdueUnits, approachingUnits, safeUnits, scheduleList]);

  // Floor counts within the selected column
  const floorCountsInColumn = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of columnBaseItems) {
      if (selectedColumn === "all" && subStatusFilter !== "all" && item.status !== subStatusFilter) {
        continue;
      }
      const fl = resolveFloorFromUnit(item.unit);
      counts.set(fl, (counts.get(fl) || 0) + 1);
    }
    return counts;
  }, [columnBaseItems, selectedColumn, subStatusFilter]);

  // Filtered items inside the expanded view
  const displayedItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return columnBaseItems.filter((item) => {
      if (selectedColumn === "all" && subStatusFilter !== "all" && item.status !== subStatusFilter) {
        return false;
      }
      const fl = resolveFloorFromUnit(item.unit);
      if (floorFilter !== "all" && fl !== floorFilter) {
        return false;
      }
      if (q) {
        const hay = `${item.unit.name} ${item.unit.code || ""} ${fl} ${item.unit.category || ""} ${
          item.last_log?.user_name || ""
        } ${item.unit.notes || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [columnBaseItems, selectedColumn, subStatusFilter, floorFilter, searchQuery]);

  const formatDate = (isoStr: string | null) => {
    if (!isoStr) return "Belum Pernah Dicuci";
    return new Date(isoStr).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const columnMeta: Record<
    ColumnKey,
    {
      title: string;
      subtitle: string;
      count: number;
      badgeClass: string;
      headerBgClass: string;
      emptyMessage: string;
    }
  > = {
    overdue: {
      title: "Daftar Unit Lewat Jadwal (Overdue)",
      subtitle: "Unit AC & VRV yang sudah melewati batas tanggal jatuh tempo dan wajib segera dicuci",
      count: overdueCount,
      badgeClass: "bg-red-600 text-white",
      headerBgClass: "bg-red-50/80 border-red-200 text-red-950",
      emptyMessage:
        "Tidak ada unit AC atau VRV yang lewat jadwal saat ini. Seluruh jadwal pencucian terkendali.",
    },
    approaching: {
      title: "Daftar Unit Mendekati Waktu Cuci (≤ 7 Hari)",
      subtitle: "Unit AC & VRV yang akan memasuki jadwal jatuh tempo pencucian dalam 7 hari ke depan",
      count: approachingCount,
      badgeClass: "bg-amber-600 text-white",
      headerBgClass: "bg-amber-50/80 border-amber-200 text-amber-950",
      emptyMessage:
        "Tidak ada unit AC atau VRV yang jatuh tempo dalam ≤ 7 hari ke depan.",
    },
    safe: {
      title: "Daftar Unit Kondisi Aman (Jadwal Masih Jauh)",
      subtitle: "Unit AC & VRV yang sudah dicuci dan jadwal perawatan berikutnya masih lebih dari 7 hari",
      count: safeCount,
      badgeClass: "bg-emerald-600 text-white",
      headerBgClass: "bg-emerald-50/80 border-emerald-200 text-emerald-950",
      emptyMessage:
        "Belum ada unit dengan status Kondisi Aman. Catat pencucian AC untuk memperbarui status jadwal unit.",
    },
    all: {
      title: "Daftar Seluruh Unit Master AC & VRV",
      subtitle: "Data lengkap seluruh kamar, area publik, ruang teknis, dan Outdoor VRV yang terhitung di sistem",
      count: totalUnits,
      badgeClass: "bg-slate-900 text-white",
      headerBgClass: "bg-slate-100/90 border-slate-300 text-slate-900",
      emptyMessage: "Belum ada data unit master AC yang terdaftar.",
    },
  };

  return (
    <div className="space-y-4" id="ac-schedule-notification-panel">
      {/* KPI Cards Header */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3.5 select-none"
        >
          <div
            onClick={handleHeaderClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleHeaderClick();
              }
            }}
            className="flex items-center gap-3 cursor-pointer group flex-1"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-500/20 shrink-0 group-hover:bg-blue-700 transition">
              <CalendarClock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-blue-600 transition flex items-center gap-2">
                <span>Daftar AC & VRV Mendekati Waktu Cleaning</span>
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                Klik salah satu kolom di bawah untuk menampilkan daftar data unit yang terhitung
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end pt-1 sm:pt-0 border-t border-slate-100 sm:border-0">
            {/* Tombol Pintas Opsi A: Buka Modal Akses Daikin ITM Controller */}
            {controllerUrl && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowControllerModal(true);
                  // Otomatis salin kredensial saat pop-up dibuka jika tersedia
                  const credentialToCopy = controllerUser.trim();
                  if (credentialToCopy && typeof navigator !== "undefined" && navigator.clipboard) {
                    navigator.clipboard.writeText(credentialToCopy).then(() => {
                      setCopiedField("credential");
                      setTimeout(() => setCopiedField(null), 3000);
                    }).catch(() => {});
                  }
                }}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200/90 transition shadow-2xs hover:shadow-xs cursor-pointer min-h-[34px]"
                title={`Buka ${controllerLabel} (${controllerUrl})`}
              >
                <Server className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span className="truncate max-w-[170px] sm:max-w-none">Buka {controllerLabel}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleHeaderClick}
              className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl border border-slate-200/80 transition shrink-0 cursor-pointer min-h-[34px]"
            >
              <span className="hidden sm:inline">{selectedColumn ? "Tutup Daftar" : "Lihat Data"}</span>
              {selectedColumn ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* 4 Summary Stat Cards (Clickable Columns) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 1. Overdue Card */}
          <button
            type="button"
            id="card-col-overdue"
            onClick={() => handleSelectColumn("overdue")}
            className={`p-3.5 rounded-xl border flex flex-col justify-between text-left transition-all cursor-pointer select-none ${
              selectedColumn === "overdue"
                ? "bg-red-100/90 border-red-500 text-red-950 ring-2 ring-red-500/30 shadow-md -translate-y-0.5"
                : overdueCount > 0
                ? "bg-red-50/70 border-red-200 text-red-900 hover:bg-red-100/70 hover:border-red-300 hover:shadow-xs"
                : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300 hover:shadow-xs"
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-xs font-bold">Lewat Jadwal</span>
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  overdueCount > 0 ? "bg-red-500 animate-ping" : "bg-red-400"
                }`}
              />
            </div>
            <div className="mt-2 flex items-baseline justify-between w-full">
              <span className="text-2xl font-black">{overdueCount}</span>
              <span className="text-[10px] font-semibold opacity-80 flex items-center gap-0.5">
                <span>Wajib Segera Cuci</span>
                {selectedColumn === "overdue" ? (
                  <ChevronUp className="w-3 h-3 ml-0.5" />
                ) : (
                  <ChevronDown className="w-3 h-3 ml-0.5 opacity-70" />
                )}
              </span>
            </div>
          </button>

          {/* 2. Approaching Card */}
          <button
            type="button"
            id="card-col-approaching"
            onClick={() => handleSelectColumn("approaching")}
            className={`p-3.5 rounded-xl border flex flex-col justify-between text-left transition-all cursor-pointer select-none ${
              selectedColumn === "approaching"
                ? "bg-amber-100/90 border-amber-500 text-amber-950 ring-2 ring-amber-500/30 shadow-md -translate-y-0.5"
                : approachingCount > 0
                ? "bg-amber-50/70 border-amber-200 text-amber-900 hover:bg-amber-100/70 hover:border-amber-300 hover:shadow-xs"
                : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300 hover:shadow-xs"
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-xs font-bold">Mendekati Waktu Cuci</span>
              <Clock className="w-3.5 h-3.5" />
            </div>
            <div className="mt-2 flex items-baseline justify-between w-full">
              <span className="text-2xl font-black">{approachingCount}</span>
              <span className="text-[10px] font-semibold opacity-80 flex items-center gap-0.5">
                <span>&le; 7 Hari Lagi</span>
                {selectedColumn === "approaching" ? (
                  <ChevronUp className="w-3 h-3 ml-0.5" />
                ) : (
                  <ChevronDown className="w-3 h-3 ml-0.5 opacity-70" />
                )}
              </span>
            </div>
          </button>

          {/* 3. Safe Card */}
          <button
            type="button"
            id="card-col-safe"
            onClick={() => handleSelectColumn("safe")}
            className={`p-3.5 rounded-xl border flex flex-col justify-between text-left transition-all cursor-pointer select-none ${
              selectedColumn === "safe"
                ? "bg-emerald-100/90 border-emerald-500 text-emerald-950 ring-2 ring-emerald-500/30 shadow-md -translate-y-0.5"
                : "bg-emerald-50/70 border-emerald-200 text-emerald-900 hover:bg-emerald-100/70 hover:border-emerald-300 hover:shadow-xs"
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-xs font-bold">Kondisi Aman</span>
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
            <div className="mt-2 flex items-baseline justify-between w-full">
              <span className="text-2xl font-black">{safeCount}</span>
              <span className="text-[10px] font-semibold opacity-80 flex items-center gap-0.5">
                <span>Jadwal Masih Jauh</span>
                {selectedColumn === "safe" ? (
                  <ChevronUp className="w-3 h-3 ml-0.5" />
                ) : (
                  <ChevronDown className="w-3 h-3 ml-0.5 opacity-70" />
                )}
              </span>
            </div>
          </button>

          {/* 4. Total Units Card */}
          <button
            type="button"
            id="card-col-total"
            onClick={() => handleSelectColumn("all")}
            className={`p-3.5 rounded-xl border flex flex-col justify-between text-left transition-all cursor-pointer select-none ${
              selectedColumn === "all"
                ? "bg-slate-800 text-white border-blue-500 ring-2 ring-blue-500/40 shadow-lg -translate-y-0.5"
                : "bg-slate-900 text-white border-slate-900 shadow-md shadow-slate-900/20 hover:bg-slate-800"
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-xs font-bold">Total Unit Master</span>
              <Building2 className="w-3.5 h-3.5" />
            </div>
            <div className="mt-2 flex items-baseline justify-between w-full">
              <span className="text-2xl font-black">{totalUnits}</span>
              <span className="text-[10px] font-semibold opacity-80 flex items-center gap-0.5">
                <span>Unit AC & VRV</span>
                {selectedColumn === "all" ? (
                  <ChevronUp className="w-3 h-3 ml-0.5" />
                ) : (
                  <ChevronDown className="w-3 h-3 ml-0.5 opacity-70" />
                )}
              </span>
            </div>
          </button>
        </div>

        {/* EXPANDED DATA PANEL WHEN A COLUMN IS CLICKED */}
        {selectedColumn && (
          <div className="pt-2 border-t border-slate-200/80 space-y-3 animate-in fade-in duration-150">
            {/* Active Column Banner */}
            <div
              className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${columnMeta[selectedColumn].headerBgClass}`}
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs sm:text-sm font-extrabold">
                    {columnMeta[selectedColumn].title}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-black ${columnMeta[selectedColumn].badgeClass}`}
                  >
                    {columnMeta[selectedColumn].count} Unit
                  </span>
                </div>
                <p className="text-[11px] opacity-80">
                  {columnMeta[selectedColumn].subtitle}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedColumn(null)}
                className="self-end sm:self-center px-3 py-1.5 rounded-lg bg-white/90 hover:bg-white text-slate-700 border border-slate-200 text-xs font-bold flex items-center gap-1 shadow-2xs transition cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
                <span>Tutup Daftar</span>
              </button>
            </div>

            {/* Sub-status filter pills when viewing "Total Unit Master" */}
            {selectedColumn === "all" && (
              <div className="flex items-center gap-1.5 flex-wrap text-xs">
                <span className="text-[11px] font-bold text-slate-500 mr-1">
                  Rincian Status:
                </span>
                <button
                  type="button"
                  onClick={() => setSubStatusFilter("all")}
                  className={`px-2.5 py-1 rounded-lg font-bold border transition cursor-pointer ${
                    subStatusFilter === "all"
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  Semua ({totalUnits})
                </button>
                <button
                  type="button"
                  onClick={() => setSubStatusFilter("overdue")}
                  className={`px-2.5 py-1 rounded-lg font-bold border transition cursor-pointer ${
                    subStatusFilter === "overdue"
                      ? "bg-red-600 text-white border-red-600"
                      : "bg-red-50 text-red-800 border-red-200 hover:bg-red-100"
                  }`}
                >
                  Lewat Jadwal ({overdueCount})
                </button>
                <button
                  type="button"
                  onClick={() => setSubStatusFilter("approaching")}
                  className={`px-2.5 py-1 rounded-lg font-bold border transition cursor-pointer ${
                    subStatusFilter === "approaching"
                      ? "bg-amber-600 text-white border-amber-600"
                      : "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
                  }`}
                >
                  Mendekati Cuci ({approachingCount})
                </button>
                <button
                  type="button"
                  onClick={() => setSubStatusFilter("safe")}
                  className={`px-2.5 py-1 rounded-lg font-bold border transition cursor-pointer ${
                    subStatusFilter === "safe"
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                  }`}
                >
                  Kondisi Aman ({safeCount})
                </button>
                {neverCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setSubStatusFilter("never")}
                    className={`px-2.5 py-1 rounded-lg font-bold border transition cursor-pointer ${
                      subStatusFilter === "never"
                        ? "bg-slate-700 text-white border-slate-700"
                        : "bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200"
                    }`}
                  >
                    Belum Pernah Dicuci ({neverCount})
                  </button>
                )}
              </div>
            )}

            {/* Filter Lantai & Pencarian Cepat (apabila ada unit di kolom ini) */}
            {columnBaseItems.length > 0 && (
              <div className="space-y-2.5 bg-slate-50/80 p-3 rounded-xl border border-slate-200/80">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Cari nomor kamar, nama ruangan, lantai, atau teknisi..."
                      className="w-full pl-8 pr-8 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="text-[11px] font-bold text-slate-600 shrink-0">
                    Menampilkan{" "}
                    <span className="text-slate-900 font-black">{displayedItems.length}</span> dari{" "}
                    <span className="text-slate-900 font-black">{columnBaseItems.length}</span> unit
                  </div>
                </div>

                {/* Floor Pills with counts */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px]">
                  <button
                    type="button"
                    onClick={() => setFloorFilter("all")}
                    className={`px-2.5 py-1 rounded-lg font-bold shrink-0 border transition cursor-pointer ${
                      floorFilter === "all"
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    Semua Lantai ({columnBaseItems.length})
                  </button>
                  {REAL_FLOORS.map((fl) => {
                    const c = floorCountsInColumn.get(fl) || 0;
                    if (c === 0) return null;
                    return (
                      <button
                        key={fl}
                        type="button"
                        onClick={() => setFloorFilter(fl)}
                        className={`px-2.5 py-1 rounded-lg font-bold shrink-0 border transition cursor-pointer ${
                          floorFilter === fl
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {fl} ({c})
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Empty State or Data Table */}
            {columnBaseItems.length === 0 ? (
              <div className="p-8 rounded-xl border border-slate-200 bg-slate-50/50 text-center space-y-2.5">
                <div className="w-10 h-10 rounded-xl bg-slate-200/70 text-slate-500 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs sm:text-sm font-bold text-slate-800">
                    0 Unit pada Kolom Ini
                  </p>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    {columnMeta[selectedColumn].emptyMessage}
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
                  {safeCount > 0 && selectedColumn !== "safe" && (
                    <button
                      type="button"
                      onClick={() => handleSelectColumn("safe")}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer"
                    >
                      Lihat Kondisi Aman ({safeCount})
                    </button>
                  )}
                  {selectedColumn !== "all" && (
                    <button
                      type="button"
                      onClick={() => handleSelectColumn("all")}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition cursor-pointer"
                    >
                      Lihat Total Unit Master ({totalUnits})
                    </button>
                  )}
                </div>
              </div>
            ) : displayedItems.length === 0 ? (
              <div className="p-6 rounded-xl border border-slate-200 bg-slate-50 text-center space-y-2">
                <Layers className="w-6 h-6 text-slate-400 mx-auto" />
                <p className="text-xs font-bold text-slate-700">
                  Tidak ada unit yang cocok dengan filter lantai / kata kunci pencarian.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setFloorFilter("all");
                    setSubStatusFilter("all");
                    setSearchQuery("");
                  }}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold cursor-pointer"
                >
                  Reset Filter Daftar
                </button>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-100/95 text-slate-700 sticky top-0 z-10 border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3 font-extrabold w-10 text-center">No</th>
                        <th className="py-2.5 px-3 font-extrabold">Kamar / Unit AC</th>
                        <th className="py-2.5 px-3 font-extrabold">Lantai & Kategori</th>
                        <th className="py-2.5 px-3 font-extrabold">Durasi Siklus</th>
                        <th className="py-2.5 px-3 font-extrabold">Terakhir Dicuci</th>
                        <th className="py-2.5 px-3 font-extrabold">Jatuh Tempo</th>
                        <th className="py-2.5 px-3 font-extrabold">Status Jadwal</th>
                        {onOpenACLog && (
                          <th className="py-2.5 px-3 font-extrabold text-right">Aksi</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {displayedItems.map((item, idx) => {
                        const unit = item.unit;
                        const floor = resolveFloorFromUnit(unit);
                        const isOverdue = item.status === "overdue";
                        const isApproaching = item.status === "approaching";
                        const isSafe = item.status === "safe";

                        let badgeClass =
                          "bg-slate-100 text-slate-700 border-slate-200";
                        if (isOverdue) {
                          badgeClass =
                            "bg-red-50 text-red-800 border-red-200 font-bold";
                        } else if (isApproaching) {
                          badgeClass =
                            "bg-amber-50 text-amber-800 border-amber-200 font-bold";
                        } else if (isSafe) {
                          badgeClass =
                            "bg-emerald-50 text-emerald-800 border-emerald-200 font-bold";
                        }

                        return (
                          <tr
                            key={unit.id}
                            className="hover:bg-blue-50/40 transition"
                          >
                            <td className="py-2.5 px-3 text-center font-bold text-slate-400">
                              {idx + 1}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-extrabold text-slate-900">
                                {unit.name}
                              </div>
                              {unit.code && (
                                <div className="text-[10px] font-mono text-slate-400">
                                  {unit.code}
                                </div>
                              )}
                              {unit.notes && (
                                <div className="text-[10px] text-slate-500 italic line-clamp-1">
                                  {unit.notes}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                {floor}
                              </span>
                              <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                                {unit.category}
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                  unit.cycle_months || unit.cycle_days
                                    ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                    : "bg-slate-50 text-slate-600 border-slate-200"
                                }`}
                              >
                                <Clock className="w-2.5 h-2.5" />
                                {formatUnitCycleLabel(unit, defaultCycleMonths)}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-slate-800">
                                {formatDate(item.last_cleaned_date)}
                              </div>
                              {item.last_log && (
                                <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5 flex-wrap">
                                  <span className="inline-flex items-center gap-0.5 font-medium text-slate-600">
                                    <UserIcon className="w-2.5 h-2.5" />
                                    {item.last_log.user_name}
                                  </span>
                                  <span className="inline-flex items-center gap-0.5 text-blue-600 font-semibold">
                                    <Thermometer className="w-2.5 h-2.5" />
                                    {item.last_log.temp_after}°C
                                  </span>
                                  <span className="inline-flex items-center gap-0.5 text-emerald-600 font-semibold">
                                    <Wind className="w-2.5 h-2.5" />
                                    {item.last_log.anemo_after} m/s
                                  </span>
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`font-bold ${
                                  isOverdue
                                    ? "text-red-600"
                                    : isApproaching
                                    ? "text-amber-600"
                                    : "text-slate-700"
                                }`}
                              >
                                {item.next_due_date
                                  ? formatDate(item.next_due_date)
                                  : "-"}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] border ${badgeClass}`}
                              >
                                {isOverdue && (
                                  <AlertCircle className="w-3 h-3 text-red-600 shrink-0" />
                                )}
                                {isApproaching && (
                                  <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                                )}
                                {isSafe && (
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                                )}
                                <span>{item.status_label}</span>
                              </span>
                            </td>
                            {onOpenACLog && (
                              <td className="py-2.5 px-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => onOpenACLog(unit.id)}
                                  className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold inline-flex items-center gap-1 shadow-2xs transition cursor-pointer whitespace-nowrap"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>Catat Cuci</span>
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Akses Daikin ITM Controller (Opsi A) */}
      {showControllerModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
          onClick={() => setShowControllerModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-sm">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <span>Akses {controllerLabel}</span>
                  </h3>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    Sistem Kontroler Sentral AC & VRV Hotel
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowControllerModal(false)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
                title="Tutup (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 space-y-4 text-xs">
              {/* Target URL Info */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                    Alamat Server Controller
                  </span>
                  <span className="font-mono font-semibold text-slate-800 text-[11px] truncate block mt-0.5">
                    {controllerUrl}
                  </span>
                </div>
                <a
                  href={controllerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 text-[11px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg shrink-0 inline-flex items-center gap-1 transition cursor-pointer"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Buka</span>
                </a>
              </div>

              {/* Status Banner Notifikasi Salin Otomatis */}
              <div
                className={`p-3 rounded-xl border transition-all flex items-start gap-2.5 ${
                  copiedField
                    ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                    : "bg-blue-50/70 border-blue-200 text-blue-900"
                }`}
              >
                {copiedField ? (
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <Key className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-bold text-[11px]">
                    {copiedField
                      ? "Kredensial berhasil disalin ke Clipboard!"
                      : controllerUser.trim()
                      ? "User & Password otomatis siap disalin"
                      : "Kredensial login belum disetel oleh Admin"}
                  </p>
                  <p className="text-[10px] opacity-90 mt-0.5 leading-relaxed">
                    {controllerUser.trim() && controllerUser.trim() === controllerPass.trim()
                      ? "Karena Username dan Password disetel sama persis, cukup tekan tombol Salin dan langsung paste di kotak User maupun Sandi pada web Daikin."
                      : controllerUser.trim()
                      ? "Salin Username atau Sandi di bawah ini untuk ditempelkan pada form login Daikin."
                      : "Admin belum mengisi username/password di Pengaturan. Anda tetap dapat membuka web Daikin dan mengetik langsung."}
                  </p>
                </div>
              </div>

              {/* Credential Box */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                    Kredensial Login
                  </span>
                  {controllerUser.trim() && controllerUser.trim() === controllerPass.trim() && (
                    <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-full border border-indigo-200/80">
                      User & Sandi Sama
                    </span>
                  )}
                </div>

                {!controllerUser.trim() && !controllerPass.trim() ? (
                  <div className="bg-white p-3 rounded-xl border border-slate-200 text-center text-slate-500">
                    <p className="text-xs">Belum ada kredensial yang disimpan.</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Admin dapat mengisinya melalui menu <strong>Pengaturan</strong>.
                    </p>
                  </div>
                ) : controllerUser.trim() === controllerPass.trim() ? (
                  /* Single Unified Credential Card (User & Pass are identical) */
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-500 font-semibold">
                        Teks Kredensial (User & Sandi):
                      </span>
                      <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-xs">
                        {controllerUser}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const val = controllerUser.trim();
                        if (val && typeof navigator !== "undefined" && navigator.clipboard) {
                          navigator.clipboard.writeText(val).then(() => {
                            setCopiedField("credential");
                            setTimeout(() => setCopiedField(null), 3000);
                          });
                        }
                      }}
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      {copiedField === "credential" ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-300" />
                          <span>Tersalin ke Clipboard!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>Salin Kredensial ({controllerUser})</span>
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  /* Dual Credential Display (if user and pass ever differ) */
                  <div className="space-y-2">
                    {/* Username row */}
                    {controllerUser.trim() && (
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-slate-400 block font-semibold">Username:</span>
                          <span className="font-mono font-bold text-slate-800 text-xs">
                            {controllerUser}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(controllerUser);
                            setCopiedField("user");
                            setTimeout(() => setCopiedField(null), 3000);
                          }}
                          className="px-2.5 py-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg flex items-center gap-1 transition"
                        >
                          {copiedField === "user" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedField === "user" ? "Tersalin" : "Salin"}</span>
                        </button>
                      </div>
                    )}

                    {/* Password row */}
                    {controllerPass.trim() && (
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div>
                            <span className="text-[10px] text-slate-400 block font-semibold">Password:</span>
                            <span className="font-mono font-bold text-slate-800 text-xs">
                              {showModalPass ? controllerPass : "••••••••"}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowModalPass(!showModalPass)}
                            className="text-slate-400 hover:text-slate-600 ml-1"
                          >
                            {showModalPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(controllerPass);
                            setCopiedField("pass");
                            setTimeout(() => setCopiedField(null), 3000);
                          }}
                          className="px-2.5 py-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg flex items-center gap-1 transition"
                        >
                          {copiedField === "pass" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedField === "pass" ? "Tersalin" : "Salin"}</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const val = controllerUser.trim();
                    if (val && typeof navigator !== "undefined" && navigator.clipboard) {
                      navigator.clipboard.writeText(val);
                    }
                    window.open(controllerUrl, "_blank", "noopener,noreferrer");
                    setShowControllerModal(false);
                  }}
                  className="w-full sm:flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>{controllerUser.trim() ? "Salin & Buka Web Daikin ITM ↗" : "Buka Web Daikin ITM ↗"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowControllerModal(false)}
                  className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
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
