import React, { useState, useEffect } from "react";
import {
  LayoutDashboard,
  ClipboardEdit,
  History as HistoryIcon,
  Settings as SettingsIcon,
  Loader2,
  Building2,
  User as UserIcon,
  Gauge,
} from "lucide-react";
import { useAuth } from "./auth";
import { useI18n } from "./i18n";
import { fetchAppSettings } from "./supabaseService";
import { Login } from "./components/Login";
import { Dashboard } from "./components/Dashboard";
import { LogList } from "./components/LogList";
import { History } from "./components/History";
import { Settings } from "./components/Settings";
import { LogEntryModal } from "./components/LogEntryModal";
import { PlantLogSheet } from "./components/PlantLogSheet";

export function App() {
  const { user, loading } = useAuth();
  const { t } = useI18n();

  const [activeTab, setActiveTab] = useState<"dashboard" | "log" | "plant" | "history" | "settings">("dashboard");
  const [selectedMeterId, setSelectedMeterId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [propertyTitle, setPropertyTitle] = useState(user?.property_name || "Engineering Hotel");

  useEffect(() => {
    fetchAppSettings()
      .then((s) => {
        if (s?.property_name) {
          setPropertyTitle(s.property_name);
        }
      })
      .catch(() => {});
  }, [user, refreshKey]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-2" />
        <p className="text-xs font-semibold text-slate-500">Memuat Hotel Meter Checklist...</p>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const handleSelectMeter = (meterId: string) => {
    setSelectedMeterId(meterId);
  };

  const handleEntrySuccess = () => {
    setSelectedMeterId(null);
    setRefreshKey((k) => k + 1);
    setActiveTab("history");
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-sm shadow-sm">
              MC
            </div>
            <div>
              <span className="font-extrabold text-sm text-slate-900 tracking-tight block">
                {t("apps_title")}
              </span>
              <span className="text-[10px] text-slate-500 font-medium -mt-0.5 block truncate max-w-[180px] sm:max-w-none">
                {propertyTitle}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60">
              <button
                id="header-tab-dashboard"
                onClick={() => setActiveTab("dashboard")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  activeTab === "dashboard"
                    ? "bg-white text-blue-600 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>{t("dashboard")}</span>
              </button>
              <button
                id="header-tab-log"
                onClick={() => setActiveTab("log")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  activeTab === "log"
                    ? "bg-white text-blue-600 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <ClipboardEdit className="w-3.5 h-3.5" />
                <span>{t("log")}</span>
              </button>
              <button
                id="header-tab-plant"
                onClick={() => setActiveTab("plant")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  activeTab === "plant"
                    ? "bg-white text-blue-600 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Gauge className="w-3.5 h-3.5" />
                <span>Ruang Mesin</span>
              </button>
              <button
                id="header-tab-history"
                onClick={() => setActiveTab("history")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  activeTab === "history"
                    ? "bg-white text-blue-600 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <HistoryIcon className="w-3.5 h-3.5" />
                <span>{t("history")}</span>
              </button>
              <button
                id="header-tab-settings"
                onClick={() => setActiveTab("settings")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  activeTab === "settings"
                    ? "bg-white text-blue-600 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <SettingsIcon className="w-3.5 h-3.5" />
                <span>{t("settings")}</span>
              </button>
            </nav>

            <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full text-xs font-semibold text-slate-700">
              <UserIcon className="w-3.5 h-3.5 text-slate-500" />
              <span>{user.name}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-bold uppercase">
                {user.role}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 pt-4 sm:pt-6">
        {activeTab === "dashboard" && (
          <Dashboard key={refreshKey} onSelectMeter={handleSelectMeter} />
        )}
        {activeTab === "log" && (
          <LogList key={refreshKey} onSelectMeter={handleSelectMeter} />
        )}
        {activeTab === "plant" && (
          <PlantLogSheet key={refreshKey} />
        )}
        {activeTab === "history" && <History key={refreshKey} />}
        {activeTab === "settings" && <Settings key={refreshKey} />}
      </main>

      {/* Modal for Log Entry */}
      {selectedMeterId && (
        <LogEntryModal
          meterId={selectedMeterId}
          onClose={() => setSelectedMeterId(null)}
          onSuccess={handleEntrySuccess}
        />
      )}

      {/* Bottom Tab Bar (iOS Native Style) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-slate-200/80 shadow-[0_-4px_16px_rgba(0,0,0,0.04)]">
        <div className="max-w-lg mx-auto flex items-center justify-around h-16 px-1">
          <button
            id="tab-dashboard"
            onClick={() => setActiveTab("dashboard")}
            className={`flex-1 flex flex-col items-center justify-center py-1 transition ${
              activeTab === "dashboard"
                ? "text-blue-600 font-bold"
                : "text-slate-500 hover:text-slate-800 font-medium"
            }`}
          >
            <LayoutDashboard className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">{t("dashboard")}</span>
          </button>

          <button
            id="tab-log"
            onClick={() => setActiveTab("log")}
            className={`flex-1 flex flex-col items-center justify-center py-1 transition ${
              activeTab === "log"
                ? "text-blue-600 font-bold"
                : "text-slate-500 hover:text-slate-800 font-medium"
            }`}
          >
            <ClipboardEdit className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] whitespace-nowrap">{t("log")}</span>
          </button>

          <button
            id="tab-plant"
            onClick={() => setActiveTab("plant")}
            className={`flex-1 flex flex-col items-center justify-center py-1 transition ${
              activeTab === "plant"
                ? "text-blue-600 font-bold"
                : "text-slate-500 hover:text-slate-800 font-medium"
            }`}
          >
            <Gauge className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] whitespace-nowrap">Ruang Mesin</span>
          </button>

          <button
            id="tab-history"
            onClick={() => setActiveTab("history")}
            className={`flex-1 flex flex-col items-center justify-center py-1 transition ${
              activeTab === "history"
                ? "text-blue-600 font-bold"
                : "text-slate-500 hover:text-slate-800 font-medium"
            }`}
          >
            <HistoryIcon className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">{t("history")}</span>
          </button>

          <button
            id="tab-settings"
            onClick={() => setActiveTab("settings")}
            className={`flex-1 flex flex-col items-center justify-center py-1 transition ${
              activeTab === "settings"
                ? "text-blue-600 font-bold"
                : "text-slate-500 hover:text-slate-800 font-medium"
            }`}
          >
            <SettingsIcon className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">{t("settings")}</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

export default App;
