-- MIGRACIÓN 006: AGREGAR COLUMNA CODIGO AL CATÁLOGO (SI NO EXISTE)
-- Ejecutar en: https://supabase.com/dashboard/project/lxdeumwfzlfzzcmsrpyh/sql

-- Primero limpiar datos de ejemplo
TRUNCATE TABLE catalogo_servicios CASCADE;

-- Agregar columna codigo si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'catalogo_servicios' 
        AND column_name = 'codigo'
    ) THEN
        ALTER TABLE catalogo_servicios 
        ADD COLUMN codigo VARCHAR(50) UNIQUE;
    END IF;
END $$;

-- Verificar estructura final
SELECT 
    column_name,
    data_type,
    is_nullable
FROM 
    information_schema.columns
WHERE 
    table_name = 'catalogo_servicios'
ORDER BY 
    ordinal_position;
