-- ================================================================
-- DIAGNÓSTICO COMPLETO DEL SISTEMA COMPRAS FC
-- ================================================================
-- Ejecutá este script en Supabase SQL Editor
-- https://supabase.com/dashboard/project/lxdeumwfzlfzzcmsrpyh/sql

-- ================================================================
-- 1. ESTRUCTURA DE TABLA SOLICITUDES
-- ================================================================
SELECT '=== COLUMNAS DE SOLICITUDES ===' as seccion;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'solicitudes'
ORDER BY ordinal_position;

-- ================================================================
-- 2. ESTRUCTURA DE TABLA USUARIOS
-- ================================================================
SELECT '=== COLUMNAS DE USUARIOS ===' as seccion;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'usuarios'
ORDER BY ordinal_position;

-- ================================================================
-- 3. USUARIOS POR ROL
-- ================================================================
SELECT '=== USUARIOS POR ROL ===' as seccion;
SELECT rol, COUNT(*) as total, array_agg(nombre) as nombres
FROM usuarios
WHERE activo = true
GROUP BY rol
ORDER BY rol;

-- ================================================================
-- 4. FUNCIONES CREADAS
-- ================================================================
SELECT '=== FUNCIONES DEL SISTEMA ===' as seccion;
SELECT proname as nombre_funcion
FROM pg_proc 
WHERE proname IN (
  'calcular_monto_solicitud',
  'obtener_aprobadores_requeridos',
  'asignar_aprobador',
  'crear_aprobaciones_automaticas',
  'actualizar_estado_solicitud'
)
ORDER BY proname;

-- ================================================================
-- 5. TRIGGERS CREADOS
-- ================================================================
SELECT '=== TRIGGERS DEL SISTEMA ===' as seccion;
SELECT tgname as nombre_trigger, tgrelid::regclass as tabla
FROM pg_trigger 
WHERE tgname IN (
  'trigger_crear_aprobaciones',
  'trigger_actualizar_solicitud'
)
ORDER BY tgname;

-- ================================================================
-- 6. REGLAS DE APROBACIÓN
-- ================================================================
SELECT '=== REGLAS DE APROBACIÓN ===' as seccion;
SELECT monto_minimo, monto_maximo, nivel_aprobacion, rol_aprobador, descripcion
FROM reglas_aprobacion
WHERE activo = true
ORDER BY nivel_aprobacion, monto_minimo;

-- ================================================================
-- 7. SOLICITUDES RECIENTES
-- ================================================================
SELECT '=== SOLICITUDES RECIENTES ===' as seccion;
SELECT 
  s.id,
  s.descripcion,
  s.estado,
  s.created_at,
  u.nombre as solicitante
FROM solicitudes s
LEFT JOIN usuarios u ON s.solicitante_id = u.id
ORDER BY s.created_at DESC
LIMIT 5;

-- ================================================================
-- 8. APROBACIONES CREADAS
-- ================================================================
SELECT '=== APROBACIONES CREADAS ===' as seccion;
SELECT 
  a.id,
  a.nivel_aprobacion,
  a.estado,
  u.nombre as aprobador,
  u.rol as rol_aprobador,
  s.descripcion as solicitud
FROM aprobaciones a
LEFT JOIN usuarios u ON a.aprobador_id = u.id
LEFT JOIN solicitudes s ON a.solicitud_id = s.id
ORDER BY a.created_at DESC
LIMIT 10;

-- ================================================================
-- FIN DEL DIAGNÓSTICO
-- ================================================================
