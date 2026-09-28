import React, { useState, useEffect, useCallback } from "react";
import {
  CalendarClock,
  Clock,
  CheckCircle2,
  Building2,
} from "lucide-react";
import {
  ACUnitScheduleStatus,
  ACMaintenanceLog,
} from "../types";
import {
  getACScheduleOverview,
  getLocalACScheduleOverview,
} from "../supabaseService";

interface ACScheduleNotificationPanelProps {
  onLogSaved?: (log: ACMaintenanceLog) => void;
}

export function ACScheduleNotificationPanel({
  onLogSaved: _onLogSaved,
}: ACScheduleNotificationPanelProps) {
  const [scheduleList, setScheduleList] = useState<ACUnitScheduleStatus[]>(() =>
    getLocalACScheduleOverview()
  );

  const loadData = useCallback(async () => {
    try {
      const statuses = await getACScheduleOverview();
      setScheduleList(statuses);
    } catch (err) {
      console.error("Gagal memuat status jadwal AC:", err);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // KPIs
  const totalUnits = scheduleList.length;
  const overdueCount = scheduleList.filter((s) => s.status === "overdue").length;
  const approachingCount = scheduleList.filter((s) => s.status === "approaching").length;
  const safeCount = scheduleList.filter((s) => s.status === "safe").length;

  return (
    <div className="space-y-4" id="ac-schedule-notification-panel">
      {/* KPI Cards Header */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-500/20 shrink-0">
            <CalendarClock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Daftar AC & VRV Mendekati Waktu Cleaning
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Monitoring rutin perawatan AC & Outdoor VRV per lantai secara otomatis
            </p>
          </div>
        </div>

        {/* 4 Summary Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Overdue Card */}
          <div
            className={`p-3.5 rounded-xl border flex flex-col justify-between ${
              overdueCount > 0
                ? "bg-red-50/70 border-red-200 text-red-900"
                : "bg-slate-50 border-slate-200 text-slate-700"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold">Lewat Jadwal</span>
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black">{overdueCount}</span>
              <span className="text-[10px] font-semibold opacity-80">Wajib Segera Cuci</span>
            </div>
          </div>

          {/* Approaching Card */}
          <div
            className={`p-3.5 rounded-xl border flex flex-col justify-between ${
              approachingCount > 0
                ? "bg-amber-50/70 border-amber-200 text-amber-900"
                : "bg-slate-50 border-slate-200 text-slate-700"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold">Mendekati Waktu Cuci</span>
              <Clock className="w-3.5 h-3.5" />
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black">{approachingCount}</span>
              <span className="text-[10px] font-semibold opacity-80">&le; 7 Hari Lagi</span>
            </div>
          </div>

          {/* Safe Card */}
          <div className="p-3.5 rounded-xl border bg-emerald-50/70 border-emerald-200 text-emerald-900 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold">Kondisi Aman</span>
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black">{safeCount}</span>
              <span className="text-[10px] font-semibold opacity-80">Jadwal Masih Jauh</span>
            </div>
          </div>

          {/* Total Units Card */}
          <div className="p-3.5 rounded-xl border bg-slate-900 text-white border-slate-900 shadow-md shadow-slate-900/20 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold">Total Unit Master</span>
              <Building2 className="w-3.5 h-3.5" />
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black">{totalUnits}</span>
              <span className="text-[10px] font-semibold opacity-80">Unit AC & VRV</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
