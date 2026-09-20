import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User } from "./types";
import { getServerUrl } from "./config";
import { supabase, supabaseLogin, getSavedSupabaseUser, clearSavedSupabaseUser } from "./supabaseService";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
  refresh: async () => {},
});

const TOKEN_KEY = "meter_checklist_token";

export async function apiGetToken(): Promise<string | null> {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function apiSetToken(t: string | null) {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

export async function resolveApiUrl(path: string): Promise<string> {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  const base = getServerUrl();
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${cleanPath}` : cleanPath;
}

export async function apiFetch<T = any>(url: string, init?: RequestInit): Promise<T> {
  const token = await apiGetToken();
  const headers = new Headers(init?.headers || {});
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (!(init?.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const fullUrl = await resolveApiUrl(url);

  let res: Response;
  try {
    res = await fetch(fullUrl, { ...init, headers });
  } catch (err: any) {
    throw new Error(`Koneksi ke server gagal. Pastikan terhubung internet / server aktif.`);
  }

  if (!res.ok) {
    let errDetail = "Terjadi kesalahan";
    try {
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const j = await res.json();
        errDetail = j.detail || j.error || j.message || errDetail;
      } else {
        const txt = await res.text();
        errDetail = `HTTP ${res.status}: ${res.statusText || "Server error"}`;
      }
    } catch {
      errDetail = res.statusText || errDetail;
    }
    throw new Error(errDetail);
  }

  const cType = res.headers.get("content-type") || "";
  if (!cType.includes("application/json")) {
    throw new Error("Respon server bukan format JSON. Periksa URL server di aplikasi.");
  }

  return res.json() as Promise<T>;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = async () => {
    // First check local Supabase user session
    const localUser = getSavedSupabaseUser();
    if (localUser) {
      setUser(localUser);
      setLoading(false);

      // Verify and revalidate session against Supabase asynchronously
      try {
        const token = await apiGetToken();
        if (!token) {
          fetch("/api/auth/token-for-user", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(localUser),
          })
            .then((r) => r.json())
            .then((d) => {
              if (d?.token) apiSetToken(d.token);
            })
            .catch(() => {});
        }

        const { data: currentRecord } = await supabase
          .from("app_users")
          .select("user_id, name, email, role, property_name, deleted")
          .eq("user_id", localUser.user_id)
          .maybeSingle();

        if (currentRecord) {
          if (currentRecord.deleted) {
            clearSavedSupabaseUser();
            await apiSetToken(null);
            setUser(null);
            return;
          }
          // If email or role or name was updated, update local user state
          if (
            currentRecord.email !== localUser.email ||
            currentRecord.name !== localUser.name ||
            currentRecord.role !== localUser.role
          ) {
            const updated: User = {
              ...localUser,
              name: currentRecord.name,
              email: currentRecord.email,
              role: currentRecord.role as "admin" | "user",
              property_name: currentRecord.property_name || localUser.property_name,
            };
            localStorage.setItem("meter_supabase_user", JSON.stringify(updated));
            setUser(updated);
          }
        }
      } catch {}
      return;
    }

    // Try fallback to backend /api/auth/me if available
    try {
      const token = await apiGetToken();
      if (!token) {
        setUser(null);
        return;
      }
      const data = await apiFetch<{ user: User }>("/api/auth/me");
      setUser(data.user);
    } catch {
      await apiSetToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMe();
  }, []);

  const login = async (identifier: string, pass: string) => {
    const cleanId = (identifier || "").trim();
    if (!cleanId || !pass) {
      throw new Error("Silakan masukkan username/email dan kata sandi.");
    }

    // 1. Try direct Supabase login (with offline/local fallback)
    try {
      const sbUser = await supabaseLogin(cleanId, pass);
      if (sbUser) {
        setUser(sbUser);
        try {
          const tRes = await fetch("/api/auth/token-for-user", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(sbUser),
          });
          if (tRes.ok) {
            const tData = await tRes.json();
            if (tData?.token) await apiSetToken(tData.token);
          }
        } catch {}
        return;
      }
    } catch (e) {
      console.warn("Supabase direct login attempt failed:", e);
    }

    // 2. Fallback to Express backend /api/auth/login if backend is reachable
    try {
      const res = await apiFetch<{ token: string; user: User }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: cleanId, email: cleanId, password: pass }),
      });
      if (res?.user) {
        await apiSetToken(res.token);
        setUser(res.user);
        return;
      }
    } catch {}

    throw new Error("Username atau password salah. Untuk login default, gunakan username 'admin' dan password 'admin'.");
  };

  const logout = async () => {
    clearSavedSupabaseUser();
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {}
    await apiSetToken(null);
    setUser(null);
  };

  const refresh = async () => {
    await fetchMe();
  };

  return React.createElement(
    AuthContext.Provider,
    { value: { user, loading, login, logout, refresh } },
    children
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
