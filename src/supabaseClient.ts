import { createClient } from '@supabase/supabase-js'

// Kredensial di-hardcode agar langsung terbaca 100% oleh perakit APK GitHub Actions
export const SUPABASE_URL = 'https://rxovpvxkgocorypesyjv.supabase.co'
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4b3ZwdnhrZ29jb3J5cGVzeWp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzOTI3NDcsImV4cCI6MjEwNDk2ODc0N30.ATlPjxKwVHkrFSh5rocpRiZjht3KNUWGvjtTj_on8mw'

// Membuat koneksi client resmi ke database Supabase
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
