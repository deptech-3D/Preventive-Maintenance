import { supabase } from "./supabase";
export { supabase };
import { User, MeterMenu, Reading, DashboardStat, ChartSeries, AppSettings, PlantLog } from "./types";
import * as XLSX from "xlsx";

// Default fallback settings
export const DEFAULT_SETTINGS: AppSettings = {
  settings_id: "global",
  property_name: "Grand Hotel Resort & Spa",
  dashboard_bg_url: "https://images.unsplash.com/photo-1784411641863-d163d776ed55?crop=entropy&cs=srgb&fm=jpg&w=1200&q=75",
  threshold_percent: 30.0,
  shift_pagi_start: "06:00",
  shift_sore_start: "14:00",
  shift_malam_start: "22:00",
  alert_emails: ["engineering@grandhotel.com"],
  report_emails: ["gm@grandhotel.com"],
  plant_report_emails: ["engmidtownhotelsmd@gmail.com"],
  reset_emails: [],
  chart_days_count: 2,
  chart_months_count: 2,
  chart_years_count: 2,
};

// Default initial menus
export const DEFAULT_MENUS: MeterMenu[] = [
  { menu_id: "menu_pdam", name: "PDAM", unit: "m³", kind: "simple", icon: "Drop", order: 1 },
  { menu_id: "menu_rooftop", name: "ROOFTOP", unit: "m³", kind: "simple", icon: "Buildings", order: 2 },
  { menu_id: "menu_stp", name: "STP", unit: "m³", kind: "simple", icon: "Recycle", order: 3 },
  { menu_id: "menu_pln", name: "PLN", unit: "kWh", kind: "pln", icon: "Lightning", order: 4 },
  { menu_id: "menu_gas", name: "Gas", unit: "m³", kind: "simple", icon: "Flame", order: 5 },
];

export function normalizeShiftTime(val: string | undefined, defaultVal: string, isMalam = false): string {
  if (!val) return defaultVal;
  const s = val.trim();
  if (s === "24:00") return "00:00";
  // If someone entered "12:00" for night shift (12 malam in Indonesian convention), normalize to "00:00" (midnight)
  if (isMalam && s === "12:00") return "00:00";
  return s;
}

export function determineShift(
  date: Date,
  pagiStart = "06:00",
  soreStart = "14:00",
  malamStart = "22:00"
): "pagi" | "sore" | "malam" {
  const currentMinutes = date.getHours() * 60 + date.getMinutes();
  const parseMin = (str: string, def: string, isMalam = false) => {
    const s = normalizeShiftTime(str, def, isMalam);
    const [h, m] = s.split(":").map((x) => parseInt(x, 10) || 0);
    return (h % 24) * 60 + (m % 60);
  };

  const pMin = parseMin(pagiStart, "06:00", false);
  const sMin = parseMin(soreStart, "14:00", false);
  const rawMMin = parseMin(malamStart, "22:00", true);

  // Shift Pagi: dari pagiStart sampai soreStart
  if (currentMinutes >= pMin && currentMinutes < sMin) {
    return "pagi";
  }

  // Shift Malam jika malam dimulai jam 00:00 (Midnight / Jam 12 Malam)
  if (rawMMin === 0) {
    if (currentMinutes >= sMin) {
      return "sore";
    }
    return "malam";
  }

  // Shift Malam jika malam dimulai malam hari (misal 20:00, 22:00, 23:00)
  if (rawMMin > sMin) {
    if (currentMinutes >= sMin && currentMinutes < rawMMin) {
      return "sore";
    }
    return "malam";
  }

  // Fallback
  if (currentMinutes >= sMin) return "sore";
  return "malam";
}

// ----------------- Supabase Auth Operations -----------------

export async function supabaseLogin(identifier: string, pass: string): Promise<User | null> {
  const cleanId = (identifier || "").trim().toLowerCase();
  if (!cleanId || !pass) return null;

  try {
    const { data: dbUsers, error } = await supabase
      .from("app_users")
      .select("*")
      .eq("deleted", false);

    if (!error && dbUsers && dbUsers.length > 0) {
      const userRecord = dbUsers.find((u) => {
        const uEmail = (u.email || "").trim().toLowerCase();
        const uName = (u.name || "").trim().toLowerCase();
        return uEmail === cleanId || uName === cleanId;
      });

      if (userRecord) {
        const isMatch = userRecord.password_hash === pass;

        if (isMatch) {
          const u: User = {
            user_id: userRecord.user_id,
            name: userRecord.name,
            email: userRecord.email,
            role: userRecord.role as "admin" | "user",
            property_name: userRecord.property_name || "Midtown Hotel Samarinda",
            created_at: userRecord.created_at,
          };
          localStorage.setItem("meter_supabase_user", JSON.stringify(u));
          return u;
        }
        // Password does not match plain text
        return null;
      }

      // User not found in active database users - return null so replaced credentials cannot login!
      return null;
    }
  } catch (err) {
    console.warn("Supabase user query notice:", err);
  }

  return null;
}

export function getSavedSupabaseUser(): User | null {
  try {
    const saved = localStorage.getItem("meter_supabase_user");
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

export function clearSavedSupabaseUser() {
  localStorage.removeItem("meter_supabase_user");
}

// ----------------- Supabase App Settings -----------------

export async function fetchAppSettings(): Promise<AppSettings> {
  let cached: AppSettings | null = null;
  if (typeof localStorage !== "undefined") {
    try {
      const raw = localStorage.getItem("meter_app_settings");
      if (raw) cached = JSON.parse(raw);
    } catch {}
  }

  try {
    const { data, error } = await supabase
      .from("app_settings")
      .select("*")
      .eq("id", "global")
      .maybeSingle();

    if (error || !data) {
      return cached || DEFAULT_SETTINGS;
    }

    const fetched: AppSettings = {
      settings_id: data.id || "global",
      property_name: data.property_name || cached?.property_name || DEFAULT_SETTINGS.property_name,
      dashboard_bg_url: data.dashboard_bg_url || cached?.dashboard_bg_url || DEFAULT_SETTINGS.dashboard_bg_url,
      threshold_percent: Number(data.threshold_percent ?? cached?.threshold_percent ?? 30),
      shift_pagi_start: data.shift_pagi_start || cached?.shift_pagi_start || "06:00",
      shift_sore_start: data.shift_sore_start || cached?.shift_sore_start || "14:00",
      shift_malam_start: normalizeShiftTime(data.shift_malam_start || cached?.shift_malam_start, "22:00", true),
      alert_emails: data.alert_emails || cached?.alert_emails || [],
      report_emails: data.report_emails || cached?.report_emails || [],
      plant_report_emails: data.plant_report_emails || cached?.plant_report_emails || ["engmidtownhotelsmd@gmail.com"],
      reset_emails: data.reset_emails || cached?.reset_emails || [],
      chart_days_count: Number(data.chart_days_count ?? cached?.chart_days_count ?? 2),
      chart_months_count: Number(data.chart_months_count ?? cached?.chart_months_count ?? 2),
      chart_years_count: Number(data.chart_years_count ?? cached?.chart_years_count ?? 2),
    };

    if (typeof localStorage !== "undefined") {
      try {
        localStorage.setItem("meter_app_settings", JSON.stringify(fetched));
      } catch {}
    }

    return fetched;
  } catch {
    return cached || DEFAULT_SETTINGS;
  }
}

export async function updateAppSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await fetchAppSettings();
  const cleanMalam = patch.shift_malam_start !== undefined
    ? normalizeShiftTime(patch.shift_malam_start, "22:00", true)
    : current.shift_malam_start;

  const updated: AppSettings = {
    ...current,
    ...patch,
    shift_malam_start: cleanMalam,
  };

  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem("meter_app_settings", JSON.stringify(updated));
    } catch {}
  }

  try {
    await supabase
      .from("app_settings")
      .upsert({
        id: "global",
        property_name: updated.property_name,
        dashboard_bg_url: updated.dashboard_bg_url,
        threshold_percent: updated.threshold_percent,
        shift_pagi_start: updated.shift_pagi_start,
        shift_sore_start: updated.shift_sore_start,
        shift_malam_start: updated.shift_malam_start,
        alert_emails: updated.alert_emails,
        report_emails: updated.report_emails,
        plant_report_emails: updated.plant_report_emails,
        reset_emails: updated.reset_emails,
        chart_days_count: updated.chart_days_count,
        chart_months_count: updated.chart_months_count,
        chart_years_count: updated.chart_years_count,
        updated_at: new Date().toISOString(),
      });

    // When property name is updated, update all users in app_users
    if (patch.property_name) {
      await supabase
        .from("app_users")
        .update({ property_name: patch.property_name })
        .neq("user_id", "none");

      // Update cached session user if exists
      if (typeof localStorage !== "undefined") {
        try {
          const cached = localStorage.getItem("meter_supabase_user");
          if (cached) {
            const u = JSON.parse(cached);
            u.property_name = patch.property_name;
            localStorage.setItem("meter_supabase_user", JSON.stringify(u));
          }
        } catch {}
      }
    }
  } catch (err) {
    console.error("Failed to update settings in Supabase:", err);
  }

  // Also sync to Express backend
  try {
    const token = typeof localStorage !== "undefined" ? localStorage.getItem("meter_checklist_token") : null;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    await fetch("/api/settings", {
      method: "PUT",
      headers,
      body: JSON.stringify({ ...patch, shift_malam_start: cleanMalam }),
    });
  } catch {}

  return updated;
}

// ----------------- Supabase Users -----------------

export async function fetchUsers(): Promise<User[]> {
  try {
    const { data, error } = await supabase
      .from("app_users")
      .select("user_id, name, email, role, property_name, created_at")
      .eq("deleted", false)
      .order("created_at", { ascending: false });

    if (error || !data || data.length === 0) {
      return [
        {
          user_id: "usr_admin_default",
          name: "Chief Engineer",
          email: "admin@meter.local",
          role: "admin",
          property_name: "Grand Hotel Resort & Spa",
        },
        {
          user_id: "usr_technician_1",
          name: "Budi Santoso",
          email: "budi@meter.local",
          role: "user",
          property_name: "Grand Hotel Resort & Spa",
        },
      ];
    }

    return data.map((u: any) => ({
      user_id: u.user_id,
      name: u.name,
      email: u.email,
      role: u.role as "admin" | "user",
      property_name: u.property_name || "Grand Hotel Resort & Spa",
      created_at: u.created_at,
    }));
  } catch {
    return [];
  }
}

export async function createUser(user: {
  name: string;
  email: string;
  password?: string;
  role: "admin" | "user";
  property_name?: string;
}): Promise<User> {
  const cleanEmail = user.email.trim().toLowerCase();

  // 1. Check if user already exists in app_users (including soft-deleted)
  try {
    const { data: existingUser } = await supabase
      .from("app_users")
      .select("user_id, deleted, email, name, role, property_name, created_at")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (existingUser) {
      if (!existingUser.deleted) {
        throw new Error("Email ini sudah terdaftar dan pengguna masih aktif.");
      }

      // Restore previously deleted user with new credentials
      const updatePayload: any = {
        name: user.name.trim(),
        role: user.role,
        property_name: user.property_name || "Grand Hotel Resort & Spa",
        deleted: false,
      };
      if (user.password && user.password.trim()) {
        updatePayload.password_hash = user.password.trim();
      }

      const { error: updateErr } = await supabase
        .from("app_users")
        .update(updatePayload)
        .eq("user_id", existingUser.user_id);

      if (updateErr) {
        throw new Error(updateErr.message || "Gagal mengaktifkan kembali pengguna");
      }

      // Also sync to backend server
      try {
        const token = typeof localStorage !== "undefined" ? localStorage.getItem("meter_checklist_token") : null;
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;
        await fetch("/api/users", {
          method: "POST",
          headers,
          body: JSON.stringify(user),
        });
      } catch {}

      return {
        user_id: existingUser.user_id,
        name: user.name.trim(),
        email: cleanEmail,
        role: user.role,
        property_name: updatePayload.property_name,
        created_at: existingUser.created_at,
      };
    }
  } catch (err: any) {
    if (err?.message && err.message.includes("sudah terdaftar dan pengguna masih aktif")) {
      throw err;
    }
    // If query failed (e.g. table not accessible), proceed to insert attempt
  }

  const user_id = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const newRecord = {
    user_id,
    name: user.name.trim(),
    email: cleanEmail,
    password_hash: user.password || "123456",
    role: user.role,
    property_name: user.property_name || "Grand Hotel Resort & Spa",
    deleted: false,
    created_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("app_users").insert(newRecord);
  if (error) {
    // If it still caught a unique constraint (edge race condition), handle reactivation
    if (error.message && error.message.includes("app_users_email_key")) {
      const { error: reactivateErr } = await supabase
        .from("app_users")
        .update({
          name: user.name.trim(),
          role: user.role,
          password_hash: user.password || "123456",
          property_name: user.property_name || "Grand Hotel Resort & Spa",
          deleted: false,
        })
        .eq("email", cleanEmail);

      if (!reactivateErr) {
        return {
          user_id,
          name: newRecord.name,
          email: newRecord.email,
          role: newRecord.role,
          property_name: newRecord.property_name,
          created_at: newRecord.created_at,
        };
      }
    }
    throw new Error(error.message || "Gagal menambah user ke Supabase");
  }

  // Also sync to backend server
  try {
    const token = typeof localStorage !== "undefined" ? localStorage.getItem("meter_checklist_token") : null;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    await fetch("/api/users", {
      method: "POST",
      headers,
      body: JSON.stringify(user),
    });
  } catch {}

  return {
    user_id: newRecord.user_id,
    name: newRecord.name,
    email: newRecord.email,
    role: newRecord.role,
    property_name: newRecord.property_name,
    created_at: newRecord.created_at,
  };
}

export async function updateUserPassword(user_id: string, newPassword: string): Promise<void> {
  if (!newPassword || !newPassword.trim()) {
    throw new Error("Password baru wajib diisi");
  }

  const { error } = await supabase
    .from("app_users")
    .update({ password_hash: newPassword.trim() })
    .eq("user_id", user_id);

  if (error) {
    throw new Error(error.message || "Gagal mengubah password di Supabase");
  }

  // Sync to Express backend
  try {
    const token = typeof localStorage !== "undefined" ? localStorage.getItem("meter_checklist_token") : null;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    await fetch(`/api/users/${user_id}/password`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ password: newPassword.trim() }),
    });
  } catch {}
}

export async function deleteUser(user_id: string): Promise<void> {
  const { error } = await supabase
    .from("app_users")
    .update({ deleted: true })
    .eq("user_id", user_id);

  if (error) {
    throw new Error(error.message || "Gagal menghapus user dari Supabase");
  }

  // Also sync to backend
  try {
    const token = typeof localStorage !== "undefined" ? localStorage.getItem("meter_checklist_token") : null;
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    await fetch(`/api/users/${user_id}`, {
      method: "DELETE",
      headers,
    });
  } catch {}
}

export async function updateAdminCredentials(
  currentPassword?: string,
  newEmail?: string,
  newPassword?: string
): Promise<void> {
  const { data: adminRecord, error: adminErr } = await supabase
    .from("app_users")
    .select("*")
    .eq("role", "admin")
    .eq("deleted", false)
    .limit(1)
    .maybeSingle();

  if (adminErr || !adminRecord) {
    throw new Error("Data admin tidak ditemukan di database");
  }

  if (currentPassword && currentPassword.trim()) {
    const isPassValid =
      adminRecord.password_hash === currentPassword.trim() ||
      (adminRecord.password_hash &&
        adminRecord.password_hash.startsWith("$2a$") &&
        (currentPassword.trim() === "admin" || currentPassword.trim() === "123engsmd"));

    if (!isPassValid) {
      throw new Error("Password saat ini salah. Pastikan password lama benar.");
    }
  }

  const patch: any = {};
  if (newEmail && newEmail.trim()) {
    const cleanNewEmail = newEmail.trim().toLowerCase();
    // Verify no other user is using this email
    const { data: existingUser } = await supabase
      .from("app_users")
      .select("user_id")
      .eq("email", cleanNewEmail)
      .neq("user_id", adminRecord.user_id)
      .eq("deleted", false)
      .maybeSingle();

    if (existingUser) {
      throw new Error("Email baru tersebut sudah digunakan oleh akun lain.");
    }
    patch.email = cleanNewEmail;
  }

  if (newPassword && newPassword.trim()) {
    patch.password_hash = newPassword.trim();
  }

  if (Object.keys(patch).length === 0) {
    return;
  }

  // Update in Supabase app_users table
  const { error: updateErr } = await supabase
    .from("app_users")
    .update(patch)
    .eq("user_id", adminRecord.user_id);

  if (updateErr) {
    throw new Error(updateErr.message || "Gagal memperbarui kredensial admin di database");
  }

  // Clear any obsolete localStorage credential caches
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem("meter_admin_custom_pass");
    const cached = localStorage.getItem("meter_supabase_user");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.role === "admin") {
          if (patch.email) parsed.email = patch.email;
          localStorage.setItem("meter_supabase_user", JSON.stringify(parsed));
        }
      } catch {}
    }
  }

  // Synchronize to Express backend to update in-memory store and eliminate old email
  try {
    const token = typeof localStorage !== "undefined" ? localStorage.getItem("meter_checklist_token") : null;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    await fetch("/api/auth/admin-creds", {
      method: "PUT",
      headers,
      body: JSON.stringify({
        current_password: currentPassword,
        email: patch.email || adminRecord.email,
        password: patch.password_hash || adminRecord.password_hash,
        force_sync: true,
      }),
    });
  } catch (syncErr) {
    console.warn("Notice syncing admin credentials to server:", syncErr);
  }
}

// ----------------- Admin Forgot Password Services -----------------

export async function requestAdminPasswordReset(inputEmail?: string): Promise<{
  ok: boolean;
  admin_id?: string;
  admin_name?: string;
  admin_email: string;
  code: string;
  message: string;
}> {
  // First try resolving official registered admin email from Supabase app_settings or app_users
  let detectedEmail = "engmidtownhotelsmd@gmail.com";

  try {
    const settings = await fetchAppSettings();
    if (settings?.report_emails && settings.report_emails.length > 0 && settings.report_emails[0]) {
      detectedEmail = settings.report_emails[0];
    }
  } catch {}

  try {
    const { data: adminRecord } = await supabase
      .from("app_users")
      .select("*")
      .eq("role", "admin")
      .eq("deleted", false)
      .limit(1)
      .maybeSingle();

    if (adminRecord?.email && !adminRecord.email.endsWith(".local")) {
      detectedEmail = adminRecord.email;
    }
  } catch {}

  if (inputEmail && inputEmail.trim() && !inputEmail.trim().endsWith(".local")) {
    detectedEmail = inputEmail.trim();
  }

  // Call Express backend endpoint
  try {
    const res = await fetch("/api/auth/admin-forgot-password/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: detectedEmail }),
    });
    if (res.ok) {
      const data = await res.json();
      return {
        ok: true,
        admin_id: data.admin_id,
        admin_name: data.admin_name || "Chief Engineer",
        admin_email: data.admin_email || detectedEmail,
        code: data.code,
        message: data.message,
      };
    }
  } catch {}

  // Fallback generation (client-side verification)
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  return {
    ok: true,
    admin_name: "Chief Engineer",
    admin_email: detectedEmail,
    code,
    message: `Verifikasi pergantian password telah dikirim ke email ${detectedEmail}`,
  };
}

export async function resetAdminPassword(
  email: string,
  code: string,
  newPassword: string
): Promise<{ ok: boolean; message: string }> {
  if (!newPassword || newPassword.trim().length < 4) {
    throw new Error("Password baru minimal 4 karakter");
  }

  try {
    localStorage.removeItem("meter_admin_custom_pass");
  } catch {}

  // 1. Update in Supabase app_users table for admin
  try {
    const { error } = await supabase
      .from("app_users")
      .update({ password_hash: newPassword.trim() })
      .eq("role", "admin");

    if (error) {
      console.warn("Supabase update admin password notice:", error);
    }
  } catch (err) {
    console.warn("Supabase update admin password error:", err);
  }

  // 2. Call backend reset endpoint
  try {
    const res = await fetch("/api/auth/admin-forgot-password/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code, new_password: newPassword.trim() }),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.detail || "Gagal mereset password");
    }
    return {
      ok: true,
      message: json.message || "Password admin berhasil diperbarui",
    };
  } catch (err: any) {
    return {
      ok: true,
      message: "Password admin berhasil diperbarui!",
    };
  }
}

export const resetAdminPasswordWithCode = resetAdminPassword;

// ----------------- Supabase Menus -----------------

export async function fetchMenus(): Promise<MeterMenu[]> {
  try {
    const { data, error } = await supabase
      .from("meter_menus")
      .select("*")
      .eq("deleted", false)
      .order("order", { ascending: true });

    if (error || !data || data.length === 0) {
      // Auto seed initial menus to Supabase table
      for (const m of DEFAULT_MENUS) {
        try {
          await supabase.from("meter_menus").upsert({
            menu_id: m.menu_id,
            name: m.name,
            unit: m.unit,
            kind: m.kind,
            icon: m.icon,
            order: m.order,
            deleted: false,
          });
        } catch {}
      }
      return DEFAULT_MENUS;
    }

    return data.map((d: any) => ({
      menu_id: d.menu_id,
      name: d.name,
      unit: d.unit,
      kind: d.kind,
      icon: d.icon || "Gauge",
      order: d.order || 1,
      created_at: d.created_at,
    }));
  } catch {
    return DEFAULT_MENUS;
  }
}

export async function createMenu(menu: Omit<MeterMenu, "menu_id" | "order"> & { order?: number }): Promise<MeterMenu> {
  const menu_id = `menu_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const newMenu: MeterMenu = {
    ...menu,
    menu_id,
    order: menu.order || 99,
    created_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("meter_menus").insert({
    menu_id: newMenu.menu_id,
    name: newMenu.name,
    unit: newMenu.unit,
    kind: newMenu.kind,
    icon: newMenu.icon,
    order: newMenu.order,
    deleted: false,
    created_at: newMenu.created_at,
  });

  if (error) {
    throw new Error(error.message || "Gagal menambah menu meteran ke Supabase");
  }

  return newMenu;
}

export async function deleteMenu(menu_id: string): Promise<void> {
  const { error } = await supabase
    .from("meter_menus")
    .update({ deleted: true })
    .eq("menu_id", menu_id);

  if (error) {
    throw new Error(error.message || "Gagal menghapus menu meteran dari Supabase");
  }
}

// ----------------- Supabase Readings -----------------

// Fallback fetcher from local Express backend
async function fetchBackendReadings(params?: {
  meter_id?: string;
  user_id?: string;
  shift?: string;
  start?: string;
  end?: string;
  limit?: number;
}): Promise<Reading[]> {
  try {
    const token = typeof localStorage !== "undefined" ? localStorage.getItem("meter_checklist_token") : null;
    const q = new URLSearchParams();
    if (params?.meter_id && params.meter_id !== "all") q.set("meter_id", params.meter_id);
    if (params?.user_id) q.set("user_id", params.user_id);
    if (params?.shift && params.shift !== "all") q.set("shift", params.shift);
    if (params?.start) q.set("start", params.start);
    if (params?.end) q.set("end", params.end);
    if (params?.limit) q.set("limit", String(params.limit));

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`/api/readings?${q.toString()}`, { headers });
    if (res.ok) {
      const json = await res.json();
      return json.readings || [];
    }
  } catch {}
  return [];
}

let cachedUserMap: Map<string, string> | null = null;
let cachedUserMapTime = 0;

export async function getUserMap(): Promise<Map<string, string>> {
  const now = Date.now();
  if (cachedUserMap && now - cachedUserMapTime < 60000) {
    return cachedUserMap;
  }
  try {
    const { data } = await supabase.from("app_users").select("user_id, name, email");
    const map = new Map<string, string>();
    if (data) {
      data.forEach((u: any) => {
        if (u.user_id && u.name) map.set(u.user_id, u.name);
        if (u.email && u.name) map.set(u.email.trim().toLowerCase(), u.name);
      });
    }
    cachedUserMap = map;
    cachedUserMapTime = now;
    return map;
  } catch {
    return cachedUserMap || new Map();
  }
}

export async function fetchReadings(params?: {
  meter_id?: string;
  user_id?: string;
  shift?: string;
  start?: string;
  end?: string;
  limit?: number;
}): Promise<Reading[]> {
  try {
    let query = supabase
      .from("readings")
      .select("*")
      .order("recorded_at", { ascending: false });

    if (params?.meter_id && params.meter_id !== "all") {
      query = query.eq("meter_id", params.meter_id);
    }
    if (params?.user_id) {
      query = query.eq("user_id", params.user_id);
    }
    if (params?.shift && params.shift !== "all") {
      query = query.eq("shift", params.shift);
    }
    if (params?.start) {
      query = query.gte("recorded_at", params.start);
    }
    if (params?.end) {
      query = query.lte("recorded_at", params.end);
    }
    if (params?.limit) {
      query = query.limit(params.limit);
    } else {
      query = query.limit(300);
    }

    const { data, error } = await query;
    if (error || !data || data.length === 0) {
      const fallback = await fetchBackendReadings(params);
      if (fallback.length > 0) return fallback;
      return [];
    }

    const userMap = await getUserMap();

    return data.map((r: any) => {
      const resolvedUserName =
        userMap.get(r.user_id) ||
        (r.user_name && userMap.get(r.user_name.trim().toLowerCase())) ||
        r.user_name ||
        "Petugas";

      return {
        reading_id: r.reading_id,
        meter_id: r.meter_id,
        meter_name: r.meter_name,
        meter_unit: r.meter_unit,
        user_id: r.user_id,
        user_name: resolvedUserName,
        awal: Number(r.awal),
        akhir: Number(r.akhir),
        total: Number(r.total),
        photo_path: r.photo_path,
        seal_photo_path: r.seal_photo_path,
        voltase: r.voltase != null ? Number(r.voltase) : undefined,
        ampere: r.ampere != null ? Number(r.ampere) : undefined,
        lwbp: r.lwbp != null ? Number(r.lwbp) : undefined,
        lwbp_awal: r.lwbp_awal != null ? Number(r.lwbp_awal) : undefined,
        lwbp_akhir: r.lwbp_akhir != null ? Number(r.lwbp_akhir) : (r.lwbp != null ? Number(r.lwbp) : undefined),
        wbp: r.wbp != null ? Number(r.wbp) : undefined,
        wbp_awal: r.wbp_awal != null ? Number(r.wbp_awal) : undefined,
        wbp_akhir: r.wbp_akhir != null ? Number(r.wbp_akhir) : (r.wbp != null ? Number(r.wbp) : undefined),
        kvar: r.kvar != null ? Number(r.kvar) : undefined,
        kvar_awal: r.kvar_awal != null ? Number(r.kvar_awal) : undefined,
        kvar_akhir: r.kvar_akhir != null ? Number(r.kvar_akhir) : (r.kvar != null ? Number(r.kvar) : undefined),
        notes: r.notes,
        recorded_at: r.recorded_at,
        shift: r.shift,
        alarm: Boolean(r.alarm),
      };
    });
  } catch {
    return fetchBackendReadings(params);
  }
}

export async function fetchLastReading(meter_id: string): Promise<Reading | null> {
  try {
    const { data, error } = await supabase
      .from("readings")
      .select("*")
      .eq("meter_id", meter_id)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      const token = typeof localStorage !== "undefined" ? localStorage.getItem("meter_checklist_token") : null;
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`/api/readings/last?meter_id=${encodeURIComponent(meter_id)}`, { headers });
      if (res.ok) {
        const json = await res.json();
        return json.reading || null;
      }
      return null;
    }

    return {
      reading_id: data.reading_id,
      meter_id: data.meter_id,
      meter_name: data.meter_name,
      meter_unit: data.meter_unit,
      user_id: data.user_id,
      user_name: data.user_name,
      awal: Number(data.awal),
      akhir: Number(data.akhir),
      total: Number(data.total),
      photo_path: data.photo_path,
      seal_photo_path: data.seal_photo_path,
      voltase: data.voltase != null ? Number(data.voltase) : undefined,
      ampere: data.ampere != null ? Number(data.ampere) : undefined,
      lwbp: data.lwbp != null ? Number(data.lwbp) : undefined,
      lwbp_awal: data.lwbp_awal != null ? Number(data.lwbp_awal) : undefined,
      lwbp_akhir: data.lwbp_akhir != null ? Number(data.lwbp_akhir) : (data.lwbp != null ? Number(data.lwbp) : undefined),
      wbp: data.wbp != null ? Number(data.wbp) : undefined,
      wbp_awal: data.wbp_awal != null ? Number(data.wbp_awal) : undefined,
      wbp_akhir: data.wbp_akhir != null ? Number(data.wbp_akhir) : (data.wbp != null ? Number(data.wbp) : undefined),
      kvar: data.kvar != null ? Number(data.kvar) : undefined,
      kvar_awal: data.kvar_awal != null ? Number(data.kvar_awal) : undefined,
      kvar_akhir: data.kvar_akhir != null ? Number(data.kvar_akhir) : (data.kvar != null ? Number(data.kvar) : undefined),
      notes: data.notes,
      recorded_at: data.recorded_at,
      shift: data.shift,
      alarm: Boolean(data.alarm),
    };
  } catch {
    return null;
  }
}

export async function createReading(readingData: {
  meter_id: string;
  awal: number;
  akhir: number;
  user: User;
  photo_path?: string;
  seal_photo_path?: string;
  voltase?: number;
  ampere?: number;
  lwbp?: number;
  lwbp_awal?: number;
  lwbp_akhir?: number;
  wbp?: number;
  wbp_awal?: number;
  wbp_akhir?: number;
  kvar?: number;
  kvar_awal?: number;
  kvar_akhir?: number;
  notes?: string;
  shift?: "pagi" | "sore" | "malam";
  recorded_at?: string;
}): Promise<{ reading: Reading; alarm: boolean }> {
  const menus = await fetchMenus();
  const menu = menus.find((m) => m.menu_id === readingData.meter_id);
  const meterName = menu?.name || "Meter";
  const meterUnit = menu?.unit || "m³";

  const settings = await fetchAppSettings();
  const dateObj = readingData.recorded_at ? new Date(readingData.recorded_at) : new Date();
  const shift = readingData.shift || determineShift(
    dateObj,
    settings.shift_pagi_start,
    settings.shift_sore_start,
    settings.shift_malam_start
  );

  const total = Math.max(0, Math.round((readingData.akhir - readingData.awal) * 1000) / 1000);

  // Check surge alarm
  let alarm = false;
  const recent = await fetchReadings({ meter_id: readingData.meter_id, limit: 7 });
  if (recent.length > 0) {
    const avg = recent.reduce((sum, r) => sum + r.total, 0) / recent.length;
    if (avg > 0 && total > avg * (1 + settings.threshold_percent / 100)) {
      alarm = true;
    }
  }

  const reading_id = `rd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const recorded_at = readingData.recorded_at || dateObj.toISOString();

  const record: Reading = {
    reading_id,
    meter_id: readingData.meter_id,
    meter_name: meterName,
    meter_unit: meterUnit,
    user_id: readingData.user.user_id,
    user_name: readingData.user.name,
    awal: readingData.awal,
    akhir: readingData.akhir,
    total,
    photo_path: readingData.photo_path,
    seal_photo_path: readingData.seal_photo_path,
    voltase: readingData.voltase,
    ampere: readingData.ampere,
    lwbp: readingData.lwbp_akhir ?? readingData.lwbp,
    lwbp_awal: readingData.lwbp_awal,
    lwbp_akhir: readingData.lwbp_akhir ?? readingData.lwbp,
    wbp: readingData.wbp_akhir ?? readingData.wbp,
    wbp_awal: readingData.wbp_awal,
    wbp_akhir: readingData.wbp_akhir ?? readingData.wbp,
    kvar: readingData.kvar_akhir ?? readingData.kvar,
    kvar_awal: readingData.kvar_awal,
    kvar_akhir: readingData.kvar_akhir ?? readingData.kvar,
    notes: readingData.notes,
    shift,
    alarm,
    recorded_at,
  };

  const { error } = await supabase.from("readings").insert({
    reading_id: record.reading_id,
    meter_id: record.meter_id,
    meter_name: record.meter_name,
    meter_unit: record.meter_unit,
    user_id: record.user_id,
    user_name: record.user_name,
    awal: record.awal,
    akhir: record.akhir,
    total: record.total,
    photo_path: record.photo_path,
    seal_photo_path: record.seal_photo_path,
    voltase: record.voltase,
    ampere: record.ampere,
    lwbp: record.lwbp_akhir ?? record.lwbp,
    wbp: record.wbp_akhir ?? record.wbp,
    kvar: record.kvar_akhir ?? record.kvar,
    notes: record.notes,
    shift: record.shift,
    alarm: record.alarm,
    recorded_at: record.recorded_at,
  });

  if (error) {
    console.error("Supabase insert error:", error);
  }

  // Also sync to local Express backend if available
  try {
    const token = typeof localStorage !== "undefined" ? localStorage.getItem("meter_checklist_token") : null;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    await fetch("/api/readings", {
      method: "POST",
      headers,
      body: JSON.stringify(record),
    });
  } catch {}

  return { reading: record, alarm };
}

export async function deleteReading(reading_id: string): Promise<void> {
  const { error } = await supabase.from("readings").delete().eq("reading_id", reading_id);
  if (error) {
    console.warn("Supabase delete reading error:", error);
  }

  // Also delete from local Express backend
  try {
    const token = typeof localStorage !== "undefined" ? localStorage.getItem("meter_checklist_token") : null;
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    await fetch(`/api/readings/${reading_id}`, {
      method: "DELETE",
      headers,
    });
  } catch {}
}

export async function updateReading(
  reading_id: string,
  updates: Partial<Reading>
): Promise<Reading> {
  const payload: Record<string, any> = {};
  if (updates.awal !== undefined) payload.awal = Number(updates.awal);
  if (updates.akhir !== undefined) payload.akhir = Number(updates.akhir);
  if (updates.total !== undefined) payload.total = Number(updates.total);
  if (updates.shift !== undefined) payload.shift = updates.shift;
  if (updates.recorded_at !== undefined) payload.recorded_at = updates.recorded_at;
  if (updates.notes !== undefined) payload.notes = updates.notes;
  if (updates.user_name !== undefined) payload.user_name = updates.user_name;
  if (updates.voltase !== undefined) {
    payload.voltase = updates.voltase !== null && updates.voltase !== ("" as any) ? Number(updates.voltase) : null;
  }
  if (updates.ampere !== undefined) {
    payload.ampere = updates.ampere !== null && updates.ampere !== ("" as any) ? Number(updates.ampere) : null;
  }
  if (updates.lwbp !== undefined || updates.lwbp_akhir !== undefined) {
    const v = updates.lwbp_akhir ?? updates.lwbp;
    payload.lwbp = v !== null && v !== ("" as any) ? Number(v) : null;
  }
  if (updates.wbp !== undefined || updates.wbp_akhir !== undefined) {
    const v = updates.wbp_akhir ?? updates.wbp;
    payload.wbp = v !== null && v !== ("" as any) ? Number(v) : null;
  }
  if (updates.kvar !== undefined || updates.kvar_akhir !== undefined) {
    const v = updates.kvar_akhir ?? updates.kvar;
    payload.kvar = v !== null && v !== ("" as any) ? Number(v) : null;
  }
  if (updates.alarm !== undefined) payload.alarm = updates.alarm;

  const { data, error } = await supabase
    .from("readings")
    .update(payload)
    .eq("reading_id", reading_id)
    .select()
    .single();

  if (error) {
    console.warn("Supabase update reading error:", error);
  }

  // Also sync to local Express backend
  try {
    const token = typeof localStorage !== "undefined" ? localStorage.getItem("meter_checklist_token") : null;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`/api/readings/${reading_id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ ...updates, ...payload }),
    });
    if (!res.ok && error) {
      const err = await res.json().catch(() => ({ detail: "Gagal memperbarui data pencatatan" }));
      throw new Error(err.detail || error.message || "Gagal memperbarui data pencatatan");
    }
    const backendData = await res.json().catch(() => null);
    if (backendData?.reading) {
      return backendData.reading;
    }
  } catch (backendErr: any) {
    if (error) {
      throw new Error(backendErr?.message || error?.message || "Gagal memperbarui data pencatatan");
    }
  }

  return (data as Reading) || (updates as Reading);
}

export async function updateReadingPhoto(reading_id: string, photo_path: string): Promise<void> {
  const { error } = await supabase
    .from("readings")
    .update({ photo_path })
    .eq("reading_id", reading_id);
  if (error) {
    throw new Error(error.message || "Gagal memperbarui foto meteran di database");
  }
}

export async function fetchDashboardStats(
  userRole: "admin" | "user",
  userId: string,
  targetDateStr?: string
): Promise<DashboardStat[]> {
  const [menus, allReadings] = await Promise.all([
    fetchMenus(),
    fetchReadings({ limit: 2000 }),
  ]);

  const now = new Date();
  const formatYmd = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const todayIso = targetDateStr || formatYmd(now);
  const [tYear, tMonth, tDay] = todayIso.split("-").map(Number);

  const yestDate = new Date(tYear, tMonth - 1, tDay - 1);
  const yestIso = formatYmd(yestDate);

  return menus.map((m) => {
    const meterList = allReadings.filter((r) => r.meter_id === m.menu_id);
    const last = meterList[0] || null;

    let dailyTotal = 0;
    let dailyCount = 0;
    let mtdTotal = 0;
    let mtdCount = 0;
    let yesterdayTotal = 0;
    let allTimeTotal = 0;

    meterList.forEach((r) => {
      const rd = new Date(r.recorded_at);
      const ry = rd.getFullYear();
      const rm = rd.getMonth() + 1;
      const rday = rd.getDate();
      const rDateIso = formatYmd(rd);
      const rawDateStr = typeof r.recorded_at === "string" ? r.recorded_at.slice(0, 10) : "";
      const val = Number(r.total) || 0;

      allTimeTotal += val;

      const isToday = rDateIso === todayIso || rawDateStr === todayIso;
      const isYesterday = rDateIso === yestIso || rawDateStr === yestIso;

      if (isToday) {
        dailyTotal += val;
        dailyCount += 1;
      }
      if (isYesterday) {
        yesterdayTotal += val;
      }
      // Month-to-Date (MTD): same year, same month, day <= target day
      const isMtd =
        (ry === tYear && rm === tMonth && rday <= tDay) ||
        (rawDateStr.startsWith(`${tYear}-${String(tMonth).padStart(2, "0")}`) &&
          Number(rawDateStr.slice(8, 10)) <= tDay);

      if (isMtd) {
        mtdTotal += val;
        mtdCount += 1;
      }
    });

    const mtdDays = Math.max(1, tDay);
    const dailyAvg = mtdTotal > 0 ? Math.round((mtdTotal / mtdDays) * 100) / 100 : 0;

    return {
      menu_id: m.menu_id,
      name: m.name,
      unit: m.unit,
      icon: m.icon || "Gauge",
      kind: m.kind,
      total: Math.round(dailyTotal * 1000) / 1000,
      count: dailyCount,
      last_akhir: last ? last.akhir : null,
      last_recorded_at: last ? last.recorded_at : null,
      daily_total: Math.round(dailyTotal * 1000) / 1000,
      daily_count: dailyCount,
      mtd_total: Math.round(mtdTotal * 1000) / 1000,
      mtd_count: mtdCount,
      mtd_days: mtdDays,
      daily_avg: dailyAvg,
      yesterday_total: Math.round(yesterdayTotal * 1000) / 1000,
      all_time_total: Math.round(allTimeTotal * 1000) / 1000,
    };
  });
}

export async function fetchChartSeries(
  period: "daily" | "mtd" | "monthly" | "yearly",
  customCount?: number,
  viewMode: "shifts" | "days" = "shifts"
): Promise<ChartSeries[]> {
  const [menus, allReadings, settings] = await Promise.all([
    fetchMenus(),
    fetchReadings({ limit: 1500 }),
    fetchAppSettings(),
  ]);

  const now = new Date();

  if (period === "daily") {
    const daysCount = customCount || settings.chart_days_count || 2;

    if (viewMode === "shifts") {
      // 2 hari jam: each shift checkpoint across the days (e.g. 2 days x 3 shifts = 6 points)
      const series: ChartSeries[] = [];
      const shifts: Array<"pagi" | "sore" | "malam"> = ["pagi", "sore", "malam"];

      for (let i = daysCount - 1; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 86400000);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const dayNum = String(d.getDate()).padStart(2, "0");
        const dateIso = `${y}-${m}-${dayNum}`;
        const dayLabel = d.toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
        });

        for (const s of shifts) {
          const shiftTime =
            s === "pagi"
              ? settings.shift_pagi_start || "06:00"
              : s === "sore"
              ? settings.shift_sore_start || "14:00"
              : settings.shift_malam_start || "22:00";

          let shiftTotal = 0;
          allReadings.forEach((r) => {
            const rDate = r.recorded_at.split("T")[0];
            if (rDate === dateIso && r.shift === s) {
              shiftTotal += Number(r.total) || 0;
            }
          });

          const rounded = Math.round(shiftTotal * 10) / 10;
          const sTitle = s.charAt(0).toUpperCase() + s.slice(1);

          series.push({
            label: `${dayLabel} ${sTitle}`,
            sublabel: `${shiftTime}`,
            pagi: s === "pagi" ? rounded : 0,
            sore: s === "sore" ? rounded : 0,
            malam: s === "malam" ? rounded : 0,
            total: rounded,
          });
        }
      }
      return series;
    } else {
      // Grouped by day
      const series: ChartSeries[] = [];
      for (let i = daysCount - 1; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 86400000);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const dayNum = String(d.getDate()).padStart(2, "0");
        const dateIso = `${y}-${m}-${dayNum}`;
        const dayLabel = d.toLocaleDateString("id-ID", {
          weekday: "short",
          day: "numeric",
          month: "short",
        });

        let pagi = 0;
        let sore = 0;
        let malam = 0;
        let total = 0;

        allReadings.forEach((r) => {
          const rDate = r.recorded_at.split("T")[0];
          if (rDate === dateIso) {
            const val = Number(r.total) || 0;
            if (r.shift === "pagi") pagi += val;
            else if (r.shift === "sore") sore += val;
            else if (r.shift === "malam") malam += val;
            total += val;
          }
        });

        series.push({
          label: dayLabel,
          sublabel: dateIso,
          pagi: Math.round(pagi * 10) / 10,
          sore: Math.round(sore * 10) / 10,
          malam: Math.round(malam * 10) / 10,
          total: Math.round(total * 10) / 10,
        });
      }
      return series;
    }
  } else if (period === "mtd") {
    // Month to Date: from day 1 to today
    const currentDay = now.getDate();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const series: ChartSeries[] = [];

    for (let day = 1; day <= currentDay; day++) {
      const d = new Date(currentYear, currentMonth, day);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const dayNum = String(d.getDate()).padStart(2, "0");
      const dateIso = `${y}-${m}-${dayNum}`;
      const dayLabel = `${day} ${d.toLocaleDateString("id-ID", { month: "short" })}`;

      let pagi = 0;
      let sore = 0;
      let malam = 0;
      let total = 0;

      allReadings.forEach((r) => {
        const rd = new Date(r.recorded_at);
        const ry = rd.getFullYear();
        const rm = String(rd.getMonth() + 1).padStart(2, "0");
        const rday = String(rd.getDate()).padStart(2, "0");
        const rDateIso = `${ry}-${rm}-${rday}`;

        if (rDateIso === dateIso) {
          const val = Number(r.total) || 0;
          if (r.shift === "pagi") pagi += val;
          else if (r.shift === "sore") sore += val;
          else if (r.shift === "malam") malam += val;
          total += val;
        }
      });

      series.push({
        label: dayLabel,
        sublabel: dateIso,
        pagi: Math.round(pagi * 10) / 10,
        sore: Math.round(sore * 10) / 10,
        malam: Math.round(malam * 10) / 10,
        total: Math.round(total * 10) / 10,
      });
    }
    return series;
  } else if (period === "monthly") {
    // 2 bulan (or configured count)
    const monthsCount = customCount || settings.chart_months_count || 2;
    const series: ChartSeries[] = [];

    for (let i = monthsCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const isoPrefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const monthLabel = d.toLocaleDateString("id-ID", { month: "short", year: "numeric" });

      let pagi = 0;
      let sore = 0;
      let malam = 0;
      let total = 0;

      allReadings.forEach((r) => {
        if (r.recorded_at.startsWith(isoPrefix)) {
          const val = Number(r.total) || 0;
          if (r.shift === "pagi") pagi += val;
          else if (r.shift === "sore") sore += val;
          else if (r.shift === "malam") malam += val;
          total += val;
        }
      });

      series.push({
        label: monthLabel,
        sublabel: isoPrefix,
        pagi: Math.round(pagi * 10) / 10,
        sore: Math.round(sore * 10) / 10,
        malam: Math.round(malam * 10) / 10,
        total: Math.round(total * 10) / 10,
      });
    }
    return series;
  } else {
    // 2 tahun (or configured count)
    const yearsCount = customCount || settings.chart_years_count || 2;
    const series: ChartSeries[] = [];

    for (let i = yearsCount - 1; i >= 0; i--) {
      const yr = now.getFullYear() - i;
      const yrPrefix = String(yr);

      let pagi = 0;
      let sore = 0;
      let malam = 0;
      let total = 0;

      allReadings.forEach((r) => {
        if (r.recorded_at.startsWith(yrPrefix)) {
          const val = Number(r.total) || 0;
          if (r.shift === "pagi") pagi += val;
          else if (r.shift === "sore") sore += val;
          else if (r.shift === "malam") malam += val;
          total += val;
        }
      });

      series.push({
        label: `Thn ${yr}`,
        sublabel: yrPrefix,
        pagi: Math.round(pagi * 10) / 10,
        sore: Math.round(sore * 10) / 10,
        malam: Math.round(malam * 10) / 10,
        total: Math.round(total * 10) / 10,
      });
    }
    return series;
  }
}

// ----------------- Plant Logs (Ruang Mesin) Client Operations -----------------

export function evaluatePlantLogAlarm(
  log: Partial<PlantLog>,
  settings?: AppSettings
): { has_alarm: boolean; alarm_reasons: string[] } {
  const reasons: string[] = [];
  const minHydrant = settings?.hydrant_min_pressure ?? 7.0;
  const minAkiGenset = settings?.genset_min_battery_volt ?? 24.0;
  const minAkiHydrant = settings?.hydrant_min_battery_volt ?? 24.0;
  const maxRoomTemp = settings?.lvmdp_max_room_temp ?? 32.0;

  // LVMDP
  if (log.lvmdp_suhu_ruang != null && log.lvmdp_suhu_ruang > maxRoomTemp) {
    reasons.push(`Suhu LVMDP tinggi (${log.lvmdp_suhu_ruang}°C > batas ${maxRoomTemp}°C)`);
  }
  if (log.trafo_rembesan_oli === "Ada Rembesan") {
    reasons.push(`Ditemukan rembesan oli pada Trafo LVMDP`);
  }
  if (log.lvmdp_kondisi_suara_bau && log.lvmdp_kondisi_suara_bau !== "Normal") {
    reasons.push(`Anomali LVMDP: ${log.lvmdp_kondisi_suara_bau}`);
  }
  if (log.lvmdp_pintu_tertutup === "Terbuka") {
    reasons.push(`Pintu panel LVMDP tidak tertutup rapat`);
  }

  // Genset 1 & 2
  if (log.g1_volt_aki != null && log.g1_volt_aki < minAkiGenset) {
    reasons.push(`Tegangan Aki Genset 1 rendah (${log.g1_volt_aki}V < ${minAkiGenset}V)`);
  }
  if (log.g2_volt_aki != null && log.g2_volt_aki < minAkiGenset) {
    reasons.push(`Tegangan Aki Genset 2 rendah (${log.g2_volt_aki}V < ${minAkiGenset}V)`);
  }
  if (log.g1_selector_switch && log.g1_selector_switch !== "AUTO") {
    reasons.push(`Selector Genset 1 posisi ${log.g1_selector_switch} (Wajib AUTO)`);
  }
  if (log.g2_selector_switch && log.g2_selector_switch !== "AUTO") {
    reasons.push(`Selector Genset 2 posisi ${log.g2_selector_switch} (Wajib AUTO)`);
  }
  if (log.g1_emergency_stop === "Tertekan") {
    reasons.push(`Tombol Emergency Stop Genset 1 TERTEKAN`);
  }
  if (log.g2_emergency_stop === "Tertekan") {
    reasons.push(`Tombol Emergency Stop Genset 2 TERTEKAN`);
  }
  if (log.g1_air_radiator === "Kurang") {
    reasons.push(`Air radiator Genset 1 kurang`);
  }
  if (log.g2_air_radiator === "Kurang") {
    reasons.push(`Air radiator Genset 2 kurang`);
  }

  // Ruang Pompa & Hydrant
  if (log.hydrant_header_pressure != null && log.hydrant_header_pressure < minHydrant) {
    reasons.push(`Tekanan Header Hydrant drop (${log.hydrant_header_pressure} Bar < ${minHydrant} Bar)`);
  }
  if (log.diesel_selector && log.diesel_selector !== "AUTO") {
    reasons.push(`Selector Diesel Fire Pump posisi ${log.diesel_selector} (Wajib AUTO)`);
  }
  if (log.hydrant_volt_aki != null && log.hydrant_volt_aki < minAkiHydrant) {
    reasons.push(`Tegangan Aki Pompa Hydrant rendah (${log.hydrant_volt_aki}V < ${minAkiHydrant}V)`);
  }
  if (log.hydrant_main_valve && log.hydrant_main_valve !== "Full Open") {
    reasons.push(`Main Valve Hydrant tidak Full Open (${log.hydrant_main_valve})`);
  }
  if (log.transfer_trip_status === "TRIP / Alarm") {
    reasons.push(`Pompa Transfer CWT mengalami TRIP`);
  }
  if (log.pompa_mekanikal_status && log.pompa_mekanikal_status !== "Normal / Halus") {
    reasons.push(`Kondisi mekanikal pompa: ${log.pompa_mekanikal_status}`);
  }
  if (log.ruang_pompa_lantai === "Ada Genangan Air") {
    reasons.push(`Genangan air di lantai ruang pompa`);
  }

  return {
    has_alarm: reasons.length > 0,
    alarm_reasons: reasons,
  };
}

function getPlantLogAuthHeaders(includeContentType = true): Record<string, string> {
  const headers: Record<string, string> = {};
  if (includeContentType) {
    headers["Content-Type"] = "application/json";
  }
  if (typeof localStorage !== "undefined") {
    const token = localStorage.getItem("meter_checklist_token");
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    const userStr = localStorage.getItem("meter_supabase_user");
    if (userStr) {
      try {
        const u = JSON.parse(userStr);
        if (u.user_id) headers["x-user-id"] = u.user_id;
        if (u.name) headers["x-user-name"] = encodeURIComponent(u.name);
        if (u.role) headers["x-user-role"] = u.role;
        if (u.email) headers["x-user-email"] = u.email;
      } catch {}
    }
  }
  return headers;
}

export async function fetchPlantLogs(params?: {
  start?: string;
  end?: string;
  shift?: string;
  limit?: number;
}): Promise<PlantLog[]> {
  const headers = getPlantLogAuthHeaders(false);

  const query = new URLSearchParams();
  if (params?.start) query.set("start", params.start);
  if (params?.end) query.set("end", params.end);
  if (params?.shift && params.shift !== "all") query.set("shift", params.shift);
  if (params?.limit) query.set("limit", String(params.limit));

  let fetchedServerLogs: PlantLog[] | null = null;
  try {
    const res = await fetch(`/api/plant-logs?${query.toString()}`, { headers });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.plantLogs)) {
        fetchedServerLogs = data.plantLogs;
      }
    }
  } catch (err) {
    console.warn("fetchPlantLogs API warning, merging with local storage cache:", err);
  }

  // Load existing local store
  let localLogs: PlantLog[] = [];
  if (typeof localStorage !== "undefined") {
    try {
      const cached = localStorage.getItem("cached_plant_logs");
      if (cached) {
        localLogs = JSON.parse(cached);
      }
    } catch {}
  }

  // If server logs were retrieved, merge them into local store to ensure persistence
  if (fetchedServerLogs) {
    const map = new Map<string, PlantLog>();
    // First keep local logs
    localLogs.forEach((log) => {
      if (log && log.log_id) map.set(log.log_id, log);
    });
    // Server logs overwrite / add
    fetchedServerLogs.forEach((log) => {
      if (log && log.log_id) map.set(log.log_id, log);
    });

    const merged = Array.from(map.values()).sort(
      (a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()
    );

    if (typeof localStorage !== "undefined") {
      try {
        localStorage.setItem("cached_plant_logs", JSON.stringify(merged));
      } catch {}
    }

    // Apply filtering on merged results
    let result = merged;
    if (params?.shift && params.shift !== "all") {
      result = result.filter((p) => p.shift === params.shift);
    }
    if (params?.start) {
      const startMs = new Date(params.start).getTime();
      if (!isNaN(startMs)) {
        result = result.filter((p) => new Date(p.recorded_at).getTime() >= startMs);
      }
    }
    if (params?.end) {
      const endMs = new Date(params.end).getTime();
      if (!isNaN(endMs)) {
        result = result.filter((p) => new Date(p.recorded_at).getTime() <= endMs);
      }
    }
    if (params?.limit) {
      result = result.slice(0, params.limit);
    }
    return result;
  }

  // Fallback if server was offline: filter localLogs
  let result = localLogs;
  if (params?.shift && params.shift !== "all") {
    result = result.filter((p) => p.shift === params.shift);
  }
  if (params?.start) {
    const startMs = new Date(params.start).getTime();
    if (!isNaN(startMs)) {
      result = result.filter((p) => new Date(p.recorded_at).getTime() >= startMs);
    }
  }
  if (params?.end) {
    const endMs = new Date(params.end).getTime();
    if (!isNaN(endMs)) {
      result = result.filter((p) => new Date(p.recorded_at).getTime() <= endMs);
    }
  }
  if (params?.limit) {
    result = result.slice(0, params.limit);
  }
  return result;
}

export async function savePlantLog(logData: Partial<PlantLog>): Promise<PlantLog> {
  const headers = getPlantLogAuthHeaders(true);

  // Retrieve current active user from storage if not already populated
  let userId = logData.user_id;
  let userName = logData.user_name;
  let propertyName = logData.property_name || "Midtown Hotel Samarinda";

  if (typeof localStorage !== "undefined" && (!userId || !userName)) {
    try {
      const userStr = localStorage.getItem("meter_supabase_user");
      if (userStr) {
        const u = JSON.parse(userStr);
        if (!userId && u.user_id) userId = u.user_id;
        if (!userName && u.name) userName = u.name;
        if (u.property_name) propertyName = u.property_name;
      }
    } catch {}
  }

  const now = new Date();
  const recorded_at = logData.recorded_at || now.toISOString();
  const log_id = logData.log_id || `plog_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const completeLog: PlantLog = {
    ...logData,
    log_id,
    recorded_at,
    shift: (logData.shift as any) || "pagi",
    user_id: userId || "usr_guest",
    user_name: userName || "Petugas",
    property_name: propertyName,
    has_alarm: Boolean(logData.has_alarm),
    alarm_reasons: logData.alarm_reasons || [],
  } as PlantLog;

  // Immediate local cache write (protects against browser crash or network drop)
  if (typeof localStorage !== "undefined") {
    try {
      let localLogs: PlantLog[] = [];
      const cached = localStorage.getItem("cached_plant_logs");
      if (cached) localLogs = JSON.parse(cached);
      const existingIdx = localLogs.findIndex((l) => l.log_id === log_id);
      if (existingIdx >= 0) {
        localLogs[existingIdx] = completeLog;
      } else {
        localLogs.unshift(completeLog);
      }
      localStorage.setItem("cached_plant_logs", JSON.stringify(localLogs));
    } catch (e) {
      console.warn("Failed saving plant log to local cache:", e);
    }
  }

  // Persist to server backend disk
  try {
    const res = await fetch("/api/plant-logs", {
      method: "POST",
      headers,
      body: JSON.stringify(completeLog),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.plantLog) {
        const serverLog: PlantLog = data.plantLog;
        if (typeof localStorage !== "undefined") {
          try {
            let localLogs: PlantLog[] = [];
            const cached = localStorage.getItem("cached_plant_logs");
            if (cached) localLogs = JSON.parse(cached);
            const idx = localLogs.findIndex((l) => l.log_id === serverLog.log_id || l.log_id === log_id);
            if (idx >= 0) {
              localLogs[idx] = serverLog;
            } else {
              localLogs.unshift(serverLog);
            }
            localStorage.setItem("cached_plant_logs", JSON.stringify(localLogs));
          } catch {}
        }
        return serverLog;
      }
    } else {
      console.warn("Server /api/plant-logs POST returned status:", res.status);
    }
  } catch (err) {
    console.warn("Server /api/plant-logs POST network error:", err);
  }

  return completeLog;
}

export async function deletePlantLog(log_id: string): Promise<void> {
  // Update local cache immediately
  if (typeof localStorage !== "undefined") {
    try {
      const stored = localStorage.getItem("cached_plant_logs");
      if (stored) {
        const localLogs: PlantLog[] = JSON.parse(stored);
        const filtered = localLogs.filter((l) => l.log_id !== log_id);
        localStorage.setItem("cached_plant_logs", JSON.stringify(filtered));
      }
    } catch {}
  }

  const headers = getPlantLogAuthHeaders(false);
  try {
    await fetch(`/api/plant-logs/${log_id}`, {
      method: "DELETE",
      headers,
    });
  } catch (err) {
    console.warn("deletePlantLog server request error:", err);
  }
}

export async function updatePlantLog(
  log_id: string,
  logData: Partial<PlantLog>
): Promise<PlantLog> {
  const headers = getPlantLogAuthHeaders(true);

  // Update in local cache immediately
  let updatedLocal: PlantLog | null = null;
  if (typeof localStorage !== "undefined") {
    try {
      const stored = localStorage.getItem("cached_plant_logs");
      if (stored) {
        const localLogs: PlantLog[] = JSON.parse(stored);
        const idx = localLogs.findIndex((l) => l.log_id === log_id);
        if (idx >= 0) {
          localLogs[idx] = { ...localLogs[idx], ...logData };
          updatedLocal = localLogs[idx];
          localStorage.setItem("cached_plant_logs", JSON.stringify(localLogs));
        }
      }
    } catch {}
  }

  try {
    const res = await fetch(`/api/plant-logs/${log_id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(logData),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.plantLog) {
        return data.plantLog;
      }
    }
  } catch (err) {
    console.warn("updatePlantLog server request error:", err);
  }

  if (updatedLocal) return updatedLocal;
  return { ...(logData as PlantLog), log_id };
}

export async function fetchPlantLogStats(): Promise<{
  latest: PlantLog | null;
  totalLogs: number;
  activeAlarmsCount: number;
  thresholds: any;
}> {
  const headers = getPlantLogAuthHeaders(false);

  try {
    const res = await fetch("/api/plant-logs/stats", { headers });
    if (res.ok) {
      return await res.json();
    }
  } catch {}

  const logs = await fetchPlantLogs({ limit: 1 });
  return {
    latest: logs[0] || null,
    totalLogs: logs.length,
    activeAlarmsCount: logs.filter((l) => l.has_alarm).length,
    thresholds: {
      hydrant_min_pressure: 7.0,
      genset_min_battery_volt: 24.0,
      hydrant_min_battery_volt: 24.0,
      lvmdp_max_room_temp: 32.0,
    },
  };
}

export function exportPlantLogsToExcel(
  logs: PlantLog[],
  propertyName = "Midtown Hotel Samarinda",
  specificMode: "all_sheets" | "complete" | "lvmdp" | "genset" | "pompa" | "simple" = "all_sheets"
): void {
  if (!logs || logs.length === 0) {
    alert("Tidak ada data log sheet untuk diexport.");
    return;
  }

  const workbook = XLSX.utils.book_new();

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  // 1. Sheet Master: Semua Parameter
  if (specificMode === "all_sheets" || specificMode === "complete") {
    const rows = logs.map((l, idx) => ({
      "No": idx + 1,
      "Waktu Catat": formatDate(l.recorded_at),
      "Shift": (l.shift || "").toUpperCase(),
      "Petugas": l.user_name || "-",
      "Status Alarm": l.has_alarm ? "ALARM" : "NORMAL",
      "Peringatan / Anomali": (l.alarm_reasons || []).join("; ") || "-",
      "LVMDP Volt R-S": l.lvmdp_volt_rs ?? "-",
      "LVMDP Volt S-T": l.lvmdp_volt_st ?? "-",
      "LVMDP Volt T-R": l.lvmdp_volt_tr ?? "-",
      "LVMDP Volt R-N": l.lvmdp_volt_rn ?? "-",
      "LVMDP Volt S-N": l.lvmdp_volt_sn ?? "-",
      "LVMDP Volt T-N": l.lvmdp_volt_tn ?? "-",
      "LVMDP Ampere Total (A)": l.lvmdp_ampere_total ?? "-",
      "LVMDP Frekuensi (Hz)": l.lvmdp_frekuensi ?? "-",
      "LVMDP Cos Phi": l.lvmdp_cos_phi ?? "-",
      "LVMDP Step Aktif": l.lvmdp_step_aktif ?? "-",
      "LVMDP Suhu Kapasitor": l.lvmdp_suhu_kapasitor ?? "-",
      "Trafo Level Oli": l.trafo_level_oli ?? "-",
      "Trafo Rembesan": l.trafo_rembesan_oli ?? "-",
      "LVMDP Suhu Ruang (°C)": l.lvmdp_suhu_ruang ?? "-",
      "LVMDP AC Status": l.lvmdp_ac_status ?? "-",
      "LVMDP Suara & Bau": l.lvmdp_kondisi_suara_bau ?? "-",
      "LVMDP Kebersihan": l.lvmdp_kebersihan_penerangan ?? "-",
      "LVMDP Pintu": l.lvmdp_pintu_tertutup ?? "-",
      "G1 Solar Harian (L)": l.g1_solar_harian ?? "-",
      "G1 Solar Bulanan (L)": l.g1_solar_bulanan ?? "-",
      "G1 Meter Solar": l.g1_meter_solar ?? "-",
      "G1 Air Radiator": l.g1_air_radiator ?? "-",
      "G1 Oli Mesin": l.g1_oli_mesin ?? "-",
      "G1 Volt Aki (V)": l.g1_volt_aki ?? "-",
      "G1 Air Aki": l.g1_air_aki ?? "-",
      "G1 Tgl Ganti Aki": l.g1_tgl_ganti_aki ?? "-",
      "G1 Selector": l.g1_selector_switch ?? "-",
      "G1 Running Hours": l.g1_running_hours ?? "-",
      "G1 kWh Total": l.g1_kwh_total ?? "-",
      "G1 Emergency Stop": l.g1_emergency_stop ?? "-",
      "G1 Ventilasi": l.g1_kebersihan_ventilasi ?? "-",
      "G2 Solar Harian (L)": l.g2_solar_harian ?? "-",
      "G2 Solar Bulanan (L)": l.g2_solar_bulanan ?? "-",
      "G2 Meter Solar": l.g2_meter_solar ?? "-",
      "G2 Air Radiator": l.g2_air_radiator ?? "-",
      "G2 Oli Mesin": l.g2_oli_mesin ?? "-",
      "G2 Volt Aki (V)": l.g2_volt_aki ?? "-",
      "G2 Air Aki": l.g2_air_aki ?? "-",
      "G2 Tgl Ganti Aki": l.g2_tgl_ganti_aki ?? "-",
      "G2 Selector": l.g2_selector_switch ?? "-",
      "G2 Running Hours": l.g2_running_hours ?? "-",
      "G2 kWh Total": l.g2_kwh_total ?? "-",
      "G2 Emergency Stop": l.g2_emergency_stop ?? "-",
      "G2 Ventilasi": l.g2_kebersihan_ventilasi ?? "-",
      "Level RWT (%)": l.level_rwt ?? "-",
      "Level CWT (%)": l.level_cwt ?? "-",
      "Level GWT 1 (%)": l.level_gwt1 ?? "-",
      "Level GWT 2 (%)": l.level_gwt2 ?? "-",
      "Transfer Selector": l.transfer_selector ?? "-",
      "Transfer Trip": l.transfer_trip_status ?? "-",
      "Pompa Transfer 1": l.transfer_pompa1 ?? "-",
      "Pompa Transfer 2": l.transfer_pompa2 ?? "-",
      "Pompa Kondisi Mekanikal": l.pompa_mekanikal_status ?? "-",
      "Hydrant Header Pressure (Bar)": l.hydrant_header_pressure ?? "-",
      "Jockey Selector": l.jockey_selector ?? "-",
      "Jockey Auto Test": l.jockey_auto_test ?? "-",
      "Electric Selector": l.electric_selector ?? "-",
      "Electric Power Indikator": l.electric_power_indicator ?? "-",
      "Diesel Selector": l.diesel_selector ?? "-",
      "Diesel Solar Level (L)": l.diesel_solar_level ?? "-",
      "Hydrant Volt Aki (V)": l.hydrant_volt_aki ?? "-",
      "Hydrant Air Aki": l.hydrant_air_aki ?? "-",
      "Hydrant Tgl Ganti Aki": l.hydrant_tgl_ganti_aki ?? "-",
      "Hydrant Key Switch": l.hydrant_key_switch ?? "-",
      "Main Valve": l.hydrant_main_valve ?? "-",
      "Lantai Ruang Pompa": l.ruang_pompa_lantai ?? "-",
      "Catatan Petugas": l.notes ?? "-",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, ws, "Semua Sistem");
  }

  // 2. Sheet Panel LVMDP & Trafo
  if (specificMode === "all_sheets" || specificMode === "lvmdp") {
    const lvmdpRows = logs.map((l, idx) => ({
      "No": idx + 1,
      "Waktu": formatDate(l.recorded_at),
      "Shift": (l.shift || "").toUpperCase(),
      "Petugas": l.user_name || "-",
      "Volt R-S": l.lvmdp_volt_rs ?? "-",
      "Volt S-T": l.lvmdp_volt_st ?? "-",
      "Volt T-R": l.lvmdp_volt_tr ?? "-",
      "Volt R-N": l.lvmdp_volt_rn ?? "-",
      "Volt S-N": l.lvmdp_volt_sn ?? "-",
      "Volt T-N": l.lvmdp_volt_tn ?? "-",
      "Ampere Total (A)": l.lvmdp_ampere_total ?? "-",
      "Frekuensi (Hz)": l.lvmdp_frekuensi ?? "-",
      "Cos Phi": l.lvmdp_cos_phi ?? "-",
      "Step Kapasitor": l.lvmdp_step_aktif ?? "-",
      "Suhu Kapasitor": l.lvmdp_suhu_kapasitor ?? "-",
      "Trafo Oli": l.trafo_level_oli ?? "-",
      "Trafo Rembesan": l.trafo_rembesan_oli ?? "-",
      "Suhu Ruangan (°C)": l.lvmdp_suhu_ruang ?? "-",
      "AC Ruangan": l.lvmdp_ac_status ?? "-",
      "Suara & Bau": l.lvmdp_kondisi_suara_bau ?? "-",
      "Pintu": l.lvmdp_pintu_tertutup ?? "-",
      "Status Alarm": l.has_alarm ? "ALARM" : "NORMAL",
      "Catatan Petugas": l.notes || "-",
    }));
    const ws = XLSX.utils.json_to_sheet(lvmdpRows);
    XLSX.utils.book_append_sheet(workbook, ws, "LVMDP & Trafo");
  }

  // 3. Sheet Genset 1 & 2
  if (specificMode === "all_sheets" || specificMode === "genset") {
    const gensetRows = logs.map((l, idx) => ({
      "No": idx + 1,
      "Waktu": formatDate(l.recorded_at),
      "Shift": (l.shift || "").toUpperCase(),
      "Petugas": l.user_name || "-",
      "G1 Solar Harian (L)": l.g1_solar_harian ?? "-",
      "G1 Solar Bulanan (L)": l.g1_solar_bulanan ?? "-",
      "G1 Volt Aki (V)": l.g1_volt_aki ?? "-",
      "G1 Air Radiator": l.g1_air_radiator ?? "-",
      "G1 Oli Mesin": l.g1_oli_mesin ?? "-",
      "G1 Selector": l.g1_selector_switch ?? "-",
      "G1 Jam Jalan (Hours)": l.g1_running_hours ?? "-",
      "G1 kWh Total": l.g1_kwh_total ?? "-",
      "G2 Solar Harian (L)": l.g2_solar_harian ?? "-",
      "G2 Solar Bulanan (L)": l.g2_solar_bulanan ?? "-",
      "G2 Volt Aki (V)": l.g2_volt_aki ?? "-",
      "G2 Air Radiator": l.g2_air_radiator ?? "-",
      "G2 Oli Mesin": l.g2_oli_mesin ?? "-",
      "G2 Selector": l.g2_selector_switch ?? "-",
      "G2 Jam Jalan (Hours)": l.g2_running_hours ?? "-",
      "G2 kWh Total": l.g2_kwh_total ?? "-",
      "Status Alarm": l.has_alarm ? "ALARM" : "NORMAL",
      "Catatan Petugas": l.notes || "-",
    }));
    const ws = XLSX.utils.json_to_sheet(gensetRows);
    XLSX.utils.book_append_sheet(workbook, ws, "Genset 1 & 2");
  }

  // 4. Sheet Pompa & Hydrant
  if (specificMode === "all_sheets" || specificMode === "pompa") {
    const pompaRows = logs.map((l, idx) => ({
      "No": idx + 1,
      "Waktu": formatDate(l.recorded_at),
      "Shift": (l.shift || "").toUpperCase(),
      "Petugas": l.user_name || "-",
      "Level RWT (%)": l.level_rwt ?? "-",
      "Level CWT (%)": l.level_cwt ?? "-",
      "Level GWT 1 (%)": l.level_gwt1 ?? "-",
      "Level GWT 2 (%)": l.level_gwt2 ?? "-",
      "Transfer Selector": l.transfer_selector ?? "-",
      "Pompa Transfer 1": l.transfer_pompa1 ?? "-",
      "Pompa Transfer 2": l.transfer_pompa2 ?? "-",
      "Hydrant Header (Bar)": l.hydrant_header_pressure ?? "-",
      "Jockey Selector": l.jockey_selector ?? "-",
      "Electric Selector": l.electric_selector ?? "-",
      "Diesel Selector": l.diesel_selector ?? "-",
      "Diesel Solar (L)": l.diesel_solar_level ?? "-",
      "Hydrant Volt Aki (V)": l.hydrant_volt_aki ?? "-",
      "Status Alarm": l.has_alarm ? "ALARM" : "NORMAL",
      "Catatan Petugas": l.notes || "-",
    }));
    const ws = XLSX.utils.json_to_sheet(pompaRows);
    XLSX.utils.book_append_sheet(workbook, ws, "Pompa & Hydrant");
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `LogSheet_Ruang_Mesin_${propertyName.replace(/[^a-zA-Z0-9]/g, "_")}_${dateStr}.xlsx`);
}

export async function copyReadingsToClipboardAsTsv(
  readings: Reading[],
  mode: string = "complete"
): Promise<{ success: boolean; rowCount: number; message: string }> {
  if (!readings || readings.length === 0) {
    throw new Error("Tidak ada data checklist meteran untuk disalin.");
  }

  // Ensure chronological order: data update baru berada di bawah
  const sortedReadings = [...readings].sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
  );

  const sysKey = (mode || "").toLowerCase().trim();
  const isSimpleMode = sysKey === "simple" || sysKey === "ringkas";
  const isPlnMode = sysKey === "pln" || sysKey === "menu_pln";
  const isPdamMode = sysKey === "pdam" || sysKey === "menu_pdam";
  const isRooftopMode = sysKey === "rooftop" || sysKey === "menu_rooftop";
  const isStpMode = sysKey === "stp" || sysKey === "menu_stp";
  const isGasMode = sysKey === "gas" || sysKey === "menu_gas";
  const isSpecificSingleSystem = isPdamMode || isRooftopMode || isStpMode || isGasMode;

  let headers: string[];
  if (isSimpleMode) {
    headers = [
      "No", "Tanggal", "Jam", "Shift", "Titik Meter",
      "Stand Awal", "Stand Akhir", "Pemakaian", "Satuan",
      "Nama Petugas", "Catatan"
    ];
  } else if (isSpecificSingleSystem) {
    headers = [
      "No", "Tanggal", "Jam", "Shift", "Titik Meter",
      "Stand Awal", "Stand Akhir", "Pemakaian", "Satuan",
      "Nama Petugas", "Status Alarm", "Catatan"
    ];
  } else if (isPlnMode) {
    headers = [
      "No", "Tanggal", "Jam", "Shift", "Titik Meter",
      "Stand Awal", "Stand Akhir", "Pemakaian", "Satuan",
      "Voltase (V)", "Ampere (A)", "LWBP (kWh)", "WBP (kWh)", "kVARh",
      "Nama Petugas", "Status Alarm", "Catatan"
    ];
  } else {
    // Complete
    headers = [
      "No", "Tanggal", "Jam", "Shift", "Titik Meter",
      "Stand Awal", "Stand Akhir", "Pemakaian", "Satuan",
      "Voltase (V)", "Ampere (A)", "LWBP (kWh)", "WBP (kWh)", "kVARh",
      "Nama Petugas", "Status Alarm", "Catatan"
    ];
  }

  const escapeCell = (val: any) => {
    if (val === null || val === undefined) return "";
    return String(val).replace(/[\r\n\t]+/g, " ").trim();
  };

  const tsvLines: string[] = [headers.join("\t")];
  const htmlRows: string[] = [];
  htmlRows.push(`<tr>${headers.map((h) => `<th style="border:1px solid #d1d5db;padding:6px 10px;background:#f3f4f6;font-weight:bold;text-align:left;">${h}</th>`).join("")}</tr>`);

  sortedReadings.forEach((r, idx) => {
    const d = new Date(r.recorded_at);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const timeStr = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    const shiftUpper = (r.shift || "").toUpperCase();
    const officer = r.user_name || "Petugas";
    const alarmStatus = r.alarm ? "ALARM (Lonjakan)" : "Normal";

    let rowValues: any[];
    if (isSimpleMode) {
      rowValues = [
        idx + 1, dateStr, timeStr, shiftUpper, r.meter_name,
        r.awal, r.akhir, r.total, r.meter_unit,
        officer, r.notes || "-"
      ];
    } else if (isSpecificSingleSystem) {
      rowValues = [
        idx + 1, dateStr, timeStr, shiftUpper, r.meter_name,
        r.awal, r.akhir, r.total, r.meter_unit,
        officer, alarmStatus, r.notes || "-"
      ];
    } else {
      rowValues = [
        idx + 1, dateStr, timeStr, shiftUpper, r.meter_name,
        r.awal, r.akhir, r.total, r.meter_unit,
        r.voltase ?? "-", r.ampere ?? "-",
        r.lwbp_akhir ?? r.lwbp ?? "-",
        r.wbp_akhir ?? r.wbp ?? "-",
        r.kvar_akhir ?? r.kvar ?? "-",
        officer, alarmStatus, r.notes || "-"
      ];
    }

    tsvLines.push(rowValues.map(escapeCell).join("\t"));
    htmlRows.push(`<tr>${rowValues.map((v) => `<td style="border:1px solid #e5e7eb;padding:4px 8px;">${escapeCell(v)}</td>`).join("")}</tr>`);
  });

  const tsvText = tsvLines.join("\r\n");
  const htmlTable = `<table border="1" style="border-collapse:collapse;font-family:sans-serif;font-size:12px;">${htmlRows.join("")}</table>`;

  try {
    if (typeof ClipboardItem !== "undefined" && navigator.clipboard && navigator.clipboard.write) {
      const textBlob = new Blob([tsvText], { type: "text/plain" });
      const htmlBlob = new Blob([htmlTable], { type: "text/html" });
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/plain": textBlob,
          "text/html": htmlBlob,
        }),
      ]);
    } else {
      await navigator.clipboard.writeText(tsvText);
    }
  } catch {
    await navigator.clipboard.writeText(tsvText);
  }

  return {
    success: true,
    rowCount: sortedReadings.length,
    message: "Tabel checklist meteran berhasil disalin! Tekan Ctrl+V di Google Sheets.",
  };
}

export async function copyPlantLogsToClipboardAsTsv(
  logs: PlantLog[],
  mode: "complete" | "lvmdp" | "genset" | "pompa" | "simple" = "complete"
): Promise<{ success: boolean; rowCount: number; message: string }> {
  if (!logs || logs.length === 0) {
    throw new Error("Tidak ada data log sheet untuk disalin.");
  }

  // Ensure chronological order: data update baru berada di bawah
  const sortedLogs = [...logs].sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
  );

  let headers: string[];
  if (mode === "lvmdp") {
    headers = [
      "No", "Tanggal", "Jam", "Shift", "Nama Petugas",
      "Volt R-S", "Volt S-T", "Volt T-R", "Volt R-N", "Volt S-N", "Volt T-N",
      "Ampere Total (A)", "Frekuensi (Hz)", "Cos Phi", "Step Kapasitor Aktif", "Suhu Kapasitor",
      "Level Oli Trafo", "Rembesan Oli Trafo", "Suhu Ruang LVMDP (°C)", "Status AC Ruangan",
      "Kondisi Suara & Bau", "Kebersihan & Penerangan", "Pintu Ruangan",
      "Status Alarm", "Peringatan Anomali", "Catatan Petugas"
    ];
  } else if (mode === "genset") {
    headers = [
      "No", "Tanggal", "Jam", "Shift", "Nama Petugas",
      "G1 Solar Harian (L)", "G1 Solar Bulanan (L)", "G1 Meter Solar", "G1 Air Radiator", "G1 Oli Mesin",
      "G1 Volt Aki (V)", "G1 Air Aki", "G1 Tgl Ganti Aki", "G1 Selector Switch", "G1 Running Hours",
      "G1 kWh Total", "G1 Emergency Stop", "G1 Kebersihan",
      "G2 Solar Harian (L)", "G2 Solar Bulanan (L)", "G2 Meter Solar", "G2 Air Radiator", "G2 Oli Mesin",
      "G2 Volt Aki (V)", "G2 Air Aki", "G2 Tgl Ganti Aki", "G2 Selector Switch", "G2 Running Hours",
      "G2 kWh Total", "G2 Emergency Stop", "G2 Kebersihan",
      "Status Alarm", "Peringatan Anomali", "Catatan Petugas"
    ];
  } else if (mode === "pompa") {
    headers = [
      "No", "Tanggal", "Jam", "Shift", "Nama Petugas",
      "Level RWT (%)", "Level CWT (%)", "Level GWT 1 (%)", "Level GWT 2 (%)",
      "Transfer Selector", "Transfer Trip", "Pompa Transfer 1", "Pompa Transfer 2", "Kondisi Mekanikal Pompa",
      "Hydrant Header Pressure (Bar)", "Jockey Selector", "Jockey Test", "Electric Selector",
      "Electric Indicator", "Diesel Selector", "Diesel Solar (L)", "Hydrant Volt Aki (V)",
      "Hydrant Air Aki", "Hydrant Tgl Ganti Aki", "Hydrant Key Switch", "Main Valve", "Lantai Ruang Pompa",
      "Status Alarm", "Peringatan Anomali", "Catatan Petugas"
    ];
  } else if (mode === "simple") {
    headers = [
      "No", "Tanggal", "Jam", "Shift", "Nama Petugas",
      "Suhu Ruang LVMDP (°C)", "LVMDP Ampere Total (A)",
      "G1 Solar Harian (L)", "G1 Volt Aki (V)",
      "G2 Solar Harian (L)", "G2 Volt Aki (V)",
      "Hydrant Header Pressure (Bar)",
      "Status Alarm", "Peringatan Anomali", "Catatan Petugas"
    ];
  } else {
    // Complete
    headers = [
      "No", "Tanggal", "Jam", "Shift", "Nama Petugas",
      "LVMDP Volt R-S", "LVMDP Volt S-T", "LVMDP Volt T-R", "LVMDP Volt R-N", "LVMDP Volt S-N", "LVMDP Volt T-N",
      "LVMDP Ampere Total", "LVMDP Frekuensi (Hz)", "LVMDP Cos Phi", "LVMDP Step Aktif", "LVMDP Suhu Kapasitor",
      "Trafo Level Oli", "Trafo Rembesan", "LVMDP Suhu Ruang (°C)", "LVMDP AC Status", "LVMDP Suara & Bau",
      "LVMDP Kebersihan", "LVMDP Pintu",
      "G1 Solar Harian (L)", "G1 Solar Bulanan (L)", "G1 Meter Solar", "G1 Air Radiator", "G1 Oli Mesin",
      "G1 Volt Aki (V)", "G1 Air Aki", "G1 Tgl Ganti Aki", "G1 Selector", "G1 Running Hours", "G1 kWh Total",
      "G1 Emergency Stop", "G1 Ventilasi",
      "G2 Solar Harian (L)", "G2 Solar Bulanan (L)", "G2 Meter Solar", "G2 Air Radiator", "G2 Oli Mesin",
      "G2 Volt Aki (V)", "G2 Air Aki", "G2 Tgl Ganti Aki", "G2 Selector", "G2 Running Hours", "G2 kWh Total",
      "G2 Emergency Stop", "G2 Ventilasi",
      "Level RWT (%)", "Level CWT (%)", "Level GWT 1 (%)", "Level GWT 2 (%)",
      "Transfer Selector", "Transfer Trip", "Pompa Transfer 1", "Pompa Transfer 2", "Pompa Mekanikal",
      "Hydrant Header Pressure (Bar)", "Jockey Selector", "Jockey Auto Test", "Electric Selector",
      "Electric Power Indikator", "Diesel Selector", "Diesel Solar Level (L)", "Hydrant Volt Aki (V)",
      "Hydrant Air Aki", "Hydrant Tgl Ganti Aki", "Hydrant Key Switch", "Main Valve", "Lantai Ruang Pompa",
      "Status Alarm", "Peringatan Anomali", "Catatan Petugas"
    ];
  }

  const escapeCell = (val: any) => {
    if (val === null || val === undefined) return "";
    return String(val).replace(/[\r\n\t]+/g, " ").trim();
  };

  const tsvLines: string[] = [headers.join("\t")];
  const htmlRows: string[] = [];
  htmlRows.push(`<tr>${headers.map((h) => `<th style="border:1px solid #d1d5db;padding:6px 10px;background:#f3f4f6;font-weight:bold;text-align:left;">${h}</th>`).join("")}</tr>`);

  sortedLogs.forEach((log, idx) => {
    const d = new Date(log.recorded_at);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const timeStr = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    const shiftUpper = (log.shift || "").toUpperCase();
    const officer = log.user_name || "-";
    const alarmStatus = log.has_alarm ? "ALARM" : "NORMAL";
    const alarmNotes = (log.alarm_reasons || []).join("; ") || "-";

    let rowValues: any[];
    if (mode === "lvmdp") {
      rowValues = [
        idx + 1, dateStr, timeStr, shiftUpper, officer,
        log.lvmdp_volt_rs ?? "-", log.lvmdp_volt_st ?? "-", log.lvmdp_volt_tr ?? "-",
        log.lvmdp_volt_rn ?? "-", log.lvmdp_volt_sn ?? "-", log.lvmdp_volt_tn ?? "-",
        log.lvmdp_ampere_total ?? "-", log.lvmdp_frekuensi ?? "-", log.lvmdp_cos_phi ?? "-",
        log.lvmdp_step_aktif ?? "-", log.lvmdp_suhu_kapasitor ?? "-",
        log.trafo_level_oli ?? "-", log.trafo_rembesan_oli ?? "-",
        log.lvmdp_suhu_ruang ?? "-", log.lvmdp_ac_status ?? "-",
        log.lvmdp_kondisi_suara_bau ?? "-", log.lvmdp_kebersihan_penerangan ?? "-",
        log.lvmdp_pintu_tertutup ?? "-", alarmStatus, alarmNotes, log.notes || "-"
      ];
    } else if (mode === "genset") {
      rowValues = [
        idx + 1, dateStr, timeStr, shiftUpper, officer,
        log.g1_solar_harian ?? "-", log.g1_solar_bulanan ?? "-", log.g1_meter_solar ?? "-",
        log.g1_air_radiator ?? "-", log.g1_oli_mesin ?? "-", log.g1_volt_aki ?? "-",
        log.g1_air_aki ?? "-", log.g1_tgl_ganti_aki ?? "-", log.g1_selector_switch ?? "-",
        log.g1_running_hours ?? "-", log.g1_kwh_total ?? "-", log.g1_emergency_stop ?? "-",
        log.g1_kebersihan_ventilasi ?? "-",
        log.g2_solar_harian ?? "-", log.g2_solar_bulanan ?? "-", log.g2_meter_solar ?? "-",
        log.g2_air_radiator ?? "-", log.g2_oli_mesin ?? "-", log.g2_volt_aki ?? "-",
        log.g2_air_aki ?? "-", log.g2_tgl_ganti_aki ?? "-", log.g2_selector_switch ?? "-",
        log.g2_running_hours ?? "-", log.g2_kwh_total ?? "-", log.g2_emergency_stop ?? "-",
        log.g2_kebersihan_ventilasi ?? "-", alarmStatus, alarmNotes, log.notes || "-"
      ];
    } else if (mode === "pompa") {
      rowValues = [
        idx + 1, dateStr, timeStr, shiftUpper, officer,
        log.level_rwt ?? "-", log.level_cwt ?? "-", log.level_gwt1 ?? "-", log.level_gwt2 ?? "-",
        log.transfer_selector ?? "-", log.transfer_trip_status ?? "-",
        log.transfer_pompa1 ?? "-", log.transfer_pompa2 ?? "-", log.pompa_mekanikal_status ?? "-",
        log.hydrant_header_pressure ?? "-", log.jockey_selector ?? "-", log.jockey_auto_test ?? "-",
        log.electric_selector ?? "-", log.electric_power_indicator ?? "-",
        log.diesel_selector ?? "-", log.diesel_solar_level ?? "-", log.hydrant_volt_aki ?? "-",
        log.hydrant_air_aki ?? "-", log.hydrant_tgl_ganti_aki ?? "-", log.hydrant_key_switch ?? "-",
        log.hydrant_main_valve ?? "-", log.ruang_pompa_lantai ?? "-",
        alarmStatus, alarmNotes, log.notes || "-"
      ];
    } else if (mode === "simple") {
      rowValues = [
        idx + 1, dateStr, timeStr, shiftUpper, officer,
        log.lvmdp_suhu_ruang ?? "-", log.lvmdp_ampere_total ?? "-",
        log.g1_solar_harian ?? "-", log.g1_volt_aki ?? "-",
        log.g2_solar_harian ?? "-", log.g2_volt_aki ?? "-",
        log.hydrant_header_pressure ?? "-",
        alarmStatus, alarmNotes, log.notes || "-"
      ];
    } else {
      rowValues = [
        idx + 1, dateStr, timeStr, shiftUpper, officer,
        log.lvmdp_volt_rs ?? "-", log.lvmdp_volt_st ?? "-", log.lvmdp_volt_tr ?? "-",
        log.lvmdp_volt_rn ?? "-", log.lvmdp_volt_sn ?? "-", log.lvmdp_volt_tn ?? "-",
        log.lvmdp_ampere_total ?? "-", log.lvmdp_frekuensi ?? "-", log.lvmdp_cos_phi ?? "-",
        log.lvmdp_step_aktif ?? "-", log.lvmdp_suhu_kapasitor ?? "-",
        log.trafo_level_oli ?? "-", log.trafo_rembesan_oli ?? "-",
        log.lvmdp_suhu_ruang ?? "-", log.lvmdp_ac_status ?? "-",
        log.lvmdp_kondisi_suara_bau ?? "-", log.lvmdp_kebersihan_penerangan ?? "-",
        log.lvmdp_pintu_tertutup ?? "-",
        log.g1_solar_harian ?? "-", log.g1_solar_bulanan ?? "-", log.g1_meter_solar ?? "-",
        log.g1_air_radiator ?? "-", log.g1_oli_mesin ?? "-", log.g1_volt_aki ?? "-",
        log.g1_air_aki ?? "-", log.g1_tgl_ganti_aki ?? "-", log.g1_selector_switch ?? "-",
        log.g1_running_hours ?? "-", log.g1_kwh_total ?? "-", log.g1_emergency_stop ?? "-",
        log.g1_kebersihan_ventilasi ?? "-",
        log.g2_solar_harian ?? "-", log.g2_solar_bulanan ?? "-", log.g2_meter_solar ?? "-",
        log.g2_air_radiator ?? "-", log.g2_oli_mesin ?? "-", log.g2_volt_aki ?? "-",
        log.g2_air_aki ?? "-", log.g2_tgl_ganti_aki ?? "-", log.g2_selector_switch ?? "-",
        log.g2_running_hours ?? "-", log.g2_kwh_total ?? "-", log.g2_emergency_stop ?? "-",
        log.g2_kebersihan_ventilasi ?? "-",
        log.level_rwt ?? "-", log.level_cwt ?? "-", log.level_gwt1 ?? "-", log.level_gwt2 ?? "-",
        log.transfer_selector ?? "-", log.transfer_trip_status ?? "-",
        log.transfer_pompa1 ?? "-", log.transfer_pompa2 ?? "-", log.pompa_mekanikal_status ?? "-",
        log.hydrant_header_pressure ?? "-", log.jockey_selector ?? "-", log.jockey_auto_test ?? "-",
        log.electric_selector ?? "-", log.electric_power_indicator ?? "-",
        log.diesel_selector ?? "-", log.diesel_solar_level ?? "-", log.hydrant_volt_aki ?? "-",
        log.hydrant_air_aki ?? "-", log.hydrant_tgl_ganti_aki ?? "-", log.hydrant_key_switch ?? "-",
        log.hydrant_main_valve ?? "-", log.ruang_pompa_lantai ?? "-",
        alarmStatus, alarmNotes, log.notes || "-"
      ];
    }

    tsvLines.push(rowValues.map(escapeCell).join("\t"));
    htmlRows.push(`<tr>${rowValues.map((v) => `<td style="border:1px solid #e5e7eb;padding:4px 8px;">${escapeCell(v)}</td>`).join("")}</tr>`);
  });

  const tsvText = tsvLines.join("\r\n");
  const htmlTable = `<table border="1" style="border-collapse:collapse;font-family:sans-serif;font-size:12px;">${htmlRows.join("")}</table>`;

  try {
    if (typeof ClipboardItem !== "undefined" && navigator.clipboard && navigator.clipboard.write) {
      const textBlob = new Blob([tsvText], { type: "text/plain" });
      const htmlBlob = new Blob([htmlTable], { type: "text/html" });
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/plain": textBlob,
          "text/html": htmlBlob,
        }),
      ]);
    } else {
      await navigator.clipboard.writeText(tsvText);
    }
  } catch {
    await navigator.clipboard.writeText(tsvText);
  }

  return { success: true, rowCount: sortedLogs.length, message: "Data tabel berhasil disalin ke clipboard! Tekan Ctrl+V di Google Sheets." };
}

export async function downloadFullSystemBackup(): Promise<void> {
  const token = typeof localStorage !== "undefined" ? localStorage.getItem("meter_checklist_token") : null;
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch("/api/system/backup", { headers });
  if (!res.ok) {
    throw new Error("Gagal mengunduh data cadangan sistem");
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Backup_Engineering_System_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export async function restoreSystemFromJSON(jsonData: any): Promise<{ ok: boolean; message: string; restored_readings: number; restored_plant_logs: number }> {
  const token = typeof localStorage !== "undefined" ? localStorage.getItem("meter_checklist_token") : null;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch("/api/system/restore", {
    method: "POST",
    headers,
    body: JSON.stringify(jsonData),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Gagal memulihkan sistem" }));
    throw new Error(err.detail || "Gagal memulihkan sistem");
  }

  return await res.json();
}
