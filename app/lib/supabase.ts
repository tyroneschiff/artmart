import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'

export const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
export const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
