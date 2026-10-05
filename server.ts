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

// Prevent browser/PWA from caching index.html or service worker
app.use((req: Request, res: Response, next) => {
  const p = req.path;
  if (p === "/" || p.endsWith(".html") || p.includes("sw.js") || p.includes("workbox") || p.includes("manifest")) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }
  next();
});

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
  deleted_ac_unit_ids?: string[];
  deleted_ac_log_ids?: string[];
  deleted_ac_logs_trash?: any[];
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
  ],
  deleted_user_ids: [],
  deleted_ac_unit_ids: [],
  deleted_ac_log_ids: [],
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
    } else if (file !== DATA_FILE && fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      parsed = JSON.parse(raw);
    }

    const deletedUnitSet = new Set<string>(Array.isArray(parsed.deleted_ac_unit_ids) ? parsed.deleted_ac_unit_ids : []);
    const deletedLogSet = new Set<string>(Array.isArray(parsed.deleted_ac_log_ids) ? parsed.deleted_ac_log_ids : []);

    let units = parsed.ac_units;
    if (!Array.isArray(units) || (units.length === 0 && deletedUnitSet.size === 0)) {
      const defaultUnitsFile = path.join(process.cwd(), "data", "default_ac_units.json");
      if (fs.existsSync(defaultUnitsFile)) {
        try {
          units = JSON.parse(fs.readFileSync(defaultUnitsFile, "utf-8"));
        } catch {}
      }
    }

    const filteredUnits = Array.isArray(units)
      ? units.filter((u: any) => u && u.id && !deletedUnitSet.has(u.id))
      : [];

    let rawLogs = Array.isArray(parsed.ac_logs) ? parsed.ac_logs : [];
    const defaultLogsFile = path.join(process.cwd(), "data", "default_ac_logs.json");
    if (fs.existsSync(defaultLogsFile)) {
      try {
        const defaultLogs = JSON.parse(fs.readFileSync(defaultLogsFile, "utf-8"));
        if (Array.isArray(defaultLogs) && defaultLogs.length > 0) {
          const logMap = new Map<string, any>();
          for (const l of defaultLogs) {
            if (l && l.log_id && !deletedLogSet.has(l.log_id)) {
              logMap.set(l.log_id, l);
            }
          }
          for (const l of rawLogs) {
            if (l && l.log_id && !deletedLogSet.has(l.log_id)) {
              const prev = logMap.get(l.log_id);
              if (!prev) {
                logMap.set(l.log_id, l);
              } else {
                const prevTime = new Date(prev.updated_at || prev.created_at || 0).getTime();
                const curTime = new Date(l.updated_at || l.created_at || 0).getTime();
                if (curTime >= prevTime) {
                  logMap.set(l.log_id, l);
                }
              }
            }
          }
          rawLogs = Array.from(logMap.values()).sort(
            (a: any, b: any) => new Date(b.recorded_at || 0).getTime() - new Date(a.recorded_at || 0).getTime()
          );
        }
      } catch {}
    }

    const filteredLogs = Array.isArray(rawLogs)
      ? rawLogs.filter((l: any) => l && l.log_id && !deletedLogSet.has(l.log_id))
      : [];

    return {
      ...DEFAULT_SERVER_STATE,
      ...parsed,
      admin: { ...DEFAULT_SERVER_STATE.admin, ...(parsed.admin || {}) },
      settings: { ...DEFAULT_SERVER_STATE.settings, ...(parsed.settings || {}) },
      deleted_ac_unit_ids: Array.from(deletedUnitSet),
      deleted_ac_log_ids: Array.from(deletedLogSet),
      deleted_ac_logs_trash: Array.isArray(parsed.deleted_ac_logs_trash) ? parsed.deleted_ac_logs_trash : [],
      ac_units: filteredUnits,
      ac_logs: filteredLogs,
    };
  } catch (err) {
    console.error("Notice reading server state file:", err);
  }
  return { ...DEFAULT_SERVER_STATE };
}

const LIVE_REMOTE_URL = "https://preventive-maint-eng.ai.studio";
const DEV_REMOTE_URL = "https://ais-dev-lz5cixvdbujknocsx4qwa7-865179435131.asia-southeast1.run.app";
const REMOTE_SYNC_URLS = [LIVE_REMOTE_URL, DEV_REMOTE_URL];
let lastRemotePullTime = 0;
let lastLocalWriteTime = 0;
let isPullingRemote = false;

function forwardToRemotePeers(apiPath: string, init: RequestInit): void {
  for (const baseUrl of REMOTE_SYNC_URLS) {
    fetch(`${baseUrl}${apiPath}`, {
      ...init,
      headers: {
        ...(init.headers || {}),
        "x-sync-forwarded": "1",
      },
    }).catch(() => {});
  }
}

function mergeUnitPreservingCycle(existing: any, incoming: any): any {
  if (!existing) {
    const clean = { ...incoming };
    delete clean.clear_cycle;
    return clean;
  }
  const merged = { ...existing, ...incoming };
  const explicitlyCleared = incoming.clear_cycle === true;
  if (!explicitlyCleared) {
    const incomingHasCycle =
      (typeof incoming.cycle_months === "number" && incoming.cycle_months > 0) ||
      (typeof incoming.cycle_days === "number" && incoming.cycle_days > 0);
    const existingHasCycle =
      (typeof existing.cycle_months === "number" && existing.cycle_months > 0) ||
      (typeof existing.cycle_days === "number" && existing.cycle_days > 0);
    if (!incomingHasCycle && existingHasCycle) {
      merged.cycle_months = existing.cycle_months ?? null;
      merged.cycle_days = existing.cycle_days ?? null;
    }
  }
  if (incoming.created_at && existing.created_at) {
    merged.created_at = existing.created_at;
  }
  delete merged.clear_cycle;
  return merged;
}

function mergeUnitsListPreservingCycles(
  existingUnits: any[],
  incomingUnits: any[],
  deletedSet: Set<string>
): any[] {
  const existingMap = new Map<string, any>();
  for (const u of existingUnits || []) {
    if (u && u.id && !deletedSet.has(u.id)) {
      existingMap.set(u.id, u);
    }
  }
  const result: any[] = [];
  const seenIds = new Set<string>();
  for (const inc of incomingUnits || []) {
    if (!inc || !inc.id || deletedSet.has(inc.id)) continue;
    seenIds.add(inc.id);
    const prev = existingMap.get(inc.id);
    result.push(mergeUnitPreservingCycle(prev, inc));
  }
  for (const [id, prev] of existingMap.entries()) {
    if (!seenIds.has(id) && !deletedSet.has(id)) {
      result.push(prev);
    }
  }
  return result;
}

function writeState(state: ServerState, pushToLive = false): void {
  try {
    const file = getEffectiveDataFile();
    state.last_updated = new Date().toISOString();
    fs.writeFileSync(file, JSON.stringify(state, null, 2), "utf-8");

    // Persist ac_units permanently into data/default_ac_units.json and src/data/officialACUnits.ts
    if (Array.isArray(state.ac_units)) {
      try {
        const defaultUnitsFile = path.join(process.cwd(), "data", "default_ac_units.json");
        fs.writeFileSync(defaultUnitsFile, JSON.stringify(state.ac_units, null, 2), "utf-8");
        const officialTsFile = path.join(process.cwd(), "src", "data", "officialACUnits.ts");
        const tsContent = `import { ACUnitLocation } from "../types";\n\n/**\n * Data Master Resmi Unit AC & Ruangan Midtown Hotel\n * Ditanamkan secara permanen ke dalam kode sumber utama proyek\n */\nexport const OFFICIAL_AC_UNITS: ACUnitLocation[] = ${JSON.stringify(state.ac_units, null, 2)};\n`;
        fs.writeFileSync(officialTsFile, tsContent, "utf-8");
      } catch {}
    }

    // Persist ac_logs permanently into data/default_ac_logs.json
    if (Array.isArray(state.ac_logs)) {
      try {
        const defaultLogsFile = path.join(process.cwd(), "data", "default_ac_logs.json");
        fs.writeFileSync(defaultLogsFile, JSON.stringify(state.ac_logs, null, 2), "utf-8");
      } catch {}
    }

    if (pushToLive) {
      lastLocalWriteTime = Date.now();
      pushStateToLiveRemote(state).catch(() => {});
    }
  } catch (err) {
    console.error("Notice writing server state file:", err);
  }
}

async function pushStateToLiveRemote(state: ServerState): Promise<void> {
  try {
    const deletedSet = new Set((state.deleted_user_ids || []).map((id) => id.toLowerCase()));
    const activeUsers = (state.users || []).filter(
      (u) => !u.deleted && !deletedSet.has(u.user_id.toLowerCase()) && !deletedSet.has(u.email.toLowerCase())
    );
    const pkg = {
      version: state.version,
      exported_at: new Date().toISOString(),
      property_name: state.property_name,
      admin: {
        name: state.admin.name,
        email: state.admin.email,
        custom_password: state.admin.password_hash,
      },
      users: activeUsers,
      deleted_user_ids: state.deleted_user_ids || [],
      deleted_ac_unit_ids: state.deleted_ac_unit_ids || [],
      deleted_ac_log_ids: state.deleted_ac_log_ids || [],
      settings: state.settings,
      ac_units: state.ac_units || [],
      ac_logs: state.ac_logs || [],
    };

    const requests: Promise<any>[] = [];
    for (const baseUrl of REMOTE_SYNC_URLS) {
      requests.push(
        fetch(`${baseUrl}/api/settings`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "x-sync-forwarded": "1" },
          body: JSON.stringify(state.settings),
        }),
        fetch(`${baseUrl}/api/ac-units/bulk`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "x-sync-forwarded": "1" },
          body: JSON.stringify({ units: state.ac_units || [] }),
        }),
        fetch(`${baseUrl}/api/sync-all`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-sync-forwarded": "1" },
          body: JSON.stringify(pkg),
        })
      );
    }
    await Promise.allSettled(requests);
  } catch {}
}

async function pullFromLiveRemoteIfNeeded(force = false): Promise<void> {
  const now = Date.now();
  if (isPullingRemote) return;
  // Skip pulling right after a local write so local write finishes propagating first
  if (!force && now - lastLocalWriteTime < 8000) return;
  if (!force && now - lastRemotePullTime < 3000) return;

  isPullingRemote = true;
  lastRemotePullTime = now;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const [pkgRes, logsRes, devLogsRes, settingsRes] = await Promise.allSettled([
      fetch(`${LIVE_REMOTE_URL}/api/export-package`, {
        signal: controller.signal,
        headers: { "x-sync-forwarded": "1" },
      }),
      fetch(`${LIVE_REMOTE_URL}/api/ac-logs`, {
        signal: controller.signal,
        headers: { "x-sync-forwarded": "1" },
      }),
      fetch(`${DEV_REMOTE_URL}/api/ac-logs`, {
        signal: controller.signal,
        headers: { "x-sync-forwarded": "1" },
      }),
      fetch(`${LIVE_REMOTE_URL}/api/settings`, {
        signal: controller.signal,
        headers: { "x-sync-forwarded": "1" },
      }),
    ]);
    clearTimeout(timer);

    let pkg: any = null;
    if (pkgRes.status === "fulfilled" && pkgRes.value.ok) {
      pkg = await pkgRes.value.json().catch(() => null);
    }
    let remoteLogsPayload: any = null;
    if (logsRes.status === "fulfilled" && logsRes.value.ok) {
      remoteLogsPayload = await logsRes.value.json().catch(() => null);
    }
    let devLogsPayload: any = null;
    if (devLogsRes.status === "fulfilled" && devLogsRes.value.ok) {
      devLogsPayload = await devLogsRes.value.json().catch(() => null);
    }
    if (devLogsPayload && Array.isArray(devLogsPayload.logs)) {
      if (!remoteLogsPayload || !Array.isArray(remoteLogsPayload.logs)) {
        remoteLogsPayload = devLogsPayload;
      } else {
        remoteLogsPayload.logs = [...remoteLogsPayload.logs, ...devLogsPayload.logs];
      }
    }
    let remoteSettingsPayload: any = null;
    if (settingsRes.status === "fulfilled" && settingsRes.value.ok) {
      remoteSettingsPayload = await settingsRes.value.json().catch(() => null);
    }

    if (!pkg && !remoteLogsPayload && !remoteSettingsPayload) return;

    const state = readState();
    let changed = false;

    if (pkg?.property_name && pkg.property_name !== state.property_name) {
      state.property_name = pkg.property_name;
      changed = true;
    }

    const incomingSettings = remoteSettingsPayload?.settings || pkg?.settings;
    if (incomingSettings && typeof incomingSettings === "object") {
      const mergedSettings = { ...state.settings, ...incomingSettings };
      const defaultBg = DEFAULT_SERVER_STATE.settings.dashboard_bg_url;
      let shouldPushBackSettings = false;
      if (
        incomingSettings.dashboard_bg_url === defaultBg &&
        state.settings.dashboard_bg_url &&
        state.settings.dashboard_bg_url !== defaultBg
      ) {
        mergedSettings.dashboard_bg_url = state.settings.dashboard_bg_url;
        shouldPushBackSettings = true;
      }
      if (!incomingSettings.gdrive_folder_id && state.settings.gdrive_folder_id) {
        mergedSettings.gdrive_folder_id = state.settings.gdrive_folder_id;
        shouldPushBackSettings = true;
      }
      if (!incomingSettings.gdrive_script_url && state.settings.gdrive_script_url) {
        mergedSettings.gdrive_script_url = state.settings.gdrive_script_url;
        shouldPushBackSettings = true;
      }
      if (shouldPushBackSettings) {
        fetch(`${LIVE_REMOTE_URL}/api/settings`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "x-sync-forwarded": "1" },
          body: JSON.stringify(mergedSettings),
        }).catch(() => {});
      }
      if (JSON.stringify(mergedSettings) !== JSON.stringify(state.settings)) {
        state.settings = mergedSettings;
        if (mergedSettings.property_name) {
          state.property_name = mergedSettings.property_name;
        }
        changed = true;
      }
    }

    if (pkg?.admin) {
      if (pkg.admin.email && pkg.admin.email !== state.admin.email) {
        state.admin.email = pkg.admin.email;
        changed = true;
      }
      if (pkg.admin.name && pkg.admin.name !== state.admin.name) {
        state.admin.name = pkg.admin.name;
        changed = true;
      }
      if (pkg.admin.custom_password && pkg.admin.custom_password !== state.admin.password_hash) {
        state.admin.password_hash = pkg.admin.custom_password;
        changed = true;
      }
    }

    if (Array.isArray(pkg?.deleted_user_ids)) {
      const mergedDel = Array.from(new Set([...(state.deleted_user_ids || []), ...pkg.deleted_user_ids]));
      if (mergedDel.length !== (state.deleted_user_ids || []).length) {
        state.deleted_user_ids = mergedDel;
        changed = true;
      }
    }

    if (Array.isArray(pkg?.users) && pkg.users.length > 0) {
      const delSet = new Set((state.deleted_user_ids || []).map((x) => x.toLowerCase()));
      const userMap = new Map<string, StoredUser>();
      state.users.forEach((u) => {
        if (!delSet.has(u.email.toLowerCase()) && !delSet.has(u.user_id.toLowerCase())) {
          userMap.set(u.email.toLowerCase(), u);
        }
      });
      pkg.users.forEach((u: any) => {
        const email = String(u.email || "").toLowerCase();
        if (!email || delSet.has(email) || delSet.has(String(u.user_id || "").toLowerCase())) return;
        userMap.set(email, {
          user_id: u.user_id || `usr_${Date.now()}`,
          name: u.name || "User",
          email,
          password_hash: u.password_hash || u.password || "123456",
          role: u.role === "admin" ? "admin" : "user",
          property_name: u.property_name || state.property_name,
          deleted: !!u.deleted,
          created_at: u.created_at || new Date().toISOString(),
        });
      });
      const nextUsers = Array.from(userMap.values());
      if (JSON.stringify(nextUsers) !== JSON.stringify(state.users)) {
        state.users = nextUsers;
        changed = true;
      }
    }

    if (Array.isArray(pkg?.ac_units) && pkg.ac_units.length > 0) {
      const delUnitSet = new Set([...(state.deleted_ac_unit_ids || []), ...(pkg.deleted_ac_unit_ids || [])]);
      const validRemoteUnits = pkg.ac_units.filter((u: any) => u && u.id && !delUnitSet.has(u.id));
      const mergedRemoteUnits = mergeUnitsListPreservingCycles(
        state.ac_units || [],
        validRemoteUnits,
        delUnitSet
      );
      if (JSON.stringify(mergedRemoteUnits) !== JSON.stringify(state.ac_units)) {
        state.ac_units = mergedRemoteUnits;
        state.deleted_ac_unit_ids = Array.from(delUnitSet);
        changed = true;
      }
      // If local state had custom cycles that were missing on remote, push them back to remote
      if (JSON.stringify(mergedRemoteUnits) !== JSON.stringify(validRemoteUnits)) {
        fetch(`${LIVE_REMOTE_URL}/api/ac-units/bulk`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "x-sync-forwarded": "1" },
          body: JSON.stringify({ units: mergedRemoteUnits }),
        }).catch(() => {});
      }
    }

    const remoteLogs = Array.isArray(remoteLogsPayload?.logs)
      ? remoteLogsPayload.logs
      : Array.isArray(pkg?.ac_logs)
      ? pkg.ac_logs
      : null;
    const remoteDeletedLogIds = [
      ...(Array.isArray(remoteLogsPayload?.deleted_log_ids) ? remoteLogsPayload.deleted_log_ids : []),
      ...(Array.isArray(pkg?.deleted_ac_log_ids) ? pkg.deleted_ac_log_ids : []),
    ];

    if (remoteLogs !== null) {
      const delLogSet = new Set([...(state.deleted_ac_log_ids || []), ...remoteDeletedLogIds]);
      const logMap = new Map<string, any>();
      const remoteLogMap = new Map<string, any>();
      (state.ac_logs || []).forEach((l: any) => {
        if (l && l.log_id && !delLogSet.has(l.log_id)) logMap.set(l.log_id, l);
      });
      remoteLogs.forEach((l: any) => {
        if (l && l.log_id && !delLogSet.has(l.log_id)) {
          remoteLogMap.set(l.log_id, l);
          const existing = logMap.get(l.log_id);
          if (!existing) {
            logMap.set(l.log_id, l);
          } else {
            const existTime = new Date(existing.updated_at || existing.created_at || 0).getTime();
            const remTime = new Date(l.updated_at || l.created_at || 0).getTime();
            if (remTime > existTime) {
              logMap.set(l.log_id, l);
            } else if (existTime > remTime) {
              // Push newer local edit to remote so remote stays in sync
              forwardToRemotePeers("/api/ac-logs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(existing),
              });
            }
          }
        }
      });
      // Push any local log that is missing on remote (e.g. after remote Cloud Run container restart)
      for (const [id, localLog] of logMap.entries()) {
        if (!remoteLogMap.has(id) && !delLogSet.has(id)) {
          forwardToRemotePeers("/api/ac-logs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(localLog),
          });
        }
      }
      const mergedLogs = Array.from(logMap.values()).sort(
        (a: any, b: any) => new Date(b.recorded_at || 0).getTime() - new Date(a.recorded_at || 0).getTime()
      );
      if (
        JSON.stringify(mergedLogs) !== JSON.stringify(state.ac_logs) ||
        delLogSet.size !== (state.deleted_ac_log_ids || []).length
      ) {
        state.ac_logs = mergedLogs;
        state.deleted_ac_log_ids = Array.from(delLogSet);
        changed = true;
      }
    }

    if (changed) {
      writeState(state, false);
    }
  } catch {
    // Silent ignore if offline or self-request
  } finally {
    isPullingRemote = false;
  }
}

// Initial state ensure & initial pull from live server
if (!fs.existsSync(getEffectiveDataFile())) {
  writeState(readState(), false);
}
pullFromLiveRemoteIfNeeded(true).catch(() => {});

// Periodic background pull every 5 seconds so server_data.json stays fresh
setInterval(() => {
  pullFromLiveRemoteIfNeeded(false).catch(() => {});
}, 5000);

// ----------------- API ROUTES -----------------

// Health check
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

// GET users
app.get("/api/users", async (req: Request, res: Response) => {
  if (req.headers["x-sync-forwarded"] !== "1") {
    await pullFromLiveRemoteIfNeeded();
  }
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
    deleted_user_ids: state.deleted_user_ids || [],
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

  const shouldForward = req.headers["x-sync-forwarded"] !== "1";
  writeState(state, shouldForward);
  if (shouldForward) {
    fetch(`${LIVE_REMOTE_URL}/api/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-sync-forwarded": "1" },
      body: JSON.stringify(req.body),
    }).catch(() => {});
  }

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

  const shouldForward = req.headers["x-sync-forwarded"] !== "1";
  writeState(state, shouldForward);
  if (shouldForward) {
    fetch(`${LIVE_REMOTE_URL}/api/users/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { "x-sync-forwarded": "1" },
    }).catch(() => {});
  }
  res.json({ ok: true, deleted: id });
});

// PUT or PATCH update user password
const handleUpdateUserPassword = (req: Request, res: Response) => {
  const { id } = req.params;
  const { new_password, password } = req.body;
  const rawPass = new_password || password;
  if (!rawPass || !String(rawPass).trim()) {
    return res.status(400).json({ ok: false, error: "Password baru wajib diisi" });
  }

  const cleanPass = String(rawPass).trim();
  const state = readState();
  const cleanId = String(id).toLowerCase();
  const shouldForward = req.headers["x-sync-forwarded"] !== "1";

  const user = state.users.find((u) => u.user_id.toLowerCase() === cleanId || u.email.toLowerCase() === cleanId);
  if (user) {
    user.password_hash = cleanPass;
    if (user.role === "admin" || user.email.toLowerCase() === state.admin.email.toLowerCase()) {
      state.admin.password_hash = cleanPass;
    }
    writeState(state, shouldForward);
    if (shouldForward) {
      fetch(`${LIVE_REMOTE_URL}/api/users/${encodeURIComponent(id)}/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-sync-forwarded": "1" },
        body: JSON.stringify({ password: cleanPass, new_password: cleanPass }),
      }).catch(() => {});
    }
    return res.json({ ok: true, message: "Password berhasil diperbarui" });
  }

  // If admin default
  if (cleanId === "usr_admin_midtown" || cleanId === "usr_admin_default" || cleanId === state.admin.email.toLowerCase()) {
    state.admin.password_hash = cleanPass;
    writeState(state, shouldForward);
    return res.json({ ok: true, message: "Password admin berhasil diperbarui" });
  }

  res.status(404).json({ ok: false, error: "Pengguna tidak ditemukan" });
};

app.put("/api/users/:id/password", handleUpdateUserPassword);
app.patch("/api/users/:id/password", handleUpdateUserPassword);

// GET / PUT admin credentials
app.get("/api/auth/admin-creds", async (req: Request, res: Response) => {
  if (req.headers["x-sync-forwarded"] !== "1") {
    await pullFromLiveRemoteIfNeeded();
  }
  const state = readState();
  res.json({
    ok: true,
    name: state.admin.name,
    email: state.admin.email,
  });
});

app.put("/api/auth/admin-creds", (req: Request, res: Response) => {
  const { email, password, name } = req.body;
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

  const shouldForward = req.headers["x-sync-forwarded"] !== "1";
  writeState(state, shouldForward);
  if (shouldForward) {
    fetch(`${LIVE_REMOTE_URL}/api/auth/admin-creds`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-sync-forwarded": "1" },
      body: JSON.stringify(req.body),
    }).catch(() => {});
  }
  res.json({
    ok: true,
    message: "Kredensial admin tersimpan di server",
    admin: { email: state.admin.email, name: state.admin.name },
  });
});

// POST Login verification
app.post("/api/auth/login", async (req: Request, res: Response) => {
  if (req.headers["x-sync-forwarded"] !== "1") {
    await pullFromLiveRemoteIfNeeded();
  }
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ ok: false, error: "Email dan Password wajib diisi" });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const cleanPass = String(password).trim();
  const state = readState();

  if (cleanEmail === "admin" && cleanPass.toLowerCase() === "admin") {
    return res.status(401).json({
      ok: false,
      error: "Akun 'admin' tidak terdaftar di daftar pengguna.",
    });
  }

  // 1. Check Admin Account (Configured in server state)
  const adminEmailMatch =
    state.admin?.email &&
    cleanEmail === state.admin.email.toLowerCase();

  const adminPassMatch =
    state.admin?.password_hash &&
    (cleanPass === state.admin.password_hash ||
      cleanPass.toLowerCase() === state.admin.password_hash.toLowerCase());

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

  // 2. Check Registered Users (Only users in user list can log in)
  const user = state.users.find(
    (u) =>
      !u.deleted &&
      (u.email.toLowerCase() === cleanEmail || u.name.toLowerCase() === cleanEmail)
  );

  if (user) {
    const isUserPassMatch =
      user.password_hash === cleanPass ||
      user.password_hash?.toLowerCase() === cleanPass.toLowerCase();

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
        token: `${user.role}_token_${Date.now()}`,
      });
    }
  }

  return res.status(401).json({
    ok: false,
    error: "Email atau Password salah. Silakan periksa kembali.",
  });
});

// POST token-for-user
app.post("/api/auth/token-for-user", (req: Request, res: Response) => {
  const user = req.body;
  if (!user || (!user.email && !user.user_id)) {
    return res.status(400).json({ ok: false, error: "Data pengguna tidak lengkap" });
  }
  const prefix = user.role === "admin" ? "admin" : "user";
  const token = `${prefix}_token_${Date.now()}`;
  res.json({ ok: true, token, user });
});

// GET /api/auth/me
app.get("/api/auth/me", (req: Request, res: Response) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  const state = readState();

  if (!token) {
    return res.status(401).json({ ok: false, error: "Tidak ada token otorisasi" });
  }

  if (token.startsWith("admin_token_")) {
    return res.json({
      ok: true,
      user: {
        user_id: state.admin.user_id,
        name: state.admin.name,
        email: state.admin.email,
        role: "admin",
        property_name: state.property_name,
      },
    });
  }

  const activeUser = state.users.find((u) => !u.deleted && u.role !== "admin") || state.users.find((u) => !u.deleted);
  if (activeUser) {
    return res.json({
      ok: true,
      user: {
        user_id: activeUser.user_id,
        name: activeUser.name,
        email: activeUser.email,
        role: activeUser.role,
        property_name: activeUser.property_name || state.property_name,
      },
    });
  }

  return res.status(401).json({ ok: false, error: "Sesi tidak valid" });
});

// POST /api/auth/logout
app.post("/api/auth/logout", (_req: Request, res: Response) => {
  res.json({ ok: true, message: "Berhasil keluar" });
});

// GET / PUT App Settings
app.get("/api/settings", async (req: Request, res: Response) => {
  if (req.headers["x-sync-forwarded"] !== "1") {
    await pullFromLiveRemoteIfNeeded();
  }
  const state = readState();
  res.json({ ok: true, settings: state.settings });
});

app.put("/api/settings", (req: Request, res: Response) => {
  const patch = req.body;
  const state = readState();
  state.settings = {
    ...state.settings,
    ...patch,
    updated_at: new Date().toISOString(),
  };
  if (patch.property_name) {
    state.property_name = patch.property_name;
  }
  const shouldForward = req.headers["x-sync-forwarded"] !== "1";
  writeState(state, shouldForward);
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

  if (pkg.settings && typeof pkg.settings === "object") {
    state.settings = { ...state.settings, ...pkg.settings };
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

  if (Array.isArray(pkg.deleted_ac_unit_ids)) {
    const set = new Set([...(state.deleted_ac_unit_ids || []), ...pkg.deleted_ac_unit_ids]);
    state.deleted_ac_unit_ids = Array.from(set);
  }

  if (Array.isArray(pkg.deleted_ac_log_ids)) {
    const set = new Set([...(state.deleted_ac_log_ids || []), ...pkg.deleted_ac_log_ids]);
    state.deleted_ac_log_ids = Array.from(set);
  }

  if (Array.isArray(pkg.users)) {
    const delSet = new Set((state.deleted_user_ids || []).map((id) => id.toLowerCase()));
    const userMap = new Map<string, StoredUser>();
    // Existing
    state.users.forEach((u) => {
      if (!delSet.has(u.email.toLowerCase()) && !delSet.has(u.user_id.toLowerCase())) {
        userMap.set(u.email.toLowerCase(), u);
      }
    });
    // New / Updated
    pkg.users.forEach((u: any) => {
      const email = String(u.email || "").toLowerCase();
      if (!email || delSet.has(email) || delSet.has(String(u.user_id || "").toLowerCase())) return;
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
    const delUnitSet = new Set(state.deleted_ac_unit_ids || []);
    state.ac_units = mergeUnitsListPreservingCycles(state.ac_units || [], pkg.ac_units, delUnitSet);
  }

  if (Array.isArray(pkg.ac_logs)) {
    const delLogSet = new Set(state.deleted_ac_log_ids || []);
    const logMap = new Map<string, any>();
    (state.ac_logs || []).forEach((l: any) => {
      if (l && l.log_id && !delLogSet.has(l.log_id)) logMap.set(l.log_id, l);
    });
    pkg.ac_logs.forEach((l: any) => {
      if (l && l.log_id && !delLogSet.has(l.log_id)) {
        const existing = logMap.get(l.log_id);
        if (!existing) {
          logMap.set(l.log_id, l);
        } else {
          const existTime = new Date(existing.updated_at || existing.created_at || 0).getTime();
          const remTime = new Date(l.updated_at || l.created_at || 0).getTime();
          if (remTime >= existTime) {
            logMap.set(l.log_id, l);
          }
        }
      }
    });
    state.ac_logs = Array.from(logMap.values()).sort(
      (a: any, b: any) => new Date(b.recorded_at || 0).getTime() - new Date(a.recorded_at || 0).getTime()
    );
  }

  writeState(state, req.headers["x-sync-forwarded"] !== "1");
  res.json({
    ok: true,
    message: "Seluruh data user, admin, pengaturan, dan AC berhasil disinkronkan ke server!",
    userCount: state.users.filter((u) => !u.deleted).length,
    acUnitsCount: (state.ac_units || []).length,
  });
});

// GET export package
app.get("/api/export-package", async (req: Request, res: Response) => {
  if (req.headers["x-sync-forwarded"] !== "1") {
    await pullFromLiveRemoteIfNeeded();
  }
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
    deleted_ac_unit_ids: state.deleted_ac_unit_ids || [],
    deleted_ac_log_ids: state.deleted_ac_log_ids || [],
    settings: state.settings,
    ac_units: state.ac_units || [],
    ac_logs: state.ac_logs || [],
  });
});

// ----------------- AC UNITS & LOGS API -----------------

// GET all AC units
app.get("/api/ac-units", async (req: Request, res: Response) => {
  if (req.headers["x-sync-forwarded"] !== "1") {
    await pullFromLiveRemoteIfNeeded();
  }
  const state = readState();
  res.json({
    ok: true,
    units: state.ac_units || [],
    deleted_unit_ids: state.deleted_ac_unit_ids || [],
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
  if (!state.deleted_ac_unit_ids) state.deleted_ac_unit_ids = [];

  const id = unit.id || `unit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  state.deleted_ac_unit_ids = state.deleted_ac_unit_ids.filter((delId) => delId !== id);
  const existingIdx = state.ac_units.findIndex((u) => u.id === id);

  const record = {
    ...unit,
    id,
    created_at: unit.created_at || new Date().toISOString(),
  };

  if (existingIdx >= 0) {
    state.ac_units[existingIdx] = mergeUnitPreservingCycle(state.ac_units[existingIdx], record);
  } else {
    const cleanRecord = { ...record };
    delete cleanRecord.clear_cycle;
    state.ac_units.push(cleanRecord);
  }

  const savedUnit = existingIdx >= 0 ? state.ac_units[existingIdx] : state.ac_units[state.ac_units.length - 1];
  const shouldForward = req.headers["x-sync-forwarded"] !== "1";
  writeState(state, shouldForward);
  if (shouldForward) {
    fetch(`${LIVE_REMOTE_URL}/api/ac-units`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-sync-forwarded": "1" },
      body: JSON.stringify({ ...savedUnit, clear_cycle: unit.clear_cycle === true }),
    }).catch(() => {});
  }
  res.json({ ok: true, unit: savedUnit });
});

// PUT bulk AC units (reorder or batch update)
app.put("/api/ac-units/bulk", (req: Request, res: Response) => {
  const { units, updates } = req.body;
  const state = readState();
  if (!state.ac_units) state.ac_units = [];
  const deletedUnitSet = new Set<string>(state.deleted_ac_unit_ids || []);

  if (Array.isArray(units)) {
    state.ac_units = mergeUnitsListPreservingCycles(state.ac_units || [], units, deletedUnitSet);
  } else if (Array.isArray(updates)) {
    const map = new Map(updates.map((u: any) => [u.id, u]));
    state.ac_units = state.ac_units
      .filter((item: any) => item && item.id && !deletedUnitSet.has(item.id))
      .map((item: any) => {
        const patch = map.get(item.id);
        if (patch) {
          return mergeUnitPreservingCycle(item, patch);
        }
        return item;
      });
  }

  const shouldForward = req.headers["x-sync-forwarded"] !== "1";
  writeState(state, shouldForward);
  if (shouldForward && Array.isArray(updates)) {
    fetch(`${LIVE_REMOTE_URL}/api/ac-units/bulk`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-sync-forwarded": "1" },
      body: JSON.stringify({ updates }),
    }).catch(() => {});
  }
  res.json({ ok: true, count: state.ac_units.length });
});

// DELETE single AC unit
app.delete("/api/ac-units/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const state = readState();
  if (!state.ac_units) state.ac_units = [];
  if (!state.deleted_ac_unit_ids) state.deleted_ac_unit_ids = [];
  if (id && !state.deleted_ac_unit_ids.includes(id)) {
    state.deleted_ac_unit_ids.push(id);
  }
  state.ac_units = state.ac_units.filter((u) => u.id !== id);
  const shouldForward = req.headers["x-sync-forwarded"] !== "1";
  writeState(state, shouldForward);
  if (shouldForward) {
    fetch(`${LIVE_REMOTE_URL}/api/ac-units/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { "x-sync-forwarded": "1" },
    }).catch(() => {});
  }
  res.json({ ok: true, deleted: id, deleted_unit_ids: state.deleted_ac_unit_ids });
});

// GET all AC maintenance logs
app.get("/api/ac-logs", async (req: Request, res: Response) => {
  if (req.headers["x-sync-forwarded"] !== "1") {
    await pullFromLiveRemoteIfNeeded();
  }
  const state = readState();
  res.json({
    ok: true,
    logs: state.ac_logs || [],
    deleted_log_ids: state.deleted_ac_log_ids || [],
    deleted_logs_trash: state.deleted_ac_logs_trash || [],
  });
});

// POST single AC maintenance log
app.post("/api/ac-logs", (req: Request, res: Response) => {
  const log = req.body;
  if (!log) return res.status(400).json({ ok: false, error: "Data log wajib diisi" });
  const state = readState();
  if (!state.ac_logs) state.ac_logs = [];
  if (!state.deleted_ac_log_ids) state.deleted_ac_log_ids = [];

  const log_id = log.log_id || `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  state.deleted_ac_log_ids = state.deleted_ac_log_ids.filter((delId) => delId !== log_id);
  const existingIdx = state.ac_logs.findIndex((l) => l.log_id === log_id);
  const record = {
    ...log,
    log_id,
    created_at: log.created_at || new Date().toISOString(),
    updated_at: log.updated_at || new Date().toISOString(),
  };

  if (existingIdx >= 0) {
    state.ac_logs[existingIdx] = record;
    state.ac_logs.sort(
      (a: any, b: any) =>
        new Date(b.recorded_at || 0).getTime() - new Date(a.recorded_at || 0).getTime()
    );
  } else {
    // Otomatis hapus foto base64 lama dari pembersihan sebelumnya di kamar/unit yang sama, namun PERTAHANKAN link foto Google Drive (http/https)
    if (record.unit_id || record.unit_name) {
      const stripIfBase64 = (val: any) =>
        typeof val === "string" && val.startsWith("data:") ? undefined : val;
      state.ac_logs = state.ac_logs.map((pastLog: any) => {
        if (
          (pastLog.unit_id === record.unit_id || pastLog.unit_name === record.unit_name) &&
          pastLog.log_id !== log_id
        ) {
          pastLog.photo_temp_before = stripIfBase64(pastLog.photo_temp_before);
          pastLog.photo_temp_after = stripIfBase64(pastLog.photo_temp_after);
          pastLog.photo_anemo_before = stripIfBase64(pastLog.photo_anemo_before);
          pastLog.photo_anemo_after = stripIfBase64(pastLog.photo_anemo_after);
          pastLog.photo_before = stripIfBase64(pastLog.photo_before);
          pastLog.photo_after = stripIfBase64(pastLog.photo_after);
          pastLog.photo_url = stripIfBase64(pastLog.photo_url);
        }
        return pastLog;
      });
    }
    state.ac_logs.unshift(record);
  }

  const shouldForward = req.headers["x-sync-forwarded"] !== "1";
  lastLocalWriteTime = Date.now();
  writeState(state, false);
  if (shouldForward) {
    forwardToRemotePeers("/api/ac-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
    });
  }
  res.json({ ok: true, log: record });
});

// PUT update single AC maintenance log (e.g. Admin edit tanggal, kamar, teknisi)
app.put("/api/ac-logs/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const patch = req.body;
  if (!id || !patch) {
    return res.status(400).json({ ok: false, error: "ID dan data perubahan wajib diisi" });
  }
  const state = readState();
  if (!state.ac_logs) state.ac_logs = [];
  const existingIdx = state.ac_logs.findIndex((l) => l.log_id === id);
  const nowIso = new Date().toISOString();

  let updatedRecord: any;
  if (existingIdx >= 0) {
    updatedRecord = {
      ...state.ac_logs[existingIdx],
      ...patch,
      log_id: id,
      updated_at: patch.updated_at || nowIso,
    };
    state.ac_logs[existingIdx] = updatedRecord;
  } else {
    updatedRecord = {
      ...patch,
      log_id: id,
      created_at: patch.created_at || nowIso,
      updated_at: patch.updated_at || nowIso,
    };
    state.ac_logs.unshift(updatedRecord);
  }

  state.ac_logs.sort(
    (a: any, b: any) =>
      new Date(b.recorded_at || 0).getTime() - new Date(a.recorded_at || 0).getTime()
  );

  const shouldForward = req.headers["x-sync-forwarded"] !== "1";
  lastLocalWriteTime = Date.now();
  writeState(state, false);
  if (shouldForward) {
    forwardToRemotePeers("/api/ac-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedRecord),
    });
  }
  res.json({ ok: true, log: updatedRecord });
});

// POST Google Drive Photo Upload Proxy (forwards to Admin's Google Apps Script Web App)
app.post("/api/gdrive/upload", async (req: Request, res: Response) => {
  try {
    const state = readState();
    const {
      scriptUrl: bodyScriptUrl,
      folderId: bodyFolderId,
      fileName,
      mimeType,
      base64,
      subfolder,
      propertyName,
    } = req.body || {};

    const scriptUrl = String(bodyScriptUrl || state.settings?.gdrive_script_url || "").trim();
    const folderId = String(bodyFolderId || state.settings?.gdrive_folder_id || "").trim();

    if (!scriptUrl || !scriptUrl.startsWith("http")) {
      return res.status(400).json({
        ok: false,
        error: "URL jembatan Google Apps Script belum diatur di menu Pengaturan.",
      });
    }

    if (!base64) {
      return res.status(400).json({
        ok: false,
        error: "Data foto (base64) tidak ditemukan.",
      });
    }

    const response = await fetch(scriptUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      redirect: "follow",
      body: JSON.stringify({
        action: "upload_photo",
        fileName: fileName || `Foto_${Date.now()}.jpg`,
        mimeType: mimeType || "image/jpeg",
        base64,
        folderId,
        subfolder: subfolder || "",
        propertyName: propertyName || state.property_name || "Midtown Hotel Samarinda",
      }),
    });

    const text = await response.text();
    let parsed: any = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      return res.status(502).json({
        ok: false,
        error: "Respons dari Google Apps Script bukan format JSON. Pastikan akses Web App disetel ke 'Siapa saja' (Anyone).",
      });
    }

    if (parsed && parsed.ok) {
      return res.json(parsed);
    }

    return res.status(400).json({
      ok: false,
      error: parsed?.error || "Gagal menyimpan foto ke Google Drive.",
    });
  } catch (err: any) {
    return res.status(500).json({
      ok: false,
      error: err?.message || "Gagal menghubungi jembatan Google Apps Script.",
    });
  }
});

// Helper to format date & time in WITA (Asia/Makassar) with Zero-Width Space (\u200B)
// so Google Sheets =IMPORTDATA() never converts DD/MM/YYYY (days 01-12) into US serial numbers (e.g. 46090, 46151, 46182)
function formatCsvDateAndTimeWita(isoOrDate?: string | number | Date): { dateStr: string; timeStr: string } {
  const d = new Date(isoOrDate || Date.now());
  const valid = isNaN(d.getTime()) ? new Date() : d;

  const dateParts = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Makassar",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(valid);

  const day = dateParts.find((p) => p.type === "day")?.value || "01";
  const month = dateParts.find((p) => p.type === "month")?.value || "01";
  const year = dateParts.find((p) => p.type === "year")?.value || "2026";

  const timeParts = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Makassar",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(valid);

  const hour = (timeParts.find((p) => p.type === "hour")?.value || "00").padStart(2, "0");
  const minute = (timeParts.find((p) => p.type === "minute")?.value || "00").padStart(2, "0");

  // Sisipkan \u200B (Zero-Width Space) yang tidak terlihat agar Google Sheets =IMPORTDATA()
  // tidak mengubah tanggal 01 s/d 12 menjadi angka serial seperti 46090 / 46151 / 46182
  return {
    dateStr: `\u200B${day}\u200B/\u200B${month}\u200B/\u200B${year}`,
    timeStr: `\u200B${hour}\u200B:\u200B${minute}`,
  };
}

// GET CSV Export for Google Sheets =IMPORTDATA() formula
app.get("/api/export/csv", async (req: Request, res: Response) => {
  await pullFromLiveRemoteIfNeeded();
  const state = readState();
  const type = String(req.query.type || "ac_maintenance").toLowerCase();
  const category = String(req.query.category || "");

  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  if (type === "ac_maintenance" || !req.query.system) {
    let logs = Array.isArray(state.ac_logs) ? [...state.ac_logs] : [];
    if (category && category !== "all") {
      logs = logs.filter((l: any) => l.category === category);
    }
    logs.sort((a: any, b: any) => new Date(a.recorded_at || 0).getTime() - new Date(b.recorded_at || 0).getTime());

    const headers = [
      "No",
      "Tanggal",
      "Jam",
      "Kategori",
      "Ruangan / Unit",
      "Teknisi",
      "Suhu Before (C)",
      "Suhu After (C)",
      "Penurunan Suhu (C)",
      "Anemometer Before (m/s)",
      "Anemometer After (m/s)",
      "Peningkatan Angin (m/s)",
      "Link Foto Suhu Before",
      "Link Foto Suhu After",
      "Link Foto Anemo Before",
      "Link Foto Anemo After",
      "Catatan Kondisi",
    ];

    const formatPhotoCell = (val?: string) => {
      if (!val) return "-";
      if (val.startsWith("http")) return val;
      return "Tersimpan di Aplikasi";
    };

    const csvRows = [headers.map((h) => `"${h}"`).join(",")];
    logs.forEach((l: any, idx: number) => {
      const { dateStr, timeStr } = formatCsvDateAndTimeWita(l.recorded_at || l.created_at);
      const tempDiff = ((Number(l.temp_before) || 0) - (Number(l.temp_after) || 0)).toFixed(1);
      const anemoDiff = ((Number(l.anemo_after) || 0) - (Number(l.anemo_before) || 0)).toFixed(2);

      const row = [
        String(idx + 1),
        dateStr,
        timeStr,
        l.category || "-",
        l.unit_name || "-",
        l.user_name || "-",
        String(l.temp_before ?? "-"),
        String(l.temp_after ?? "-"),
        tempDiff,
        String(l.anemo_before ?? "-"),
        String(l.anemo_after ?? "-"),
        anemoDiff,
        formatPhotoCell(l.photo_temp_before || l.photo_before),
        formatPhotoCell(l.photo_temp_after || l.photo_after),
        formatPhotoCell(l.photo_anemo_before),
        formatPhotoCell(l.photo_anemo_after),
        (l.notes || "").replace(/[\r\n]+/g, " "),
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`);
      csvRows.push(row.join(","));
    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    return res.send(csvRows.join("\r\n"));
  }

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.send('"Status"\r\n"OK"');
});

// DELETE AC maintenance log (moves to trash for 30 days so Admin can restore if needed)
app.delete("/api/ac-logs/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const state = readState();
  if (!state.ac_logs) state.ac_logs = [];
  if (!state.deleted_ac_log_ids) state.deleted_ac_log_ids = [];
  if (!state.deleted_ac_logs_trash) state.deleted_ac_logs_trash = [];

  const targetLog = state.ac_logs.find((l) => l.log_id === id);
  if (targetLog) {
    state.deleted_ac_logs_trash = [
      { ...targetLog, deleted_at: new Date().toISOString() },
      ...state.deleted_ac_logs_trash.filter((t) => t.log_id !== id),
    ].slice(0, 100);
  }

  if (id && !state.deleted_ac_log_ids.includes(id)) {
    state.deleted_ac_log_ids.push(id);
  }
  state.ac_logs = state.ac_logs.filter((l) => l.log_id !== id);
  const shouldForward = req.headers["x-sync-forwarded"] !== "1";
  writeState(state, shouldForward);
  if (shouldForward) {
    forwardToRemotePeers(`/api/ac-logs/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }
  res.json({ ok: true, deleted: id });
});

// POST restore deleted AC maintenance log from Trash
app.post("/api/ac-logs/restore", (req: Request, res: Response) => {
  const { log_id, log } = req.body || {};
  const targetId = log_id || log?.log_id;
  if (!targetId) {
    return res.status(400).json({ ok: false, error: "log_id wajib diisi" });
  }
  const state = readState();
  if (!state.ac_logs) state.ac_logs = [];
  if (!state.deleted_ac_log_ids) state.deleted_ac_log_ids = [];
  if (!state.deleted_ac_logs_trash) state.deleted_ac_logs_trash = [];

  state.deleted_ac_log_ids = state.deleted_ac_log_ids.filter((id) => id !== targetId);
  const fromTrash = state.deleted_ac_logs_trash.find((t) => t.log_id === targetId);
  state.deleted_ac_logs_trash = state.deleted_ac_logs_trash.filter((t) => t.log_id !== targetId);

  const restoredLog = log || fromTrash;
  if (restoredLog && restoredLog.log_id) {
    const cleanLog = { ...restoredLog, updated_at: new Date().toISOString() };
    delete cleanLog.deleted_at;
    const existIdx = state.ac_logs.findIndex((l) => l.log_id === targetId);
    if (existIdx >= 0) {
      state.ac_logs[existIdx] = cleanLog;
    } else {
      state.ac_logs.unshift(cleanLog);
    }
    state.ac_logs.sort(
      (a: any, b: any) =>
        new Date(b.recorded_at || 0).getTime() - new Date(a.recorded_at || 0).getTime()
    );
  }

  const shouldForward = req.headers["x-sync-forwarded"] !== "1";
  lastLocalWriteTime = Date.now();
  writeState(state, false);
  if (shouldForward) {
    forwardToRemotePeers("/api/ac-logs/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ log_id: targetId, log: restoredLog }),
    });
  }
  res.json({ ok: true, restored: targetId, log: restoredLog });
});

// POST bulk delete AC maintenance logs
app.post("/api/ac-logs/bulk-delete", (req: Request, res: Response) => {
  const { log_ids } = req.body;
  const state = readState();
  if (!state.ac_logs) state.ac_logs = [];
  if (!state.deleted_ac_log_ids) state.deleted_ac_log_ids = [];
  if (!state.deleted_ac_logs_trash) state.deleted_ac_logs_trash = [];
  if (Array.isArray(log_ids)) {
    const idSet = new Set<string>(log_ids);
    const removedLogs = state.ac_logs
      .filter((l) => idSet.has(l.log_id))
      .map((l) => ({ ...l, deleted_at: new Date().toISOString() }));
    if (removedLogs.length > 0) {
      state.deleted_ac_logs_trash = [
        ...removedLogs,
        ...state.deleted_ac_logs_trash.filter((t) => !idSet.has(t.log_id)),
      ].slice(0, 100);
    }
    for (const id of log_ids) {
      if (id && !state.deleted_ac_log_ids.includes(id)) {
        state.deleted_ac_log_ids.push(id);
      }
    }
    state.ac_logs = state.ac_logs.filter((l) => !idSet.has(l.log_id));
    const shouldForward = req.headers["x-sync-forwarded"] !== "1";
    writeState(state, shouldForward);
    if (shouldForward) {
      forwardToRemotePeers("/api/ac-logs/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ log_ids }),
      });
    }
  }
  res.json({ ok: true, remaining: state.ac_logs.length });
});

// POST clear all AC maintenance logs
app.post("/api/ac-logs/clear", (req: Request, res: Response) => {
  const state = readState();
  if (!state.deleted_ac_log_ids) state.deleted_ac_log_ids = [];
  if (Array.isArray(state.ac_logs)) {
    for (const l of state.ac_logs) {
      if (l?.log_id && !state.deleted_ac_log_ids.includes(l.log_id)) {
        state.deleted_ac_log_ids.push(l.log_id);
      }
    }
  }
  state.ac_logs = [];
  const shouldForward = req.headers["x-sync-forwarded"] !== "1";
  writeState(state, shouldForward);
  if (shouldForward) {
    fetch(`${LIVE_REMOTE_URL}/api/ac-logs/clear`, {
      method: "POST",
      headers: { "x-sync-forwarded": "1" },
    }).catch(() => {});
  }
  res.json({ ok: true, remaining: 0 });
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
      const defaultBg = DEFAULT_SERVER_STATE.settings.dashboard_bg_url;
      const mergedSettings = { ...state.settings, ...pkg.settings };
      if (
        pkg.settings.dashboard_bg_url === defaultBg &&
        state.settings.dashboard_bg_url &&
        state.settings.dashboard_bg_url !== defaultBg
      ) {
        mergedSettings.dashboard_bg_url = state.settings.dashboard_bg_url;
      }
      state.settings = mergedSettings;
    }
    if (Array.isArray(pkg.ac_units) && pkg.ac_units.length > 0) {
      const delUnitSet = new Set<string>(state.deleted_ac_unit_ids || []);
      state.ac_units = mergeUnitsListPreservingCycles(state.ac_units || [], pkg.ac_units, delUnitSet);
    }
    if (Array.isArray(pkg.ac_logs) && pkg.ac_logs.length > 0) {
      const delLogSet = new Set<string>([
        ...(state.deleted_ac_log_ids || []),
        ...(Array.isArray(pkg.deleted_ac_log_ids) ? pkg.deleted_ac_log_ids : []),
      ]);
      state.deleted_ac_log_ids = Array.from(delLogSet);
      const logMap = new Map<string, any>();
      for (const l of state.ac_logs || []) {
        if (l && l.log_id && !delLogSet.has(l.log_id)) {
          logMap.set(l.log_id, l);
        }
      }
      for (const l of pkg.ac_logs) {
        if (l && l.log_id && !delLogSet.has(l.log_id)) {
          const existing = logMap.get(l.log_id);
          if (!existing) {
            logMap.set(l.log_id, l);
          } else {
            const existTime = new Date(existing.updated_at || existing.created_at || 0).getTime();
            const remTime = new Date(l.updated_at || l.created_at || 0).getTime();
            if (remTime >= existTime) {
              logMap.set(l.log_id, l);
            }
          }
        }
      }
      state.ac_logs = Array.from(logMap.values()).sort(
        (a: any, b: any) => new Date(b.recorded_at || 0).getTime() - new Date(a.recorded_at || 0).getTime()
      );
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
  const isProduction = process.env.NODE_ENV === "production";
  const hasDist = fs.existsSync(distPath) && fs.existsSync(path.join(distPath, "index.html"));

  // If running in production with built dist, serve static production assets
  if (isProduction && hasDist) {
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
        server: { middlewareMode: true, hmr: false },
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
    console.log(`Server listening on port ${PORT} (isProduction=${isProduction}, hasDist=${hasDist})`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
