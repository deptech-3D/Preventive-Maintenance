import React, { useState, useEffect } from "react";
import {
  Building2,
  User,
  Lock,
  Eye,
  EyeOff,
  Globe,
  Loader2,
  CheckCircle2,
  KeyRound,
  ShieldCheck,
  AlertCircle,
  X,
} from "lucide-react";
import { useAuth } from "../auth";
import { useI18n } from "../i18n";
import {
  requestAdminPasswordReset,
  resetAdminPasswordWithCode,
  fetchAppSettings,
} from "../supabaseService";

export function Login() {
  const { login } = useAuth();
  const { t, lang, setLang } = useI18n();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Dynamic Hotel Background & Title for Login
  const [heroBg, setHeroBg] = useState<string>(() => {
    if (typeof localStorage !== "undefined") {
      const custom =
        localStorage.getItem("meter_dashboard_custom_bg") ||
        localStorage.getItem("meter_login_custom_bg");
      if (custom) return custom;
      try {
        const raw = localStorage.getItem("meter_app_settings");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.dashboard_bg_url) return parsed.dashboard_bg_url;
        }
      } catch {}
    }
    return "https://images.unsplash.com/photo-1784411641863-d163d776ed55?crop=entropy&cs=srgb&fm=jpg&w=1200&q=75";
  });

  const [hotelTitle, setHotelTitle] = useState<string>(() => {
    if (typeof localStorage !== "undefined") {
      try {
        const raw = localStorage.getItem("meter_app_settings");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.property_name) return parsed.property_name;
        }
      } catch {}
    }
    return "";
  });

  // Forgot password modal states
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState<"request" | "verify">("request");
  const [forgotUser, setForgotUser] = useState("admin");
  const [adminTargetEmail, setAdminTargetEmail] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMsg, setForgotMsg] = useState<{ text: string; kind: "ok" | "err" } | null>(null);

  useEffect(() => {
    try {
      const lastUser = localStorage.getItem("meter_last_login_user");
      if (lastUser) {
        setUsername(lastUser);
      }
    } catch {}

    // Fetch latest app settings (photo & hotel title) from cloud database
    const loadSettings = async () => {
      try {
        const settings = await fetchAppSettings();
        if (settings) {
          if (settings.dashboard_bg_url) {
            setHeroBg(settings.dashboard_bg_url);
            try {
              localStorage.setItem("meter_dashboard_custom_bg", settings.dashboard_bg_url);
              localStorage.setItem("meter_login_custom_bg", settings.dashboard_bg_url);
            } catch {}
          }
          if (settings.property_name) {
            setHotelTitle(settings.property_name);
          }
        }
      } catch (err) {
        console.warn("Notice loading login settings:", err);
      }
    };
    loadSettings();

    // Listen to storage changes across tabs
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "meter_dashboard_custom_bg" || e.key === "meter_login_custom_bg") {
        if (e.newValue) setHeroBg(e.newValue);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      await login(username.trim(), password);
      try {
        localStorage.setItem("meter_last_login_user", username.trim());
      } catch {}
    } catch (err: any) {
      setError(err?.message || "Username atau password salah. Jika kredensial telah diganti di Pengaturan, silakan gunakan kredensial yang baru.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (userType: "admin" | "user") => {
    setError(null);
    setSuccessMsg(null);
    setLoading(true);
    const u = userType === "admin" ? "admin" : "budi";
    const p = userType === "admin" ? "admin" : "user123";
    setUsername(u);
    setPassword(p);
    try {
      await login(u, p);
      try {
        localStorage.setItem("meter_last_login_user", u);
      } catch {}
    } catch (err: any) {
      setError(err?.message || "Gagal masuk. Silakan gunakan kredensial Anda.");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotMsg(null);
    setForgotLoading(true);
    try {
      const res = await requestAdminPasswordReset(forgotUser.trim() || undefined);
      setAdminTargetEmail(res.admin_email);
      setForgotStep("verify");
      setForgotMsg({
        text: res.message || `Kode verifikasi 6-digit telah disiapkan untuk akun admin: ${res.admin_email}. Kode otomatis: ${res.code}`,
        kind: "ok",
      });
      if (res.code) {
        setVerifyCode(res.code);
      }
    } catch (err: any) {
      setForgotMsg({
        text: err?.message || "Gagal meminta kode verifikasi admin.",
        kind: "err",
      });
    } finally {
      setForgotLoading(false);
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotMsg(null);
    setForgotLoading(true);
    try {
      const res = await resetAdminPasswordWithCode(
        adminTargetEmail || forgotUser.trim(),
        verifyCode.trim(),
        newPassword.trim()
      );
      setSuccessMsg(res.message || "Password admin berhasil diubah. Silakan login!");
      setShowForgotModal(false);
      setPassword(newPassword.trim());
      if (adminTargetEmail) {
        setUsername(adminTargetEmail);
      }
    } catch (err: any) {
      setForgotMsg({
        text: err?.message || "Gagal mereset password.",
        kind: "err",
      });
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden" id="login-card">
        {/* Top Hero Section */}
        <div className="relative h-48 sm:h-52 w-full bg-slate-900 overflow-hidden">
          <img
            src={heroBg}
            alt={hotelTitle || "Hotel"}
            onError={() => {
              setHeroBg("https://images.unsplash.com/photo-1784411641863-d163d776ed55?crop=entropy&cs=srgb&fm=jpg&w=1200&q=75");
            }}
            className="w-full h-full object-cover opacity-85 transition-all duration-300"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
          <div className="absolute bottom-4 left-6 right-6">
            <div>
              <div className="flex items-center gap-1.5 text-blue-300 text-xs font-semibold uppercase tracking-wider mb-0.5">
                <Building2 className="w-3.5 h-3.5 text-blue-400" />
                <span className="truncate max-w-[240px]">{hotelTitle || t("apps_title")}</span>
              </div>
              <h1 className="text-xl font-extrabold text-white">{t("login")}</h1>
              <p className="text-xs text-slate-300">{t("tagline_sub")}</p>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} noValidate className="p-6 space-y-4">
          {error && (
            <div
              id="login-error"
              className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div
              id="login-success"
              className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-medium flex items-start gap-2"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              {t("username")}
            </label>
            <div className="relative flex items-center">
              <User className="absolute left-3.5 w-4 h-4 text-slate-400" />
              <input
                id="login-username-input"
                type="text"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                {t("password")}
              </label>
              <button
                type="button"
                onClick={() => {
                  setForgotMsg(null);
                  setForgotStep("request");
                  setForgotUser(username);
                  setShowForgotModal(true);
                }}
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 hover:underline"
              >
                Lupa Password?
              </button>
            </div>

            <div className="relative flex items-center">
              <Lock className="absolute left-3.5 w-4 h-4 text-slate-400" />
              <input
                id="login-password-input"
                type={showPass ? "text" : "password"}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
              />
              <button
                type="button"
                id="toggle-password"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 text-slate-400 hover:text-slate-600 p-1"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            id="login-submit-button"
            disabled={loading}
            className="w-full mt-2 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{t("login")}</span>
          </button>

          {/* Quick 1-Tap Login Buttons for Mobile / Fast Access */}
          <div className="pt-1">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-center mb-2">
              Atau Masuk Cepat (1-Sentuh untuk HP):
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin("admin")}
                disabled={loading}
                className="py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
                <span>Masuk Admin</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin("user")}
                disabled={loading}
                className="py-2.5 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <User className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Masuk Teknisi</span>
              </button>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-xs text-slate-700 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold flex items-center gap-1.5 text-slate-800 text-xs">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>Kredensial Login Sistem</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setUsername("admin");
                  setPassword("admin");
                }}
                className="text-[10px] font-bold px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition"
              >
                Isi Admin
              </button>
            </div>
            <div className="font-mono text-[11px] text-slate-600 flex justify-between items-center">
              <span>Admin: <strong className="text-slate-900">admin</strong> / <strong className="text-slate-900">admin</strong></span>
            </div>
            <div className="font-mono text-[11px] text-slate-500 flex justify-between items-center">
              <span>User: <strong className="text-slate-700">budi</strong> / <strong className="text-slate-700">user123</strong></span>
              <button
                type="button"
                onClick={() => {
                  setUsername("budi");
                  setPassword("user123");
                }}
                className="text-[10px] font-semibold text-blue-600 hover:underline"
              >
                Isi User
              </button>
            </div>
            <p className="text-[10px] text-slate-400 pt-0.5 italic">
              *Juga mendukung username/email <strong>engmidtownhotelsmd@gmail.com</strong> (password: <strong>admin</strong> atau <strong>123engsmd</strong>).
            </p>
          </div>

          {/* Language Toggle */}
          <div className="flex flex-col items-center gap-2 pt-1">
            <div className="flex justify-center items-center gap-2">
              <Globe className="w-3.5 h-3.5 text-slate-400" />
              <button
                type="button"
                onClick={() => setLang("id")}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                  lang === "id"
                    ? "bg-blue-100 text-blue-700 border border-blue-200"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Bahasa Indonesia (ID)
              </button>
              <button
                type="button"
                onClick={() => setLang("en")}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                  lang === "en"
                    ? "bg-blue-100 text-blue-700 border border-blue-200"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                English (EN)
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Reset Password Admin</h3>
                  <p className="text-[11px] text-slate-500">Verifikasi akun admin</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {forgotMsg && (
              <div
                className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                  forgotMsg.kind === "ok"
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-red-50 text-red-800 border border-red-200"
                }`}
              >
                {forgotMsg.kind === "ok" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                )}
                <span>{forgotMsg.text}</span>
              </div>
            )}

            {forgotStep === "request" ? (
              <form onSubmit={handleRequestResetCode} className="space-y-3">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Masukkan username atau email akun admin saat ini untuk menerima kode verifikasi 6-digit.
                </p>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Username / Email Admin
                  </label>
                  <input
                    type="text"
                    autoCapitalize="none"
                    autoCorrect="off"
                    required
                    value={forgotUser}
                    onChange={(e) => setForgotUser(e.target.value)}
                    placeholder="admin"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {forgotLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Minta Kode Verifikasi</span>
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleConfirmReset} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Kode Verifikasi (6-Digit)
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value)}
                    placeholder="e.g. 123456"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 tracking-widest text-center"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Password Baru
                  </label>
                  <input
                    type="password"
                    required
                    minLength={4}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimal 4 karakter"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div className="flex justify-between items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setForgotStep("request")}
                    className="text-xs text-slate-500 hover:underline"
                  >
                    &larr; Ubah Akun
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {forgotLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Simpan Password Baru</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
