-- =====================================================
-- MIGRACIÓN 005: Solicitudes Multi-Ítem con Categorías
-- =====================================================
-- Fecha: 2026-04-16
-- Descripción: Agrega tabla items_solicitud y campos adicionales
--              para soportar solicitudes con múltiples ítems categorizados

-- 1. Tabla de ítems de solicitud
CREATE TABLE IF NOT EXISTS items_solicitud (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitud_id uuid REFERENCES solicitudes(id) ON DELETE CASCADE,
  categoria text NOT NULL,
  descripcion text NOT NULL,
  cantidad numeric NOT NULL,
  unidad text NOT NULL,
  especificaciones text,
  presupuesto_estimado numeric,
  created_at timestamptz DEFAULT now()
);

-- 2. Agregar campos nuevos a solicitudes
ALTER TABLE solicitudes
ADD COLUMN IF NOT EXISTS ciudad text,
ADD COLUMN IF NOT EXISTS prioridad text DEFAULT 'normal',
ADD COLUMN IF NOT EXISTS archivos_adjuntos jsonb DEFAULT '[]'::jsonb;

-- 3. Índices para performance
CREATE INDEX IF NOT EXISTS idx_items_solicitud_solicitud_id ON items_solicitud(solicitud_id);
CREATE INDEX IF NOT EXISTS idx_items_solicitud_categoria ON items_solicitud(categoria);

-- 4. Comentarios
COMMENT ON TABLE items_solicitud IS 'Ítems individuales de cada solicitud de compra';
COMMENT ON COLUMN items_solicitud.categoria IS 'Categoría del producto/servicio: Talento, Producción, Logística, etc.';
COMMENT ON COLUMN items_solicitud.descripcion IS 'Descripción específica del ítem';
COMMENT ON COLUMN items_solicitud.cantidad IS 'Cantidad solicitada';
COMMENT ON COLUMN items_solicitud.unidad IS 'Unidad de medida: Unidades, Horas, Días, Metros, etc.';
COMMENT ON COLUMN items_solicitud.especificaciones IS 'Detalles técnicos, marca, modelo, etc.';
COMMENT ON COLUMN items_solicitud.presupuesto_estimado IS 'Presupuesto aproximado si se conoce';

COMMENT ON COLUMN solicitudes.ciudad IS 'Ciudad donde se ejecutará el servicio/compra';
COMMENT ON COLUMN solicitudes.prioridad IS 'Prioridad de la solicitud: normal, urgente, critico';
COMMENT ON COLUMN solicitudes.archivos_adjuntos IS 'Array de archivos adjuntos {nombre, url, tipo}';

-- 5. Valores por defecto para registros existentes
UPDATE solicitudes
SET prioridad = 'normal'
WHERE prioridad IS NULL;

UPDATE solicitudes
SET archivos_adjuntos = '[]'::jsonb
WHERE archivos_adjuntos IS NULL;
