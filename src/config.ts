// Server URL configuration for Web and Android Capacitor APK

const SERVER_URL_KEY = "hotel_meter_server_url";

export const DEFAULT_SERVER_URL = "";
export const DEV_SERVER_URL = "";

export function getServerUrl(): string {
  try {
    const saved = localStorage.getItem(SERVER_URL_KEY);
    if (saved && saved.trim().startsWith("http")) {
      // Ignore stale URLs from previously exported container environments
      if (!saved.includes("754986885398") && !saved.includes("ais-pre-4dw7") && !saved.includes("ais-dev-4dw7")) {
        return saved.trim().replace(/\/+$/, "");
      }
    }
  } catch {}

  // If running in browser on standard domain, use origin (so /api calls hit the same server)
  if (typeof window !== "undefined") {
    if (window.location.origin && window.location.origin !== "null") {
      return window.location.origin;
    }
  }

  return "";
}

export function setServerUrl(url: string | null) {
  try {
    if (url && url.trim()) {
      localStorage.setItem(SERVER_URL_KEY, url.trim().replace(/\/+$/, ""));
    } else {
      localStorage.removeItem(SERVER_URL_KEY);
    }
  } catch {}
}
