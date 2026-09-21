import React, { useState, useEffect } from "react";
import {
  Building2,
  Plus,
  Pencil,
  Trash2,
  Search,
  CheckCircle2,
  AlertTriangle,
  X,
  Layers,
  Check,
  ChevronRight,
  Clock,
} from "lucide-react";
import {
  ACCategory,
  AC_CATEGORIES,
  ACUnitLocation,
  REAL_FLOORS,
  RealFloor,
  resolveFloorFromUnit,
  normalizeACCategory,
  formatUnitCycleLabel,
} from "../types";
import {
  fetchACUnits,
  createACUnit,
  updateACUnit,
  deleteACUnit,
} from "../supabaseService";

export function ACMasterUnitsManager() {
  const [units, setUnits] = useState<ACUnitLocation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedFloor, setSelectedFloor] = useState<RealFloor>("Lantai 3");
  const [selectedCategory, setSelectedCategory] = useState<ACCategory | "all">("all");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Add / Edit Modal state
  const [modalMode, setModalMode] = useState<"add" | "edit" | null>(null);
  const [editingUnit, setEditingUnit] = useState<ACUnitLocation | null>(null);
  const [formCategory, setFormCategory] = useState<ACCategory>("Area Privat / Kamar Hotel");
  const [formFloor, setFormFloor] = useState<RealFloor>("Lantai 3");
  const [formName, setFormName] = useState<string>("");
  const [formCode, setFormCode] = useState<string>("");
  const [formNotes, setFormNotes] = useState<string>("");
  const [formCycleSelect, setFormCycleSelect] = useState<string>("default");
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<ACUnitLocation | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  // Success toast
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadUnits = async () => {
    try {
      setLoading(true);
      const data = await fetchACUnits();
      setUnits(data);
    } catch (err) {
      console.error("Gagal memuat unit:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUnits();
  }, []);

  const openAddModal = () => {
    setErrorMsg(null);
    let defaultCategory: ACCategory = "Area Privat / Kamar Hotel";
    if (selectedFloor === "Lantai Lain / VRV" || selectedFloor === "Rooftop") {
      defaultCategory = "Area Utilitas/Outdoor VRV";
    } else if (selectedFloor === "Basement") {
      defaultCategory = "Ruang Teknis & Utilitas";
    } else if (selectedFloor === "Lobby / Lantai 1") {
      defaultCategory = "Area Publik & Komersial";
    } else if (selectedFloor === "Lantai 2") {
      defaultCategory = "Area Operasional & Servis";
    }
    setFormCategory(defaultCategory);
    setFormFloor(selectedFloor);
    setFormName("");
    setFormCode("");
    setFormNotes("");
    setFormCycleSelect("default");
    setEditingUnit(null);
    setModalMode("add");
  };

  const openEditModal = (unit: ACUnitLocation) => {
    setErrorMsg(null);
    setFormCategory(normalizeACCategory(unit.category));
    setFormFloor(resolveFloorFromUnit(unit));
    setFormName(unit.name);
    setFormCode(unit.code || "");
    setFormNotes(unit.notes || "");
    
    if (unit.cycle_days && unit.cycle_days > 0 && unit.cycle_days % 30 !== 0) {
      setFormCycleSelect(`days_${unit.cycle_days}`);
    } else if (unit.cycle_months && unit.cycle_months > 0) {
      setFormCycleSelect(`months_${unit.cycle_months}`);
    } else if (unit.cycle_days && unit.cycle_days > 0) {
      setFormCycleSelect(`months_${Math.round(unit.cycle_days / 30)}`);
    } else {
      setFormCycleSelect("default");
    }

    setEditingUnit(unit);
    setModalMode("edit");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanName = formName.trim();
    if (!cleanName) {
      setErrorMsg("Nama/nomor ruangan atau identifikasi lantai VRV wajib diisi!");
      return;
    }

    let cycle_months: number | undefined = undefined;
    let cycle_days: number | undefined = undefined;

    if (formCycleSelect.startsWith("months_")) {
      cycle_months = parseInt(formCycleSelect.replace("months_", ""), 10);
    } else if (formCycleSelect.startsWith("days_")) {
      cycle_days = parseInt(formCycleSelect.replace("days_", ""), 10);
    }

    try {
      setSaving(true);
      if (modalMode === "add") {
        await createACUnit({
          category: formCategory,
          floor: formFloor,
          name: cleanName,
          code: formCode.trim() || undefined,
          notes: formNotes.trim() || undefined,
          cycle_months,
          cycle_days,
          order: units.length + 1,
        });
        setSuccessMsg(`Berhasil menambahkan "${cleanName}" di ${formFloor}`);
      } else if (modalMode === "edit" && editingUnit) {
        await updateACUnit(editingUnit.id, {
          category: formCategory,
          floor: formFloor,
          name: cleanName,
          code: formCode.trim() || undefined,
          notes: formNotes.trim() || undefined,
          cycle_months: cycle_months || null as any,
          cycle_days: cycle_days || null as any,
        });
        setSuccessMsg(`Berhasil memperbarui "${cleanName}" (${formFloor})`);
      }

      setModalMode(null);
      await loadUnits();
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal menyimpan data unit");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await deleteACUnit(deleteTarget.id);
      setSuccessMsg(`Berhasil menghapus "${deleteTarget.name}"`);
      setDeleteTarget(null);
      await loadUnits();
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal menghapus unit");
    } finally {
      setDeleting(false);
    }
  };

  // Filtered unit list strictly per selected real floor
  const filteredUnits = units.filter((u) => {
    const unitFloor = resolveFloorFromUnit(u);
    const matchFloor = unitFloor === selectedFloor;
    const matchCategory = selectedCategory === "all" || normalizeACCategory(u.category) === selectedCategory;
    const matchSearch =
      !searchTerm ||
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.code && u.code.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchFloor && matchCategory && matchSearch;
  });

  return (
    <div className="space-y-4">
      {/* Top Banner / Notification */}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Header & Add Button */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            <span>Master Data Kamar & Unit AC</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Sistem filter tab lantai riil dan pengelolaan master nomor kamar per lantai
          </p>
        </div>

        <button
          id="btn-add-unit-master"
          onClick={openAddModal}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-bold shadow-sm flex items-center justify-center gap-2 transition shrink-0 w-full sm:w-auto min-h-[44px]"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Kamar ({selectedFloor})</span>
        </button>
      </div>

      {/* SISTEM TAB LANTAI RIIL HORIZONTAL */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
            <span>Pilih Tab Lantai Riil</span>
            <span className="text-[11px] font-normal text-slate-400">
              (Basement, Lobby / Lantai 1, Lantai 2, Lantai 3-12, Rooftop)
            </span>
          </div>
          <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
            Aktif: {selectedFloor}
          </span>
        </div>

        {/* Horizontal Tab Bar Buttons */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-0.5 scrollbar-thin scrollbar-thumb-slate-300">
          {REAL_FLOORS.map((floor) => {
            const count = units.filter((u) => resolveFloorFromUnit(u) === floor).length;
            const isActive = selectedFloor === floor;
            return (
              <button
                key={floor}
                id={`tab-floor-${floor.replace(/\s+/g, "-").toLowerCase()}`}
                onClick={() => setSelectedFloor(floor)}
                className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold transition shrink-0 flex items-center gap-2 border shadow-2xs ${
                  isActive
                    ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300"
                }`}
              >
                <span>{floor}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    isActive ? "bg-white/25 text-white" : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Secondary Filter & Search within selected floor */}
        <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* Category Chip Selector */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`px-2.5 py-1.5 rounded-lg font-bold transition shrink-0 text-[11px] border ${
                selectedCategory === "all"
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
              }`}
            >
              Semua Area ({units.filter((u) => resolveFloorFromUnit(u) === selectedFloor).length})
            </button>
            {AC_CATEGORIES.map((cat) => {
              const countInFloor = units.filter(
                (u) => resolveFloorFromUnit(u) === selectedFloor && normalizeACCategory(u.category) === cat
              ).length;
              if (countInFloor === 0) return null;
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1.5 rounded-lg font-bold transition shrink-0 text-[11px] border ${
                    isSelected
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {cat} ({countInFloor})
                </button>
              );
            })}
          </div>

          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={`Cari kamar atau unit di ${selectedFloor}...`}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[40px]"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Units Table / Grid for Selected Floor */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="bg-slate-50/80 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between text-xs">
          <div className="font-bold text-slate-800 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-600" />
            <span>Daftar Kamar / Unit di {selectedFloor}</span>
          </div>
          <span className="text-slate-500 font-medium">
            Total {filteredUnits.length} kamar/unit
          </span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span>Memuat data {selectedFloor}...</span>
          </div>
        ) : filteredUnits.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 space-y-2">
            <Layers className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="font-semibold text-slate-700">
              Belum ada kamar / unit di {selectedFloor}
            </p>
            <p className="text-[11px]">
              Klik tombol &ldquo;Tambah Kamar ({selectedFloor})&rdquo; di atas untuk mendaftarkan kamar di lantai ini.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">No</th>
                  <th className="py-3 px-4">Nama / Nomor Kamar</th>
                  <th className="py-3 px-4">Lantai</th>
                  <th className="py-3 px-4">Kategori Area</th>
                  <th className="py-3 px-4">Durasi Cuci</th>
                  <th className="py-3 px-4">Kode Unit</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredUnits.map((u, idx) => {
                  const resolvedFloor = resolveFloorFromUnit(u);
                  const isCustomCycle = Boolean(u.cycle_months || u.cycle_days);
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition group">
                      <td className="py-3 px-4 text-center font-bold text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{u.name}</div>
                        {u.notes && (
                          <div className="text-[11px] text-slate-400 mt-0.5">{u.notes}</div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                          {resolvedFloor}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          {u.category}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                            isCustomCycle
                              ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                              : "bg-slate-100 text-slate-600 border-slate-200"
                          }`}
                        >
                          <Clock className="w-3 h-3 text-slate-400" />
                          {formatUnitCycleLabel(u, 1)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {u.code ? (
                          <span className="font-mono text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {u.code}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => openEditModal(u)}
                          className="px-2.5 py-1 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg text-xs font-bold transition inline-flex items-center gap-1 border border-slate-200 min-h-[32px]"
                          title="Edit Unit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => setDeleteTarget(u)}
                          className="px-2.5 py-1 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg text-xs font-bold transition inline-flex items-center gap-1 border border-slate-200 min-h-[32px]"
                          title="Hapus Unit"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Hapus</span>
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

      {/* ADD / EDIT MODAL DENGAN DROPDOWN PILIHAN LANTAI */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-400" />
                <span>
                  {modalMode === "add"
                    ? `Tambah Kamar Baru (${formFloor})`
                    : "Edit Data Kamar / Unit"}
                </span>
              </h3>
              <button
                onClick={() => setModalMode(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4 text-xs text-slate-700">
              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* DROPDOWN PILIHAN LANTAI */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Pilihan Lantai <span className="text-red-500">*</span>
                </label>
                <select
                  id="select-room-floor"
                  value={formFloor}
                  onChange={(e) => setFormFloor(e.target.value as RealFloor)}
                  required
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden min-h-[44px]"
                >
                  {REAL_FLOORS.map((floor) => (
                    <option key={floor} value={floor}>
                      {floor}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Data yang disimpan ke database Supabase memiliki penanda lantai yang jelas.
                </p>
              </div>

              {/* Nama / Nomor Ruangan */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Nama / Nomor Kamar <span className="text-red-500">*</span>
                </label>
                <input
                  id="input-room-name"
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder={
                    formFloor === "Basement"
                      ? "Contoh: Ruang Panel LVMDP / Ruang Genset / Pompa"
                      : formFloor === "Lobby / Lantai 1"
                      ? "Contoh: Lobby Reception / Restoran / Front Office"
                      : formFloor === "Lantai 2"
                      ? "Contoh: Ballroom Aster / Ruang Meeting / Kamar 201"
                      : formFloor === "Rooftop"
                      ? "Contoh: Outdoor VRV Rooftop / Ruang Lift"
                      : formFloor.includes("3")
                      ? "Contoh: Kamar 309"
                      : formFloor.includes("5")
                      ? "Contoh: Kamar 507"
                      : "Contoh: Kamar 605 / Outdoor VRV"
                  }
                  required
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden min-h-[44px]"
                />
              </div>

              {/* Kategori Area */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Kategori Area <span className="text-red-500">*</span>
                </label>
                <select
                  id="select-room-category"
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as ACCategory)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden min-h-[44px]"
                >
                  {AC_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Durasi Siklus Cuci AC */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Durasi Siklus Cuci AC
                  </label>
                  <span className="text-[10px] text-indigo-600 font-semibold">
                    Kebutuhan Tiap Area Berbeda
                  </span>
                </div>
                <select
                  value={formCycleSelect}
                  onChange={(e) => setFormCycleSelect(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden min-h-[44px]"
                >
                  <option value="default">Default Sistem (Ikuti Pengaturan Siklus Global)</option>
                  <option value="days_14">14 Hari (~2 Minggu) - Area Sangat Berdebu / Dapur</option>
                  <option value="months_1">1 Bulan Sekali (~30 Hari) - Kamar Hotel / Tamu Publik</option>
                  <option value="months_2">2 Bulan Sekali (~60 Hari) - Office & Ruang Meeting</option>
                  <option value="months_3">3 Bulan Sekali (~90 Hari) - Outdoor VRV & Ruang Pompa/Teknis</option>
                  <option value="months_6">6 Bulan Sekali (~180 Hari) - Ruang Tertutup / Gudang Arsip</option>
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  Pilih durasi khusus jika unit ini butuh dicuci lebih sering atau lebih santai daripada standar default.
                </p>
              </div>

              {/* Kode Identifikasi */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Kode Unit (Opsional)
                </label>
                <input
                  type="text"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  placeholder="Contoh: KM-309 / VRV-LT3"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              {/* Catatan / Detail Lokasi */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Catatan Lokasi (Opsional)
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Contoh: AC Split Duct 2 PK / Posisi Kamar Sayap Timur"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  disabled={saving}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition min-h-[44px]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 transition disabled:opacity-50 min-h-[44px]"
                >
                  <Check className="w-4 h-4" />
                  <span>{saving ? "Menyimpan..." : "Simpan Kamar"}</span>
                </button>
              </div>
            </form>
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
              <h4 className="text-sm font-bold text-slate-900">Hapus Unit Lokasi?</h4>
              <p className="text-xs text-slate-500 mt-1">
                Apakah Anda yakin ingin menghapus <strong>&ldquo;{deleteTarget.name}&rdquo;</strong> dari{" "}
                <strong>{resolveFloorFromUnit(deleteTarget)}</strong>?
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition min-h-[44px]"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition disabled:opacity-50 min-h-[44px]"
              >
                {deleting ? "Menghapus..." : "Ya, Hapus Unit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
