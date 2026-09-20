import React, { useState } from "react";
import { X, Save, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Reading, User, AppSettings } from "../types";
import { updateReading } from "../supabaseService";

interface EditReadingModalProps {
  reading: Reading;
  users: User[];
  settings: AppSettings | null;
  onClose: () => void;
  onSuccess: (updated: Reading) => void;
}

export function EditReadingModal({
  reading,
  users,
  onClose,
  onSuccess,
}: EditReadingModalProps) {
  const [awal, setAwal] = useState(String(reading.awal));
  const [akhir, setAkhir] = useState(String(reading.akhir));
  const [shift, setShift] = useState<"pagi" | "sore" | "malam">(reading.shift || "pagi");
  const [userName, setUserName] = useState(reading.user_name || "");
  const [notes, setNotes] = useState(reading.notes || "");
  const [voltase, setVoltase] = useState(reading.voltase !== undefined ? String(reading.voltase) : "");
  const [ampere, setAmpere] = useState(reading.ampere !== undefined ? String(reading.ampere) : "");
  const [lwbp, setLwbp] = useState(
    (reading.lwbp_akhir ?? reading.lwbp) !== undefined ? String(reading.lwbp_akhir ?? reading.lwbp) : ""
  );
  const [wbp, setWbp] = useState(
    (reading.wbp_akhir ?? reading.wbp) !== undefined ? String(reading.wbp_akhir ?? reading.wbp) : ""
  );
  const [kvar, setKvar] = useState(
    (reading.kvar_akhir ?? reading.kvar) !== undefined ? String(reading.kvar_akhir ?? reading.kvar) : ""
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const totalCalculated = Math.max(0, (parseFloat(akhir) || 0) - (parseFloat(awal) || 0));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr(null);

    try {
      const numAwal = parseFloat(awal) || 0;
      const numAkhir = parseFloat(akhir) || 0;
      const numTotal = Math.max(0, numAkhir - numAwal);

      const updates: Partial<Reading> = {
        awal: numAwal,
        akhir: numAkhir,
        total: numTotal,
        shift,
        user_name: userName,
        notes,
      };

      if (voltase !== "") updates.voltase = parseFloat(voltase);
      if (ampere !== "") updates.ampere = parseFloat(ampere);
      if (lwbp !== "") {
        updates.lwbp = parseFloat(lwbp);
        updates.lwbp_akhir = parseFloat(lwbp);
      }
      if (wbp !== "") {
        updates.wbp = parseFloat(wbp);
        updates.wbp_akhir = parseFloat(wbp);
      }
      if (kvar !== "") {
        updates.kvar = parseFloat(kvar);
        updates.kvar_akhir = parseFloat(kvar);
      }

      const updated = await updateReading(reading.reading_id, updates);
      onSuccess(updated || { ...reading, ...updates });
    } catch (e: any) {
      setErr(e?.message || "Gagal memperbarui pencatatan meter");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Koreksi Catatan Meter: {reading.meter_name}
            </h3>
            <p className="text-[11px] text-slate-500">
              Koreksi angka stand, shift, atau petugas oleh Admin
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSave} className="p-5 overflow-y-auto space-y-4">
          {err && (
            <div className="p-3 rounded-xl text-xs bg-red-50 text-red-700 border border-red-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{err}</span>
            </div>
          )}

          {/* Stand Awal & Akhir */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Stand Awal ({reading.meter_unit})
              </label>
              <input
                type="number"
                step="any"
                required
                value={awal}
                onChange={(e) => setAwal(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Stand Akhir ({reading.meter_unit})
              </label>
              <input
                type="number"
                step="any"
                required
                value={akhir}
                onChange={(e) => setAkhir(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-between text-xs">
            <span className="text-blue-800 font-semibold">Total Pemakaian Terhitung:</span>
            <span className="text-base font-black text-blue-700">
              +{totalCalculated.toLocaleString("id-ID")} {reading.meter_unit}
            </span>
          </div>

          {/* Shift & Petugas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Shift</label>
              <select
                value={shift}
                onChange={(e) => setShift(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none"
              >
                <option value="pagi">Pagi</option>
                <option value="sore">Sore</option>
                <option value="malam">Malam</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nama Petugas</label>
              {users.length > 0 ? (
                <select
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                >
                  <option value={reading.user_name}>{reading.user_name} (Asli)</option>
                  {users.map((u) => (
                    <option key={u.user_id} value={u.name}>
                      {u.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              )}
            </div>
          </div>

          {/* PLN Electrical Parameters (if PLN) */}
          {(reading.meter_name?.toUpperCase().includes("PLN") ||
            reading.voltase !== undefined ||
            reading.lwbp !== undefined) && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                Parameter Listrik PLN
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">Voltase (V)</label>
                  <input
                    type="number"
                    step="any"
                    value={voltase}
                    onChange={(e) => setVoltase(e.target.value)}
                    placeholder="380"
                    className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">Arus (A)</label>
                  <input
                    type="number"
                    step="any"
                    value={ampere}
                    onChange={(e) => setAmpere(e.target.value)}
                    placeholder="250"
                    className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">LWBP Akhir</label>
                  <input
                    type="number"
                    step="any"
                    value={lwbp}
                    onChange={(e) => setLwbp(e.target.value)}
                    className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">WBP Akhir</label>
                  <input
                    type="number"
                    step="any"
                    value={wbp}
                    onChange={(e) => setWbp(e.target.value)}
                    className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">kVARh Akhir</label>
                  <input
                    type="number"
                    step="any"
                    value={kvar}
                    onChange={(e) => setKvar(e.target.value)}
                    className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Catatan</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan tambahan teknisi..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? "Menyimpan..." : "Simpan Koreksi"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
