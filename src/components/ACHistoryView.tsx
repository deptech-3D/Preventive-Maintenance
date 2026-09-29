import React, { useState, useEffect, useCallback } from "react";
import {
  Thermometer,
  Wind,
  Search,
  Calendar,
  Clock,
  User as UserIcon,
  Download,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  Building2,
  Trash2,
  Eye,
  X,
  FileSpreadsheet,
  RefreshCw,
  Plus,
  Layers,
  FileText,
  CheckSquare,
  Square,
  Camera,
  Users,
  UserPlus,
  Pencil,
  ExternalLink,
} from "lucide-react";
import {
  ACCategory,
  AC_CATEGORIES,
  ACMaintenanceLog,
  ACUnitLocation,
  normalizeACCategory,
} from "../types";
import { useAuth } from "../auth";
import {
  fetchACMaintenanceLogs,
  fetchACUnits,
  getLocalACLogs,
  getLocalACUnits,
  updateACMaintenanceLog,
  deleteACMaintenanceLog,
  deleteBulkACMaintenanceLogs,
  clearAllACMaintenanceLogs,
  exportACLogsToExcel,
  copyACLogsToClipboardAsTsv,
  fetchUsers,
  getRegisteredUserOptions,
  parseTechnicianNames,
  formatTechnicianNames,
} from "../supabaseService";
import { ACLogEntryModal } from "./ACLogEntryModal";
import {
  scoreLogSmartMatch,
  getSmartUnitSuggestions,
} from "../utils/smartSearch";
import { resolveFloorFromUnit } from "../types";
import { useBackHandler } from "../utils/backNavigation";
import {
  getPhotoDisplayUrl,
  getPhotoViewLink,
  isGoogleDrivePhotoUrl,
} from "../utils/googleDrivePhoto";

export function ACHistoryView() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || !user;
  const [logs, setLogs] = useState<ACMaintenanceLog[]>(() => getLocalACLogs());
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Registered Users / Technicians for Admin selection (1 or 2 names)
  const [registeredUsers, setRegisteredUsers] = useState<
    Array<{ user_id: string; name: string; role: "admin" | "user" }>
  >(() => getRegisteredUserOptions());
  const [editingTechLog, setEditingTechLog] = useState<ACMaintenanceLog | null>(null);
  const [editTech1, setEditTech1] = useState<string>("");
  const [editTech2, setEditTech2] = useState<string>("");
  const [savingTech, setSavingTech] = useState<boolean>(false);

  // Admin Edit Tanggal & Kamar / Unit State
  const [masterUnits, setMasterUnits] = useState<ACUnitLocation[]>(() => getLocalACUnits());
  const [editingDateUnitLog, setEditingDateUnitLog] = useState<ACMaintenanceLog | null>(null);
  const [editDateStr, setEditDateStr] = useState<string>("");
  const [editTimeStr, setEditTimeStr] = useState<string>("");
  const [editUnitId, setEditUnitId] = useState<string>("");
  const [editUnitName, setEditUnitName] = useState<string>("");
  const [editCategory, setEditCategory] = useState<ACCategory>("Area Privat / Kamar Hotel");
  const [editUnitSearch, setEditUnitSearch] = useState<string>("");
  const [savingDateUnit, setSavingDateUnit] = useState<boolean>(false);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState<ACCategory | "all">("all");
  const [dateFilter, setDateFilter] = useState<"today" | "7d" | "30d" | "all">("30d");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Modals & Selection
  const [selectedLog, setSelectedLog] = useState<ACMaintenanceLog | null>(null);
  const [viewingPhoto, setViewingPhoto] = useState<{ title: string; src: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ACMaintenanceLog | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState<boolean>(false);
  const [showClearAllModal, setShowClearAllModal] = useState<boolean>(false);
  const [clearingAll, setClearingAll] = useState<boolean>(false);

  // Tombol Kembali (Back) untuk menutup modal secara bertingkat dari yang paling atas
  useBackHandler(Boolean(selectedLog), () => setSelectedLog(null), 20);
  useBackHandler(Boolean(editingTechLog), () => setEditingTechLog(null), 30);
  useBackHandler(Boolean(editingDateUnitLog), () => setEditingDateUnitLog(null), 30);
  useBackHandler(Boolean(deleteTarget), () => setDeleteTarget(null), 30);
  useBackHandler(showBulkDeleteModal, () => setShowBulkDeleteModal(false), 30);
  useBackHandler(showClearAllModal, () => setShowClearAllModal(false), 30);
  useBackHandler(Boolean(viewingPhoto), () => setViewingPhoto(null), 40);

  // Clipboard & Excel state
  const [copiedTsv, setCopiedTsv] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    try {
      const data = await fetchACMaintenanceLogs();
      setLogs(data);
    } catch (err) {
      console.error("Gagal memuat log perawatan AC:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
    fetchACUnits()
      .then((uList) => {
        if (uList.length > 0) setMasterUnits(uList);
      })
      .catch(() => {});
    fetchUsers()
      .then((list) => {
        if (list.length > 0) {
          setRegisteredUsers(getRegisteredUserOptions(list));
        }
      })
      .catch(() => {});

    const handleSynced = () => {
      setLogs(getLocalACLogs());
      setMasterUnits(getLocalACUnits());
    };
    const handleUsersSynced = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      setRegisteredUsers(getRegisteredUserOptions(Array.isArray(detail) ? detail : undefined));
    };
    window.addEventListener("ac-data-synced", handleSynced);
    window.addEventListener("users-data-synced", handleUsersSynced);
    return () => {
      window.removeEventListener("ac-data-synced", handleSynced);
      window.removeEventListener("users-data-synced", handleUsersSynced);
    };
  }, [loadLogs]);

  const openEditTechModal = (log: ACMaintenanceLog) => {
    const [t1, t2] = parseTechnicianNames(log.user_name);
    setEditTech1(t1 || registeredUsers[0]?.name || "");
    setEditTech2(t2 || "");
    setEditingTechLog(log);
  };

  const handleQuickToggleEditTech = (name: string) => {
    if (editTech1.toLowerCase() === name.toLowerCase()) {
      if (editTech2) {
        setEditTech1(editTech2);
        setEditTech2("");
      }
    } else if (editTech2.toLowerCase() === name.toLowerCase()) {
      setEditTech2("");
    } else if (!editTech1) {
      setEditTech1(name);
    } else if (!editTech2) {
      setEditTech2(name);
    } else {
      setEditTech2(name);
    }
  };

  const handleSaveTechNames = async () => {
    if (!editingTechLog) return;
    const combined = formatTechnicianNames(editTech1, editTech2);
    const targetId = editingTechLog.log_id;
    const targetUnit = editingTechLog.unit_name;

    try {
      setSavingTech(true);
      setLogs((prev) =>
        prev.map((l) => (l.log_id === targetId ? { ...l, user_name: combined } : l))
      );
      if (selectedLog?.log_id === targetId) {
        setSelectedLog((prev) => (prev ? { ...prev, user_name: combined } : null));
      }
      await updateACMaintenanceLog(targetId, { user_name: combined });
      setEditingTechLog(null);
      setToastMsg(
        `Nama teknisi untuk ${targetUnit} berhasil disimpan: ${combined}`
      );
      setTimeout(() => setToastMsg(null), 3500);
    } catch (err: any) {
      alert(err.message || "Gagal memperbarui nama teknisi");
      await loadLogs();
    } finally {
      setSavingTech(false);
    }
  };

  const toLocalDateAndTime = (isoString: string): { date: string; time: string } => {
    const d = new Date(isoString);
    const valid = isNaN(d.getTime()) ? new Date() : d;
    const pad = (n: number) => String(n).padStart(2, "0");
    return {
      date: `${valid.getFullYear()}-${pad(valid.getMonth() + 1)}-${pad(valid.getDate())}`,
      time: `${pad(valid.getHours())}:${pad(valid.getMinutes())}`,
    };
  };

  const openEditDateUnitModal = (log: ACMaintenanceLog) => {
    setMasterUnits(getLocalACUnits());
    const { date, time } = toLocalDateAndTime(log.recorded_at);
    setEditDateStr(date);
    setEditTimeStr(time);
    setEditUnitId(log.unit_id || "");
    setEditUnitName(log.unit_name || "");
    setEditCategory(normalizeACCategory(log.category));
    setEditUnitSearch("");
    setEditingDateUnitLog(log);
  };

  const editUnitSuggestions = React.useMemo(() => {
    if (!editUnitSearch.trim()) return [];
    return getSmartUnitSuggestions(masterUnits, (u) => u, editUnitSearch, 12);
  }, [masterUnits, editUnitSearch]);

  const handleSelectEditMasterUnit = (u: ACUnitLocation) => {
    setEditUnitId(u.id);
    setEditUnitName(u.name);
    setEditCategory(normalizeACCategory(u.category));
    setEditUnitSearch("");
  };

  const handleSaveDateAndUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDateUnitLog) return;
    const cleanName = editUnitName.trim();
    if (!cleanName || !editDateStr) return;

    const combinedLocal = `${editDateStr}T${editTimeStr || "09:00"}`;
    const parsedDate = new Date(combinedLocal);
    const newIso = isNaN(parsedDate.getTime())
      ? editingDateUnitLog.recorded_at
      : parsedDate.toISOString();

    const matchedMaster = masterUnits.find(
      (u) => u.id === editUnitId || u.name.toLowerCase() === cleanName.toLowerCase()
    );
    const finalUnitId = matchedMaster ? matchedMaster.id : editUnitId || editingDateUnitLog.unit_id;
    const finalCategory = matchedMaster
      ? normalizeACCategory(matchedMaster.category)
      : normalizeACCategory(editCategory);

    const targetId = editingDateUnitLog.log_id;
    const patch: Partial<ACMaintenanceLog> = {
      recorded_at: newIso,
      unit_id: finalUnitId,
      unit_name: cleanName,
      category: finalCategory,
    };

    try {
      setSavingDateUnit(true);
      setLogs((prev) => {
        const next = prev.map((l) => (l.log_id === targetId ? { ...l, ...patch } : l));
        next.sort(
          (a, b) => new Date(b.recorded_at || 0).getTime() - new Date(a.recorded_at || 0).getTime()
        );
        return next;
      });
      if (selectedLog?.log_id === targetId) {
        setSelectedLog((prev) => (prev ? { ...prev, ...patch } : null));
      }

      // Pastikan baris yang diedit tidak tersembunyi oleh filter rentang tanggal / kategori aktif
      if (categoryFilter !== "all" && categoryFilter !== finalCategory) {
        setCategoryFilter("all");
      }
      const diffDays = (Date.now() - new Date(newIso).getTime()) / (1000 * 60 * 60 * 24);
      if (
        (dateFilter === "today" && diffDays > 1) ||
        (dateFilter === "7d" && diffDays > 7) ||
        (dateFilter === "30d" && diffDays > 30)
      ) {
        setDateFilter("all");
      }

      await updateACMaintenanceLog(targetId, patch);
      setEditingDateUnitLog(null);
      setToastMsg(
        `Tanggal & kamar berhasil diperbarui: ${cleanName} (${formatDateTime(newIso)})`
      );
      setTimeout(() => setToastMsg(null), 3500);
    } catch (err: any) {
      alert(err.message || "Gagal memperbarui tanggal dan kamar");
      await loadLogs();
    } finally {
      setSavingDateUnit(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadLogs();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const targetId = deleteTarget.log_id;
    const targetName = deleteTarget.unit_name;
    try {
      setDeleting(true);
      // 1. Optimistic removal from UI state immediately
      setLogs((prev) => prev.filter((l) => l.log_id !== targetId));
      setSelectedLogIds((prev) => {
        const next = new Set(prev);
        next.delete(targetId);
        return next;
      });

      // 2. Perform durable deletion
      await deleteACMaintenanceLog(targetId);
      setToastMsg(`Log perawatan untuk ${targetName} berhasil dihapus permanen.`);
      setDeleteTarget(null);
      if (selectedLog?.log_id === targetId) {
        setSelectedLog(null);
      }

      // 3. Reload in background to ensure sync
      await loadLogs();
      setTimeout(() => setToastMsg(null), 3500);
    } catch (err: any) {
      alert(err.message || "Gagal menghapus log perawatan");
      await loadLogs();
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedLogIds.size === 0) return;
    const ids = Array.from(selectedLogIds);
    try {
      setDeleting(true);
      setLogs((prev) => prev.filter((l) => !selectedLogIds.has(l.log_id)));
      await deleteBulkACMaintenanceLogs(ids);
      setSelectedLogIds(new Set());
      setShowBulkDeleteModal(false);
      setToastMsg(`Berhasil menghapus ${ids.length} log perawatan yang dipilih.`);
      await loadLogs();
      setTimeout(() => setToastMsg(null), 3500);
    } catch (err: any) {
      alert(err.message || "Gagal menghapus log perawatan terpilih");
      await loadLogs();
    } finally {
      setDeleting(false);
    }
  };

  const handleClearAll = async () => {
    try {
      setClearingAll(true);
      setLogs([]);
      setSelectedLogIds(new Set());
      await clearAllACMaintenanceLogs();
      setShowClearAllModal(false);
      setSelectedLog(null);
      setToastMsg("Seluruh riwayat log cuci AC telah berhasil dibersihkan.");
      await loadLogs();
      setTimeout(() => setToastMsg(null), 3500);
    } catch (err: any) {
      alert(err.message || "Gagal membersihkan seluruh log");
      await loadLogs();
    } finally {
      setClearingAll(false);
    }
  };

  const handleExportExcel = () => {
    try {
      setExporting(true);
      exportACLogsToExcel(filteredLogs);
      setToastMsg("File Excel hasil perawatan AC berhasil diunduh.");
      setTimeout(() => setToastMsg(null), 3500);
    } catch (err: any) {
      alert("Gagal mengunduh Excel: " + err.message);
    } finally {
      setExporting(false);
    }
  };

  const handleCopyTsv = async () => {
    try {
      const ok = await copyACLogsToClipboardAsTsv(filteredLogs);
      if (ok) {
        setCopiedTsv(true);
        setToastMsg("Data berhasil disalin! Silakan Paste (Ctrl+V) langsung ke Google Sheets atau Excel.");
        setTimeout(() => setCopiedTsv(false), 3000);
        setTimeout(() => setToastMsg(null), 4000);
      }
    } catch {
      alert("Gagal menyalin data ke clipboard.");
    }
  };

  // Smart suggestions from master units + existing logs when typing in searchTerm
  const smartSuggestions = React.useMemo(() => {
    if (!searchTerm.trim()) return [];
    const allUnits = getLocalACUnits();
    return getSmartUnitSuggestions(allUnits, (u) => u, searchTerm, 8);
  }, [searchTerm]);

  // Filter logic with Smart Search
  const now = new Date();
  const filteredLogs = React.useMemo(() => {
    const applyDateAndCat = (list: ACMaintenanceLog[], ignoreDate: boolean = false) =>
      list.filter((item) => {
        if (categoryFilter !== "all" && normalizeACCategory(item.category) !== categoryFilter) {
          return false;
        }
        if (!ignoreDate) {
          const itemDate = new Date(item.recorded_at);
          if (dateFilter === "today") {
            if (
              itemDate.getDate() !== now.getDate() ||
              itemDate.getMonth() !== now.getMonth() ||
              itemDate.getFullYear() !== now.getFullYear()
            ) {
              return false;
            }
          } else if (dateFilter === "7d") {
            const diffDays = (now.getTime() - itemDate.getTime()) / (1000 * 60 * 60 * 24);
            if (diffDays > 7) return false;
          } else if (dateFilter === "30d") {
            const diffDays = (now.getTime() - itemDate.getTime()) / (1000 * 60 * 60 * 24);
            if (diffDays > 30) return false;
          }
        }
        return true;
      });

    const baseList = applyDateAndCat(logs, false);
    if (!searchTerm.trim()) return baseList;

    const scoreList = (list: ACMaintenanceLog[]) => {
      const scored = list
        .map((item) => ({ item, score: scoreLogSmartMatch(item, searchTerm) }))
        .filter((x) => x.score > 0);
      scored.sort((a, b) => b.score - a.score);
      const strong = scored.filter((x) => x.score >= 500);
      return (strong.length > 0 ? strong : scored).map((x) => x.item);
    };

    const matched = scoreList(baseList);
    if (matched.length > 0) return matched;
    // Jika log berada di luar filter tanggal/kategori saat ini, cari di seluruh riwayat
    return scoreList(logs);
  }, [logs, categoryFilter, dateFilter, searchTerm]);

  // Selection helpers
  const isAllFilteredSelected =
    filteredLogs.length > 0 && filteredLogs.every((l) => selectedLogIds.has(l.log_id));

  const toggleSelectAllFiltered = () => {
    if (isAllFilteredSelected) {
      setSelectedLogIds((prev) => {
        const next = new Set(prev);
        filteredLogs.forEach((l) => next.delete(l.log_id));
        return next;
      });
    } else {
      setSelectedLogIds((prev) => {
        const next = new Set(prev);
        filteredLogs.forEach((l) => next.add(l.log_id));
        return next;
      });
    }
  };

  const toggleSelectLog = (logId: string) => {
    setSelectedLogIds((prev) => {
      const next = new Set(prev);
      if (next.has(logId)) {
        next.delete(logId);
      } else {
        next.add(logId);
      }
      return next;
    });
  };

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-4" id="ac-history-view-container">
      {/* Toast feedback */}
      {toastMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}


      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        {/* Date Range Chips */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
            <span className="text-[11px] font-bold text-slate-400 mr-1 uppercase">Rentang:</span>
            {[
              { key: "today", label: "Hari Ini" },
              { key: "7d", label: "7 Hari Terakhir" },
              { key: "30d", label: "30 Hari Terakhir" },
              { key: "all", label: "Semua Waktu" },
            ].map((d) => (
              <button
                key={d.key}
                onClick={() => setDateFilter(d.key as any)}
                className={`px-3 py-1.5 rounded-xl font-bold transition shrink-0 border cursor-pointer ${
                  dateFilter === d.key
                    ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Ketik nomor kamar saja (misal: 502, 301) / teknisi..."
              className="w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Smart Clickable Suggestions ("Persamaan Kamar / Unit untuk diklik") */}
        {searchTerm.trim() && smartSuggestions.length > 0 && (
          <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-2.5 space-y-1.5">
            <span className="text-[11px] font-bold text-blue-900 block">
              Persamaan Kamar / Unit (Klik untuk memfilter riwayat):
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {smartSuggestions.map(({ unit: u, score }) => {
                const uFloor = resolveFloorFromUnit(u);
                const isPrimary = score >= 900;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      setSearchTerm(u.name);
                      setCategoryFilter("all");
                      setDateFilter("all");
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
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 5 Categories Selector */}
        <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          <span className="text-[11px] font-bold text-slate-400 mr-1 uppercase shrink-0">
            Kategori:
          </span>
          <button
            onClick={() => setCategoryFilter("all")}
            className={`px-3 py-1 rounded-lg font-bold shrink-0 border cursor-pointer ${
              categoryFilter === "all"
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
            }`}
          >
            Semua Kategori
          </button>
          {AC_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1 rounded-lg font-bold shrink-0 border cursor-pointer ${
                categoryFilter === cat
                  ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Floating Bulk Action Bar when items selected */}
      {selectedLogIds.size > 0 && (
        <div className="p-3 bg-slate-900 text-white rounded-2xl shadow-lg flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 border border-slate-800">
          <div className="flex items-center gap-2 pl-2">
            <CheckSquare className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-bold">{selectedLogIds.size} log riwayat dipilih</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowBulkDeleteModal(true)}
              className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus {selectedLogIds.size} Terpilih</span>
            </button>
            <button
              onClick={() => setSelectedLogIds(new Set())}
              className="px-3 py-1.5 text-xs text-slate-300 hover:text-white font-medium transition cursor-pointer"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* Main Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span>Memuat rekapan riwayat perawatan AC...</span>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 space-y-2">
            <Layers className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="font-bold text-slate-700">Belum ada riwayat perawatan yang cocok</p>
            <p className="text-[11px]">
              Klik tombol &ldquo;Catat Cuci Baru&rdquo; untuk menginput hasil pemeriksaan dan cuci AC.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-3 w-10 text-center">
                    <button
                      type="button"
                      onClick={toggleSelectAllFiltered}
                      className="text-slate-400 hover:text-blue-600 transition cursor-pointer flex items-center justify-center mx-auto"
                      title={isAllFilteredSelected ? "Batal pilih semua" : "Pilih semua data terfilter"}
                    >
                      {isAllFilteredSelected ? (
                        <CheckSquare className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-4">Tanggal & Jam</th>
                  <th className="py-3 px-4">Kategori Area</th>
                  <th className="py-3 px-4">Nama / Ruangan Unit</th>
                  <th className="py-3 px-4">Teknisi</th>
                  <th className="py-3 px-4">Suhu (°C)</th>
                  <th className="py-3 px-4">Anemometer (m/s)</th>
                  <th className="py-3 px-4">Foto Before / After</th>
                  <th className="py-3 px-4">Catatan Kondisi</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredLogs.map((log) => {
                  const tempDiff = Number((log.temp_before - log.temp_after).toFixed(1));
                  const anemoDiff = Number((log.anemo_after - log.anemo_before).toFixed(2));
                  const isChecked = selectedLogIds.has(log.log_id);

                  return (
                    <tr
                      key={log.log_id}
                      className={`hover:bg-slate-50 transition group ${
                        isChecked ? "bg-blue-50/40" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => toggleSelectLog(log.log_id)}
                          className="text-slate-400 hover:text-blue-600 transition cursor-pointer flex items-center justify-center mx-auto"
                        >
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-300 group-hover:text-slate-400" />
                          )}
                        </button>
                      </td>

                      {/* Tanggal & Jam */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span>{formatDateTime(log.recorded_at)}</span>
                          </div>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => openEditDateUnitModal(log)}
                              className="px-1.5 py-0.5 bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-700 border border-slate-200 hover:border-blue-200 rounded-md text-[10px] font-bold flex items-center gap-0.5 transition cursor-pointer"
                              title="Edit Tanggal & Jam Pencatatan (Admin)"
                            >
                              <Pencil className="w-2.5 h-2.5 text-blue-600" />
                              <span>Edit</span>
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Kategori Area */}
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                          {log.category}
                        </span>
                      </td>

                      {/* Nama Ruangan */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <div className="font-bold text-slate-900">{log.unit_name}</div>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => openEditDateUnitModal(log)}
                              className="px-1.5 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-md text-[10px] font-bold flex items-center gap-0.5 transition cursor-pointer"
                              title="Edit Kamar / Ruangan Unit (Admin)"
                            >
                              <Pencil className="w-2.5 h-2.5 text-amber-600" />
                              <span>Edit</span>
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Nama Teknisi */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <div className="flex items-center gap-1 text-slate-800 font-semibold">
                            {log.user_name?.includes("&") ? (
                              <Users className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            ) : (
                              <UserIcon className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            )}
                            <span>{log.user_name}</span>
                          </div>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => openEditTechModal(log)}
                              className="px-1.5 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-md text-[10px] font-bold flex items-center gap-1 transition cursor-pointer"
                              title="Pilih / tambah sampai 2 nama teknisi terdaftar"
                            >
                              <UserPlus className="w-2.5 h-2.5 text-blue-600" />
                              <span>Pilih</span>
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Suhu Before vs After */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="text-slate-600">
                            <span className="font-mono text-slate-500">{log.temp_before.toFixed(1)}°</span>
                            <span className="mx-1 text-slate-300">&rarr;</span>
                            <span className="font-bold text-slate-900">{log.temp_after.toFixed(1)}°C</span>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                              tempDiff > 0
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {tempDiff > 0 ? `-${tempDiff}°` : `${tempDiff}°`}
                          </span>
                        </div>
                      </td>

                      {/* Anemometer Before vs After */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="text-slate-600">
                            <span className="font-mono text-slate-500">{log.anemo_before.toFixed(1)}</span>
                            <span className="mx-1 text-slate-300">&rarr;</span>
                            <span className="font-bold text-slate-900">{log.anemo_after.toFixed(1)} m/s</span>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                              anemoDiff > 0
                                ? "bg-cyan-100 text-cyan-800"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {anemoDiff > 0 ? `+${anemoDiff}` : `${anemoDiff}`}
                          </span>
                        </div>
                      </td>

                      {/* Dokumentasi Foto Before / After (Suhu & Anemo) */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {(log.photo_temp_before ||
                          log.photo_before ||
                          log.photo_temp_after ||
                          log.photo_after ||
                          log.photo_anemo_before ||
                          log.photo_anemo_after) ? (
                          <div className="flex flex-col gap-1">
                            {(log.photo_temp_before || log.photo_before || log.photo_temp_after || log.photo_after) && (
                              <div className="flex items-center gap-1">
                                <span className="text-[9px] font-bold text-amber-700 w-9">Suhu:</span>
                                {(log.photo_temp_before || log.photo_before) && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setViewingPhoto({
                                        title: `Foto BEFORE Suhu - ${log.unit_name}`,
                                        src: (log.photo_temp_before || log.photo_before)!,
                                      })
                                    }
                                    className="px-1.5 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded text-[9px] font-bold flex items-center gap-0.5 cursor-pointer transition"
                                  >
                                    <Camera className="w-2.5 h-2.5 text-amber-600" />
                                    <span>Before</span>
                                  </button>
                                )}
                                {(log.photo_temp_after || log.photo_after) && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setViewingPhoto({
                                        title: `Foto AFTER Suhu - ${log.unit_name}`,
                                        src: (log.photo_temp_after || log.photo_after)!,
                                      })
                                    }
                                    className="px-1.5 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded text-[9px] font-bold flex items-center gap-0.5 cursor-pointer transition"
                                  >
                                    <Camera className="w-2.5 h-2.5 text-emerald-600" />
                                    <span>After</span>
                                  </button>
                                )}
                              </div>
                            )}
                            {(log.photo_anemo_before || log.photo_anemo_after) && (
                              <div className="flex items-center gap-1">
                                <span className="text-[9px] font-bold text-cyan-700 w-9">Anemo:</span>
                                {log.photo_anemo_before && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setViewingPhoto({
                                        title: `Foto BEFORE Anemometer - ${log.unit_name}`,
                                        src: log.photo_anemo_before!,
                                      })
                                    }
                                    className="px-1.5 py-0.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-200 rounded text-[9px] font-bold flex items-center gap-0.5 cursor-pointer transition"
                                  >
                                    <Camera className="w-2.5 h-2.5 text-cyan-600" />
                                    <span>Before</span>
                                  </button>
                                )}
                                {log.photo_anemo_after && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setViewingPhoto({
                                        title: `Foto AFTER Anemometer - ${log.unit_name}`,
                                        src: log.photo_anemo_after!,
                                      })
                                    }
                                    className="px-1.5 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded text-[9px] font-bold flex items-center gap-0.5 cursor-pointer transition"
                                  >
                                    <Camera className="w-2.5 h-2.5 text-emerald-600" />
                                    <span>After</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300 text-[11px]">-</span>
                        )}
                      </td>

                      {/* Catatan */}
                      <td className="py-3 px-4 max-w-xs truncate">
                        {log.notes ? (
                          <span className="text-slate-600 text-[11px]" title={log.notes}>
                            {log.notes}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">-</span>
                        )}
                      </td>

                      {/* Aksi */}
                      <td className="py-3 px-4 text-right whitespace-nowrap space-x-1">
                        {isAdmin && (
                          <button
                            onClick={() => openEditDateUnitModal(log)}
                            className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                            title="Edit Tanggal & Kamar / Unit (Admin)"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            onClick={() => openEditTechModal(log)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                            title="Pilih / Tambah 2 Nama Teknisi Terdaftar"
                          >
                            <UserPlus className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                          title="Lihat Detail"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {(user?.role === "admin" || !user || user?.user_id === log.user_id) && (
                          <button
                            onClick={() => setDeleteTarget(log)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                            title="Hapus Log"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DETAIL MODAL */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-blue-600 text-white px-5 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Thermometer className="w-4 h-4" />
                  <span>Detail Log Perawatan AC & VRV</span>
                </h3>
                <p className="text-xs text-blue-100 mt-0.5">{selectedLog.unit_name}</p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs text-slate-700">
              {/* Meta Grid */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="block text-[10px] font-bold uppercase text-slate-400">
                    Waktu Pengisian
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-slate-900">
                      {formatDateTime(selectedLog.recorded_at)}
                    </span>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => openEditDateUnitModal(selectedLog)}
                        className="px-1.5 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer transition"
                      >
                        <Pencil className="w-2.5 h-2.5" />
                        <span>Edit Tanggal</span>
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <span className="block text-[10px] font-bold uppercase text-slate-400">
                    Teknisi Bertugas
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-slate-900">{selectedLog.user_name}</span>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => openEditTechModal(selectedLog)}
                        className="px-1.5 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer transition"
                      >
                        <Pencil className="w-2.5 h-2.5" />
                        <span>Pilih 1-2 Teknisi</span>
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <span className="block text-[10px] font-bold uppercase text-slate-400">
                    Kategori Area
                  </span>
                  <span className="font-bold text-blue-700">{selectedLog.category}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold uppercase text-slate-400">
                    Nama / Nomor Unit
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-slate-900">{selectedLog.unit_name}</span>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => openEditDateUnitModal(selectedLog)}
                        className="px-1.5 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer transition"
                      >
                        <Pencil className="w-2.5 h-2.5" />
                        <span>Edit Kamar</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Temperature Comparison */}
              <div className="p-3.5 bg-amber-50/60 border border-amber-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-amber-900 font-bold">
                  <span className="flex items-center gap-1.5">
                    <Thermometer className="w-4 h-4 text-amber-600" />
                    Suhu Kisi Evaporator
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    Suhu Turun {(selectedLog.temp_before - selectedLog.temp_after).toFixed(1)} °C
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="bg-white p-2 rounded-lg border border-amber-200">
                    <span className="block text-[10px] text-slate-500 font-semibold">Sebelum</span>
                    <span className="text-base font-black text-amber-800">
                      {selectedLog.temp_before.toFixed(1)} °C
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-amber-200">
                    <span className="block text-[10px] text-slate-500 font-semibold">Sesudah</span>
                    <span className="text-base font-black text-emerald-700">
                      {selectedLog.temp_after.toFixed(1)} °C
                    </span>
                  </div>
                </div>
              </div>

              {/* Anemometer Comparison */}
              <div className="p-3.5 bg-cyan-50/60 border border-cyan-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-cyan-900 font-bold">
                  <span className="flex items-center gap-1.5">
                    <Wind className="w-4 h-4 text-cyan-600" />
                    Kecepatan Angin Anemometer
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    Angin Naik +{(selectedLog.anemo_after - selectedLog.anemo_before).toFixed(2)} m/s
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="bg-white p-2 rounded-lg border border-cyan-200">
                    <span className="block text-[10px] text-slate-500 font-semibold">Sebelum</span>
                    <span className="text-base font-black text-cyan-800">
                      {selectedLog.anemo_before.toFixed(1)} m/s
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-cyan-200">
                    <span className="block text-[10px] text-slate-500 font-semibold">Sesudah</span>
                    <span className="text-base font-black text-emerald-700">
                      {selectedLog.anemo_after.toFixed(1)} m/s
                    </span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <span className="block text-[10px] font-bold uppercase text-slate-500">
                  Catatan Kondisi Unit:
                </span>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-800 italic">
                  {selectedLog.notes || "Tidak ada catatan tambahan."}
                </div>
              </div>

              {/* Dokumentasi Foto Before & After (4 Foto: Suhu & Anemometer) */}
              {(selectedLog.photo_temp_before ||
                selectedLog.photo_before ||
                selectedLog.photo_temp_after ||
                selectedLog.photo_after ||
                selectedLog.photo_anemo_before ||
                selectedLog.photo_anemo_after) && (
                <div className="space-y-2.5">
                  <span className="block text-[10px] font-bold uppercase text-slate-500 flex items-center gap-1">
                    <Camera className="w-3.5 h-3.5 text-blue-600" />
                    Dokumentasi Foto (Before & After):
                  </span>

                  {/* 1. Foto Suhu */}
                  {(selectedLog.photo_temp_before ||
                    selectedLog.photo_before ||
                    selectedLog.photo_temp_after ||
                    selectedLog.photo_after) && (
                    <div className="space-y-1">
                      <span className="block text-[10px] font-bold text-amber-900">
                        1. Foto Before & After Suhu (°C)
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-amber-50/50 p-1.5 rounded-lg border border-amber-200 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="block text-[9px] font-bold text-amber-800 uppercase">
                              Before Suhu
                            </span>
                            {isGoogleDrivePhotoUrl(selectedLog.photo_temp_before || selectedLog.photo_before) && (
                              <a
                                href={getPhotoViewLink(selectedLog.photo_temp_before || selectedLog.photo_before)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[9px] font-bold text-blue-600 hover:underline flex items-center gap-0.5"
                              >
                                <span>Drive</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </div>
                          {selectedLog.photo_temp_before || selectedLog.photo_before ? (
                            <button
                              type="button"
                              onClick={() =>
                                setViewingPhoto({
                                  title: `Foto BEFORE Suhu - ${selectedLog.unit_name}`,
                                  src: (selectedLog.photo_temp_before || selectedLog.photo_before)!,
                                })
                              }
                              className="w-full h-20 rounded-md overflow-hidden bg-slate-900 border border-amber-300 block cursor-pointer hover:opacity-90 transition"
                            >
                              <img
                                src={getPhotoDisplayUrl(selectedLog.photo_temp_before || selectedLog.photo_before)}
                                alt="Before Suhu"
                                className="w-full h-full object-cover"
                              />
                            </button>
                          ) : (
                            <div className="h-20 rounded-md bg-slate-100 flex items-center justify-center text-[9px] text-slate-400">
                              Tidak ada foto
                            </div>
                          )}
                        </div>

                        <div className="bg-emerald-50/50 p-1.5 rounded-lg border border-emerald-200 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="block text-[9px] font-bold text-emerald-800 uppercase">
                              After Suhu
                            </span>
                            {isGoogleDrivePhotoUrl(selectedLog.photo_temp_after || selectedLog.photo_after) && (
                              <a
                                href={getPhotoViewLink(selectedLog.photo_temp_after || selectedLog.photo_after)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[9px] font-bold text-blue-600 hover:underline flex items-center gap-0.5"
                              >
                                <span>Drive</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </div>
                          {selectedLog.photo_temp_after || selectedLog.photo_after ? (
                            <button
                              type="button"
                              onClick={() =>
                                setViewingPhoto({
                                  title: `Foto AFTER Suhu - ${selectedLog.unit_name}`,
                                  src: (selectedLog.photo_temp_after || selectedLog.photo_after)!,
                                })
                              }
                              className="w-full h-20 rounded-md overflow-hidden bg-slate-900 border border-emerald-300 block cursor-pointer hover:opacity-90 transition"
                            >
                              <img
                                src={getPhotoDisplayUrl(selectedLog.photo_temp_after || selectedLog.photo_after)}
                                alt="After Suhu"
                                className="w-full h-full object-cover"
                              />
                            </button>
                          ) : (
                            <div className="h-20 rounded-md bg-slate-100 flex items-center justify-center text-[9px] text-slate-400">
                              Tidak ada foto
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 2. Foto Anemometer */}
                  {(selectedLog.photo_anemo_before || selectedLog.photo_anemo_after) && (
                    <div className="space-y-1">
                      <span className="block text-[10px] font-bold text-cyan-900">
                        2. Foto Before & After Anemometer (m/s)
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-cyan-50/50 p-1.5 rounded-lg border border-cyan-200 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="block text-[9px] font-bold text-cyan-800 uppercase">
                              Before Anemometer
                            </span>
                            {isGoogleDrivePhotoUrl(selectedLog.photo_anemo_before) && (
                              <a
                                href={getPhotoViewLink(selectedLog.photo_anemo_before)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[9px] font-bold text-blue-600 hover:underline flex items-center gap-0.5"
                              >
                                <span>Drive</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </div>
                          {selectedLog.photo_anemo_before ? (
                            <button
                              type="button"
                              onClick={() =>
                                setViewingPhoto({
                                  title: `Foto BEFORE Anemometer - ${selectedLog.unit_name}`,
                                  src: selectedLog.photo_anemo_before!,
                                })
                              }
                              className="w-full h-20 rounded-md overflow-hidden bg-slate-900 border border-cyan-300 block cursor-pointer hover:opacity-90 transition"
                            >
                              <img
                                src={getPhotoDisplayUrl(selectedLog.photo_anemo_before)}
                                alt="Before Anemometer"
                                className="w-full h-full object-cover"
                              />
                            </button>
                          ) : (
                            <div className="h-20 rounded-md bg-slate-100 flex items-center justify-center text-[9px] text-slate-400">
                              Tidak ada foto
                            </div>
                          )}
                        </div>

                        <div className="bg-emerald-50/50 p-1.5 rounded-lg border border-emerald-200 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="block text-[9px] font-bold text-emerald-800 uppercase">
                              After Anemometer
                            </span>
                            {isGoogleDrivePhotoUrl(selectedLog.photo_anemo_after) && (
                              <a
                                href={getPhotoViewLink(selectedLog.photo_anemo_after)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[9px] font-bold text-blue-600 hover:underline flex items-center gap-0.5"
                              >
                                <span>Drive</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </div>
                          {selectedLog.photo_anemo_after ? (
                            <button
                              type="button"
                              onClick={() =>
                                setViewingPhoto({
                                  title: `Foto AFTER Anemometer - ${selectedLog.unit_name}`,
                                  src: selectedLog.photo_anemo_after!,
                                })
                              }
                              className="w-full h-20 rounded-md overflow-hidden bg-slate-900 border border-emerald-300 block cursor-pointer hover:opacity-90 transition"
                            >
                              <img
                                src={getPhotoDisplayUrl(selectedLog.photo_anemo_after)}
                                alt="After Anemometer"
                                className="w-full h-full object-cover"
                              />
                            </button>
                          ) : (
                            <div className="h-20 rounded-md bg-slate-100 flex items-center justify-center text-[9px] text-slate-400">
                              Tidak ada foto
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-2 flex items-center justify-between">
                {(user?.role === "admin" || !user || user?.user_id === selectedLog.user_id) ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteTarget(selectedLog);
                    }}
                    className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus Log Ini</span>
                  </button>
                ) : (
                  <div />
                )}
                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDIT TANGGAL & KAMAR / RUANGAN UNIT (KHUSUS ADMIN) */}
      {editingDateUnitLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-blue-700 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center">
                  <Pencil className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold leading-tight">
                    Edit Tanggal & Kamar / Unit AC
                  </h3>
                  <p className="text-[11px] text-amber-100 mt-0.5">
                    Ubah waktu pencatatan atau pindahkan ke kamar/ruangan lain
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingDateUnitLog(null)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveDateAndUnit} className="p-5 space-y-4 text-xs text-slate-700">
              {/* 1. Edit Tanggal & Jam */}
              <div className="p-3.5 bg-blue-50/60 border border-blue-200 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    <span>1. Tanggal & Jam Pencatatan</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const { date, time } = toLocalDateAndTime(new Date().toISOString());
                        setEditDateStr(date);
                        setEditTimeStr(time);
                      }}
                      className="px-2 py-0.5 bg-white hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-[10px] font-bold cursor-pointer transition"
                    >
                      Hari Ini
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const yest = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
                        const { date } = toLocalDateAndTime(yest);
                        setEditDateStr(date);
                      }}
                      className="px-2 py-0.5 bg-white hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-[10px] font-bold cursor-pointer transition"
                    >
                      Kemarin
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <span className="block text-[10px] font-semibold text-slate-600 mb-1">
                      Tanggal Cuci AC:
                    </span>
                    <input
                      type="date"
                      value={editDateStr}
                      onChange={(e) => setEditDateStr(e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-white border border-blue-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <span className="block text-[10px] font-semibold text-slate-600 mb-1">
                      Jam Pencatatan:
                    </span>
                    <input
                      type="time"
                      value={editTimeStr}
                      onChange={(e) => setEditTimeStr(e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-white border border-blue-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Edit Kamar / Ruangan Unit */}
              <div className="p-3.5 bg-amber-50/60 border border-amber-200 rounded-xl space-y-3">
                <label className="text-[11px] font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-amber-600" />
                  <span>2. Kamar / Ruangan Unit AC</span>
                </label>

                {/* Pencarian Cepat Nomor Kamar */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-semibold text-slate-600 block">
                    Cari Cepat Nomor Kamar / Nama Unit:
                  </span>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={editUnitSearch}
                      onChange={(e) => setEditUnitSearch(e.target.value)}
                      placeholder="Ketik nomor kamar (misal: 805, 502, 1108) untuk ganti cepat..."
                      className="w-full pl-8 pr-7 py-2 bg-white border border-amber-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                    />
                    {editUnitSearch && (
                      <button
                        type="button"
                        onClick={() => setEditUnitSearch("")}
                        className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {editUnitSearch.trim() && editUnitSuggestions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1 max-h-32 overflow-y-auto">
                      {editUnitSuggestions.map(({ unit: u }) => {
                        const isCurrent =
                          editUnitName.trim().toLowerCase() === u.name.trim().toLowerCase();
                        return (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => handleSelectEditMasterUnit(u)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer flex items-center gap-1 ${
                              isCurrent
                                ? "bg-amber-600 text-white border-amber-600"
                                : "bg-white text-slate-800 border-amber-300 hover:bg-amber-100"
                            }`}
                          >
                            <span>{u.name}</span>
                            <span className="text-[9px] opacity-75">
                              ({resolveFloorFromUnit(u)})
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Dropdown Pilih dari Master Unit */}
                <div>
                  <span className="text-[10px] font-semibold text-slate-600 block mb-1">
                    Atau Pilih dari Daftar Master Unit:
                  </span>
                  <select
                    value={editUnitId}
                    onChange={(e) => {
                      const found = masterUnits.find((u) => u.id === e.target.value);
                      if (found) {
                        handleSelectEditMasterUnit(found);
                      } else {
                        setEditUnitId(e.target.value);
                      }
                    }}
                    className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-hidden cursor-pointer"
                  >
                    <option value="">-- Pilih Kamar / Unit Terdaftar --</option>
                    {masterUnits.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} — {resolveFloorFromUnit(u)} ({u.category})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Nama Kamar / Unit & Kategori Area */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 border-t border-amber-200/70">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                      Nama Kamar / Unit Terpilih
                    </label>
                    <input
                      type="text"
                      value={editUnitName}
                      onChange={(e) => setEditUnitName(e.target.value)}
                      required
                      placeholder="Contoh: Kamar 805"
                      className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                      Kategori Area
                    </label>
                    <select
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value as ACCategory)}
                      className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-hidden cursor-pointer"
                    >
                      {AC_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingDateUnitLog(null)}
                  disabled={savingDateUnit}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingDateUnit || !editUnitName.trim() || !editDateStr}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{savingDateUnit ? "Menyimpan..." : "Simpan Tanggal & Kamar"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PILIH / UBAH NAMA USER / TEKNISI (BISA 1 ATAU 2 NAMA TERDAFTAR) */}
      {editingTechLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center">
                  <Users className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold leading-tight">
                    Pilih Nama User / Teknisi
                  </h3>
                  <p className="text-[11px] text-blue-100 mt-0.5">
                    {editingTechLog.unit_name} • Bisa pilih 1 atau 2 nama terdaftar
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingTechLog(null)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs text-slate-700">
              {/* Preview Hasil Gabungan Nama */}
              <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="block text-[10px] font-bold uppercase text-blue-700">
                    Nama Teknisi Terpilih:
                  </span>
                  <span className="text-sm font-extrabold text-slate-900 truncate block mt-0.5">
                    {formatTechnicianNames(editTech1, editTech2)}
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                  {editTech2 ? "2 Nama Teknisi" : "1 Nama Teknisi"}
                </span>
              </div>

              {/* Klik Cepat Daftar Nama User / Teknisi Terdaftar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700">
                    Klik Nama User / Teknisi yang Terdaftar (Maks. 2 Nama):
                  </span>
                  {editTech2 && (
                    <button
                      type="button"
                      onClick={() => setEditTech2("")}
                      className="text-[10px] font-bold text-red-600 hover:underline cursor-pointer"
                    >
                      Hapus Nama ke-2
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  {registeredUsers.map((u) => {
                    const isFirst = editTech1.toLowerCase() === u.name.toLowerCase();
                    const isSecond = editTech2.toLowerCase() === u.name.toLowerCase();
                    const isPicked = isFirst || isSecond;
                    return (
                      <button
                        key={`edit_chip_${u.user_id}_${u.name}`}
                        type="button"
                        onClick={() => handleQuickToggleEditTech(u.name)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 border cursor-pointer ${
                          isFirst
                            ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                            : isSecond
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                            : "bg-white text-slate-700 border-slate-200 hover:border-blue-400 hover:text-blue-700"
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

              {/* Pilihan Melalui 2 Dropdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-100">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    1. Nama Teknisi Pertama
                  </label>
                  <select
                    value={editTech1}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditTech1(val);
                      if (val.toLowerCase() === editTech2.toLowerCase()) {
                        setEditTech2("");
                      }
                    }}
                    className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden cursor-pointer"
                  >
                    {registeredUsers.map((u) => (
                      <option key={`sel1_${u.user_id}_${u.name}`} value={u.name}>
                        {u.name} ({u.role === "admin" ? "Admin" : "Teknisi"})
                      </option>
                    ))}
                    {editTech1 &&
                      !registeredUsers.some(
                        (u) => u.name.toLowerCase() === editTech1.toLowerCase()
                      ) && <option value={editTech1}>{editTech1}</option>}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    2. Nama Teknisi Kedua (Opsional)
                  </label>
                  <select
                    value={editTech2}
                    onChange={(e) => setEditTech2(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden cursor-pointer"
                  >
                    <option value="">— Tanpa Nama ke-2 —</option>
                    {registeredUsers
                      .filter((u) => u.name.toLowerCase() !== editTech1.toLowerCase())
                      .map((u) => (
                        <option key={`sel2_${u.user_id}_${u.name}`} value={u.name}>
                          + {u.name} ({u.role === "admin" ? "Admin" : "Teknisi"})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingTechLog(null)}
                  disabled={savingTech}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveTechNames}
                  disabled={savingTech || !editTech1.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{savingTech ? "Menyimpan..." : "Simpan Nama Teknisi"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-slate-200 p-5 space-y-3 animate-in fade-in zoom-in-95">
            <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>
            <div className="text-center">
              <h4 className="text-sm font-bold text-slate-900">Hapus Log Perawatan?</h4>
              <p className="text-xs text-slate-500 mt-1">
                Data perawatan untuk <strong>{deleteTarget.unit_name}</strong> tanggal{" "}
                {formatDateTime(deleteTarget.recorded_at)} akan dihapus permanen.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition disabled:opacity-50 cursor-pointer"
              >
                {deleting ? "Menghapus..." : "Ya, Hapus Log"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK DELETE CONFIRMATION MODAL */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-slate-200 p-5 space-y-3 animate-in fade-in zoom-in-95">
            <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>
            <div className="text-center">
              <h4 className="text-sm font-bold text-slate-900">
                Hapus {selectedLogIds.size} Log Terpilih?
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                {selectedLogIds.size} data riwayat cuci AC yang dicentang akan dihapus permanen dari sistem.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowBulkDeleteModal(false)}
                disabled={deleting}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleBulkDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition disabled:opacity-50 cursor-pointer"
              >
                {deleting ? "Menghapus..." : `Ya, Hapus (${selectedLogIds.size})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CLEAR ALL CONFIRMATION MODAL */}
      {showClearAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-slate-200 p-5 space-y-3 animate-in fade-in zoom-in-95">
            <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>
            <div className="text-center">
              <h4 className="text-sm font-bold text-slate-900">Bersihkan Seluruh Riwayat?</h4>
              <p className="text-xs text-slate-500 mt-1">
                Semua ({logs.length}) data riwayat cuci AC akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowClearAllModal(false)}
                disabled={clearingAll}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                disabled={clearingAll}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition disabled:opacity-50 cursor-pointer"
              >
                {clearingAll ? "Membersihkan..." : "Ya, Kosongkan Semua"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PHOTO LIGHTBOX MODAL */}
      {viewingPhoto && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xs"
          onClick={() => setViewingPhoto(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between text-white gap-2">
              <div className="flex items-center gap-2 text-xs font-bold min-w-0">
                <Camera className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="truncate">{viewingPhoto.title}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {viewingPhoto.src.startsWith("http") && (
                  <a
                    href={getPhotoViewLink(viewingPhoto.src)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 transition"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Buka di Google Drive</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setViewingPhoto(null)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-3 flex items-center justify-center bg-black max-h-[75vh]">
              <img
                src={getPhotoDisplayUrl(viewingPhoto.src)}
                alt={viewingPhoto.title}
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}

      {/* Add Entry Modal */}
      {showAddModal && (
        <ACLogEntryModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            loadLogs();
          }}
        />
      )}
    </div>
  );
}
