/**
 * Capa de acceso a datos — Supabase con fallback a localStorage.
 * Si VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY no están configuradas,
 * todas las funciones operan solo en localStorage (modo offline).
 */
import { supabase } from './supabase';
import {
  CUBI_STORAGE_KEY, COMPU_STORAGE_KEY, CUBI_ACCOUNTS_KEY,
  loadCubiculos as lsLoadCubiculos,
  saveCubiculos  as lsSaveCubiculos,
  loadComputadoras as lsLoadComputadoras,
  saveComputadoras as lsSaveComputadoras,
  loadAccounts as lsLoadAccounts,
  saveAccounts as lsSaveAccounts,
} from './cubiData';

// ── helpers de deserialización ──────────────────────────────────────────────
function parseCubi(row) {
  if (!row) return row;
  return {
    ...row,
    reserva: row.reserva
      ? { ...row.reserva, inicio: row.reserva.inicio ? new Date(row.reserva.inicio) : null }
      : null,
  };
}

function parseCompu(row) {
  if (!row) return row;
  return {
    ...row,
    reserva: row.reserva
      ? { ...row.reserva, inicio: row.reserva.inicio ? new Date(row.reserva.inicio) : null }
      : null,
  };
}

// ── Cubículos ───────────────────────────────────────────────────────────────
export async function dbLoadCubiculos() {
  if (!supabase) return lsLoadCubiculos();
  const { data, error } = await supabase.from('cubiculos').select('*').order('nombre');
  if (error) { console.error('[db] cubiculos load:', error.message); return lsLoadCubiculos(); }
  return data.map(parseCubi);
}

export async function dbSaveCubiculo(cubiculo) {
  lsSaveCubiculos(
    (lsLoadCubiculos() || []).map(c => c.id === cubiculo.id ? cubiculo : c)
  );
  if (!supabase) return;
  const { error } = await supabase.from('cubiculos').upsert(cubiculo, { onConflict: 'id' });
  if (error) console.error('[db] cubiculos save:', error.message);
}

export async function dbSeedCubiculos(arr) {
  lsSaveCubiculos(arr);
  if (!supabase) return;
  const { error } = await supabase.from('cubiculos').upsert(arr, { onConflict: 'id' });
  if (error) console.error('[db] cubiculos seed:', error.message);
}

export async function dbDeleteCubiculo(id) {
  lsSaveCubiculos((lsLoadCubiculos() || []).filter(c => c.id !== id));
  if (!supabase) return;
  const { error } = await supabase.from('cubiculos').delete().eq('id', id);
  if (error) console.error('[db] cubiculos delete:', error.message);
}

// ── Computadoras ────────────────────────────────────────────────────────────
export async function dbLoadComputadoras() {
  if (!supabase) return lsLoadComputadoras();
  const { data, error } = await supabase.from('computadoras').select('*').order('nombre');
  if (error) { console.error('[db] computadoras load:', error.message); return lsLoadComputadoras(); }
  return data.map(parseCompu);
}

export async function dbSaveComputadora(compu) {
  lsSaveComputadoras(
    (lsLoadComputadoras() || []).map(c => c.id === compu.id ? compu : c)
  );
  if (!supabase) return;
  const { error } = await supabase.from('computadoras').upsert(compu, { onConflict: 'id' });
  if (error) console.error('[db] computadoras save:', error.message);
}

export async function dbSeedComputadoras(arr) {
  lsSaveComputadoras(arr);
  if (!supabase) return;
  const { error } = await supabase.from('computadoras').upsert(arr, { onConflict: 'id' });
  if (error) console.error('[db] computadoras seed:', error.message);
}

export async function dbDeleteComputadora(id) {
  lsSaveComputadoras((lsLoadComputadoras() || []).filter(c => c.id !== id));
  if (!supabase) return;
  const { error } = await supabase.from('computadoras').delete().eq('id', id);
  if (error) console.error('[db] computadoras delete:', error.message);
}

// ── Alumnos ─────────────────────────────────────────────────────────────────
export async function dbFindAlumno(matricula) {
  if (!supabase) {
    const accounts = lsLoadAccounts();
    return accounts.find(a => String(a.matricula).toLowerCase() === String(matricula).toLowerCase().trim()) || null;
  }
  const { data, error } = await supabase
    .from('alumnos')
    .select('*')
    .ilike('matricula', matricula.trim())
    .single();
  if (error && error.code !== 'PGRST116') console.error('[db] alumnos find:', error.message);
  return data || null;
}

export async function dbSaveAlumno(alumno) {
  const accounts = lsLoadAccounts();
  const idx = accounts.findIndex(a => a.matricula === alumno.matricula);
  if (idx >= 0) accounts[idx] = alumno; else accounts.push(alumno);
  lsSaveAccounts(accounts);
  if (!supabase) return;
  const { error } = await supabase.from('alumnos').insert(alumno);
  if (error) {
    console.error('[db] alumnos insert:', error.code, error.message, error.hint);
    throw new Error(error.message);
  }
}

export async function dbLoadAlumnos() {
  if (!supabase) return lsLoadAccounts();
  const { data, error } = await supabase.from('alumnos').select('*').order('nombre');
  if (error) { console.error('[db] alumnos load:', error.message); return lsLoadAccounts(); }
  return data;
}

// ── Suscripciones en tiempo real ────────────────────────────────────────────
export function subscribeCubiculos(onChange) {
  if (!supabase) return () => {};
  const ch = supabase.channel('rt-cubiculos')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'cubiculos' }, payload => {
      onChange(parseCubi(payload.new || payload.old), payload.eventType);
    })
    .subscribe();
  return () => supabase.removeChannel(ch);
}

export function subscribeComputadoras(onChange) {
  if (!supabase) return () => {};
  const ch = supabase.channel('rt-computadoras')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'computadoras' }, payload => {
      onChange(parseCompu(payload.new || payload.old), payload.eventType);
    })
    .subscribe();
  return () => supabase.removeChannel(ch);
}

export function subscribeAlumnos(onChange) {
  if (!supabase) return () => {};
  const ch = supabase.channel('rt-alumnos')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'alumnos' }, payload => {
      onChange(payload.new || payload.old, payload.eventType);
    })
    .subscribe();
  return () => supabase.removeChannel(ch);
}

// ── App Config (PIN, etc.) ──────────────────────────────────────────────────
const APP_CONFIG_KEY = 'biblio_app_config';
const DEFAULT_APP_CONFIG = { pinRequired: true };

export function loadAppConfig() {
  try {
    const raw = localStorage.getItem(APP_CONFIG_KEY);
    return raw ? { ...DEFAULT_APP_CONFIG, ...JSON.parse(raw) } : { ...DEFAULT_APP_CONFIG };
  } catch { return { ...DEFAULT_APP_CONFIG }; }
}

export function saveAppConfig(config) {
  try { localStorage.setItem(APP_CONFIG_KEY, JSON.stringify(config)); } catch {}
}

export function broadcastAppConfig(config) {
  if (!supabase) return;
  supabase.channel('biblio-app-config').send({
    type: 'broadcast', event: 'config-update', payload: config,
  });
}

export function subscribeAppConfig(onChange) {
  if (!supabase) return () => {};
  const ch = supabase.channel('biblio-app-config')
    .on('broadcast', { event: 'config-update' }, ({ payload }) => onChange(payload))
    .subscribe();
  return () => supabase.removeChannel(ch);
}

// ── Push Subscriptions ──────────────────────────────────────────────────────
export async function dbSavePushSubscription(matricula, subscription) {
  if (!supabase) return;
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({ matricula, subscription }, { onConflict: 'matricula' });
  if (error) console.error('[db] push_subscriptions save:', error.message);
}

export async function dbGetPushSubscription(matricula) {
  if (!supabase || !matricula) return null;
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('subscription')
    .eq('matricula', matricula)
    .single();
  if (error) return null;
  return data?.subscription ?? null;
}
