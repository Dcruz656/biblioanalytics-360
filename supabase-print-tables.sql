-- ============================================================
-- BiblioAnalytics 360 — Servicio de Impresión
-- Ejecutar en Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Saldo de páginas en la tabla alumnos
ALTER TABLE alumnos
  ADD COLUMN IF NOT EXISTS saldo_paginas integer NOT NULL DEFAULT 0;

-- 2. Impresoras registradas
CREATE TABLE IF NOT EXISTS printers (
  id          text PRIMARY KEY,
  nombre      text NOT NULL,
  ip          text,
  modelo      text,
  ubicacion   text,
  online      boolean NOT NULL DEFAULT false,
  last_seen   timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE printers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_printers"   ON printers FOR SELECT USING (true);
CREATE POLICY "anon_write_printers"  ON printers FOR ALL    USING (true) WITH CHECK (true);

-- 3. Cola de trabajos de impresión
CREATE TABLE IF NOT EXISTS print_jobs (
  id               text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  matricula        text,
  carrera          text,
  nombre_archivo   text,
  filename         text,          -- alias legacy
  paginas          integer NOT NULL DEFAULT 1,
  paginas_cobradas integer,
  color            boolean NOT NULL DEFAULT false,
  doble_cara       boolean NOT NULL DEFAULT false,
  copias           integer NOT NULL DEFAULT 1,
  printer_id       text REFERENCES printers(id) ON DELETE SET NULL,
  estado           text NOT NULL DEFAULT 'pendiente'
                     CHECK (estado IN ('pendiente','imprimiendo','completado','error','cancelado')),
  reembolsado      boolean NOT NULL DEFAULT false,
  cancelado_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE print_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_print_jobs"   ON print_jobs FOR SELECT USING (true);
CREATE POLICY "anon_write_print_jobs"  ON print_jobs FOR ALL    USING (true) WITH CHECK (true);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_print_jobs_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_print_jobs_updated_at ON print_jobs;
CREATE TRIGGER trg_print_jobs_updated_at
  BEFORE UPDATE ON print_jobs
  FOR EACH ROW EXECUTE FUNCTION update_print_jobs_updated_at();

-- 4. Ledger de movimientos de saldo
CREATE TABLE IF NOT EXISTS print_ledger (
  id          bigserial PRIMARY KEY,
  matricula   text,
  job_id      text REFERENCES print_jobs(id) ON DELETE SET NULL,
  tipo        text NOT NULL CHECK (tipo IN ('recarga','cobro','reembolso')),
  paginas     integer NOT NULL,
  motivo      text,
  operador    text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE print_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_print_ledger"  ON print_ledger FOR SELECT USING (true);
CREATE POLICY "anon_write_print_ledger" ON print_ledger FOR ALL    USING (true) WITH CHECK (true);

-- 5. Habilitar Realtime para las tablas nuevas
-- (Ejecutar separado si falla junto con lo de arriba)
ALTER PUBLICATION supabase_realtime ADD TABLE printers;
ALTER PUBLICATION supabase_realtime ADD TABLE print_jobs;
