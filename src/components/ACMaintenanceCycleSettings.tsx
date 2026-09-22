import React, { useState, useEffect, useMemo } from "react";
import {
  CalendarClock,
  Save,
  CheckCircle2,
  AlertTriangle,
  Info,
  Clock,
  Check,
  Search,
  Layers,
  Sparkles,
  RotateCcw,
  Sliders,
  Building2,
  CheckSquare,
  Square,
  Filter,
  CheckCheck,
  Zap,
} from "lucide-react";
import {
  AppSettings,
  ACUnitLocation,
  ACCategory,
  AC_CATEGORIES,
  REAL_FLOORS,
  RealFloor,
  normalizeACCategory,
  resolveFloorFromUnit,
  formatUnitCycleLabel,
} from "../types";
import {
  fetchAppSettings,
  updateAppSettings,
  fetchACUnits,
  updateBulkACUnits,
} from "../supabaseService";

export const CLEAN_CYCLE_OPTIONS = [
  { value: "default", label: "Default Sistem" },
  { value: "months_1", label: "1 Bulan" },
  { value: "months_2", label: "2 Bulan" },
  { value: "months_3", label: "3 Bulan" },
  { value: "months_4", label: "4 Bulan" },
  { value: "months_5", label: "5 Bulan" },
  { value: "months_6", label: "6 Bulan" },
  { value: "months_7", label: "7 Bulan" },
  { value: "months_8", label: "8 Bulan" },
  { value: "months_9", label: "9 Bulan" },
  { value: "months_10", label: "10 Bulan" },
  { value: "months_11", label: "11 Bulan" },
  { value: "months_12", label: "12 Bulan" },
];

export function ACMaintenanceCycleSettings() {
  const [cycle, setCycle] = useState<"1 Bulan Sekali" | "2 Bulan Sekali" | "3 Bulan Sekali">("1 Bulan Sekali");
  const [loading, setLoading] = useState<boolean>(true);
  const [savingGlobal, setSavingGlobal] = useState<boolean>(false);
  const [msg, setMsg] = useState<{ text: string; kind: "ok" | "err" } | null>(null);

  // Unit-specific duration management
  const [units, setUnits] = useState<ACUnitLocation[]>([]);
  const [unitDraftCycles, setUnitDraftCycles] = useState<Record<string, { months?: number; days?: number }>>({});
  const [unitSearch, setUnitSearch] = useState<string>("");
  const [unitCatFilter, setUnitCatFilter] = useState<ACCategory | "all">("all");
  const [unitFloorFilter, setUnitFloorFilter] = useState<RealFloor | "all">("all");
  const [selectedUnitIds, setSelectedUnitIds] = useState<Set<string>>(new Set());
  const [bulkOption, setBulkOption] = useState<string>("default");
  const [savingUnits, setSavingUnits] = useState<boolean>(false);
  const [unitMsg, setUnitMsg] = useState<{ text: string; kind: "ok" | "err" } | null>(null);

  // Quick area batch states
  const [quickBatchTarget, setQuickBatchTarget] = useState<string>("cat:Area Privat / Kamar Hotel");
  const [quickBatchCycle, setQuickBatchCycle] = useState<string>("months_1");
  const [categoryCardCycles, setCategoryCardCycles] = useState<Record<string, string>>({
    "Area Privat / Kamar Hotel": "months_1",
    "Area Publik & Komersial": "months_2",
    "Area Operasional & Servis": "months_2",
    "Ruang Teknis & Utilitas": "months_3",
    "Area Utilitas/Outdoor VRV": "months_3",
  });

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [st, uList] = await Promise.all([fetchAppSettings(), fetchACUnits()]);

        if (st.ac_maintenance_cycle) {
          setCycle(st.ac_maintenance_cycle);
        } else if (st.ac_maintenance_cycle_months) {
          if (st.ac_maintenance_cycle_months === 2) setCycle("2 Bulan Sekali");
          else if (st.ac_maintenance_cycle_months === 3) setCycle("3 Bulan Sekali");
          else setCycle("1 Bulan Sekali");
        }

        setUnits(uList);

        // Populate drafts
        const drafts: Record<string, { months?: number; days?: number }> = {};
        uList.forEach((u) => {
          drafts[u.id] = {
            months: u.cycle_months ?? undefined,
            days: u.cycle_days ?? undefined,
          };
        });
        setUnitDraftCycles(drafts);
      } catch (err) {
        console.error("Gagal memuat setting siklus AC:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSaveGlobal = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setSavingGlobal(true);
    try {
      let months = 1;
      if (cycle === "2 Bulan Sekali") months = 2;
      if (cycle === "3 Bulan Sekali") months = 3;

      await updateAppSettings({
        ac_maintenance_cycle: cycle,
        ac_maintenance_cycle_months: months,
      });

      setMsg({
        kind: "ok",
        text: `Berhasil memperbarui batas siklus default global ke "${cycle}"!`,
      });

      setTimeout(() => setMsg(null), 4000);
    } catch (err: any) {
      setMsg({
        kind: "err",
        text: err.message || "Gagal menyimpan siklus perawatan AC.",
      });
    } finally {
      setSavingGlobal(false);
    }
  };

  // Helper to get raw value string for a unit's draft
  const getUnitSelectValue = (unitId: string): string => {
    const draft = unitDraftCycles[unitId];
    if (!draft) return "default";
    if (draft.days && draft.days > 0 && draft.days % 30 !== 0) {
      return `days_${draft.days}`;
    }
    if (draft.months && draft.months > 0) {
      return `months_${draft.months}`;
    }
    if (draft.days && draft.days > 0) {
      return `months_${Math.round(draft.days / 30)}`;
    }
    return "default";
  };

  const handleUnitCycleChange = (unitId: string, val: string) => {
    setUnitDraftCycles((prev) => {
      const copy = { ...prev };
      if (val === "default") {
        copy[unitId] = { months: undefined, days: undefined };
      } else if (val.startsWith("months_")) {
        const m = parseInt(val.replace("months_", ""), 10);
        copy[unitId] = { months: m, days: undefined };
      } else if (val.startsWith("days_")) {
        const d = parseInt(val.replace("days_", ""), 10);
        copy[unitId] = { days: d, months: undefined };
      }
      return copy;
    });
  };

  // Toggle selection
  const toggleSelectUnit = (id: string) => {
    setSelectedUnitIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Filtered unit list for duration table
  const filteredUnits = useMemo(() => {
    return units.filter((u) => {
      const floor = resolveFloorFromUnit(u);
      if (unitFloorFilter !== "all" && floor !== unitFloorFilter) {
        return false;
      }
      if (unitCatFilter !== "all" && normalizeACCategory(u.category) !== unitCatFilter) {
        return false;
      }
      if (unitSearch.trim()) {
        const q = unitSearch.toLowerCase().trim();
        const matchName = u.name.toLowerCase().includes(q);
        const matchFloor = floor.toLowerCase().includes(q);
        const matchCat = normalizeACCategory(u.category).toLowerCase().includes(q);
        const matchCode = u.code ? u.code.toLowerCase().includes(q) : false;
        if (!matchName && !matchFloor && !matchCat && !matchCode) return false;
      }
      return true;
    });
  }, [units, unitCatFilter, unitFloorFilter, unitSearch]);

  const isAllFilteredSelected = useMemo(() => {
    if (filteredUnits.length === 0) return false;
    return filteredUnits.every((u) => selectedUnitIds.has(u.id));
  }, [filteredUnits, selectedUnitIds]);

  const toggleSelectAllFiltered = () => {
    if (isAllFilteredSelected) {
      setSelectedUnitIds((prev) => {
        const next = new Set(prev);
        filteredUnits.forEach((u) => next.delete(u.id));
        return next;
      });
    } else {
      setSelectedUnitIds((prev) => {
        const next = new Set(prev);
        filteredUnits.forEach((u) => next.add(u.id));
        return next;
      });
    }
  };

  // Resolve target units for quick batch setter
  const resolveTargetUnits = (targetKey: string): { label: string; units: ACUnitLocation[] } => {
    if (targetKey === "all") {
      return { label: `Seluruh Unit Hotel (${units.length} unit)`, units };
    }
    if (targetKey === "selected") {
      const selected = units.filter((u) => selectedUnitIds.has(u.id));
      return { label: `${selected.length} Unit yang Dicentang`, units: selected };
    }
    if (targetKey.startsWith("cat:")) {
      const cat = targetKey.replace("cat:", "") as ACCategory;
      const matched = units.filter((u) => normalizeACCategory(u.category) === cat);
      return { label: `Kategori ${cat} (${matched.length} unit)`, units: matched };
    }
    if (targetKey.startsWith("floor:")) {
      const floor = targetKey.replace("floor:", "") as RealFloor;
      const matched = units.filter((u) => resolveFloorFromUnit(u) === floor);
      return { label: `Area ${floor} (${matched.length} unit)`, units: matched };
    }
    return { label: "Unit", units: [] };
  };

  // Helper to apply cycle to a specific array of unit IDs and optionally auto-save immediately
  const applyCycleToUnitIds = async (
    targetIds: string[],
    val: string,
    targetLabel: string,
    autoSave: boolean = false
  ) => {
    if (targetIds.length === 0) {
      setUnitMsg({
        kind: "err",
        text: "Tidak ada unit yang cocok pada target area yang dipilih.",
      });
      return;
    }

    const nextDrafts = { ...unitDraftCycles };
    targetIds.forEach((id) => {
      if (val === "default") {
        nextDrafts[id] = { months: undefined, days: undefined };
      } else if (val.startsWith("months_")) {
        const m = parseInt(val.replace("months_", ""), 10);
        nextDrafts[id] = { months: m, days: undefined };
      } else if (val.startsWith("days_")) {
        const d = parseInt(val.replace("days_", ""), 10);
        nextDrafts[id] = { days: d, months: undefined };
      }
    });
    setUnitDraftCycles(nextDrafts);

    const cycleLabel = CLEAN_CYCLE_OPTIONS.find((o) => o.value === val)?.label || val;

    if (autoSave) {
      setSavingUnits(true);
      try {
        const payload = units.map((u) => {
          const draft = nextDrafts[u.id];
          return {
            id: u.id,
            cycle_months: draft?.months ? draft.months : null,
            cycle_days: draft?.days ? draft.days : null,
          };
        });
        await updateBulkACUnits(payload);
        const fresh = await fetchACUnits();
        setUnits(fresh);
        setUnitMsg({
          kind: "ok",
          text: `Berhasil! Durasi "${cycleLabel}" langsung disimpan untuk ${targetIds.length} unit di ${targetLabel}.`,
        });
      } catch (err: any) {
        setUnitMsg({
          kind: "err",
          text: err.message || "Gagal menyimpan perubahan ke database.",
        });
      } finally {
        setSavingUnits(false);
      }
    } else {
      setUnitMsg({
        kind: "ok",
        text: `Berhasil mengatur durasi "${cycleLabel}" untuk ${targetIds.length} unit di ${targetLabel}. Klik tombol "Simpan Perubahan Unit" untuk menyimpan permanen.`,
      });
    }
    setTimeout(() => setUnitMsg(null), 5000);
  };

  // Bulk Apply for currently visible filtered units
  const handleBulkApply = () => {
    if (filteredUnits.length === 0) return;
    applyCycleToUnitIds(
      filteredUnits.map((u) => u.id),
      bulkOption,
      `${filteredUnits.length} unit yang tampil`,
      false
    );
  };

  // Save all unit drafts
  const handleSaveAllUnits = async () => {
    setUnitMsg(null);
    setSavingUnits(true);
    try {
      const payload = units.map((u) => {
        const draft = unitDraftCycles[u.id];
        return {
          id: u.id,
          cycle_months: draft?.months ? draft.months : null,
          cycle_days: draft?.days ? draft.days : null,
        };
      });

      await updateBulkACUnits(payload);

      // Refresh list
      const fresh = await fetchACUnits();
      setUnits(fresh);

      setUnitMsg({
        kind: "ok",
        text: "Berhasil menyimpan durasi siklus untuk seluruh area & ruangan! Jadwal perawatan telah diperbarui.",
      });
      setTimeout(() => setUnitMsg(null), 4000);
    } catch (err: any) {
      setUnitMsg({
        kind: "err",
        text: err.message || "Gagal menyimpan durasi per unit.",
      });
    } finally {
      setSavingUnits(false);
    }
  };

  // Count units with custom cycle
  const customCount = useMemo(() => {
    return units.filter((u) => {
      const draft = unitDraftCycles[u.id];
      return draft?.months || draft?.days;
    }).length;
  }, [units, unitDraftCycles]);

  return (
    <div className="space-y-6">
      {/* 1. GLOBAL BASE CYCLE CARD */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <CalendarClock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Durasi Siklus Perawatan AC & VRV (Default Sistem)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Interval standar wajib cuci AC untuk seluruh unit yang tidak diatur secara khusus
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSaveGlobal}
            disabled={savingGlobal || loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition shrink-0 self-start sm:self-auto disabled:opacity-50 cursor-pointer min-h-[38px]"
          >
            <Save className="w-4 h-4" />
            <span>{savingGlobal ? "Menyimpan..." : "Simpan Durasi"}</span>
          </button>
        </div>

        {msg && (
          <div
            className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 border ${
              msg.kind === "ok"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-red-50 text-red-800 border-red-200"
            }`}
          >
            {msg.kind === "ok" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{msg.text}</span>
          </div>
        )}

        {/* Cycle Options Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            {
              value: "1 Bulan Sekali",
              months: 1,
              days: "~30 Hari",
              label: "1 Bulan Sekali (Rekomendasi)",
              desc: "Sangat direkomendasikan untuk hotel okupansi tinggi, kamar berdebu, dan ruangan beroperasi 24/7.",
            },
            {
              value: "2 Bulan Sekali",
              months: 2,
              days: "~60 Hari",
              label: "2 Bulan Sekali",
              desc: "Ideal untuk ruangan office, meeting room, dan area dengan jam operasional sedang.",
            },
            {
              value: "3 Bulan Sekali",
              months: 3,
              days: "~90 Hari",
              label: "3 Bulan Sekali",
              desc: "Batas waktu maksimal perawatan berkala untuk unit Outdoor VRV dan ruangan ber-AC tertutup.",
            },
          ].map((item) => {
            const isSelected = cycle === item.value;
            return (
              <div
                key={item.value}
                onClick={() => setCycle(item.value as any)}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition flex flex-col justify-between ${
                  isSelected
                    ? "border-blue-600 bg-blue-50/40 shadow-xs"
                    : "border-slate-200 bg-slate-50/50 hover:bg-slate-100/70 hover:border-slate-300"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-900">{item.label}</span>
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                        isSelected
                          ? "bg-blue-600 text-white border-blue-600"
                          : "border-slate-300 bg-white"
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3" />}
                    </span>
                  </div>
                  <div className="text-[11px] font-bold text-blue-600 bg-blue-100/60 px-2 py-0.5 rounded-full inline-block mb-2">
                    Interval Waktu: {item.days}
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Dropdown Selector */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
            Pilihan Interval Siklus Perawatan (Dropdown)
          </label>
          <select
            value={cycle}
            onChange={(e) => setCycle(e.target.value as any)}
            disabled={loading}
            className="w-full text-xs font-bold px-3 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden cursor-pointer min-h-[44px]"
          >
            <option value="1 Bulan Sekali">1 Bulan Sekali (Setiap 1 Bulan)</option>
            <option value="2 Bulan Sekali">2 Bulan Sekali (Setiap 2 Bulan)</option>
            <option value="3 Bulan Sekali">3 Bulan Sekali (Setiap 3 Bulan)</option>
          </select>
          <p className="text-[11px] text-slate-500">
            *Setelah disimpan, sistem akan secara otomatis menghitung ulang tanggal jatuh tempo berikutnya untuk setiap unit kamar, meeting room, office, peralatan, dan outdoor VRV.
          </p>
        </div>
      </div>

      {/* 2. DEDICATED PER-UNIT / AREA CLEANING DURATION MANAGER */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-slate-900">
                  Durasi Siklus Pembersihan Khusus Tiap Area & Nama Ruangan
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {customCount} dari {units.length} Unit Diatur Khusus
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Sesuaikan interval cuci per ruangan karena tidak semua area memiliki beban operasional yang sama
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSaveAllUnits}
            disabled={savingUnits || loading}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition shrink-0 self-start sm:self-auto disabled:opacity-50 cursor-pointer min-h-[38px]"
          >
            <Save className="w-4 h-4" />
            <span>{savingUnits ? "Menyimpan..." : "Simpan Perubahan Unit"}</span>
          </button>
        </div>

        {unitMsg && (
          <div
            className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 border ${
              unitMsg.kind === "ok"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-red-50 text-red-800 border-red-200"
            }`}
          >
            {unitMsg.kind === "ok" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{unitMsg.text}</span>
          </div>
        )}

        {/* Info Guide Card */}
        <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl flex items-start gap-2.5 text-xs text-blue-900">
          <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold">Panduan Interval Sesuai Karakteristik Area:</span>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 text-[11px] text-blue-800 mt-1">
              <div className="bg-white/70 p-2 rounded-lg border border-blue-100">
                <span className="font-bold block text-blue-900">1 Bulan:</span>
                Area Privat / Kamar Tamu Hotel & Lobby beroperasi terus.
              </div>
              <div className="bg-white/70 p-2 rounded-lg border border-blue-100">
                <span className="font-bold block text-blue-900">2 Bulan:</span>
                Area Operasional / Office & Meeting Room.
              </div>
              <div className="bg-white/70 p-2 rounded-lg border border-blue-100">
                <span className="font-bold block text-blue-900">3 Bulan:</span>
                Area Utilitas / Outdoor VRV Rooftop & Ruang Panel.
              </div>
              <div className="bg-white/70 p-2 rounded-lg border border-blue-100">
                <span className="font-bold block text-blue-900">6 Bulan:</span>
                Area Arsip / Gudang Tertutup jarang digunakan.
              </div>
            </div>
          </div>
        </div>

        {/* 2A. PENGATURAN CEPAT PER KATEGORI AREA (MASSAL UNTUK JUMLAH BANYAK) */}
        <div className="space-y-3 bg-gradient-to-r from-indigo-50/80 via-white to-blue-50/80 p-4 rounded-2xl border border-indigo-100 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-100/70 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                ⚡
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">
                  Tentukan Siklus Sekaligus Per Kategori Area
                </h4>
                <p className="text-[11px] text-slate-500">
                  Ubah seluruh kamar atau seluruh area kerja dalam 1 klik tanpa harus mengubah satu per satu
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 pt-1">
            {AC_CATEGORIES.map((cat) => {
              const matched = units.filter((u) => normalizeACCategory(u.category) === cat);
              const count = matched.length;
              const currentSelected = categoryCardCycles[cat] || "months_1";

              return (
                <div
                  key={cat}
                  className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs hover:border-indigo-300 transition flex flex-col justify-between space-y-2.5"
                >
                  <div>
                    <div className="flex items-start justify-between gap-1.5 mb-1">
                      <span className="text-xs font-bold text-slate-800 line-clamp-1" title={cat}>
                        {cat}
                      </span>
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                        {count} unit
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      {cat.includes("Kamar")
                        ? "Kamar tamu & suite hotel"
                        : cat.includes("Meeting")
                        ? "Ruang rapat & ballroom"
                        : cat.includes("Office")
                        ? "Kantor & back office"
                        : cat.includes("Teknis")
                        ? "Genset, panel & pompa"
                        : "Outdoor VRV & rooftop"}
                    </p>
                  </div>

                  <div className="space-y-2 pt-1 border-t border-slate-100">
                    <select
                      value={currentSelected}
                      onChange={(e) =>
                        setCategoryCardCycles((prev) => ({
                          ...prev,
                          [cat]: e.target.value,
                        }))
                      }
                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                      {CLEAN_CYCLE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label === "Default Sistem" ? `Default Sistem (${cycle})` : opt.label}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      disabled={count === 0}
                      onClick={() =>
                        applyCycleToUnitIds(
                          matched.map((u) => u.id),
                          currentSelected,
                          `${cat} (${count} unit)`,
                          false
                        )
                      }
                      className="w-full py-1.5 px-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 shadow-2xs cursor-pointer disabled:opacity-40"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      <span>Set Semua ({count})</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2B. UNIVERSAL TARGET SELECTOR (PILIH AREA ATAU LANTAI SPESIFIK) */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-600" />
            <h4 className="text-xs font-bold text-slate-900">
              Pilih Target Area / Lantai Massal Tertentu:
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div className="sm:col-span-5">
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Pilih Area / Lantai Target:
              </label>
              <select
                value={quickBatchTarget}
                onChange={(e) => setQuickBatchTarget(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer min-h-[40px]"
              >
                <optgroup label="Berdasarkan Kategori Area Hotel">
                  {AC_CATEGORIES.map((cat) => {
                    const count = units.filter((u) => normalizeACCategory(u.category) === cat).length;
                    return (
                      <option key={`cat:${cat}`} value={`cat:${cat}`}>
                        Semua {cat} ({count} unit)
                      </option>
                    );
                  })}
                </optgroup>
                <optgroup label="Berdasarkan Lantai Bangunan">
                  {REAL_FLOORS.map((floor) => {
                    const count = units.filter((u) => resolveFloorFromUnit(u) === floor).length;
                    return (
                      <option key={`floor:${floor}`} value={`floor:${floor}`}>
                        {floor} ({count} unit)
                      </option>
                    );
                  })}
                </optgroup>
                <optgroup label="Opsi Khusus / Fleksibel">
                  <option value="selected">
                    Unit yang Sedang Dicentang ({selectedUnitIds.size} unit)
                  </option>
                  <option value="all">
                    Seluruh Unit Hotel ({units.length} unit)
                  </option>
                </optgroup>
              </select>
            </div>

            <div className="sm:col-span-4">
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Tentukan Durasi Siklus:
              </label>
              <select
                value={quickBatchCycle}
                onChange={(e) => setQuickBatchCycle(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer min-h-[40px]"
              >
                {CLEAN_CYCLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label === "Default Sistem" ? `Default Sistem (${cycle})` : opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const resolved = resolveTargetUnits(quickBatchTarget);
                  applyCycleToUnitIds(
                    resolved.units.map((u) => u.id),
                    quickBatchCycle,
                    resolved.label,
                    false
                  );
                }}
                className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer min-h-[40px]"
              >
                <Zap className="w-3.5 h-3.5 text-amber-300" />
                <span>Terapkan</span>
              </button>

              <button
                type="button"
                disabled={savingUnits}
                onClick={() => {
                  const resolved = resolveTargetUnits(quickBatchTarget);
                  applyCycleToUnitIds(
                    resolved.units.map((u) => u.id),
                    quickBatchCycle,
                    resolved.label,
                    true
                  );
                }}
                className="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center justify-center gap-1 cursor-pointer min-h-[40px] shrink-0 disabled:opacity-50"
                title="Terapkan dan langsung simpan permanen ke database"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Simpan</span>
              </button>
            </div>
          </div>
        </div>

        {/* 2C. FILTER BAR DENGAN PENCARIAN, KATEGORI & LANTAI */}
        <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-200">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            {/* Search Box */}
            <div className="relative md:col-span-6">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              <input
                type="text"
                value={unitSearch}
                onChange={(e) => setUnitSearch(e.target.value)}
                placeholder="Cari nama ruangan (misal: Kamar 301, Tulip, VRV, Office)..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium min-h-[40px]"
              />
            </div>

            {/* Floor Filter Dropdown */}
            <div className="md:col-span-3">
              <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-300 min-h-[40px]">
                <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <select
                  value={unitFloorFilter}
                  onChange={(e) => setUnitFloorFilter(e.target.value as RealFloor | "all")}
                  className="w-full text-xs font-semibold bg-transparent border-0 text-slate-800 focus:outline-hidden cursor-pointer"
                >
                  <option value="all">Semua Lantai ({units.length})</option>
                  {REAL_FLOORS.map((floor) => {
                    const count = units.filter((u) => resolveFloorFromUnit(u) === floor).length;
                    return (
                      <option key={floor} value={floor}>
                        {floor} ({count})
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {/* Quick Bulk Setter for Filtered */}
            <div className="md:col-span-3 flex items-center gap-1 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-300 min-h-[40px]">
              <select
                value={bulkOption}
                onChange={(e) => setBulkOption(e.target.value)}
                className="flex-1 text-xs font-semibold bg-transparent border-0 text-slate-800 focus:outline-hidden cursor-pointer"
              >
                {CLEAN_CYCLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label === "Default Sistem" ? `Default (${cycle})` : opt.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleBulkApply}
                disabled={filteredUnits.length === 0}
                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer disabled:opacity-50 shrink-0"
              >
                Set ({filteredUnits.length})
              </button>
            </div>
          </div>

          {/* Category Tabs Filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs pt-1 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setUnitCatFilter("all")}
              className={`px-3 py-1.5 rounded-lg font-bold shrink-0 border transition cursor-pointer ${
                unitCatFilter === "all"
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                  : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
              }`}
            >
              Semua Kategori ({units.length})
            </button>
            {AC_CATEGORIES.map((cat) => {
              const count = units.filter((u) => normalizeACCategory(u.category) === cat).length;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setUnitCatFilter(cat)}
                  className={`px-3 py-1.5 rounded-lg font-bold shrink-0 border transition cursor-pointer ${
                    unitCatFilter === cat
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {cat} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* MULTI-SELECT FLOATING ACTION BAR */}
        {selectedUnitIds.size > 0 && (
          <div className="p-3 bg-indigo-900 text-white rounded-xl shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-indigo-300" />
              <span className="text-xs font-bold">
                {selectedUnitIds.size} unit kamar/ruangan dipilih
              </span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs text-indigo-200 font-medium">Ubah durasi ke:</span>
              <select
                value={bulkOption}
                onChange={(e) => setBulkOption(e.target.value)}
                className="px-2.5 py-1.5 bg-indigo-800 border border-indigo-700 rounded-lg text-xs font-semibold text-white focus:outline-hidden cursor-pointer"
              >
                {CLEAN_CYCLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} className="text-slate-900 bg-white">
                    {opt.label === "Default Sistem" ? `Default Sistem (${cycle})` : opt.label}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => {
                  applyCycleToUnitIds(
                    Array.from(selectedUnitIds),
                    bulkOption,
                    `${selectedUnitIds.size} unit dipilih`,
                    false
                  );
                }}
                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
              >
                Terapkan
              </button>

              <button
                type="button"
                onClick={() => setSelectedUnitIds(new Set())}
                className="px-2 py-1.5 text-xs text-indigo-200 hover:text-white hover:underline transition"
              >
                Batal
              </button>
            </div>
          </div>
        )}

        {/* Table of Units with Checkbox Multi-Select */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          {filteredUnits.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 space-y-2">
              <Layers className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-bold text-slate-700">Tidak ada unit yang cocok dengan filter saat ini.</p>
              <button
                type="button"
                onClick={() => {
                  setUnitSearch("");
                  setUnitCatFilter("all");
                  setUnitFloorFilter("all");
                }}
                className="text-indigo-600 font-bold hover:underline"
              >
                Reset Semua Filter
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[480px]">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px] sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">
                      <button
                        type="button"
                        onClick={toggleSelectAllFiltered}
                        className="text-slate-400 hover:text-indigo-600 transition cursor-pointer"
                        title={isAllFilteredSelected ? "Batal pilih semua" : "Pilih semua di tabel ini"}
                      >
                        {isAllFilteredSelected ? (
                          <CheckSquare className="w-4 h-4 text-indigo-600" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="py-2.5 px-3 w-10 text-center">No</th>
                    <th className="py-2.5 px-3">Nama Ruangan / Unit</th>
                    <th className="py-2.5 px-3">Lantai</th>
                    <th className="py-2.5 px-3">Kategori Area</th>
                    <th className="py-2.5 px-3 w-64">Durasi Siklus Cuci AC</th>
                    <th className="py-2.5 px-3 text-center">Status Durasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredUnits.map((u, idx) => {
                    const selectVal = getUnitSelectValue(u.id);
                    const isCustom = selectVal !== "default";
                    const floor = resolveFloorFromUnit(u);
                    const isChecked = selectedUnitIds.has(u.id);

                    return (
                      <tr
                        key={u.id}
                        className={`hover:bg-slate-50/80 transition ${
                          isChecked ? "bg-indigo-50/50" : isCustom ? "bg-indigo-50/20" : ""
                        }`}
                      >
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => toggleSelectUnit(u.id)}
                            className="text-slate-400 hover:text-indigo-600 transition cursor-pointer"
                          >
                            {isChecked ? (
                              <CheckSquare className="w-4 h-4 text-indigo-600" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-300" />
                            )}
                          </button>
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-400 font-bold text-[11px]">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900">{u.name}</div>
                          {u.code && (
                            <span className="font-mono text-[10px] text-slate-400">{u.code}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                            {floor}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                            {normalizeACCategory(u.category)}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <select
                            value={selectVal}
                            onChange={(e) => handleUnitCycleChange(u.id, e.target.value)}
                            className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                              isCustom
                                ? "bg-indigo-50 border-indigo-300 text-indigo-900 font-bold focus:ring-2 focus:ring-indigo-500"
                                : "bg-white border-slate-200 text-slate-700 focus:ring-2 focus:ring-blue-500"
                            }`}
                          >
                            {CLEAN_CYCLE_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label === "Default Sistem" ? `Default Sistem (${cycle})` : opt.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {isCustom ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                              <Clock className="w-3 h-3 text-indigo-600" />
                              Khusus
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                              Default
                            </span>
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

        {/* Action bar at the bottom */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="text-xs text-slate-500">
            Menampilkan <strong className="text-slate-800">{filteredUnits.length}</strong> dari{" "}
            <strong>{units.length}</strong> total unit.
          </div>
          <button
            type="button"
            onClick={handleSaveAllUnits}
            disabled={savingUnits || loading}
            className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-500/20 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 min-h-[44px]"
          >
            <Save className="w-4 h-4" />
            <span>{savingUnits ? "Menyimpan..." : "Simpan Semua Perubahan Durasi Unit"}</span>
          </button>
        </div>
      </div>

      {/* 3. ALGORITMA NOTIFIKASI */}
      <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-2">
        <h4 className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
          <Info className="w-4 h-4 text-indigo-600" />
          <span>Cara Kerja Perhitungan Jatuh Tempo Sesuai Durasi:</span>
        </h4>
        <ul className="text-xs text-indigo-800 space-y-1.5 pl-5 list-disc">
          <li>
            <strong>Tanggal Terakhir Cuci</strong> diambil dari log riwayat cuci AC terakhir unit tersebut yang dicatat teknisi.
          </li>
          <li>
            <strong>Tanggal Jatuh Tempo Berikutnya</strong> dihitung dari: <em>Tanggal Terakhir Cuci + Durasi Khusus Unit Tersebut</em>. Jika unit tidak diatur khusus, sistem otomatis menggunakan <em>Durasi Default Global ({cycle})</em>.
          </li>
          <li>
            <span className="text-red-700 font-bold">Peringatan Merah (Lewat Jadwal)</span>: Jika selisih hari &lt; 0 hari atau unit belum pernah dicuci.
          </li>
          <li>
            <span className="text-amber-700 font-bold">Peringatan Kuning (Mendekati Waktu Cuci)</span>: Jika selisih hari &le; 7 hari ke depan.
          </li>
          <li>
            <span className="text-emerald-700 font-bold">Indikator Hijau (Kondisi Aman)</span>: Jika selisih hari masih &gt; 7 hari.
          </li>
        </ul>
      </div>
    </div>
  );
}
