-- VERIFICAR ESTRUCTURA DE CATALOGO_SERVICIOS
-- Ejecutar en: https://supabase.com/dashboard/project/lxdeumwfzlfzzcmsrpyh/sql

-- Ver todas las columnas de la tabla
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM 
    information_schema.columns
WHERE 
    table_name = 'catalogo_servicios'
ORDER BY 
    ordinal_position;

-- Ver algunos registros de ejemplo
SELECT * FROM catalogo_servicios LIMIT 10;

-- Contar registros totales
SELECT COUNT(*) as total_servicios FROM catalogo_servicios;
