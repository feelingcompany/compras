-- LIMPIEZA DEL CATÁLOGO DE SERVICIOS
-- Ejecutar en: https://supabase.com/dashboard/project/lxdeumwfzlfzzcmsrpyh/sql

-- Opción 1: Simplemente vaciar la tabla (mantiene la estructura actual)
TRUNCATE TABLE catalogo_servicios CASCADE;

-- Verificar que quedó vacía
SELECT COUNT(*) as registros_en_catalogo FROM catalogo_servicios;

-- NOTA: Después de ejecutar esto, el catálogo estará vacío
-- y el campo "Servicio (Opcional)" en el formulario de OFs
-- no mostrará ninguna opción predefinida.
-- 
-- El usuario podrá:
-- 1. Llenar todo manualmente (campo libre)
-- 2. Agregar servicios al catálogo más adelante desde la página de administración
