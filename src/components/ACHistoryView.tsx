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
} from "lucide-react";
import {
  ACCategory,
  AC_CATEGORIES,
  ACMaintenanceLog,
  normalizeACCategory,
} from "../types";
import { useAuth } from "../auth";
import {
  fetchACMaintenanceLogs,
  deleteACMaintenanceLog,
  exportACLogsToExcel,
  copyACLogsToClipboardAsTsv,
} from "../supabaseService";
import { ACLogEntryModal } from "./ACLogEntryModal";

export function ACHistoryView() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<ACMaintenanceLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState<ACCategory | "all">("all");
  const [dateFilter, setDateFilter] = useState<"today" | "7d" | "30d" | "all">("30d");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Modals
  const [selectedLog, setSelectedLog] = useState<ACMaintenanceLog | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ACMaintenanceLog | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // Clipboard & Excel state
  const [copiedTsv, setCopiedTsv] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
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
  }, [loadLogs]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadLogs();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await deleteACMaintenanceLog(deleteTarget.log_id);
      setToastMsg(`Log perawatan untuk ${deleteTarget.unit_name} berhasil dihapus.`);
      setDeleteTarget(null);
      await loadLogs();
      setTimeout(() => setToastMsg(null), 3500);
    } catch (err: any) {
      alert(err.message || "Gagal menghapus log perawatan");
    } finally {
      setDeleting(false);
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

  // Filter logic
  const now = new Date();
  const filteredLogs = logs.filter((item) => {
    // Category
    if (categoryFilter !== "all" && normalizeACCategory(item.category) !== categoryFilter) {
      return false;
    }

    // Date
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

    // Search
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const matchName = item.unit_name.toLowerCase().includes(q);
      const matchCat =
        normalizeACCategory(item.category).toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q);
      const matchUser = item.user_name.toLowerCase().includes(q);
      const matchNotes = item.notes ? item.notes.toLowerCase().includes(q) : false;
      if (!matchName && !matchCat && !matchUser && !matchNotes) return false;
    }

    return true;
  });

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

      {/* Top Header Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Thermometer className="w-5 h-5 text-blue-600" />
              <span>Riwayat Perawatan AC Rutin Berjadwal</span>
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              {filteredLogs.length} Data
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Pencatatan suhu (°C), hembusan angin anemometer (m/s), dan kondisi unit
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={handleCopyTsv}
            className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
            title="Salin data untuk Google Sheets"
          >
            {copiedTsv ? (
              <Check className="w-4 h-4 text-emerald-600" />
            ) : (
              <Copy className="w-4 h-4 text-slate-600" />
            )}
            <span>{copiedTsv ? "Tersalin!" : "Salin TSV (Sheets)"}</span>
          </button>

          <button
            onClick={handleExportExcel}
            disabled={exporting || filteredLogs.length === 0}
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Unduh Excel (.xlsx)</span>
          </button>

          <button
            id="btn-history-add-ac-log"
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-blue-500/20 flex items-center gap-1.5 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Catat Cuci Baru</span>
          </button>
        </div>
      </div>

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
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari unit, teknisi, catatan..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

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
                  <th className="py-3 px-4">Tanggal & Jam</th>
                  <th className="py-3 px-4">Kategori Area</th>
                  <th className="py-3 px-4">Nama / Ruangan Unit</th>
                  <th className="py-3 px-4">Teknisi</th>
                  <th className="py-3 px-4">Suhu (°C)</th>
                  <th className="py-3 px-4">Anemometer (m/s)</th>
                  <th className="py-3 px-4">Catatan Kondisi</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredLogs.map((log) => {
                  const tempDiff = Number((log.temp_before - log.temp_after).toFixed(1));
                  const anemoDiff = Number((log.anemo_after - log.anemo_before).toFixed(2));

                  return (
                    <tr key={log.log_id} className="hover:bg-slate-50 transition group">
                      {/* Tanggal & Jam */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-blue-600" />
                          <span>{formatDateTime(log.recorded_at)}</span>
                        </div>
                      </td>

                      {/* Kategori Area */}
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                          {log.category}
                        </span>
                      </td>

                      {/* Nama Ruangan */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{log.unit_name}</div>
                      </td>

                      {/* Nama Teknisi */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1 text-slate-700">
                          <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                          <span>{log.user_name}</span>
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
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="Lihat Detail"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {user?.role === "admin" && (
                          <button
                            onClick={() => setDeleteTarget(log)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
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
                  <span className="font-bold text-slate-900">
                    {formatDateTime(selectedLog.recorded_at)}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold uppercase text-slate-400">
                    Teknisi Bertugas
                  </span>
                  <span className="font-bold text-slate-900">{selectedLog.user_name}</span>
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
                  <span className="font-bold text-slate-900">{selectedLog.unit_name}</span>
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

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition"
                >
                  Tutup
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
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition disabled:opacity-50"
              >
                {deleting ? "Menghapus..." : "Ya, Hapus Log"}
              </button>
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
