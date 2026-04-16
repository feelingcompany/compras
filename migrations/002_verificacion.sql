-- ============================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================
-- Ejecutar en Supabase SQL Editor después de la migración
-- para confirmar que todo está correcto

-- 1. Verificar que las tablas existan
SELECT 
  table_name,
  CASE 
    WHEN table_name = 'catalogo_servicios' THEN '✅ Catálogo de servicios'
    WHEN table_name = 'historial_precios' THEN '✅ Historial de precios'
  END as descripcion
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('catalogo_servicios', 'historial_precios')
ORDER BY table_name;

-- Resultado esperado: 2 filas
-- catalogo_servicios | ✅ Catálogo de servicios
-- historial_precios  | ✅ Historial de precios

-- ============================================

-- 2. Contar servicios seed
SELECT 
  COUNT(*) as total_servicios,
  '✅ Deberían ser 10 servicios' as verificacion
FROM catalogo_servicios;

-- Resultado esperado: 10

-- ============================================

-- 3. Verificar servicios por categoría
SELECT 
  categoria,
  COUNT(*) as cantidad
FROM catalogo_servicios
GROUP BY categoria
ORDER BY cantidad DESC;

-- Resultado esperado:
-- Servicios    | 4
-- Tecnología   | 3
-- Materiales   | 3

-- ============================================

-- 4. Verificar que el trigger esté creado
SELECT 
  trigger_name,
  event_manipulation,
  '✅ Trigger activo' as estado
FROM information_schema.triggers
WHERE trigger_name = 'trigger_actualizar_estadisticas';

-- Resultado esperado: 1 fila con trigger_actualizar_estadisticas

-- ============================================

-- 5. Ver todos los servicios cargados
SELECT 
  codigo,
  nombre,
  categoria,
  unidad_medida,
  TO_CHAR(precio_referencia, 'FM$999,999,999') as precio
FROM catalogo_servicios
ORDER BY categoria, nombre;

-- Deberías ver los 10 servicios con sus precios

-- ============================================

-- 6. Verificar índices
SELECT 
  indexname,
  tablename,
  '✅ Índice activo' as estado
FROM pg_indexes
WHERE tablename IN ('catalogo_servicios', 'historial_precios')
  AND schemaname = 'public'
ORDER BY tablename, indexname;

-- Resultado esperado: ~7 índices (3 en catalogo + 2 en historial + PKs)

-- ============================================
-- Si todos estos queries funcionan = TODO OK ✅
-- ============================================
