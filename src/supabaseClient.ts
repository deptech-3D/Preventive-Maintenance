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

// Custom storage adapter dengan fallback yang aman untuk environment web maupun Capacitor
const capacitorStorageAdapter: SupportedStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      const { value } = await Preferences.get({ key })
      if (value !== null && value !== undefined) return value
    } catch {}
    try {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(key)
      }
    } catch {}
    return null
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await Preferences.set({ key, value })
    } catch {}
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value)
      }
    } catch {}
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      await Preferences.remove({ key })
    } catch {}
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key)
      }
    } catch {}
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
