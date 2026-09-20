import React, { useState, useEffect } from "react";
import {
  CalendarClock,
  Save,
  CheckCircle2,
  AlertTriangle,
  Info,
  Clock,
  Check,
  ShieldCheck,
} from "lucide-react";
import { AppSettings } from "../types";
import { fetchAppSettings, updateAppSettings } from "../supabaseService";

export function ACMaintenanceCycleSettings() {
  const [cycle, setCycle] = useState<"1 Bulan Sekali" | "2 Bulan Sekali" | "3 Bulan Sekali">("1 Bulan Sekali");
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [msg, setMsg] = useState<{ text: string; kind: "ok" | "err" } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const st = await fetchAppSettings();
        if (st.ac_maintenance_cycle) {
          setCycle(st.ac_maintenance_cycle);
        } else if (st.ac_maintenance_cycle_months) {
          if (st.ac_maintenance_cycle_months === 2) setCycle("2 Bulan Sekali");
          else if (st.ac_maintenance_cycle_months === 3) setCycle("3 Bulan Sekali");
          else setCycle("1 Bulan Sekali");
        }
      } catch (err) {
        console.error("Gagal memuat setting siklus AC:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setSaving(true);
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
        text: `Berhasil memperbarui batas siklus perawatan AC ke "${cycle}"! Jadwal dan notifikasi dashboard otomatis disesuaikan.`,
      });

      setTimeout(() => setMsg(null), 4000);
    } catch (err: any) {
      setMsg({
        kind: "err",
        text: err.message || "Gagal menyimpan siklus perawatan AC.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-5">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
            <CalendarClock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Durasi Siklus Perawatan AC & VRV
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Tentukan interval rutin wajib cuci AC untuk peringatan otomatis di Dashboard
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving || loading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition shrink-0 self-start sm:self-auto disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? "Menyimpan..." : "Simpan Durasi"}</span>
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

      {/* Cycle Options Card */}
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
          className="w-full text-xs font-bold px-3 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden cursor-pointer"
        >
          <option value="1 Bulan Sekali">1 Bulan Sekali (Setiap 1 Bulan)</option>
          <option value="2 Bulan Sekali">2 Bulan Sekali (Setiap 2 Bulan)</option>
          <option value="3 Bulan Sekali">3 Bulan Sekali (Setiap 3 Bulan)</option>
        </select>
        <p className="text-[11px] text-slate-500">
          *Setelah disimpan, sistem akan secara otomatis menghitung ulang tanggal jatuh tempo berikutnya untuk setiap unit kamar, meeting room, office, peralatan, dan outdoor VRV.
        </p>
      </div>

      {/* Algoritma Peringatan Penjelasan */}
      <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-2">
        <h4 className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
          <Info className="w-4 h-4 text-indigo-600" />
          <span>Cara Kerja Notifikasi Jadwal di Dashboard:</span>
        </h4>
        <ul className="text-xs text-indigo-800 space-y-1.5 pl-5 list-disc">
          <li>
            <strong>Tanggal Terakhir Cuci</strong> diambil dari log perawatan terakhir unit tersebut oleh teknisi.
          </li>
          <li>
            <strong>Tanggal Jatuh Tempo Berikutnya</strong> = Tanggal Terakhir Cuci + Durasi Siklus (
            {cycle === "1 Bulan Sekali" ? "1 Bulan" : cycle === "2 Bulan Sekali" ? "2 Bulan" : "3 Bulan"}).
          </li>
          <li>
            <span className="text-red-700 font-bold">Peringatan Merah (Lewat Jadwal)</span>: Jika selisih hari sudah &lt; 0 hari atau unit belum pernah dicuci.
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
