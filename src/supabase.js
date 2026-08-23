import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.warn('[Supabase] Variables de entorno no configuradas — modo offline (localStorage)');
}

export const supabase = (url && key) ? createClient(url, key) : null;
export const isOnline = !!supabase;
