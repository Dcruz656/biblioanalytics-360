/**
 * Capa de acceso a datos — Supabase como única fuente de verdad.
 * Sin localStorage. Si Supabase no está disponible las funciones devuelven
 * arrays vacíos / null para que la UI arranque en estado limpio.
 */
import { supabase } from './supabase';

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
  if (!supabase) return [];
  const { data, error } = await supabase.from('cubiculos').select('*').order('nombre');
  if (error) { console.error('[db] cubiculos load:', error.message); return []; }
  return data.map(parseCubi);
}

export async function dbSaveCubiculo(cubiculo) {
  if (!supabase) return;
  const { error } = await supabase.from('cubiculos').upsert(cubiculo, { onConflict: 'id' });
  if (error) console.error('[db] cubiculos save:', error.message);
}

export async function dbSeedCubiculos(arr) {
  if (!supabase) return;
  const { error } = await supabase.from('cubiculos').upsert(arr, { onConflict: 'id' });
  if (error) console.error('[db] cubiculos seed:', error.message);
}

export async function dbDeleteCubiculo(id) {
  if (!supabase) return;
  const { error } = await supabase.from('cubiculos').delete().eq('id', id);
  if (error) console.error('[db] cubiculos delete:', error.message);
}

// ── Computadoras ────────────────────────────────────────────────────────────
export async function dbLoadComputadoras() {
  if (!supabase) return [];
  const { data, error } = await supabase.from('computadoras').select('*').order('nombre');
  if (error) { console.error('[db] computadoras load:', error.message); return []; }
  return data.map(parseCompu);
}

export async function dbSaveComputadora(compu) {
  if (!supabase) return;
  const { error } = await supabase.from('computadoras').upsert(compu, { onConflict: 'id' });
  if (error) console.error('[db] computadoras save:', error.message);
}

export async function dbSeedComputadoras(arr) {
  if (!supabase) return;
  const { error } = await supabase.from('computadoras').upsert(arr, { onConflict: 'id' });
  if (error) console.error('[db] computadoras seed:', error.message);
}

export async function dbDeleteComputadora(id) {
  if (!supabase) return;
  const { error } = await supabase.from('computadoras').delete().eq('id', id);
  if (error) console.error('[db] computadoras delete:', error.message);
}

// ── Alumnos ─────────────────────────────────────────────────────────────────
export async function dbFindAlumno(matricula) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('alumnos')
    .select('*')
    .ilike('matricula', matricula.trim())
    .single();
  if (error && error.code !== 'PGRST116') console.error('[db] alumnos find:', error.message);
  return data || null;
}

export async function dbSaveAlumno(alumno) {
  if (!supabase) return;
  const { error } = await supabase.from('alumnos').insert(alumno);
  if (error) {
    console.error('[db] alumnos insert:', error.code, error.message, error.hint);
    throw new Error(error.message);
  }
}

export async function dbLoadAlumnos() {
  if (!supabase) return [];
  const { data, error } = await supabase.from('alumnos').select('*').order('nombre');
  if (error) { console.error('[db] alumnos load:', error.message); return []; }
  return data;
}

export async function dbUpdateAlumno(alumno) {
  if (!supabase) return;
  const { error } = await supabase.from('alumnos').update(alumno).eq('matricula', alumno.matricula);
  if (error) console.error('[db] alumnos update:', error.message);
}

export async function dbDeleteAlumno(matricula) {
  if (!supabase) return;
  const { error } = await supabase.from('alumnos').delete().eq('matricula', matricula);
  if (error) console.error('[db] alumnos delete:', error.message);
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

// ── App Config ───────────────────────────────────────────────────────────────
const DEFAULT_APP_CONFIG = { pinRequired: true };

export async function dbLoadAppConfig() {
  if (!supabase) return { ...DEFAULT_APP_CONFIG };
  const { data, error } = await supabase
    .from('app_config').select('config').eq('id', 1).single();
  if (error) { console.error('[db] app_config load:', error.message); return { ...DEFAULT_APP_CONFIG }; }
  return { ...DEFAULT_APP_CONFIG, ...(data?.config ?? {}) };
}

export async function dbSaveAppConfig(config) {
  if (!supabase) return;
  const { error } = await supabase
    .from('app_config')
    .update({ config, updated_at: new Date().toISOString() })
    .eq('id', 1);
  if (error) console.error('[db] app_config save:', error.message);
}

export function subscribeAppConfig(onChange) {
  if (!supabase) return () => {};
  const ch = supabase.channel('rt-app-config')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_config' }, payload => {
      onChange({ ...DEFAULT_APP_CONFIG, ...(payload.new?.config ?? {}) });
    })
    .subscribe();
  return () => supabase.removeChannel(ch);
}

export function loadAppConfig() { return { ...DEFAULT_APP_CONFIG }; }
export function saveAppConfig() {}
export function broadcastAppConfig() {}

// ── Historial de reservas ───────────────────────────────────────────────────
export async function dbSaveHistorialReserva(entry) {
  if (!supabase) return;
  const { error } = await supabase.from('historial_reservas').insert(entry);
  if (error) console.error('[db] historial_reservas insert:', error.message);
}

export async function dbLoadHistorialReservas(limit = 1000) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('historial_reservas')
    .select('*')
    .order('fin', { ascending: false })
    .limit(limit);
  if (error) { console.error('[db] historial load:', error.message); return []; }
  return data ?? [];
}

export function subscribeHistorialReservas(onChange) {
  if (!supabase) return () => {};
  const channel = supabase
    .channel('historial_reservas_changes')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'historial_reservas' }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}

// ── Push Subscriptions ───────────────────────────────────────────────────────
export async function dbSavePushSubscription(matricula, subscription) {
  if (!supabase) return;
  const endpoint = subscription.endpoint;
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({ matricula, subscription, endpoint }, { onConflict: 'endpoint' });
  if (error) console.error('[db] push_subscriptions save:', error.message);
}

export async function dbGetPushSubscriptions(matricula) {
  if (!supabase || !matricula) return [];
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('subscription')
    .eq('matricula', matricula);
  if (error) return [];
  return (data ?? []).map(r => r.subscription);
}

export async function dbGetPushSubscription(matricula) {
  const subs = await dbGetPushSubscriptions(matricula);
  return subs[0] ?? null;
}

// ── Impresión — Print Jobs ───────────────────────────────────────────────────
export async function dbLoadPrintJobs(limit = 300) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('print_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) { console.error('[db] print_jobs load:', error.message); return []; }
  return data ?? [];
}

export async function dbUpdatePrintJob(id, updates) {
  if (!supabase) return;
  const { error } = await supabase.from('print_jobs').update(updates).eq('id', id);
  if (error) console.error('[db] print_jobs update:', error.message);
}

export function subscribePrintJobs(onChange) {
  if (!supabase) return () => {};
  const ch = supabase.channel('rt-print-jobs')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'print_jobs' }, () => onChange())
    .subscribe();
  return () => supabase.removeChannel(ch);
}

// ── Impresión — Printers ─────────────────────────────────────────────────────
export async function dbLoadPrinters() {
  if (!supabase) return [];
  const { data, error } = await supabase.from('printers').select('*').order('nombre');
  if (error) { console.error('[db] printers load:', error.message); return []; }
  return data ?? [];
}

export async function dbSavePrinter(printer) {
  if (!supabase) return;
  const { error } = await supabase.from('printers').upsert(printer, { onConflict: 'id' });
  if (error) console.error('[db] printers save:', error.message);
}

export async function dbDeletePrinter(id) {
  if (!supabase) return;
  const { error } = await supabase.from('printers').delete().eq('id', id);
  if (error) console.error('[db] printers delete:', error.message);
}

export function subscribePrinters(onChange) {
  if (!supabase) return () => {};
  const ch = supabase.channel('rt-printers')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'printers' }, () => onChange())
    .subscribe();
  return () => supabase.removeChannel(ch);
}

// ── Impresión — Ledger ───────────────────────────────────────────────────────
export async function dbInsertPrintLedger(entry) {
  if (!supabase) return;
  const { error } = await supabase.from('print_ledger').insert(entry);
  if (error) console.error('[db] print_ledger insert:', error.message);
}

// ── Impresión — Saldo ────────────────────────────────────────────────────────
export async function dbRecargarSaldo(matricula, paginas, operador) {
  if (!supabase) return false;
  const { data: alumno, error: fe } = await supabase
    .from('alumnos').select('saldo_paginas').eq('matricula', matricula).single();
  if (fe) { console.error('[db] recargar saldo:', fe.message); return false; }
  const nuevo = (alumno?.saldo_paginas ?? 0) + paginas;
  const { error: ue } = await supabase
    .from('alumnos').update({ saldo_paginas: nuevo }).eq('matricula', matricula);
  if (ue) { console.error('[db] recargar saldo update:', ue.message); return false; }
  await dbInsertPrintLedger({ matricula, tipo: 'recarga', paginas, motivo: 'Recarga manual', operador: operador ?? 'admin', created_at: new Date().toISOString() });
  return true;
}

export async function dbReembolsarPrintJob(job) {
  if (!supabase || !job) return false;
  await dbUpdatePrintJob(job.id, { reembolsado: true });
  if (job.matricula && job.paginas_cobradas) {
    const { data: alumno } = await supabase
      .from('alumnos').select('saldo_paginas').eq('matricula', job.matricula).single();
    const nuevo = (alumno?.saldo_paginas ?? 0) + (job.paginas_cobradas ?? 0);
    await supabase.from('alumnos').update({ saldo_paginas: nuevo }).eq('matricula', job.matricula);
    await dbInsertPrintLedger({
      matricula: job.matricula, job_id: job.id,
      tipo: 'reembolso', paginas: job.paginas_cobradas,
      motivo: 'Reembolso manual admin', operador: 'admin',
      created_at: new Date().toISOString(),
    });
  }
  return true;
}
