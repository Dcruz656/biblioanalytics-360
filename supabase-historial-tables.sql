-- ============================================================
-- BiblioAnalytics 360 — Historial de Reservas
-- Ejecutar en Supabase SQL Editor (Dashboard → SQL Editor)
-- Este script crea la tabla de estadísticas de uso de
-- cubículos y computadoras. Sin esta tabla los datos de
-- exportación y los gráficos de servicios están vacíos.
-- ============================================================

CREATE TABLE IF NOT EXISTS historial_reservas (
  id          bigserial PRIMARY KEY,
  cubicule    text        NOT NULL,        -- nombre del cubículo / computadora
  tipo        text        NOT NULL
              CHECK (tipo IN ('cubiculos', 'computadoras')),
  nombre      text,                        -- nombre del estudiante
  matricula   text,
  carrera     text,
  duracion    integer,                     -- horas reservadas
  personas    integer,                     -- solo cubículos
  piso        integer,                     -- solo cubículos
  inicio      timestamptz,
  fin         timestamptz NOT NULL,        -- marca el fin del uso
  turno       text
              CHECK (turno IN ('Matutino', 'Vespertino', 'Nocturno')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Índices para las consultas más frecuentes
CREATE INDEX IF NOT EXISTS idx_hist_fin        ON historial_reservas (fin DESC);
CREATE INDEX IF NOT EXISTS idx_hist_matricula  ON historial_reservas (matricula);
CREATE INDEX IF NOT EXISTS idx_hist_tipo       ON historial_reservas (tipo);
CREATE INDEX IF NOT EXISTS idx_hist_carrera    ON historial_reservas (carrera);

-- Row Level Security — lectura y escritura anónima (igual que otras tablas del proyecto)
ALTER TABLE historial_reservas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read_historial"
  ON historial_reservas FOR SELECT USING (true);

CREATE POLICY "anon_write_historial"
  ON historial_reservas FOR INSERT WITH CHECK (true);

-- Realtime (para que el panel admin reciba nuevos registros en vivo)
ALTER PUBLICATION supabase_realtime ADD TABLE historial_reservas;
