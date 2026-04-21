-- ================================================================
-- CATÁLOGO DE SERVICIOS PERSONALIZADO FEELING COMPANY
-- Generado automáticamente del histórico de compras 2026
-- 
-- Análisis realizado sobre 1,212 órdenes de facturación reales
-- Servicios extraídos: Solo aquellos con ≥3 ocurrencias en el histórico
-- Precios: Promedios calculados del histórico real de compras
-- ================================================================

-- EJECUTAR EN: https://supabase.com/dashboard/project/lxdeumwfzlfzzcmsrpyh/sql

-- Paso 1: Limpiar tabla existente
TRUNCATE TABLE catalogo_servicios CASCADE;

-- Paso 2: Insertar servicios recurrentes reales de Feeling Company

INSERT INTO catalogo_servicios (
  categoria,
  subcategoria,
  servicio,
  descripcion,
  unidad_medida,
  precio_referencia,
  activo
)
VALUES
  -- ========== MATERIALES (2 servicios) ==========
  (
    'Materiales',
    NULL,
    'Insumos operacionales',
    'Servicio recurrente - 72 órdenes en histórico',
    'unidad',
    312842,
    true
  ),
  (
    'Materiales',
    NULL,
    'Elementos operacionales',
    'Servicio frecuente - 39 órdenes en histórico',
    'unidad',
    200000,
    true
  ),
  
  -- ========== ALIMENTACIÓN (2 servicios) ==========
  (
    'Alimentación',
    NULL,
    'Refrigerios para eventos',
    'Servicio recurrente - 53 órdenes en histórico',
    'persona',
    2085382,
    true
  ),
  (
    'Alimentación',
    NULL,
    'Servicio de alimentación',
    'Servicio recurrente - 6 órdenes en histórico',
    'persona',
    12968020,
    true
  ),
  
  -- ========== SERVICIOS (1 servicio) ==========
  (
    'Servicios',
    NULL,
    'Alquiler de espacio',
    'Servicio recurrente - 46 órdenes en histórico',
    'unidad',
    4325911,
    true
  ),
  
  -- ========== TALENTO (2 servicios) ==========
  (
    'Talento',
    NULL,
    'Personal logístico',
    'Servicio recurrente - 23 órdenes en histórico',
    'día',
    2985804,
    true
  ),
  (
    'Talento',
    NULL,
    'Personal operativo',
    'Servicio frecuente - 36 órdenes en histórico',
    'día',
    150000,
    true
  ),
  
  -- ========== LOGÍSTICA (3 servicios) ==========
  (
    'Logística',
    NULL,
    'Transporte general',
    'Servicio recurrente - 21 órdenes en histórico',
    'servicio',
    15307383,
    true
  ),
  (
    'Logística',
    NULL,
    'Servicio de transporte',
    'Servicio recurrente - 6 órdenes en histórico',
    'servicio',
    2397500,
    true
  ),
  (
    'Logística',
    NULL,
    'Alquiler de vehículos',
    'Servicio frecuente - 51 órdenes en histórico',
    'día',
    2000000,
    true
  ),
  
  -- ========== IMPRESIÓN (1 servicio) ==========
  (
    'Impresión',
    NULL,
    'Servicio de impresión',
    'Servicio recurrente - 11 órdenes en histórico',
    'unidad',
    7279254,
    true
  ),
  
  -- ========== PRODUCCIÓN (1 servicio) ==========
  (
    'Producción',
    NULL,
    'Alquiler de equipos',
    'Servicio recurrente - 3 órdenes en histórico',
    'unidad',
    513000,
    true
  ),
  
  -- ========== TECNOLOGÍA (2 servicios) ==========
  (
    'Tecnología',
    NULL,
    'Plan de telefonía (TIGO/CLARO)',
    'Servicio frecuente - 139 órdenes en histórico',
    'mes',
    150000,
    true
  ),
  (
    'Tecnología',
    NULL,
    'Material de cómputo',
    'Servicio frecuente - 29 órdenes en histórico',
    'unidad',
    500000,
    true
  )
;

-- ================================================================
-- VERIFICACIÓN
-- ================================================================

-- Ver resumen por categoría
SELECT 
  categoria, 
  COUNT(*) as total_servicios,
  AVG(precio_referencia) as precio_promedio_categoria
FROM catalogo_servicios
GROUP BY categoria
ORDER BY total_servicios DESC;

-- Ver todos los servicios insertados
SELECT 
  categoria,
  servicio,
  precio_referencia,
  unidad_medida,
  descripcion
FROM catalogo_servicios
ORDER BY categoria, servicio;

-- Total de servicios
SELECT COUNT(*) as total_servicios_catalogo FROM catalogo_servicios;

-- ================================================================
-- RESUMEN
-- ================================================================
-- Total de servicios insertados: 14
-- Categorías: 7 (Materiales, Alimentación, Servicios, Talento, Logística, Impresión, Producción, Tecnología)
-- Basado en análisis de 1,212 órdenes de facturación reales del 2026
-- Servicios con ≥3 ocurrencias en el histórico
-- Precios calculados como promedio del histórico real
