import React from "react";
import {
  X,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Clock,
  User as UserIcon,
  Zap,
  Flame,
  Droplets,
  Camera,
  ExternalLink,
  Download,
} from "lucide-react";
import { PlantLog } from "../types";
import { resolvePhotoUrl } from "./History";

interface PlantLogDetailModalProps {
  log: PlantLog;
  onClose: () => void;
}

export function PlantLogDetailModal({ log, onClose }: PlantLogDetailModalProps) {
  const d = new Date(log.recorded_at);
  const dateFmt = d.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const timeFmt = d.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold">Detail Log Sheet Ruang Mesin</h3>
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                    log.shift === "pagi"
                      ? "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                      : log.shift === "sore"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                      : "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40"
                  }`}
                >
                  Shift {log.shift}
                </span>
                {log.has_alarm ? (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/40">
                    ALARM / ANOMALI
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    NORMAL
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {dateFmt} • {timeFmt} • Petugas: <strong>{log.user_name}</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Anomaly Alerts Box if Alarm */}
          {log.has_alarm && log.alarm_reasons && log.alarm_reasons.length > 0 && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl space-y-1.5 text-red-900">
              <div className="font-bold flex items-center gap-1.5 text-red-800">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>Peringatan Anomali Terdeteksi:</span>
              </div>
              <ul className="list-disc pl-5 text-[11px] space-y-0.5 text-red-700">
                {log.alarm_reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}

          {/* SECTION 1: LVMDP & TRAFO */}
          <div className="border border-slate-200 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center gap-2 font-bold text-slate-800 text-xs border-b border-slate-100 pb-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <span>1. Panel LVMDP & Trafo Distribusi</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <div className="bg-slate-50 p-2 rounded-lg">
                <span className="text-slate-500 block text-[10px]">Volt R-S / S-T / T-R</span>
                <span className="font-bold text-slate-800 font-mono">
                  {log.lvmdp_volt_rs ?? "-"} / {log.lvmdp_volt_st ?? "-"} / {log.lvmdp_volt_tr ?? "-"} V
                </span>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg">
                <span className="text-slate-500 block text-[10px]">Volt R-N / S-N / T-N</span>
                <span className="font-bold text-slate-800 font-mono">
                  {log.lvmdp_volt_rn ?? "-"} / {log.lvmdp_volt_sn ?? "-"} / {log.lvmdp_volt_tn ?? "-"} V
                </span>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg">
                <span className="text-slate-500 block text-[10px]">Ampere Total / Hz</span>
                <span className="font-bold text-slate-800 font-mono">
                  {log.lvmdp_ampere_total ?? "-"} A / {log.lvmdp_frekuensi ?? "-"} Hz
                </span>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg">
                <span className="text-slate-500 block text-[10px]">Cos Phi / Step</span>
                <span className="font-bold text-slate-800 font-mono">
                  {log.lvmdp_cos_phi ?? "-"} / {log.lvmdp_step_aktif || "-"}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] pt-1">
              <div className="bg-slate-50 p-2 rounded-lg">
                <span className="text-slate-500 block text-[10px]">Suhu Ruangan / AC</span>
                <span className="font-bold text-slate-800">
                  {log.lvmdp_suhu_ruang != null ? `${log.lvmdp_suhu_ruang}°C` : "-"} / {log.lvmdp_ac_status || "-"}
                </span>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg">
                <span className="text-slate-500 block text-[10px]">Kondisi Bau/Suara</span>
                <span className="font-bold text-slate-800">{log.lvmdp_kondisi_suara_bau || "-"}</span>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg">
                <span className="text-slate-500 block text-[10px]">Level Oli Trafo</span>
                <span className="font-bold text-slate-800">{log.trafo_level_oli || "-"}</span>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg">
                <span className="text-slate-500 block text-[10px]">Rembesan Oli Trafo</span>
                <span className="font-bold text-slate-800">{log.trafo_rembesan_oli || "-"}</span>
              </div>
            </div>
          </div>

          {/* SECTION 2: GENSET 1 & 2 */}
          <div className="border border-slate-200 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center gap-2 font-bold text-slate-800 text-xs border-b border-slate-100 pb-2">
              <Flame className="w-4 h-4 text-orange-500" />
              <span>2. Ruang Genset (Unit 1 & Unit 2)</span>
            </div>

            {/* Genset 1 */}
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-blue-700 block">Genset Unit 1:</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div className="bg-slate-50 p-2 rounded-lg">
                  <span className="text-slate-500 block text-[10px]">Solar Harian / Bulanan</span>
                  <span className="font-bold text-slate-800 font-mono">
                    {log.g1_solar_harian ?? "-"} L / {log.g1_solar_bulanan ?? "-"} L
                  </span>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg">
                  <span className="text-slate-500 block text-[10px]">Volt Aki / Air Aki</span>
                  <span className="font-bold text-slate-800 font-mono">
                    {log.g1_volt_aki != null ? `${log.g1_volt_aki}V` : "-"} / {log.g1_air_aki || "-"}
                  </span>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg">
                  <span className="text-slate-500 block text-[10px]">Selector Switch</span>
                  <span className="font-bold text-slate-800 font-mono">{log.g1_selector_switch || "-"}</span>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg">
                  <span className="text-slate-500 block text-[10px]">Running Hours / kWh</span>
                  <span className="font-bold text-slate-800 font-mono">
                    {log.g1_running_hours ?? "-"} Jam / {log.g1_kwh_total ?? "-"} kWh
                  </span>
                </div>
              </div>
            </div>

            {/* Genset 2 */}
            <div className="space-y-1 pt-1">
              <span className="text-[11px] font-bold text-blue-700 block">Genset Unit 2:</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div className="bg-slate-50 p-2 rounded-lg">
                  <span className="text-slate-500 block text-[10px]">Solar Harian / Bulanan</span>
                  <span className="font-bold text-slate-800 font-mono">
                    {log.g2_solar_harian ?? "-"} L / {log.g2_solar_bulanan ?? "-"} L
                  </span>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg">
                  <span className="text-slate-500 block text-[10px]">Volt Aki / Air Aki</span>
                  <span className="font-bold text-slate-800 font-mono">
                    {log.g2_volt_aki != null ? `${log.g2_volt_aki}V` : "-"} / {log.g2_air_aki || "-"}
                  </span>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg">
                  <span className="text-slate-500 block text-[10px]">Selector Switch</span>
                  <span className="font-bold text-slate-800 font-mono">{log.g2_selector_switch || "-"}</span>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg">
                  <span className="text-slate-500 block text-[10px]">Running Hours / kWh</span>
                  <span className="font-bold text-slate-800 font-mono">
                    {log.g2_running_hours ?? "-"} Jam / {log.g2_kwh_total ?? "-"} kWh
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: POMPA & HYDRANT */}
          <div className="border border-slate-200 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center gap-2 font-bold text-slate-800 text-xs border-b border-slate-100 pb-2">
              <Droplets className="w-4 h-4 text-cyan-600" />
              <span>3. Sistem Pompa Air Bersih & Fire Hydrant</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <div className="bg-slate-50 p-2 rounded-lg">
                <span className="text-slate-500 block text-[10px]">Level CWT / RWT</span>
                <span className="font-bold text-slate-800 font-mono">
                  {log.level_cwt != null ? `${log.level_cwt}%` : "-"} / {log.level_rwt != null ? `${log.level_rwt}%` : "-"}
                </span>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg">
                <span className="text-slate-500 block text-[10px]">Level GWT 1 / GWT 2</span>
                <span className="font-bold text-slate-800 font-mono">
                  {log.level_gwt1 != null ? `${log.level_gwt1}%` : "-"} / {log.level_gwt2 != null ? `${log.level_gwt2}%` : "-"}
                </span>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg">
                <span className="text-slate-500 block text-[10px]">Selector Pompa Transfer</span>
                <span className="font-bold text-slate-800 font-mono">{log.transfer_selector || "-"}</span>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg">
                <span className="text-slate-500 block text-[10px]">Status Trip Transfer</span>
                <span className="font-bold text-slate-800">{log.transfer_trip_status || "-"}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] pt-1">
              <div className="bg-slate-50 p-2 rounded-lg">
                <span className="text-slate-500 block text-[10px]">Tekanan Header Hydrant</span>
                <span className="font-black text-rose-600 font-mono text-xs">
                  {log.hydrant_header_pressure != null ? `${log.hydrant_header_pressure} Bar` : "-"}
                </span>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg">
                <span className="text-slate-500 block text-[10px]">Jockey / Electric / Diesel</span>
                <span className="font-bold text-slate-800 font-mono">
                  {log.jockey_selector || "-"} / {log.electric_selector || "-"} / {log.diesel_selector || "-"}
                </span>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg">
                <span className="text-slate-500 block text-[10px]">Volt Aki Diesel Hydrant</span>
                <span className="font-bold text-slate-800 font-mono">
                  {log.hydrant_volt_aki != null ? `${log.hydrant_volt_aki}V` : "-"}
                </span>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg">
                <span className="text-slate-500 block text-[10px]">Solar Diesel Hydrant</span>
                <span className="font-bold text-slate-800 font-mono">
                  {log.diesel_solar_level != null ? `${log.diesel_solar_level}%` : "-"}
                </span>
              </div>
            </div>
          </div>

          {/* Catatan Petugas */}
          {log.notes && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <span className="text-[11px] font-bold text-slate-700 block">Catatan Petugas:</span>
              <p className="text-slate-600 italic">"{log.notes}"</p>
            </div>
          )}

          {/* Foto Temuan */}
          {log.photo_temuan_url && (
            <div className="space-y-2 border border-slate-200 rounded-xl p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-blue-600" />
                  <span>Foto Temuan Pemeriksaan</span>
                </span>
                <a
                  href={resolvePhotoUrl(log.photo_temuan_url)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
                >
                  <span>Buka Gambar Penuh</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
              <div className="rounded-xl overflow-hidden max-h-72 bg-slate-900 flex items-center justify-center">
                <img
                  src={resolvePhotoUrl(log.photo_temuan_url)}
                  alt="Foto temuan ruang mesin"
                  className="max-h-72 w-full object-contain"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
