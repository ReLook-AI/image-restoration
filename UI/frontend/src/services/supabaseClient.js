import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const defaultSupabaseUrl = 'https://ardynnsjrgyndfwtdyyg.supabase.co'
const defaultSupabaseAnonKey = 'sb_publishable_rWbKKSY_kQNqppnKM3w_Wg__ZtkIq85'

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase env vars. Falling back to the configured hosted Supabase project.')
}

export const supabase = createClient(
  supabaseUrl || defaultSupabaseUrl,
  supabaseAnonKey || defaultSupabaseAnonKey
)
