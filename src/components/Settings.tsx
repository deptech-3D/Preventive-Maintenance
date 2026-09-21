import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  User as UserIcon,
  Settings as SettingsIcon,
  Clock,
  Image,
  Globe,
  LogOut,
  Users,
  Plus,
  Trash2,
  Lock,
  Save,
  RefreshCw,
  Smartphone,
  Building2,
  CheckCircle2,
  Check,
  AlertTriangle,
  Key,
  FileSpreadsheet,
  Copy,
  ExternalLink,
  Send,
  Eye,
  EyeOff,
  Mail,
  Upload,
  Download,
  RotateCcw,
  Camera,
  Sun,
  Sunset,
  Moon,
  Sparkles,
  Info,
  TrendingUp,
  Gauge,
  Zap,
  Droplets,
  Activity,
  Flame,
  CalendarClock,
} from "lucide-react";
import { ACMasterUnitsManager } from "./ACMasterUnitsManager";
import { ACMaintenanceCycleSettings } from "./ACMaintenanceCycleSettings";
import { ACIntegrationReportPanel } from "./ACIntegrationReportPanel";
import { User, AppSettings } from "../types";
import { useAuth } from "../auth";
import { useI18n, Lang } from "../i18n";
import { SUPABASE_URL } from "../supabase";
import {
  fetchAppSettings,
  updateAppSettings,
  fetchUsers,
  createUser,
  deleteUser,
  updateUserPassword,
  updateAdminCredentials,
} from "../supabaseService";

export function Settings() {
  const { user, logout, refresh: refreshUser } = useAuth();
  const { t, lang, setLang } = useI18n();

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; kind: "ok" | "err" } | null>(null);

  // Custom confirmation modal state (safe for mobile WebView where window.confirm might fail)
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    description: string;
    confirmText?: string;
    action: () => Promise<void>;
  } | null>(null);

  // Form states for settings
  const [propertyName, setPropertyName] = useState("");
  const [bgUrl, setBgUrl] = useState("");
  const [uploadingBg, setUploadingBg] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const bgFileInputRef = useRef<HTMLInputElement | null>(null);
  const [threshold, setThreshold] = useState("30");
  const [shiftPagi, setShiftPagi] = useState("08:00");
  const [shiftSore, setShiftSore] = useState("16:00");
  const [shiftMalam, setShiftMalam] = useState("00:00");
  const [savingShift, setSavingShift] = useState(false);

  // Chart trend settings
  const [chartDays, setChartDays] = useState("2");
  const [chartMonths, setChartMonths] = useState("2");
  const [chartYears, setChartYears] = useState("2");

  // Machine room thresholds
  const [hydrantMinPressure, setHydrantMinPressure] = useState("7.0");
  const [gensetMinVolt, setGensetMinVolt] = useState("24.0");
  const [hydrantMinVolt, setHydrantMinVolt] = useState("24.0");
  const [lvmdpMaxTemp, setLvmdpMaxTemp] = useState("32.0");

  // New user state
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPass, setNewUserPass] = useState("");
  const [newUserRole, setNewUserRole] = useState<"user" | "admin">("user");

  // Admin creds state
  const [currPass, setCurrPass] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminPass, setNewAdminPass] = useState("");

  // Edit User Password state
  const [editPassUser, setEditPassUser] = useState<User | null>(null);
  const [editPassValue, setEditPassValue] = useState("");
  const [showEditPass, setShowEditPass] = useState(false);
  const [savingPass, setSavingPass] = useState(false);
  const [reportEmail, setReportEmail] = useState("engmidtownhotelsmd@gmail.com");
  const [plantReportEmail, setPlantReportEmail] = useState("engmidtownhotelsmd@gmail.com");

  // Admin AC Management Submenu State
  const [adminSubmenu, setAdminSubmenu] = useState<"master_ac" | "cycle_ac" | "reports" | "users" | "general">("master_ac");

  const [updatingApp, setUpdatingApp] = useState(false);

  const handleForceUpdateApp = async () => {
    setUpdatingApp(true);
    try {
      if ("caches" in window) {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map((key) => caches.delete(key)));
      }
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.unregister();
        }
      }
      window.location.reload();
    } catch (e) {
      console.error(e);
      window.location.reload();
    }
  };

  const loadData = useCallback(async () => {
    try {
      const s = await fetchAppSettings();
      setSettings(s);
      setPropertyName(s.property_name);
      setBgUrl(s.dashboard_bg_url);
      setThreshold(String(s.threshold_percent));
      setShiftPagi(s.shift_pagi_start);
      setShiftSore(s.shift_sore_start);
      setShiftMalam(s.shift_malam_start);
      setChartDays(String(s.chart_days_count ?? 2));
      setChartMonths(String(s.chart_months_count ?? 2));
      setChartYears(String(s.chart_years_count ?? 2));
      setHydrantMinPressure(String(s.hydrant_min_pressure ?? 7.0));
      setGensetMinVolt(String(s.genset_min_battery_volt ?? 24.0));
      setHydrantMinVolt(String(s.hydrant_min_battery_volt ?? 24.0));
      setLvmdpMaxTemp(String(s.lvmdp_max_room_temp ?? 32.0));

      if (s?.report_emails && s.report_emails.length > 0) {
        setReportEmail(s.report_emails[0]);
      } else {
        setReportEmail("engmidtownhotelsmd@gmail.com");
      }

      if (s?.plant_report_emails && s.plant_report_emails.length > 0) {
        setPlantReportEmail(s.plant_report_emails[0]);
      } else if (s?.report_emails && s.report_emails.length > 0) {
        setPlantReportEmail(s.report_emails[0]);
      } else {
        setPlantReportEmail("engmidtownhotelsmd@gmail.com");
      }

      if (user?.role === "admin") {
        const uList = await fetchUsers();
        setUsersList(uList);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (readerEvent) => {
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let { width, height } = img;
          const maxDim = 1440;

          if (width > height && width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(readerEvent.target?.result as string);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
          resolve(dataUrl);
        };
        img.onerror = (e) => reject(e);
        img.src = readerEvent.target?.result as string;
      };
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });
  };

  const handleSelectBgFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingBg(true);
    setMsg(null);

    try {
      const compressedDataUrl = await compressImage(file);
      setBgUrl(compressedDataUrl);

      if (typeof localStorage !== "undefined") {
        try {
          localStorage.setItem("meter_dashboard_custom_bg", compressedDataUrl);
          localStorage.setItem("meter_login_custom_bg", compressedDataUrl);
        } catch (storageErr) {
          console.warn("Storage warning:", storageErr);
        }
      }

      // Automatically sync to cloud settings so Login and Dashboard update immediately
      try {
        await updateAppSettings({
          dashboard_bg_url: compressedDataUrl,
        });
      } catch (cloudErr) {
        console.warn("Notice updating cloud background:", cloudErr);
      }

      setMsg({
        text: "Foto dari galeri berhasil dimuat dan otomatis diterapkan ke Halaman Login & Dashboard!",
        kind: "ok",
      });
    } catch (err: any) {
      setMsg({
        text: "Gagal memproses foto dari galeri: " + (err?.message || "Format tidak didukung"),
        kind: "err",
      });
    } finally {
      setUploadingBg(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleSaveShifts = async () => {
    setSavingShift(true);
    setMsg(null);
    try {
      let cleanMalam = shiftMalam.trim();
      if (cleanMalam === "12:00" || cleanMalam === "24:00") {
        cleanMalam = "00:00";
        setShiftMalam("00:00");
      }
      await updateAppSettings({
        shift_pagi_start: shiftPagi,
        shift_sore_start: shiftSore,
        shift_malam_start: cleanMalam,
      });

      setMsg({
        text: `Jadwal Shift berhasil disimpan! Pagi (${shiftPagi} - ${shiftSore}), Sore (${shiftSore} - ${cleanMalam}), Malam (${cleanMalam} - ${shiftPagi})`,
        kind: "ok",
      });
    } catch (err: any) {
      setMsg({ text: err?.message || "Gagal menyimpan jadwal shift", kind: "err" });
    } finally {
      setSavingShift(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      let cleanMalam = shiftMalam.trim();
      if (cleanMalam === "12:00" || cleanMalam === "24:00") {
        cleanMalam = "00:00";
        setShiftMalam("00:00");
      }
      await updateAppSettings({
        property_name: propertyName,
        dashboard_bg_url: bgUrl,
        threshold_percent: parseFloat(threshold) || 30,
        shift_pagi_start: shiftPagi,
        shift_sore_start: shiftSore,
        shift_malam_start: cleanMalam,
        report_emails: reportEmail ? [reportEmail.trim()] : ["engmidtownhotelsmd@gmail.com"],
        plant_report_emails: plantReportEmail ? [plantReportEmail.trim()] : ["engmidtownhotelsmd@gmail.com"],
        chart_days_count: parseInt(chartDays, 10) || 2,
        chart_months_count: parseInt(chartMonths, 10) || 2,
        chart_years_count: parseInt(chartYears, 10) || 2,
        hydrant_min_pressure: parseFloat(hydrantMinPressure) || 7.0,
        genset_min_battery_volt: parseFloat(gensetMinVolt) || 24.0,
        hydrant_min_battery_volt: parseFloat(hydrantMinVolt) || 24.0,
        lvmdp_max_room_temp: parseFloat(lvmdpMaxTemp) || 32.0,
      });

      if (typeof localStorage !== "undefined" && bgUrl) {
        try {
          localStorage.setItem("meter_dashboard_custom_bg", bgUrl);
          localStorage.setItem("meter_login_custom_bg", bgUrl);
        } catch {}
      }

      await refreshUser();
      setMsg({ text: "Pengaturan berhasil disimpan ke Database Cloud", kind: "ok" });
    } catch (err: any) {
      setMsg({ text: err?.message || "Gagal menyimpan", kind: "err" });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateUserPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPassUser) return;
    if (!editPassValue || !editPassValue.trim()) {
      setMsg({ text: "Password baru wajib diisi", kind: "err" });
      return;
    }
    setSavingPass(true);
    try {
      await updateUserPassword(editPassUser.user_id, editPassValue.trim());
      setMsg({
        text: `Password untuk user "${editPassUser.name}" berhasil diubah!`,
        kind: "ok",
      });
      setEditPassUser(null);
      setEditPassValue("");
    } catch (err: any) {
      setMsg({ text: err?.message || "Gagal mengubah password user", kind: "err" });
    } finally {
      setSavingPass(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    try {
      await createUser({
        name: newUserName,
        email: newUserEmail,
        password: newUserPass,
        role: newUserRole,
        property_name: propertyName,
      });
      setShowAddUser(false);
      setNewUserName("");
      setNewUserEmail("");
      setNewUserPass("");
      setMsg({ text: "Pengguna baru berhasil ditambahkan", kind: "ok" });
      loadData();
    } catch (err: any) {
      setMsg({ text: err?.message || "Gagal menambah pengguna", kind: "err" });
    }
  };

  const handleDeleteUser = (id: string, name: string) => {
    setConfirmModal({
      open: true,
      title: "Hapus Pengguna",
      description: `Apakah Anda yakin ingin menghapus akun teknisi "${name}"? Tindakan ini tidak dapat dibatalkan.`,
      action: async () => {
        try {
          await deleteUser(id);
          setMsg({ text: "Pengguna berhasil dihapus", kind: "ok" });
          loadData();
        } catch (err: any) {
          setMsg({ text: err?.message || "Gagal menghapus", kind: "err" });
        }
      },
    });
  };

  const handleChangeAdminCreds = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!currPass || !currPass.trim()) {
      setMsg({ text: "Password saat ini wajib diisi untuk verifikasi keamanan", kind: "err" });
      return;
    }
    if (!newAdminEmail?.trim() && !newAdminPass?.trim()) {
      setMsg({ text: "Isi username baru atau password baru yang ingin diubah", kind: "err" });
      return;
    }
    try {
      await updateAdminCredentials(
        currPass.trim(),
        newAdminEmail?.trim() || undefined,
        newAdminPass?.trim() || undefined
      );
      setCurrPass("");
      setNewAdminEmail("");
      setNewAdminPass("");
      setMsg({
        text: "Kredensial admin berhasil diperbarui! Username dan password lama otomatis dinonaktifkan secara permanen dan tidak dapat digunakan untuk login lagi.",
        kind: "ok",
      });
      await refreshUser();
    } catch (err: any) {
      setMsg({ text: err?.message || "Gagal mengganti kredensial admin", kind: "err" });
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-28">
      {/* Title */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center font-bold">
            <SettingsIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">{t("settings")}</h1>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide ${
                  user?.role === "admin"
                    ? "bg-purple-100 text-purple-700 border border-purple-200"
                    : "bg-blue-100 text-blue-700 border border-blue-200"
                }`}
              >
                {user?.role === "admin" ? "Admin Aktif" : "User / Teknisi"}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Cloud Aktif
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Masuk sebagai <strong className="text-slate-800">{user?.name}</strong> ({user?.email})
            </p>
          </div>
        </div>
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
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Admin Settings Navigation */}
      {user?.role === "admin" && (
        <>
          <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-1.5 overflow-x-auto scrollbar-none text-xs">
            <button
              id="tab-admin-master-ac"
              type="button"
              onClick={() => setAdminSubmenu("master_ac")}
              className={`px-3.5 py-2.5 rounded-xl font-bold transition flex items-center gap-2 shrink-0 border cursor-pointer ${
                adminSubmenu === "master_ac"
                  ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                  : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>A. Master Lokasi/Unit</span>
            </button>

            <button
              id="tab-admin-cycle-ac"
              type="button"
              onClick={() => setAdminSubmenu("cycle_ac")}
              className={`px-3.5 py-2.5 rounded-xl font-bold transition flex items-center gap-2 shrink-0 border cursor-pointer ${
                adminSubmenu === "cycle_ac"
                  ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                  : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
              }`}
            >
              <CalendarClock className="w-4 h-4" />
              <span>B. Durasi Siklus Perawatan</span>
            </button>

            <button
              id="tab-admin-reports"
              type="button"
              onClick={() => setAdminSubmenu("reports")}
              className={`px-3.5 py-2.5 rounded-xl font-bold transition flex items-center gap-2 shrink-0 border cursor-pointer ${
                adminSubmenu === "reports"
                  ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                  : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>C. Laporan & Integrasi Sheets</span>
              <span className="px-1.5 py-0.2 bg-emerald-500 text-white text-[9px] font-black rounded-full">
                Tema AC
              </span>
            </button>

            <button
              id="tab-admin-users"
              type="button"
              onClick={() => setAdminSubmenu("users")}
              className={`px-3.5 py-2.5 rounded-xl font-bold transition flex items-center gap-2 shrink-0 border cursor-pointer ${
                adminSubmenu === "users"
                  ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                  : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
              }`}
            >
              <Users className="w-4 h-4" />
              <span>D. Kelola Pengguna</span>
            </button>

            <button
              id="tab-admin-general"
              type="button"
              onClick={() => setAdminSubmenu("general")}
              className={`px-3.5 py-2.5 rounded-xl font-bold transition flex items-center gap-2 shrink-0 border cursor-pointer ${
                adminSubmenu === "general"
                  ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                  : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
              }`}
            >
              <SettingsIcon className="w-4 h-4" />
              <span>E. Konfigurasi Property</span>
            </button>
          </div>

          {/* Submenu A: Master Lokasi/Unit */}
          {adminSubmenu === "master_ac" && <ACMasterUnitsManager />}

          {/* Submenu B: Durasi Siklus Perawatan */}
          {adminSubmenu === "cycle_ac" && <ACMaintenanceCycleSettings />}

          {/* Submenu C: Integrasi Google Sheets, Excel & Laporan Otomatis */}
          {adminSubmenu === "reports" && (
            <ACIntegrationReportPanel propertyName={propertyName || "Midtown Hotel Samarinda"} />
          )}

          {/* Submenu D: Konfigurasi Property & Operasional */}
          {adminSubmenu === "general" && (
            <form
              onSubmit={handleSaveSettings}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4"
            >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-600" />
                <span>Konfigurasi Property & Operasional</span>
              </h2>
              <button
                type="submit"
                disabled={saving}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition shadow-sm flex items-center gap-1.5 disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? "Menyimpan..." : t("save")}</span>
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                {t("property_name")}
              </label>
              <input
                type="text"
                value={propertyName}
                onChange={(e) => setPropertyName(e.target.value)}
                placeholder="Grand Hotel Resort & Spa"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
              />
            </div>

            {/* Background Dashboard Settings */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3" id="bg-dashboard-setting-card">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Image className="w-4 h-4 text-blue-600" />
                  <span>{t("dashboard_bg")}</span>
                </label>
                {bgUrl && (
                  <button
                    type="button"
                    onClick={async () => {
                      const defUrl =
                        "https://images.unsplash.com/photo-1784411641863-d163d776ed55?crop=entropy&cs=srgb&fm=jpg&w=1200&q=75";
                      setBgUrl(defUrl);
                      if (typeof localStorage !== "undefined") {
                        try {
                          localStorage.setItem("meter_dashboard_custom_bg", defUrl);
                          localStorage.setItem("meter_login_custom_bg", defUrl);
                        } catch {}
                      }
                      try {
                        await updateAppSettings({ dashboard_bg_url: defUrl });
                      } catch {}
                      setMsg({
                        text: "Foto background direset ke foto hotel default (Dashboard & Login)",
                        kind: "ok",
                      });
                    }}
                    className="text-[11px] text-slate-500 hover:text-slate-800 font-semibold flex items-center gap-1 transition"
                    title="Reset ke background hotel bawaan"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset Default</span>
                  </button>
                )}
              </div>

              {/* Live Preview Box */}
              <div className="relative h-36 md:h-40 w-full rounded-xl overflow-hidden border border-slate-200 shadow-inner bg-slate-900 group">
                <img
                  src={
                    bgUrl ||
                    "https://images.unsplash.com/photo-1784411641863-d163d776ed55?crop=entropy&cs=srgb&fm=jpg&w=1200&q=75"
                  }
                  alt="Preview Background Dashboard & Login"
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/50 to-transparent" />
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-blue-300 font-bold uppercase tracking-wider block">
                      Live Preview Dashboard & Login
                    </span>
                    <span className="text-xs font-extrabold text-white truncate max-w-[200px] block">
                      {propertyName || "Grand Hotel Resort & Spa"}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 bg-black/60 backdrop-blur-sm text-white/90 text-[10px] font-medium rounded-md border border-white/20">
                    {bgUrl?.startsWith("data:image") ? "Foto Galeri Admin" : "URL Gambar"}
                  </span>
                </div>
              </div>

              {/* Upload from Gallery / Camera buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <input
                  type="file"
                  accept="image/*"
                  ref={bgFileInputRef}
                  onChange={handleSelectBgFile}
                  className="hidden"
                  id="bg-gallery-file-input"
                />

                <button
                  type="button"
                  id="btn-upload-bg-gallery"
                  disabled={uploadingBg}
                  onClick={() => bgFileInputRef.current?.click()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-2 disabled:opacity-50"
                >
                  {uploadingBg ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Memproses Foto...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      <span>Ambil dari Galeri / Kamera</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setShowUrlInput(!showUrlInput)}
                  className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                  <span>{showUrlInput ? "Tutup Kolom URL" : "Input Link URL"}</span>
                </button>
              </div>

              {/* Optional Text URL Input */}
              {showUrlInput && (
                <div className="pt-2 animate-in fade-in space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-500">
                    Tempelkan tautan URL gambar (misal Unsplash, CDN, atau cloud hosting):
                  </label>
                  <input
                    type="text"
                    value={bgUrl}
                    onChange={(e) => setBgUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none font-mono"
                  />
                </div>
              )}

              <p className="text-[11px] text-slate-500 leading-normal">
                Foto yang dipilih dari galeri HP, kamera, atau tautan URL akan otomatis disimpan dan langsung tampil sebagai gambar utama di Halaman Login dan banner latar belakang di Dashboard.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                {t("threshold_percent")} (Surge Alarm)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  placeholder="30"
                  className="w-32 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                />
                <span className="text-xs text-slate-500">
                  % di atas rata-rata 7 pencatatan terakhir memicu alarm
                </span>
              </div>
            </div>

            {/* Shift start times */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-blue-600" />
                    <span>{t("shifts")} (Jadwal Jam Mulai Operasional)</span>
                  </label>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Atur jam pergantian shift kerja engineering hotel
                  </p>
                </div>
                <button
                  type="button"
                  disabled={savingShift}
                  onClick={handleSaveShifts}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingShift ? "Menyimpan..." : "Simpan Jam Shift"}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Shift Pagi */}
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-700 flex items-center gap-1">
                      <Sun className="w-3.5 h-3.5 text-amber-500" />
                      <span>{t("pagi")}</span>
                    </span>
                    <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-md font-semibold">
                      Mulai
                    </span>
                  </div>
                  <input
                    type="time"
                    value={shiftPagi}
                    onChange={(e) => setShiftPagi(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900"
                  />
                  <div className="text-[11px] text-slate-500 font-medium">
                    Rentang: <span className="font-bold text-slate-700">{shiftPagi} - {shiftSore}</span>
                  </div>
                </div>

                {/* Shift Sore */}
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-orange-700 flex items-center gap-1">
                      <Sunset className="w-3.5 h-3.5 text-orange-500" />
                      <span>{t("sore")}</span>
                    </span>
                    <span className="text-[10px] bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded-md font-semibold">
                      Mulai
                    </span>
                  </div>
                  <input
                    type="time"
                    value={shiftSore}
                    onChange={(e) => setShiftSore(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900"
                  />
                  <div className="text-[11px] text-slate-500 font-medium">
                    Rentang: <span className="font-bold text-slate-700">{shiftSore} - {shiftMalam === "12:00" ? "00:00" : shiftMalam}</span>
                  </div>
                </div>

                {/* Shift Malam */}
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-700 flex items-center gap-1">
                      <Moon className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{t("malam")}</span>
                    </span>
                    <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-md font-semibold">
                      Mulai
                    </span>
                  </div>
                  <input
                    type="time"
                    value={shiftMalam}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "12:00") {
                        setShiftMalam("00:00");
                      } else {
                        setShiftMalam(v);
                      }
                    }}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900"
                  />
                  <div className="text-[11px] text-slate-500 font-medium">
                    Rentang: <span className="font-bold text-slate-700">{shiftMalam === "12:00" ? "00:00" : shiftMalam} - {shiftPagi}</span>
                  </div>
                </div>
              </div>

              {/* Quick presets for Shift Malam */}
              <div className="pt-1">
                <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 mb-1.5">
                  <Sparkles className="w-3 h-3 text-indigo-500" />
                  <span>Preset Cepat Jam Malam (Format 24 Jam):</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: "00:00 (12 Malam / Tengah Malam)", val: "00:00" },
                    { label: "23:00 (11 Malam)", val: "23:00" },
                    { label: "22:00 (10 Malam)", val: "22:00" },
                    { label: "20:00 (8 Malam)", val: "20:00" },
                  ].map((preset) => (
                    <button
                      key={preset.val}
                      type="button"
                      onClick={() => setShiftMalam(preset.val)}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border font-semibold transition ${
                        (shiftMalam === preset.val || (preset.val === "00:00" && shiftMalam === "12:00"))
                          ? "bg-indigo-600 text-white border-indigo-700 shadow-xs"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-2.5 flex items-start gap-2 text-[11px] text-blue-800">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p>
                  <strong>Tips Jam 12 Malam:</strong> Sistem menggunakan format 24 jam. Jam 12 Malam diinput sebagai <strong>00:00</strong>. Jika Anda memasukkan 12:00, itu dihitung sebagai jam 12 Siang. Tombol preset di atas akan langsung mengatur 00:00 dengan benar.
                </p>
              </div>
            </div>

            {/* Chart Trend Configuration */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3.5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                  <span>Rentang Grafik Tren Pemakaian (Line Chart)</span>
                </label>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Atur jumlah data/periode yang ditampilkan pada grafik garis pemakaian di Dashboard
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Harian */}
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-1.5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Tren Harian</span>
                    <span className="text-[10px] bg-blue-50 text-blue-700 font-bold px-1.5 py-0.5 rounded">Jam Shift</span>
                  </div>
                  <select
                    value={chartDays}
                    onChange={(e) => setChartDays(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900"
                  >
                    <option value="2">2 Hari (Bawaan)</option>
                    <option value="3">3 Hari</option>
                    <option value="5">5 Hari</option>
                    <option value="7">7 Hari (1 Minggu)</option>
                    <option value="14">14 Hari (2 Minggu)</option>
                    <option value="30">30 Hari (1 Bulan)</option>
                  </select>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    Menampilkan titik jam & pemakaian per shift (Pagi, Sore, Malam)
                  </p>
                </div>

                {/* Bulanan */}
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-1.5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Tren Bulanan</span>
                    <span className="text-[10px] bg-blue-50 text-blue-700 font-bold px-1.5 py-0.5 rounded">Bulan</span>
                  </div>
                  <select
                    value={chartMonths}
                    onChange={(e) => setChartMonths(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900"
                  >
                    <option value="2">2 Bulan (Bawaan)</option>
                    <option value="3">3 Bulan</option>
                    <option value="6">6 Bulan</option>
                    <option value="12">12 Bulan (1 Tahun)</option>
                  </select>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    Perbandingan total pemakaian antar bulan
                  </p>
                </div>

                {/* Tahunan */}
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-1.5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Tren Tahunan</span>
                    <span className="text-[10px] bg-blue-50 text-blue-700 font-bold px-1.5 py-0.5 rounded">Tahun</span>
                  </div>
                  <select
                    value={chartYears}
                    onChange={(e) => setChartYears(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900"
                  >
                    <option value="2">2 Tahun (Bawaan)</option>
                    <option value="3">3 Tahun</option>
                    <option value="5">5 Tahun</option>
                  </select>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    Perbandingan total pemakaian tahun ke tahun
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition shadow-sm flex items-center gap-1.5 disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? "Menyimpan..." : t("save")}</span>
              </button>
            </div>
          </form>
          )}

          {/* Submenu C: User Management Section */}
          {adminSubmenu === "users" && (
            <>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                <span>{t("users")} ({usersList.length})</span>
              </h2>
              <button
                type="button"
                onClick={() => setShowAddUser(!showAddUser)}
                className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-bold transition flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t("add_user")}</span>
              </button>
            </div>

            {showAddUser && (
              <form
                onSubmit={handleAddUser}
                className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3"
              >
                <h4 className="text-xs font-bold text-slate-800">Form Pengguna Baru</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    required
                    placeholder="Nama Lengkap"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Username (e.g. budi, andi)"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                  />
                  <input
                    type="password"
                    required
                    placeholder="Password"
                    value={newUserPass}
                    onChange={(e) => setNewUserPass(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                  />
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as any)}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold"
                  >
                    <option value="user">User (Teknisi)</option>
                    <option value="admin">Admin (Chief / Supervisor)</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddUser(false)}
                    className="px-3 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded-lg"
                  >
                    {t("cancel")}
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold"
                  >
                    {t("save")}
                  </button>
                </div>
              </form>
            )}

            <div className="divide-y divide-slate-100">
              {usersList.map((u) => (
                <div key={u.user_id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">{u.name}</span>
                    <span className="text-[11px] text-slate-500 font-mono">{u.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        u.role === "admin"
                          ? "bg-purple-100 text-purple-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {u.role}
                    </span>

                    {/* Edit Password Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setEditPassUser(u);
                        setEditPassValue("");
                        setShowEditPass(false);
                      }}
                      className="p-1.5 text-slate-400 hover:text-amber-600 rounded-lg hover:bg-amber-50 transition"
                      title="Ganti Password Pengguna"
                    >
                      <Key className="w-3.5 h-3.5" />
                    </button>

                    {u.user_id !== user?.user_id && (
                      <button
                        type="button"
                        onClick={() => handleDeleteUser(u.user_id, u.name)}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"
                        title="Hapus user"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Admin Credentials Change */}
          <form
            onSubmit={handleChangeAdminCreds}
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Lock className="w-4 h-4 text-blue-600" />
                <span>{t("change_admin_creds")}</span>
              </h2>
              <span className="text-[11px] text-slate-500 font-medium">
                Username Aktif: <strong className="text-slate-800">{user?.email || "admin"}</strong>
              </span>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              Jika username atau password diganti, kredensial lama otomatis dinonaktifkan permanen dan <strong>tidak dapat digunakan untuk login lagi</strong>.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              <input
                type="password"
                required
                placeholder={t("current_password")}
                value={currPass}
                onChange={(e) => setCurrPass(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              />
              <input
                type="text"
                placeholder="Username baru (opsional)"
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              />
              <input
                type="password"
                placeholder={t("new_password")}
                value={newAdminPass}
                onChange={(e) => setNewAdminPass(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              />
            </div>
            <div className="flex justify-end pt-1">
              <button
                type="submit"
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition"
              >
                Perbarui Kredensial
              </button>
            </div>
          </form>
          </>
          )}

          {/* Submenu E (Part 2): Integrasi Laporan & Sheets */}
          {adminSubmenu === "general" && (
            <ACIntegrationReportPanel propertyName={propertyName || "Midtown Hotel Samarinda"} />
          )}
        </>
      )}

      {/* Versi & Perbarui Aplikasi Langsung */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-5 rounded-2xl border border-blue-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-blue-600" />
            <span>Pembaruan Aplikasi HP (Sinkronkan Fitur Baru)</span>
          </h2>
          <p className="text-xs text-slate-600 mt-1 max-w-xl leading-relaxed">
            Jika fitur baru (seperti pilihan foto dari Galeri) belum muncul di HP Anda, klik tombol ini untuk memuat ulang sistem terbaru secara otomatis tanpa perlu install ulang.
          </p>
        </div>

        <button
          type="button"
          disabled={updatingApp}
          onClick={handleForceUpdateApp}
          className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-sm shrink-0 disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${updatingApp ? "animate-spin" : ""}`} />
          <span>{updatingApp ? "Memperbarui..." : "Perbarui Aplikasi Sekarang"}</span>
        </button>
      </div>

      {/* Language Selection Card (Pilihan Bahasa) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
          <Globe className="w-4 h-4 text-blue-600" />
          <span>Bahasa / Language</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setLang("id")}
            className={`p-3 rounded-xl border text-xs font-bold transition flex items-center justify-between ${
              lang === "id"
                ? "bg-blue-50 border-blue-500 text-blue-800"
                : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
            }`}
          >
            <span>Bahasa Indonesia</span>
            {lang === "id" && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
          </button>
          <button
            type="button"
            onClick={() => setLang("en")}
            className={`p-3 rounded-xl border text-xs font-bold transition flex items-center justify-between ${
              lang === "en"
                ? "bg-blue-50 border-blue-500 text-blue-800"
                : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
            }`}
          >
            <span>English (US)</span>
            {lang === "en" && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
          </button>
        </div>
      </div>

      {/* Logout / Keluar Akun Section (Placed at the very bottom) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <LogOut className="w-4 h-4 text-red-600" />
            <span>Keluar dari Aplikasi</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Sesi aktif: <strong className="text-slate-700">{user?.name}</strong> ({user?.email})
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setConfirmModal({
              open: true,
              title: "Keluar dari Akun",
              description: `Apakah Anda yakin ingin keluar dari akun "${user?.name}"? Anda harus login kembali untuk mencatat meteran.`,
              confirmText: "Ya, Keluar",
              action: async () => {
                logout();
              },
            });
          }}
          className="w-full sm:w-auto px-5 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-xl border border-red-200 transition flex items-center justify-center gap-2 shadow-sm"
        >
          <LogOut className="w-4 h-4" />
          <span>{t("logout")}</span>
        </button>
      </div>

      {/* Modal Edit Password Pengguna */}
      {editPassUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0 text-amber-700">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Ganti Password Pengguna</h3>
                <span className="text-[11px] text-slate-500">{editPassUser.name} ({editPassUser.email})</span>
              </div>
            </div>

            <form onSubmit={handleUpdateUserPassword} className="space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Password Baru
                </label>
                <div className="relative">
                  <input
                    type={showEditPass ? "text" : "password"}
                    required
                    placeholder="Masukkan password baru"
                    value={editPassValue}
                    onChange={(e) => setEditPassValue(e.target.value)}
                    className="w-full px-3 py-2 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPass(!showEditPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showEditPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Pengguna dapat langsung login dengan password baru ini.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setEditPassUser(null);
                    setEditPassValue("");
                  }}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingPass}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                >
                  {savingPass ? "Menyimpan..." : "Simpan Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal (Reliable on mobile & web) */}
      {confirmModal && confirmModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl border border-slate-200 space-y-3">
            <div className="flex items-center gap-2.5 text-red-600">
              <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">{confirmModal.title}</h3>
                <span className="text-[11px] text-slate-500">Konfirmasi Tindakan</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {confirmModal.description}
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={async () => {
                  const act = confirmModal.action;
                  setConfirmModal(null);
                  await act();
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
              >
                {confirmModal.confirmText || "Ya, Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
