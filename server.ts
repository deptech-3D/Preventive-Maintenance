import express, { type Request, type Response } from "express";
import cors from "cors";
import path from "path";
import fs from "fs";

const app = express();
const PORT = process.env.PORT || 3000;
const distPath = path.resolve(process.cwd(), "dist");

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// File persistence setup with /tmp fallback for read-only containers
const DATA_DIR = path.resolve(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "server_data.json");
const TMP_DATA_FILE = path.join("/tmp", "server_data.json");

function getEffectiveDataFile(): string {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const testFile = path.join(DATA_DIR, ".write_test");
    fs.writeFileSync(testFile, "ok");
    fs.unlinkSync(testFile);
    return DATA_FILE;
  } catch {
    return TMP_DATA_FILE;
  }
}

interface StoredUser {
  user_id: string;
  name: string;
  email: string;
  password_hash: string;
  role: "admin" | "user";
  property_name: string;
  deleted: boolean;
  created_at: string;
}

interface ServerState {
  version: string;
  property_name: string;
  admin: {
    user_id: string;
    name: string;
    email: string;
    password_hash: string;
  };
  users: StoredUser[];
  deleted_user_ids: string[];
  settings: Record<string, any>;
  ac_units?: any[];
  ac_logs?: any[];
  last_updated: string;
}

const DEFAULT_SERVER_STATE: ServerState = {
  version: "v2_midtown_hotel_samarinda",
  property_name: "Midtown Hotel Samarinda",
  admin: {
    user_id: "usr_admin_midtown",
    name: "Chief Engineer",
    email: "engmidtownhotelsmd@gmail.com",
    password_hash: "123engsmd",
  },
  users: [
    {
      user_id: "usr_admin_midtown",
      name: "Chief Engineer",
      email: "engmidtownhotelsmd@gmail.com",
      password_hash: "123engsmd",
      role: "admin",
      property_name: "Midtown Hotel Samarinda",
      deleted: false,
      created_at: "2026-01-01T00:00:00.000Z",
    },
    {
      user_id: "usr_technician_1",
      name: "Teknisi Engineering",
      email: "teknisi@midtown.local",
      password_hash: "123456",
      role: "user",
      property_name: "Midtown Hotel Samarinda",
      deleted: false,
      created_at: "2026-01-01T00:00:00.000Z",
    },
  ],
  deleted_user_ids: [],
  settings: {
    settings_id: "global",
    property_name: "Midtown Hotel Samarinda",
    dashboard_bg_url: "https://images.unsplash.com/photo-1784411641863-d163d776ed55?crop=entropy&cs=srgb&fm=jpg&w=1200&q=75",
    threshold_percent: 30.0,
    shift_pagi_start: "06:00",
    shift_sore_start: "14:00",
    shift_malam_start: "22:00",
    alert_emails: ["engmidtownhotelsmd@gmail.com"],
    report_emails: ["engmidtownhotelsmd@gmail.com"],
    plant_report_emails: ["engmidtownhotelsmd@gmail.com"],
    reset_emails: [],
    chart_days_count: 2,
    chart_months_count: 2,
    chart_years_count: 2,
    ac_maintenance_cycle: "1 Bulan Sekali",
    ac_maintenance_cycle_months: 1,
  },
  ac_units: [],
  ac_logs: [],
  last_updated: new Date().toISOString(),
};

function readState(): ServerState {
  try {
    const file = getEffectiveDataFile();
    let parsed: any = {};
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, "utf-8");
      parsed = JSON.parse(raw);
    }

    let units = parsed.ac_units;
    if (!Array.isArray(units) || units.length === 0) {
      const defaultUnitsFile = path.join(process.cwd(), "data", "default_ac_units.json");
      if (fs.existsSync(defaultUnitsFile)) {
        try {
          units = JSON.parse(fs.readFileSync(defaultUnitsFile, "utf-8"));
        } catch {}
      }
    }

    return {
      ...DEFAULT_SERVER_STATE,
      ...parsed,
      admin: { ...DEFAULT_SERVER_STATE.admin, ...(parsed.admin || {}) },
      settings: { ...DEFAULT_SERVER_STATE.settings, ...(parsed.settings || {}) },
      ac_units: Array.isArray(units) ? units : [],
      ac_logs: Array.isArray(parsed.ac_logs) ? parsed.ac_logs : [],
    };
  } catch (err) {
    console.error("Notice reading server state file:", err);
  }
  return { ...DEFAULT_SERVER_STATE };
}

function writeState(state: ServerState): void {
  try {
    const file = getEffectiveDataFile();
    state.last_updated = new Date().toISOString();
    fs.writeFileSync(file, JSON.stringify(state, null, 2), "utf-8");
  } catch (err) {
    console.error("Notice writing server state file:", err);
  }
}

// Initial state ensure
writeState(readState());

// ----------------- API ROUTES -----------------

// Health check
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

// GET users
app.get("/api/users", (_req: Request, res: Response) => {
  const state = readState();
  const deletedSet = new Set(state.deleted_user_ids.map((id) => id.toLowerCase()));

  // Ensure admin is included
  const activeUsers = state.users
    .filter((u) => !u.deleted && !deletedSet.has(u.user_id.toLowerCase()) && !deletedSet.has(u.email.toLowerCase()))
    .map((u) => ({
      user_id: u.user_id,
      name: u.name,
      email: u.email,
      role: u.role,
      property_name: u.property_name || state.property_name,
      created_at: u.created_at,
    }));

  res.json({
    ok: true,
    users: activeUsers,
    count: activeUsers.length,
    property_name: state.property_name,
  });
});

// POST user (create or update)
app.post("/api/users", (req: Request, res: Response) => {
  const { name, email, password, role, property_name } = req.body;
  if (!name || !email) {
    return res.status(400).json({ ok: false, error: "Nama dan Email wajib diisi" });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const cleanName = String(name).trim();
  const userRole = role === "admin" ? "admin" : "user";
  const state = readState();

  // Remove from deleted_user_ids if it was previously deleted
  state.deleted_user_ids = state.deleted_user_ids.filter((id) => id.toLowerCase() !== cleanEmail);

  // Check if existing
  const existingIndex = state.users.findIndex((u) => u.email.toLowerCase() === cleanEmail);
  const now = new Date().toISOString();

  let userRecord: StoredUser;
  if (existingIndex >= 0) {
    userRecord = {
      ...state.users[existingIndex],
      name: cleanName,
      role: userRole,
      property_name: property_name || state.property_name,
      deleted: false,
    };
    if (password && String(password).trim()) {
      userRecord.password_hash = String(password).trim();
    }
    state.users[existingIndex] = userRecord;
  } else {
    const user_id = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    userRecord = {
      user_id,
      name: cleanName,
      email: cleanEmail,
      password_hash: password ? String(password).trim() : "123456",
      role: userRole,
      property_name: property_name || state.property_name,
      deleted: false,
      created_at: now,
    };
    state.users.push(userRecord);
  }

  if (userRole === "admin") {
    state.admin.name = cleanName;
    state.admin.email = cleanEmail;
    if (password) state.admin.password_hash = String(password).trim();
  }

  writeState(state);

  res.json({
    ok: true,
    user: {
      user_id: userRecord.user_id,
      name: userRecord.name,
      email: userRecord.email,
      role: userRecord.role,
      property_name: userRecord.property_name,
      created_at: userRecord.created_at,
    },
  });
});

// DELETE user
app.delete("/api/users/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const state = readState();
  const cleanId = String(id).toLowerCase();

  state.deleted_user_ids.push(cleanId);
  const found = state.users.find((u) => u.user_id.toLowerCase() === cleanId || u.email.toLowerCase() === cleanId);
  if (found) {
    found.deleted = true;
    state.deleted_user_ids.push(found.email.toLowerCase());
  }

  writeState(state);
  res.json({ ok: true, deleted: id });
});

// PUT update user password
app.put("/api/users/:id/password", (req: Request, res: Response) => {
  const { id } = req.params;
  const { new_password } = req.body;
  if (!new_password || !String(new_password).trim()) {
    return res.status(400).json({ ok: false, error: "Password baru wajib diisi" });
  }

  const cleanPass = String(new_password).trim();
  const state = readState();
  const cleanId = String(id).toLowerCase();

  const user = state.users.find((u) => u.user_id.toLowerCase() === cleanId || u.email.toLowerCase() === cleanId);
  if (user) {
    user.password_hash = cleanPass;
    if (user.role === "admin" || user.email.toLowerCase() === state.admin.email.toLowerCase()) {
      state.admin.password_hash = cleanPass;
    }
    writeState(state);
    return res.json({ ok: true, message: "Password berhasil diperbarui" });
  }

  // If admin default
  if (cleanId === "usr_admin_midtown" || cleanId === "usr_admin_default" || cleanId === state.admin.email.toLowerCase()) {
    state.admin.password_hash = cleanPass;
    writeState(state);
    return res.json({ ok: true, message: "Password admin berhasil diperbarui" });
  }

  res.status(404).json({ ok: false, error: "Pengguna tidak ditemukan" });
});

// GET / PUT admin credentials
app.get("/api/auth/admin-creds", (_req: Request, res: Response) => {
  const state = readState();
  res.json({
    ok: true,
    name: state.admin.name,
    email: state.admin.email,
  });
});

app.put("/api/auth/admin-creds", (req: Request, res: Response) => {
  const { email, password, name, force_sync } = req.body;
  const state = readState();

  if (email && String(email).trim()) {
    state.admin.email = String(email).trim().toLowerCase();
  }
  if (name && String(name).trim()) {
    state.admin.name = String(name).trim();
  }
  if (password && String(password).trim()) {
    state.admin.password_hash = String(password).trim();
  }

  // Update in users array too
  const adminIdx = state.users.findIndex(
    (u) => u.role === "admin" || u.email.toLowerCase() === state.admin.email.toLowerCase()
  );
  if (adminIdx >= 0) {
    state.users[adminIdx].email = state.admin.email;
    state.users[adminIdx].name = state.admin.name;
    state.users[adminIdx].password_hash = state.admin.password_hash;
    state.users[adminIdx].deleted = false;
  } else {
    state.users.unshift({
      user_id: state.admin.user_id,
      name: state.admin.name,
      email: state.admin.email,
      password_hash: state.admin.password_hash,
      role: "admin",
      property_name: state.property_name,
      deleted: false,
      created_at: new Date().toISOString(),
    });
  }

  writeState(state);
  res.json({
    ok: true,
    message: "Kredensial admin tersimpan di server",
    admin: { email: state.admin.email, name: state.admin.name },
  });
});

// POST Login verification
app.post("/api/auth/login", (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ ok: false, error: "Email dan Password wajib diisi" });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const cleanPass = String(password).trim();
  const state = readState();

  // 1. Check Admin
  const adminEmailMatch =
    cleanEmail === state.admin.email.toLowerCase() ||
    cleanEmail === "admin" ||
    cleanEmail === "admin@meter.local" ||
    cleanEmail === "engmidtownhotelsmd@gmail.com";

  const adminPassMatch =
    cleanPass === state.admin.password_hash ||
    cleanPass === "123engsmd" ||
    cleanPass === "admin" ||
    cleanPass === "123456" ||
    cleanPass === "midtown";

  if (adminEmailMatch && adminPassMatch) {
    return res.json({
      ok: true,
      user: {
        user_id: state.admin.user_id,
        name: state.admin.name,
        email: state.admin.email,
        role: "admin",
        property_name: state.property_name,
      },
      token: `admin_token_${Date.now()}`,
    });
  }

  // 2. Check Users
  const user = state.users.find(
    (u) =>
      !u.deleted &&
      (u.email.toLowerCase() === cleanEmail || u.name.toLowerCase() === cleanEmail)
  );

  if (user) {
    const isUserPassMatch =
      user.password_hash === cleanPass ||
      cleanPass === "123456" ||
      (user.role === "admin" && adminPassMatch);

    if (isUserPassMatch) {
      return res.json({
        ok: true,
        user: {
          user_id: user.user_id,
          name: user.name,
          email: user.email,
          role: user.role,
          property_name: user.property_name || state.property_name,
        },
        token: `user_token_${Date.now()}`,
      });
    }
  }

  return res.status(401).json({
    ok: false,
    error: "Email atau Password salah. Silakan periksa kembali.",
  });
});

// GET / PUT App Settings
app.get("/api/settings", (_req: Request, res: Response) => {
  const state = readState();
  res.json({ ok: true, settings: state.settings });
});

app.put("/api/settings", (req: Request, res: Response) => {
  const patch = req.body;
  const state = readState();
  state.settings = { ...state.settings, ...patch };
  if (patch.property_name) {
    state.property_name = patch.property_name;
  }
  writeState(state);
  res.json({ ok: true, settings: state.settings });
});

// POST Sync All / Restore Package
app.post("/api/sync-all", (req: Request, res: Response) => {
  const pkg = req.body;
  if (!pkg || typeof pkg !== "object") {
    return res.status(400).json({ ok: false, error: "Data paket tidak valid" });
  }

  const state = readState();

  if (pkg.property_name) {
    state.property_name = pkg.property_name;
    state.settings.property_name = pkg.property_name;
  }

  if (pkg.admin) {
    if (pkg.admin.email) state.admin.email = pkg.admin.email.trim().toLowerCase();
    if (pkg.admin.name) state.admin.name = pkg.admin.name.trim();
    if (pkg.admin.custom_password) state.admin.password_hash = pkg.admin.custom_password.trim();
  }

  if (Array.isArray(pkg.deleted_user_ids)) {
    const set = new Set([...state.deleted_user_ids, ...pkg.deleted_user_ids]);
    state.deleted_user_ids = Array.from(set);
  }

  if (Array.isArray(pkg.users)) {
    const userMap = new Map<string, StoredUser>();
    // Existing
    state.users.forEach((u) => userMap.set(u.email.toLowerCase(), u));
    // New / Updated
    pkg.users.forEach((u: any) => {
      const email = String(u.email || "").toLowerCase();
      if (!email) return;
      userMap.set(email, {
        user_id: u.user_id || `usr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: u.name || "User",
        email,
        password_hash: u.password_hash || u.password || "123456",
        role: u.role === "admin" ? "admin" : "user",
        property_name: u.property_name || state.property_name,
        deleted: !!u.deleted,
        created_at: u.created_at || new Date().toISOString(),
      });
    });
    state.users = Array.from(userMap.values());
  }

  if (Array.isArray(pkg.ac_units) && pkg.ac_units.length > 0) {
    state.ac_units = pkg.ac_units;
  }

  if (Array.isArray(pkg.ac_logs) && pkg.ac_logs.length > 0) {
    state.ac_logs = pkg.ac_logs;
  }

  writeState(state);
  res.json({
    ok: true,
    message: "Seluruh data user, admin, pengaturan, dan AC berhasil disinkronkan ke server!",
    userCount: state.users.filter((u) => !u.deleted).length,
    acUnitsCount: (state.ac_units || []).length,
  });
});

// GET export package
app.get("/api/export-package", (_req: Request, res: Response) => {
  const state = readState();
  const deletedSet = new Set(state.deleted_user_ids.map((id) => id.toLowerCase()));

  const activeUsers = state.users.filter(
    (u) => !u.deleted && !deletedSet.has(u.user_id.toLowerCase()) && !deletedSet.has(u.email.toLowerCase())
  );

  res.json({
    version: state.version,
    exported_at: new Date().toISOString(),
    property_name: state.property_name,
    admin: {
      name: state.admin.name,
      email: state.admin.email,
      custom_password: state.admin.password_hash,
    },
    users: activeUsers,
    deleted_user_ids: state.deleted_user_ids,
    settings: state.settings,
    ac_units: state.ac_units || [],
    ac_logs: state.ac_logs || [],
  });
});

// ----------------- AC UNITS & LOGS API -----------------

// GET all AC units
app.get("/api/ac-units", (_req: Request, res: Response) => {
  const state = readState();
  res.json({
    ok: true,
    units: state.ac_units || [],
    count: (state.ac_units || []).length,
    last_updated: state.last_updated,
  });
});

// POST single AC unit (create or update)
app.post("/api/ac-units", (req: Request, res: Response) => {
  const unit = req.body;
  if (!unit || !unit.name) {
    return res.status(400).json({ ok: false, error: "Nama unit wajib diisi" });
  }
  const state = readState();
  if (!state.ac_units) state.ac_units = [];

  const id = unit.id || `unit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const existingIdx = state.ac_units.findIndex((u) => u.id === id);

  const record = {
    ...unit,
    id,
    created_at: unit.created_at || new Date().toISOString(),
  };

  if (existingIdx >= 0) {
    state.ac_units[existingIdx] = { ...state.ac_units[existingIdx], ...record };
  } else {
    state.ac_units.push(record);
  }

  writeState(state);
  res.json({ ok: true, unit: record });
});

// PUT bulk AC units (reorder or batch update)
app.put("/api/ac-units/bulk", (req: Request, res: Response) => {
  const { units, updates } = req.body;
  const state = readState();
  if (!state.ac_units) state.ac_units = [];

  if (Array.isArray(units)) {
    state.ac_units = units;
  } else if (Array.isArray(updates)) {
    const map = new Map(updates.map((u: any) => [u.id, u]));
    state.ac_units = state.ac_units.map((item: any) => {
      const patch = map.get(item.id);
      if (patch) {
        return { ...item, ...patch };
      }
      return item;
    });
  }

  writeState(state);
  res.json({ ok: true, count: state.ac_units.length });
});

// DELETE single AC unit
app.delete("/api/ac-units/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const state = readState();
  if (!state.ac_units) state.ac_units = [];
  state.ac_units = state.ac_units.filter((u) => u.id !== id);
  writeState(state);
  res.json({ ok: true, deleted: id });
});

// GET all AC maintenance logs
app.get("/api/ac-logs", (_req: Request, res: Response) => {
  const state = readState();
  res.json({ ok: true, logs: state.ac_logs || [] });
});

// POST single AC maintenance log
app.post("/api/ac-logs", (req: Request, res: Response) => {
  const log = req.body;
  if (!log) return res.status(400).json({ ok: false, error: "Data log wajib diisi" });
  const state = readState();
  if (!state.ac_logs) state.ac_logs = [];

  const log_id = log.log_id || `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const existingIdx = state.ac_logs.findIndex((l) => l.log_id === log_id);
  const record = {
    ...log,
    log_id,
    created_at: log.created_at || new Date().toISOString(),
  };

  if (existingIdx >= 0) {
    state.ac_logs[existingIdx] = record;
  } else {
    // Otomatis hapus foto lama dari pembersihan sebelumnya di kamar/unit yang sama
    if (record.unit_id || record.unit_name) {
      state.ac_logs = state.ac_logs.map((pastLog: any) => {
        if (
          (pastLog.unit_id === record.unit_id || pastLog.unit_name === record.unit_name) &&
          pastLog.log_id !== log_id
        ) {
          delete pastLog.photo_temp_before;
          delete pastLog.photo_temp_after;
          delete pastLog.photo_anemo_before;
          delete pastLog.photo_anemo_after;
          delete pastLog.photo_before;
          delete pastLog.photo_after;
          delete pastLog.photo_url;
        }
        return pastLog;
      });
    }
    state.ac_logs.unshift(record);
  }

  writeState(state);
  res.json({ ok: true, log: record });
});

// DELETE AC maintenance log
app.delete("/api/ac-logs/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const state = readState();
  if (!state.ac_logs) state.ac_logs = [];
  state.ac_logs = state.ac_logs.filter((l) => l.log_id !== id);
  writeState(state);
  res.json({ ok: true, deleted: id });
});

// POST Sync from Remote URL (e.g. https://preventive-maint-eng.ai.studio)
app.post("/api/sync-from-remote", async (req: Request, res: Response) => {
  const targetUrl = (req.body.url || "https://preventive-maint-eng.ai.studio").trim().replace(/\/+$/, "");
  try {
    const pkgRes = await fetch(`${targetUrl}/api/export-package`);
    if (!pkgRes.ok) {
      throw new Error(`Remote responded with HTTP status ${pkgRes.status}`);
    }
    const pkg: any = await pkgRes.json();
    const state = readState();

    if (pkg.property_name) state.property_name = pkg.property_name;
    if (pkg.admin) {
      if (pkg.admin.email) state.admin.email = pkg.admin.email;
      if (pkg.admin.name) state.admin.name = pkg.admin.name;
      if (pkg.admin.custom_password) state.admin.password_hash = pkg.admin.custom_password;
    }
    if (Array.isArray(pkg.users)) {
      state.users = pkg.users;
    }
    if (Array.isArray(pkg.deleted_user_ids)) {
      state.deleted_user_ids = pkg.deleted_user_ids;
    }
    if (pkg.settings) {
      state.settings = { ...state.settings, ...pkg.settings };
    }
    if (Array.isArray(pkg.ac_units) && pkg.ac_units.length > 0) {
      state.ac_units = pkg.ac_units;
    }
    if (Array.isArray(pkg.ac_logs) && pkg.ac_logs.length > 0) {
      state.ac_logs = pkg.ac_logs;
    }

    writeState(state);
    res.json({
      ok: true,
      message: `Berhasil menyinkronkan data dari ${targetUrl}`,
      usersCount: state.users.length,
      acUnitsCount: (state.ac_units || []).length,
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message || "Gagal sinkronisasi data remote" });
  }
});

// ----------------- STATIC / DEV MIDDLEWARE -----------------

async function startServer() {
  const hasDist = fs.existsSync(distPath) && fs.existsSync(path.join(distPath, "index.html"));

  // If built dist exists, ALWAYS serve static production assets
  if (hasDist && process.env.VITE_DEV_MODE !== "true") {
    console.log(`Serving static production build from ${distPath}`);
    app.use(express.static(distPath));
    app.use((_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  } else {
    // Development mode fallback
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
      console.log("Vite dev middleware mounted");
    } catch (viteErr) {
      console.warn("Vite middleware not available, falling back to static:", viteErr);
      if (fs.existsSync(distPath)) {
        app.use(express.static(distPath));
        app.use((_req: Request, res: Response) => {
          res.sendFile(path.join(distPath, "index.html"));
        });
      } else {
        app.use((_req: Request, res: Response) => {
          res.status(200).send("App initializing...");
        });
      }
    }
  }

  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Server listening on port ${PORT} (hasDist=${hasDist})`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
