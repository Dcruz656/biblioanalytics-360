-- ============================================================
-- BiblioAnalytics 360 — Alterar historial_reservas
-- Ejecutar en Supabase SQL Editor DESPUÉS de supabase-historial-tables.sql
-- Habilita el registro al inicio de sesión (no solo al liberar)
-- ============================================================

-- 1. fin puede ser NULL mientras la sesión está en curso
--    (se rellena con el fin real al liberar)
ALTER TABLE historial_reservas
  ALTER COLUMN fin DROP NOT NULL;

-- 2. Unique constraint para el upsert inicio→fin
--    Permite actualizar el fin real sin crear duplicados
ALTER TABLE historial_reservas
  ADD CONSTRAINT hist_session_unique
  UNIQUE (matricula, cubicule, inicio);
