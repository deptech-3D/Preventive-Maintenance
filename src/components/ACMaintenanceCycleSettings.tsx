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
} from "lucide-react";
import {
  AppSettings,
  ACUnitLocation,
  ACCategory,
  AC_CATEGORIES,
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
  const [bulkOption, setBulkOption] = useState<string>("default");
  const [savingUnits, setSavingUnits] = useState<boolean>(false);
  const [unitMsg, setUnitMsg] = useState<{ text: string; kind: "ok" | "err" } | null>(null);

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
            months: u.cycle_months,
            days: u.cycle_days,
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

  // Filtered unit list for duration table
  const filteredUnits = useMemo(() => {
    return units.filter((u) => {
      if (unitCatFilter !== "all" && normalizeACCategory(u.category) !== unitCatFilter) {
        return false;
      }
      if (unitSearch.trim()) {
        const q = unitSearch.toLowerCase().trim();
        const floor = resolveFloorFromUnit(u).toLowerCase();
        const matchName = u.name.toLowerCase().includes(q);
        const matchFloor = floor.includes(q);
        const matchCat = normalizeACCategory(u.category).toLowerCase().includes(q);
        const matchCode = u.code ? u.code.toLowerCase().includes(q) : false;
        if (!matchName && !matchFloor && !matchCat && !matchCode) return false;
      }
      return true;
    });
  }, [units, unitCatFilter, unitSearch]);

  // Bulk Apply
  const handleBulkApply = () => {
    if (filteredUnits.length === 0) return;
    setUnitDraftCycles((prev) => {
      const next = { ...prev };
      filteredUnits.forEach((u) => {
        if (bulkOption === "default") {
          next[u.id] = { months: undefined, days: undefined };
        } else if (bulkOption.startsWith("months_")) {
          const m = parseInt(bulkOption.replace("months_", ""), 10);
          next[u.id] = { months: m, days: undefined };
        } else if (bulkOption.startsWith("days_")) {
          const d = parseInt(bulkOption.replace("days_", ""), 10);
          next[u.id] = { days: d, months: undefined };
        }
      });
      return next;
    });

    setUnitMsg({
      kind: "ok",
      text: `Berhasil menerapkan durasi ke ${filteredUnits.length} unit yang tampil. Klik "Simpan Perubahan Unit" untuk menyimpan permanen.`,
    });
    setTimeout(() => setUnitMsg(null), 4000);
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
                <span className="font-bold block text-blue-900">14 Hari / 2 Minggu:</span>
                Area berminyak/berdebu (Dapur, Laundry, Loading Dock).
              </div>
              <div className="bg-white/70 p-2 rounded-lg border border-blue-100">
                <span className="font-bold block text-blue-900">1 Bulan Sekali:</span>
                Area Privat / Kamar Tamu Hotel & Lobby beroperasi terus.
              </div>
              <div className="bg-white/70 p-2 rounded-lg border border-blue-100">
                <span className="font-bold block text-blue-900">2 Bulan Sekali:</span>
                Area Operasional / Office & Meeting Room.
              </div>
              <div className="bg-white/70 p-2 rounded-lg border border-blue-100">
                <span className="font-bold block text-blue-900">3 Bulan Sekali:</span>
                Area Utilitas / Outdoor VRV Rooftop & Ruang Panel.
              </div>
            </div>
          </div>
        </div>

        {/* Filter Bar & Bulk Apply */}
        <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            {/* Search Box */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              <input
                type="text"
                value={unitSearch}
                onChange={(e) => setUnitSearch(e.target.value)}
                placeholder="Cari nama ruangan (misal: Kamar 301, Tulip, VRV, Office)..."
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium min-h-[40px]"
              />
            </div>

            {/* Quick Bulk Setter */}
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-300 shrink-0">
              <span className="text-[11px] font-bold text-slate-600 whitespace-nowrap">
                Set ({filteredUnits.length} unit):
              </span>
              <select
                value={bulkOption}
                onChange={(e) => setBulkOption(e.target.value)}
                className="text-xs font-semibold bg-transparent border-0 text-slate-800 focus:outline-hidden cursor-pointer"
              >
                <option value="default">Default Sistem ({cycle})</option>
                <option value="days_14">14 Hari (2 Minggu)</option>
                <option value="months_1">1 Bulan Sekali (~30 Hari)</option>
                <option value="months_2">2 Bulan Sekali (~60 Hari)</option>
                <option value="months_3">3 Bulan Sekali (~90 Hari)</option>
                <option value="months_6">6 Bulan Sekali (~180 Hari)</option>
              </select>
              <button
                type="button"
                onClick={handleBulkApply}
                disabled={filteredUnits.length === 0}
                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition border border-indigo-200 cursor-pointer disabled:opacity-50"
              >
                Terapkan
              </button>
            </div>
          </div>

          {/* Category Tabs Filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
            <button
              type="button"
              onClick={() => setUnitCatFilter("all")}
              className={`px-3 py-1.5 rounded-lg font-bold shrink-0 border transition cursor-pointer ${
                unitCatFilter === "all"
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
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
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {cat} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Table of Units */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          {filteredUnits.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 space-y-2">
              <Layers className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-bold text-slate-700">Tidak ada unit yang cocok dengan filter.</p>
              <button
                type="button"
                onClick={() => {
                  setUnitSearch("");
                  setUnitCatFilter("all");
                }}
                className="text-indigo-600 font-bold hover:underline"
              >
                Reset Filter
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[480px]">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px] sticky top-0 z-10">
                  <tr>
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

                    return (
                      <tr
                        key={u.id}
                        className={`hover:bg-slate-50/80 transition ${
                          isCustom ? "bg-indigo-50/20" : ""
                        }`}
                      >
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
                            <option value="default">Default Sistem ({cycle})</option>
                            <option value="days_14">14 Hari (2 Minggu) - Area Berdebu/Dapur</option>
                            <option value="months_1">1 Bulan Sekali (~30 Hari) - Kamar Tamu/Publik</option>
                            <option value="months_2">2 Bulan Sekali (~60 Hari) - Office/Meeting</option>
                            <option value="months_3">3 Bulan Sekali (~90 Hari) - Outdoor VRV/Teknis</option>
                            <option value="months_6">6 Bulan Sekali (~180 Hari) - Gudang/Arsip</option>
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
