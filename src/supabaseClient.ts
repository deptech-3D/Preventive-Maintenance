import { createClient, type SupportedStorage } from '@supabase/supabase-js'
import { Preferences } from '@capacitor/preferences'

// ============================================================================
// Konfigurasi URL & Key Supabase
// ============================================================================
export const RAW_URL = import.meta.env.VITE_SUPABASE_URL || 'https://supabase.co'
export const SUPABASE_URL = RAW_URL.replace(/\/rest\/v1\/?$/, '')
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_secret_atau_anon_key_kamu_yang_asli_tanpa_tanda_kurung_siku'
// ============================================================================

// Custom storage adapter menggunakan Capacitor Preferences
// Memungkinkan auth token tersimpan di native preferences (Android/iOS)
// dan tersinkronisasi otomatis dengan session login aplikasi sebelumnya.
const capacitorStorageAdapter: SupportedStorage = {
  getItem: async (key: string): Promise<string | null> => {
    const { value } = await Preferences.get({ key })
    return value
  },
  setItem: async (key: string, value: string): Promise<void> => {
    await Preferences.set({ key, value })
  },
  removeItem: async (key: string): Promise<void> => {
    await Preferences.remove({ key })
  },
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: capacitorStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})
