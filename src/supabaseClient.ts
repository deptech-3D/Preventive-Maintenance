import { createClient, type SupportedStorage } from '@supabase/supabase-js'
import { Preferences } from '@capacitor/preferences'

// ============================================================================
// Konfigurasi URL & Key Supabase
// ============================================================================
export const getEffectiveSupabaseUrl = (): string => {
  if (typeof localStorage !== 'undefined') {
    const custom = localStorage.getItem('meter_custom_supabase_url')
    if (custom && custom.trim().startsWith('http')) {
      return custom.trim().replace(/\/rest\/v1\/?$/, '')
    }
  }
  const raw = import.meta.env.VITE_SUPABASE_URL || 'https://rxovpvxkgocorypesyjv.supabase.co'
  return raw.replace(/\/rest\/v1\/?$/, '')
}

export const getEffectiveSupabaseAnonKey = (): string => {
  if (typeof localStorage !== 'undefined') {
    const custom = localStorage.getItem('meter_custom_supabase_anon_key')
    if (custom && custom.trim()) {
      return custom.trim()
    }
  }
  return import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_secret_2V0Crt5G4CfX90J0xxAMKw_glBOqSmi'
}

export const RAW_URL = import.meta.env.VITE_SUPABASE_URL || 'https://rxovpvxkgocorypesyjv.supabase.co'
// Supabase Client membutuhkan base project URL (menghapus akhiran /rest/v1 jika ada)
export const SUPABASE_URL = getEffectiveSupabaseUrl()
export const SUPABASE_ANON_KEY = getEffectiveSupabaseAnonKey()
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
