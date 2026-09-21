import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Search,
  X,
  Plus,
  Layers,
  Clock,
  CheckCircle2,
  AlertCircle,
  Building2,
  Filter,
  Thermometer,
  Wind,
  Calendar,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import {
  ACCategory,
  AC_CATEGORIES,
  ACUnitScheduleStatus,
  REAL_FLOORS,
  RealFloor,
  resolveFloorFromUnit,
  ACMaintenanceLog,
  normalizeACCategory,
} from "../types";
import { getACScheduleOverview } from "../supabaseService";

interface ACSearchModeProps {
  onOpenACLog: (unitId?: string) => void;
}

export function ACSearchMode({ onOpenACLog }: ACSearchModeProps) {
  const [scheduleList, setScheduleList] = useState<ACUnitScheduleStatus[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Search query & filters
  const [query, setQuery] = useState<string>("");
  const [selectedFloor, setSelectedFloor] = useState<RealFloor | "all">("all");
  const [selectedCategory, setSelectedCategory] = useState<ACCategory | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "urgent" | "overdue" | "approaching" | "safe">("all");

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const data = await getACScheduleOverview();
        if (mounted) setScheduleList(data);
      } catch (e) {
        console.error("Gagal memuat jadwal AC:", e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Filtered and searched data
  const filteredList = useMemo(() => {
    return scheduleList.filter((item) => {
      const unit = item.unit;
      const unitFloor = resolveFloorFromUnit(unit);

      // Floor Filter
      if (selectedFloor !== "all" && unitFloor !== selectedFloor) {
        return false;
      }

      // Category Filter
      if (selectedCategory !== "all" && normalizeACCategory(unit.category) !== selectedCategory) {
        return false;
      }

      // Status Filter
      if (statusFilter === "urgent") {
        if (item.status !== "overdue" && item.status !== "approaching") return false;
      } else if (statusFilter !== "all" && item.status !== statusFilter) {
        return false;
      }

      // Real-time Text Search (matches room number, area name, code, notes, floor)
      if (query.trim()) {
        const q = query.toLowerCase().trim();
        const matchName = unit.name.toLowerCase().includes(q);
        const matchCode = unit.code ? unit.code.toLowerCase().includes(q) : false;
        const matchCat =
          normalizeACCategory(unit.category).toLowerCase().includes(q) ||
          unit.category.toLowerCase().includes(q);
        const matchFloor = unitFloor.toLowerCase().includes(q);
        const matchNotes = unit.notes ? unit.notes.toLowerCase().includes(q) : false;
        if (!matchName && !matchCode && !matchCat && !matchFloor && !matchNotes) return false;
      }

      return true;
    });
  }, [scheduleList, query, selectedFloor, selectedCategory, statusFilter]);

  const handleResetFilters = () => {
    setQuery("");
    setSelectedFloor("all");
    setSelectedCategory("all");
    setStatusFilter("all");
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const formatDate = (isoStr: string | null) => {
    if (!isoStr) return "Belum Ada Data";
    return new Date(isoStr).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-4 pb-24" id="ac-quick-search-mode">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-500/20 shrink-0">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Mode Pencarian Area & Kamar AC
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Cari nomor kamar atau area hotel secara langsung dan catat cuci AC seketika
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onOpenACLog()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-blue-500/20 flex items-center justify-center gap-1.5 transition min-h-[42px] shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Catat Cuci AC</span>
          </button>
        </div>

        {/* Search Input Bar (Prominent & Real-time) */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
          <input
            ref={searchInputRef}
            id="search-mode-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ketik nomor kamar (misal: 502, 301) atau area (Meeting, Server, VRV)..."
            className="w-full pl-10 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white transition min-h-[46px]"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 p-1 rounded-full transition cursor-pointer"
              title="Hapus pencarian"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Quick Floor Tabs Bar */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Filter Lantai:
            </span>
            {selectedFloor !== "all" && (
              <button
                type="button"
                onClick={() => setSelectedFloor("all")}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
              >
                Reset Lantai
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
            <button
              type="button"
              onClick={() => setSelectedFloor("all")}
              className={`px-3 py-1.5 rounded-xl font-bold shrink-0 transition border cursor-pointer ${
                selectedFloor === "all"
                  ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
              }`}
            >
              Semua Lantai
            </button>
            {REAL_FLOORS.map((floor) => (
              <button
                key={floor}
                type="button"
                onClick={() => setSelectedFloor(floor)}
                className={`px-3 py-1.5 rounded-xl font-bold shrink-0 transition border cursor-pointer ${
                  selectedFloor === floor
                    ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
              >
                {floor}
              </button>
            ))}
          </div>
        </div>

        {/* Quick Category & Status Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs border-t border-slate-100">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1">
            Status:
          </span>
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`px-2.5 py-1 rounded-lg font-bold border transition cursor-pointer ${
              statusFilter === "all"
                ? "bg-slate-800 text-white border-slate-800"
                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
            }`}
          >
            Semua
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("overdue")}
            className={`px-2.5 py-1 rounded-lg font-bold border transition cursor-pointer ${
              statusFilter === "overdue"
                ? "bg-red-600 text-white border-red-600 shadow-xs"
                : "bg-red-50 text-red-800 border-red-200 hover:bg-red-100"
            }`}
          >
            🔴 Terlambat
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("approaching")}
            className={`px-2.5 py-1 rounded-lg font-bold border transition cursor-pointer ${
              statusFilter === "approaching"
                ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                : "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
            }`}
          >
            🟡 Mendekati
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("safe")}
            className={`px-2.5 py-1 rounded-lg font-bold border transition cursor-pointer ${
              statusFilter === "safe"
                ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                : "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
            }`}
          >
            🟢 Aman
          </button>

          <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />

          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1">
            Kategori:
          </span>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as ACCategory | "all")}
            className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Semua Kategori</option>
            {AC_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between px-1 text-xs">
        <div className="font-semibold text-slate-600">
          Ditemukan <strong className="text-slate-900">{filteredList.length}</strong> unit kamar & area
          {query.trim() && (
            <span>
              {" "}
              untuk kata kunci &ldquo;<strong className="text-blue-600">{query}</strong>&rdquo;
            </span>
          )}
          {selectedFloor !== "all" && (
            <span>
              {" "}
              di <strong className="text-slate-900">{selectedFloor}</strong>
            </span>
          )}
        </div>

        {(query.trim() || selectedFloor !== "all" || selectedCategory !== "all" || statusFilter !== "all") && (
          <button
            type="button"
            onClick={handleResetFilters}
            className="font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Filter</span>
          </button>
        )}
      </div>

      {/* Results Grid / List */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-xs text-slate-500 space-y-2">
          <div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="font-semibold text-slate-700">Mencari data kamar & AC...</p>
        </div>
      ) : filteredList.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">
              Tidak ada kamar atau area yang cocok
            </h3>
            <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
              Periksa kembali nomor kamar atau kata kunci pencarian Anda, atau reset filter lantai yang sedang aktif.
            </p>
          </div>
          <button
            type="button"
            onClick={handleResetFilters}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-sm transition cursor-pointer"
          >
            Reset Pencarian
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredList.map((item) => {
            const unit = item.unit;
            const floor = resolveFloorFromUnit(unit);
            const isOverdue = item.status === "overdue";
            const isApproaching = item.status === "approaching";

            let statusBorder = "border-slate-200 hover:border-slate-300";
            let statusBadge = "bg-emerald-50 text-emerald-800 border-emerald-200";
            const statusText = item.status_label;

            if (isOverdue) {
              statusBorder = "border-red-200 hover:border-red-300 bg-red-50/10";
              statusBadge = "bg-red-50 text-red-800 border-red-200 font-bold";
            } else if (isApproaching) {
              statusBorder = "border-amber-200 hover:border-amber-300 bg-amber-50/10";
              statusBadge = "bg-amber-50 text-amber-800 border-amber-200 font-bold";
            } else if (item.status === "never") {
              statusBadge = "bg-slate-100 text-slate-700 border-slate-200 font-medium";
            }

            return (
              <div
                key={unit.id}
                className={`bg-white rounded-2xl border ${statusBorder} p-4 shadow-xs hover:shadow-md transition flex flex-col justify-between space-y-3`}
              >
                {/* Top Info: Room Name, Floor, Category */}
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900 leading-tight">
                        {unit.name}
                      </h3>
                      {unit.code && (
                        <span className="font-mono text-[10px] text-slate-400 block mt-0.5">
                          {unit.code}
                        </span>
                      )}
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                      {floor}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-700">
                      {unit.category}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] border ${statusBadge}`}
                    >
                      {isOverdue && <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping" />}
                      {isApproaching && <Clock className="w-3 h-3" />}
                      {!isOverdue && !isApproaching && item.status === "safe" && (
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      )}
                      <span>{statusText}</span>
                    </span>
                  </div>

                  {unit.notes && (
                    <p className="text-[11px] text-slate-500 italic line-clamp-1">
                      {unit.notes}
                    </p>
                  )}
                </div>

                {/* Maintenance Dates */}
                <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100 text-[11px] space-y-1">
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="text-slate-400">Terakhir Dicuci:</span>
                    <span className="font-bold text-slate-800">
                      {formatDate(item.last_cleaned_date)}
                    </span>
                  </div>
                  {item.last_log && (
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>Teknisi:</span>
                      <span className="font-medium text-slate-700">{item.last_log.user_name}</span>
                    </div>
                  )}
                  {item.next_due_date && (
                    <div className="flex items-center justify-between text-slate-600 border-t border-slate-200/60 pt-1 mt-1">
                      <span className="text-slate-400">Jatuh Tempo:</span>
                      <span
                        className={`font-bold ${
                          isOverdue
                            ? "text-red-600"
                            : isApproaching
                            ? "text-amber-600"
                            : "text-slate-700"
                        }`}
                      >
                        {formatDate(item.next_due_date)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Quick Action: Catat Cuci AC for THIS Unit */}
                <button
                  type="button"
                  onClick={() => onOpenACLog(unit.id)}
                  className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-bold shadow-sm shadow-blue-500/20 flex items-center justify-center gap-1.5 transition min-h-[40px] cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Catat Cuci Kamar Ini</span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
