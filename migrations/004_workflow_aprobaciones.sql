-- ============================================
-- MIGRACIÓN: WORKFLOW DE APROBACIONES MULTINIVEL
-- ============================================
-- Ejecutar en Supabase SQL Editor
-- Fecha: 2026-04-16

-- ============================================
-- 1. TABLA DE APROBACIONES
-- ============================================

CREATE TABLE IF NOT EXISTS aprobaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  of_id UUID REFERENCES ordenes_facturacion(id) ON DELETE CASCADE,
  nivel INTEGER NOT NULL, -- 1=Encargado, 2=Admin, 3=Gerencia, 4=Junta
  aprobador_id UUID REFERENCES usuarios(id),
  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente', -- pendiente, aprobado, rechazado
  comentarios TEXT,
  fecha_aprobacion TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_aprobaciones_of ON aprobaciones(of_id);
CREATE INDEX IF NOT EXISTS idx_aprobaciones_aprobador ON aprobaciones(aprobador_id);
CREATE INDEX IF NOT EXISTS idx_aprobaciones_estado ON aprobaciones(estado);

COMMENT ON TABLE aprobaciones IS 'Aprobaciones multinivel para órdenes de facturación';
COMMENT ON COLUMN aprobaciones.nivel IS '1=Encargado, 2=Admin Compras, 3=Gerencia, 4=Junta';
COMMENT ON COLUMN aprobaciones.estado IS 'pendiente, aprobado, rechazado';

-- ============================================
-- 2. TABLA DE REGLAS DE APROBACIÓN
-- ============================================

CREATE TABLE IF NOT EXISTS reglas_aprobacion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(100) NOT NULL,
  monto_min DECIMAL(15,2) NOT NULL,
  monto_max DECIMAL(15,2), -- NULL = sin límite superior
  nivel_requerido INTEGER NOT NULL, -- 1, 2, 3, 4
  rol_aprobador VARCHAR(50) NOT NULL, -- encargado, admin_compras, gerencia
  activa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reglas_activa ON reglas_aprobacion(activa);

COMMENT ON TABLE reglas_aprobacion IS 'Reglas de aprobación según monto de la OF';

-- ============================================
-- 3. SEED DE REGLAS POR DEFECTO
-- ============================================

INSERT INTO reglas_aprobacion (nombre, monto_min, monto_max, nivel_requerido, rol_aprobador, activa)
VALUES
  ('Nivel 1: Aprobación Automática', 0, 3000000, 1, 'encargado', true),
  ('Nivel 2: Admin Compras', 3000000, 10000000, 2, 'admin_compras', true),
  ('Nivel 3: Gerencia', 10000000, 50000000, 3, 'gerencia', true),
  ('Nivel 4: Junta Directiva', 50000000, NULL, 4, 'gerencia', true)
ON CONFLICT DO NOTHING;

-- ============================================
-- 4. FUNCIÓN: Determinar nivel requerido
-- ============================================

CREATE OR REPLACE FUNCTION get_nivel_aprobacion_requerido(monto DECIMAL)
RETURNS INTEGER AS $$
DECLARE
  nivel INTEGER;
BEGIN
  SELECT nivel_requerido INTO nivel
  FROM reglas_aprobacion
  WHERE activa = true
    AND monto >= monto_min
    AND (monto_max IS NULL OR monto < monto_max)
  ORDER BY nivel_requerido DESC
  LIMIT 1;
  
  RETURN COALESCE(nivel, 1);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_nivel_aprobacion_requerido IS 'Determina el nivel de aprobación requerido según el monto';

-- ============================================
-- 5. FUNCIÓN: Crear aprobaciones automáticamente
-- ============================================

CREATE OR REPLACE FUNCTION crear_aprobaciones_of()
RETURNS TRIGGER AS $$
DECLARE
  nivel_req INTEGER;
  aprobador UUID;
  rol_necesario VARCHAR(50);
BEGIN
  -- Determinar nivel requerido según monto
  nivel_req := get_nivel_aprobacion_requerido(NEW.valor_total);
  
  -- Crear aprobaciones necesarias según el nivel
  FOR i IN 1..nivel_req LOOP
    -- Determinar rol necesario para cada nivel
    rol_necesario := CASE i
      WHEN 1 THEN 'encargado'
      WHEN 2 THEN 'admin_compras'
      WHEN 3 THEN 'gerencia'
      WHEN 4 THEN 'gerencia' -- Junta usa gerencia por ahora
    END;
    
    -- Buscar un aprobador del rol correspondiente
    SELECT id INTO aprobador
    FROM usuarios
    WHERE activo = true AND rol = rol_necesario
    ORDER BY RANDOM()
    LIMIT 1;
    
    -- Crear aprobación (incluso si no hay aprobador, se crea pendiente)
    INSERT INTO aprobaciones (of_id, nivel, aprobador_id, estado)
    VALUES (NEW.id, i, aprobador, 'pendiente');
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION crear_aprobaciones_of IS 'Crea aprobaciones automáticamente cuando se inserta una OF';

-- ============================================
-- 6. TRIGGER: Crear aprobaciones al insertar OF
-- ============================================

DROP TRIGGER IF EXISTS trigger_crear_aprobaciones ON ordenes_facturacion;
CREATE TRIGGER trigger_crear_aprobaciones
  AFTER INSERT ON ordenes_facturacion
  FOR EACH ROW
  EXECUTE FUNCTION crear_aprobaciones_of();

-- ============================================
-- 7. FUNCIÓN: Actualizar estado OF según aprobaciones
-- ============================================

CREATE OR REPLACE FUNCTION actualizar_estado_of()
RETURNS TRIGGER AS $$
DECLARE
  total_niveles INTEGER;
  niveles_aprobados INTEGER;
  tiene_rechazos BOOLEAN;
BEGIN
  -- Contar niveles totales, aprobados y rechazos para esta OF
  SELECT 
    COUNT(*),
    COUNT(CASE WHEN estado = 'aprobado' THEN 1 END),
    COUNT(CASE WHEN estado = 'rechazado' THEN 1 END) > 0
  INTO total_niveles, niveles_aprobados, tiene_rechazos
  FROM aprobaciones
  WHERE of_id = NEW.of_id;
  
  -- Si hay rechazos, marcar OF como DESESTIMADA
  IF tiene_rechazos THEN
    UPDATE ordenes_facturacion
    SET estado_verificacion = 'DESESTIMADA'
    WHERE id = NEW.of_id;
  
  -- Si todos los niveles están aprobados, marcar OF como OK
  ELSIF niveles_aprobados = total_niveles THEN
    UPDATE ordenes_facturacion
    SET estado_verificacion = 'OK'
    WHERE id = NEW.of_id;
  
  -- Si hay aprobaciones pendientes, mantener EN_REVISION
  ELSE
    UPDATE ordenes_facturacion
    SET estado_verificacion = 'EN_REVISION'
    WHERE id = NEW.of_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION actualizar_estado_of IS 'Actualiza el estado de la OF según el estado de sus aprobaciones';

-- ============================================
-- 8. TRIGGER: Actualizar estado OF al cambiar aprobación
-- ============================================

DROP TRIGGER IF EXISTS trigger_actualizar_estado_of ON aprobaciones;
CREATE TRIGGER trigger_actualizar_estado_of
  AFTER INSERT OR UPDATE ON aprobaciones
  FOR EACH ROW
  EXECUTE FUNCTION actualizar_estado_of();

-- ============================================
-- 9. CREAR APROBACIONES PARA OFs EXISTENTES (OPCIONAL)
-- ============================================
-- Comentado por defecto - descomentar si quieres crear aprobaciones para OFs existentes

/*
DO $$
DECLARE
  of_record RECORD;
  nivel_req INTEGER;
  aprobador UUID;
  rol_necesario VARCHAR(50);
BEGIN
  -- Iterar sobre todas las OFs que no tienen aprobaciones
  FOR of_record IN 
    SELECT id, valor_total 
    FROM ordenes_facturacion 
    WHERE NOT EXISTS (SELECT 1 FROM aprobaciones WHERE of_id = ordenes_facturacion.id)
    LIMIT 100 -- Limitar a 100 para no saturar
  LOOP
    -- Determinar nivel requerido
    nivel_req := get_nivel_aprobacion_requerido(of_record.valor_total);
    
    -- Crear aprobaciones para cada nivel
    FOR i IN 1..nivel_req LOOP
      rol_necesario := CASE i
        WHEN 1 THEN 'encargado'
        WHEN 2 THEN 'admin_compras'
        WHEN 3 THEN 'gerencia'
        WHEN 4 THEN 'gerencia'
      END;
      
      SELECT id INTO aprobador
      FROM usuarios
      WHERE activo = true AND rol = rol_necesario
      ORDER BY RANDOM()
      LIMIT 1;
      
      INSERT INTO aprobaciones (of_id, nivel, aprobador_id, estado)
      VALUES (of_record.id, i, aprobador, 'pendiente');
    END LOOP;
  END LOOP;
END $$;
*/

-- ============================================
-- VERIFICACIÓN
-- ============================================

-- Verificar que las tablas se crearon
SELECT 
  'Tablas creadas' as status,
  COUNT(*) FILTER (WHERE tablename = 'aprobaciones') as tabla_aprobaciones,
  COUNT(*) FILTER (WHERE tablename = 'reglas_aprobacion') as tabla_reglas
FROM pg_tables 
WHERE schemaname = 'public' AND tablename IN ('aprobaciones', 'reglas_aprobacion');

-- Verificar reglas cargadas
SELECT 'Reglas de aprobación' as tipo, COUNT(*) as total FROM reglas_aprobacion;

-- Verificar funciones creadas
SELECT 
  'Funciones creadas' as status,
  COUNT(*) FILTER (WHERE proname = 'get_nivel_aprobacion_requerido') as fn_nivel,
  COUNT(*) FILTER (WHERE proname = 'crear_aprobaciones_of') as fn_crear,
  COUNT(*) FILTER (WHERE proname = 'actualizar_estado_of') as fn_actualizar
FROM pg_proc 
WHERE proname IN ('get_nivel_aprobacion_requerido', 'crear_aprobaciones_of', 'actualizar_estado_of');

-- Verificar triggers
SELECT 'Triggers creados' as status, COUNT(*) as total
FROM pg_trigger 
WHERE tgname IN ('trigger_crear_aprobaciones', 'trigger_actualizar_estado_of');
