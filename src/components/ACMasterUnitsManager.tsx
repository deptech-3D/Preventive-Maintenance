import React, { useState, useEffect } from "react";
import {
  Building2,
  Plus,
  Pencil,
  Trash2,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  X,
  Layers,
  Check,
  Tag,
} from "lucide-react";
import { ACCategory, AC_CATEGORIES, ACUnitLocation } from "../types";
import {
  fetchACUnits,
  createACUnit,
  updateACUnit,
  deleteACUnit,
} from "../supabaseService";

export function ACMasterUnitsManager() {
  const [units, setUnits] = useState<ACUnitLocation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedCategory, setSelectedCategory] = useState<ACCategory | "all">("all");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Add / Edit Modal state
  const [modalMode, setModalMode] = useState<"add" | "edit" | null>(null);
  const [editingUnit, setEditingUnit] = useState<ACUnitLocation | null>(null);
  const [formCategory, setFormCategory] = useState<ACCategory>("Kamar Hotel");
  const [formName, setFormName] = useState<string>("");
  const [formCode, setFormCode] = useState<string>("");
  const [formNotes, setFormNotes] = useState<string>("");
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

  const openAddModal = (defaultCat?: ACCategory) => {
    setErrorMsg(null);
    setFormCategory(defaultCat || (selectedCategory !== "all" ? selectedCategory : "Kamar Hotel"));
    setFormName("");
    setFormCode("");
    setFormNotes("");
    setEditingUnit(null);
    setModalMode("add");
  };

  const openEditModal = (unit: ACUnitLocation) => {
    setErrorMsg(null);
    setFormCategory(unit.category);
    setFormName(unit.name);
    setFormCode(unit.code || "");
    setFormNotes(unit.notes || "");
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

    try {
      setSaving(true);
      if (modalMode === "add") {
        await createACUnit({
          category: formCategory,
          name: cleanName,
          code: formCode.trim() || undefined,
          notes: formNotes.trim() || undefined,
          order: units.length + 1,
        });
        setSuccessMsg(`Berhasil menambahkan "${cleanName}"`);
      } else if (modalMode === "edit" && editingUnit) {
        await updateACUnit(editingUnit.id, {
          category: formCategory,
          name: cleanName,
          code: formCode.trim() || undefined,
          notes: formNotes.trim() || undefined,
        });
        setSuccessMsg(`Berhasil memperbarui "${cleanName}"`);
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

  // Filtered unit list
  const filteredUnits = units.filter((u) => {
    const matchCategory = selectedCategory === "all" || u.category === selectedCategory;
    const matchSearch =
      !searchTerm ||
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.code && u.code.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchCategory && matchSearch;
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
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            <span>Master Lokasi & Unit AC/VRV</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola daftar nama/nomor ruangan dan unit Outdoor VRV per lantai untuk 5 kategori
          </p>
        </div>

        <button
          id="btn-add-unit-master"
          onClick={() => openAddModal()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Unit Baru</span>
        </button>
      </div>

      {/* Category Tabs & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        {/* Category Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          <button
            onClick={() => setSelectedCategory("all")}
            className={`px-3 py-1.5 rounded-xl font-bold transition shrink-0 flex items-center gap-1.5 border ${
              selectedCategory === "all"
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
            }`}
          >
            <span>Semua Kategori</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
              {units.length}
            </span>
          </button>

          {AC_CATEGORIES.map((cat) => {
            const count = units.filter((u) => u.category === cat).length;
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl font-bold transition shrink-0 flex items-center gap-1.5 border ${
                  isSelected
                    ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
              >
                <span>{cat}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    isSelected ? "bg-white/25 text-white" : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari nama ruangan, nomor kamar, atau identifikasi lantai VRV..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Units Table / Grid */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span>Memuat master unit lokasi...</span>
          </div>
        ) : filteredUnits.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 space-y-2">
            <Layers className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="font-semibold text-slate-700">Tidak ada unit yang cocok</p>
            <p className="text-[11px]">
              Klik tombol &ldquo;Tambah Unit Baru&rdquo; untuk mendaftarkan ruangan atau outdoor VRV pada kategori ini.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">No</th>
                  <th className="py-3 px-4">Nama / Nomor Unit</th>
                  <th className="py-3 px-4">Kategori Area</th>
                  <th className="py-3 px-4">Kode Unit</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredUnits.map((u, idx) => (
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
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                        {u.category}
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
                    <td className="py-3 px-4 text-right space-x-1.5">
                      <button
                        onClick={() => openEditModal(u)}
                        className="px-2.5 py-1 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg text-xs font-bold transition inline-flex items-center gap-1 border border-slate-200"
                        title="Edit Unit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => setDeleteTarget(u)}
                        className="px-2.5 py-1 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg text-xs font-bold transition inline-flex items-center gap-1 border border-slate-200"
                        title="Hapus Unit"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ADD / EDIT MODAL */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-400" />
                <span>
                  {modalMode === "add" ? "Tambah Unit / Ruangan Baru" : "Edit Unit / Ruangan"}
                </span>
              </h3>
              <button
                onClick={() => setModalMode(null)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition"
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

              {/* Kategori Area */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Kategori Area (5 Kategori) <span className="text-red-500">*</span>
                </label>
                <div className="space-y-1">
                  {AC_CATEGORIES.map((cat) => (
                    <label
                      key={cat}
                      className={`flex items-center gap-2.5 p-2 rounded-xl border cursor-pointer transition ${
                        formCategory === cat
                          ? "bg-blue-50 border-blue-500 text-blue-900 font-bold"
                          : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <input
                        type="radio"
                        name="unitCategory"
                        value={cat}
                        checked={formCategory === cat}
                        onChange={() => setFormCategory(cat)}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span>{cat}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Nama Unit / Ruangan */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Nama / Nomor Ruangan / Identifikasi Lantai VRV{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Contoh: Kamar 104 / Ruang Server IT / Outdoor VRV Lt. 3"
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              {/* Kode Identifikasi */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Kode Unit (Opsional)
                </label>
                <input
                  type="text"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  placeholder="Contoh: KM-104 / VRV-LT3"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              {/* Catatan / Detail Lokasi */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Catatan Lokasi (Opsional)
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Contoh: AC Split Duct 2 PK / Posisi Rooftop Sayap Barat"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  disabled={saving}
                  className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 transition disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{saving ? "Menyimpan..." : "Simpan Unit"}</span>
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
                Apakah Anda yakin ingin menghapus <strong>&ldquo;{deleteTarget.name}&rdquo;</strong> dari
                kategori <strong>{deleteTarget.category}</strong>?
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
                {deleting ? "Menghapus..." : "Ya, Hapus Unit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
