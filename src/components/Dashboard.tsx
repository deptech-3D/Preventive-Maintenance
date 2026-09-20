import React, { useState, useEffect } from "react";
import {
  Building2,
  ShieldCheck,
  RefreshCw,
  Plus,
  Thermometer,
} from "lucide-react";
import { AppSettings } from "../types";
import { useAuth } from "../auth";
import { useI18n } from "../i18n";
import { ACScheduleNotificationPanel } from "./ACScheduleNotificationPanel";
import { fetchAppSettings } from "../supabaseService";

interface DashboardProps {
  onOpenACLog?: () => void;
}

export function Dashboard({ onOpenACLog }: DashboardProps) {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    fetchAppSettings()
      .then((s) => setSettings(s))
      .catch((e) => console.error(e));
  }, [refreshTrigger]);

  const handleRefresh = () => {
    setRefreshing(true);
    setRefreshTrigger((k) => k + 1);
    setTimeout(() => setRefreshing(false), 600);
  };

  const todayStr = new Date().toLocaleDateString(lang === "id" ? "id-ID" : "en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const heroBg =
    settings?.dashboard_bg_url ||
    (typeof localStorage !== "undefined" ? localStorage.getItem("meter_dashboard_custom_bg") : null) ||
    "https://images.unsplash.com/photo-1784411641863-d163d776ed55?crop=entropy&cs=srgb&fm=jpg&w=1200&q=75";

  const propertyName = settings?.property_name || user?.property_name || "Grand Hotel Resort";

  return (
    <div className="space-y-6 pb-20">
      {/* Top Hero Section */}
      <div className="relative h-60 md:h-68 w-full rounded-2xl overflow-hidden shadow-lg border border-slate-200">
        <img
          src={heroBg}
          alt="Hotel Property"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/60 to-transparent" />
        <div className="absolute bottom-6 left-6 right-6 flex flex-col justify-end">
          <div className="flex items-center justify-between mb-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/20 backdrop-blur-md rounded-full text-blue-200 text-xs font-semibold border border-blue-400/30">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-300" />
              <span>{t("safety_first") || "Preventive Maintenance Berjadwal"}</span>
            </div>
            <div className="flex items-center gap-2">
              {onOpenACLog && (
                <button
                  type="button"
                  onClick={onOpenACLog}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Catat Cuci AC</span>
                </button>
              )}
              <button
                onClick={handleRefresh}
                className="p-2 rounded-full bg-black/40 text-white/80 hover:text-white hover:bg-black/60 transition backdrop-blur-md"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
          <h1 id="welcome-text" className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            {t("welcome")}, {user?.name}
          </h1>
          <p className="text-xs md:text-sm text-slate-300 mt-1">{todayStr}</p>
          <div className="flex items-center gap-1.5 text-xs text-blue-200/90 mt-2 font-medium">
            <Building2 className="w-3.5 h-3.5" />
            <span>{propertyName}</span>
          </div>
        </div>
      </div>

      {/* PANEL UTAMA: NOTIFIKASI & MONITORING JADWAL CLEANING AC & VRV */}
      <ACScheduleNotificationPanel key={refreshTrigger} />
    </div>
  );
}

export default Dashboard;
