-- ARREGLO DEFINITIVO DEL SISTEMA DE APROBACIONES
-- Ejecutá TODO este script de una vez en:
-- https://supabase.com/dashboard/project/lxdeumwfzlfzzcmsrpyh/sql

-- ================================================================
-- PASO 1: ASEGURAR COLUMNAS NECESARIAS
-- ================================================================

ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS centro_costo text DEFAULT 'GENERAL';
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE aprobaciones ADD COLUMN IF NOT EXISTS nivel_aprobacion integer DEFAULT 1;
ALTER TABLE aprobaciones ADD COLUMN IF NOT EXISTS orden_aprobacion integer DEFAULT 1;
ALTER TABLE aprobaciones ADD COLUMN IF NOT EXISTS fecha_limite timestamptz;
ALTER TABLE aprobaciones ADD COLUMN IF NOT EXISTS comentarios text;
ALTER TABLE aprobaciones ADD COLUMN IF NOT EXISTS fecha_aprobacion timestamptz;
ALTER TABLE aprobaciones ADD COLUMN IF NOT EXISTS fecha_rechazo timestamptz;

-- ================================================================
-- PASO 2: CREAR USUARIOS DE PRUEBA SI NO EXISTEN
-- ================================================================

INSERT INTO usuarios (nombre, email, pin, rol, area, activo)
VALUES ('Encargado Compras', 'encargado@feelingcompany.com', '1234', 'encargado', 'Compras', true)
ON CONFLICT (email) DO UPDATE SET rol = 'encargado', activo = true;

INSERT INTO usuarios (nombre, email, pin, rol, area, activo)
VALUES ('Gerencia Feeling', 'gerencia@feelingcompany.com', '1234', 'gerencia', 'Gerencia', true)
ON CONFLICT (email) DO UPDATE SET rol = 'gerencia', activo = true;

-- ================================================================
-- PASO 3: LIMPIAR FUNCIONES Y TRIGGERS ANTIGUOS
-- ================================================================

DROP TRIGGER IF EXISTS trigger_crear_aprobaciones ON solicitudes;
DROP TRIGGER IF EXISTS trigger_actualizar_solicitud ON aprobaciones;
DROP FUNCTION IF EXISTS crear_aprobaciones_automaticas() CASCADE;
DROP FUNCTION IF EXISTS actualizar_estado_solicitud() CASCADE;
DROP FUNCTION IF EXISTS calcular_monto_solicitud(uuid) CASCADE;
DROP FUNCTION IF EXISTS obtener_aprobadores_requeridos(numeric) CASCADE;
DROP FUNCTION IF EXISTS asignar_aprobador(text, text, text) CASCADE;

-- ================================================================
-- PASO 4: FUNCIÓN CALCULAR MONTO
-- ================================================================

CREATE OR REPLACE FUNCTION calcular_monto_solicitud(solicitud_uuid uuid)
RETURNS numeric AS $$
DECLARE 
  monto_total numeric := 0;
BEGIN
  SELECT COALESCE(SUM(
    CASE 
      WHEN presupuesto_estimado IS NOT NULL THEN presupuesto_estimado 
      ELSE 0 
    END
  ), 0)
  INTO monto_total 
  FROM items_solicitud 
  WHERE solicitud_id = solicitud_uuid;
  
  RETURN monto_total;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- PASO 5: TRIGGER PARA CREAR APROBACIONES AUTOMÁTICAMENTE
-- ================================================================

CREATE OR REPLACE FUNCTION crear_aprobaciones_automaticas()
RETURNS TRIGGER AS $$
DECLARE
  v_monto numeric;
  v_regla RECORD;
  v_aprobador_id uuid;
  v_orden integer := 1;
BEGIN
  -- Solo procesar si está en estado pendiente
  IF NEW.estado != 'pendiente' THEN 
    RETURN NEW; 
  END IF;
  
  -- Calcular monto total (con delay para que los items se hayan insertado)
  PERFORM pg_sleep(0.5);
  v_monto := calcular_monto_solicitud(NEW.id);
  
  -- Si no hay items todavía, asumir monto alto para crear todas las aprobaciones
  IF v_monto = 0 THEN
    v_monto := 1500000; -- Asumir monto medio por defecto
  END IF;
  
  -- Recorrer reglas de aprobación aplicables
  FOR v_regla IN 
    SELECT nivel_aprobacion, rol_aprobador, descripcion
    FROM reglas_aprobacion
    WHERE activo = true
      AND v_monto >= monto_minimo
      AND (monto_maximo IS NULL OR v_monto <= monto_maximo)
    ORDER BY nivel_aprobacion
  LOOP
    -- Buscar aprobador con ese rol
    SELECT id INTO v_aprobador_id
    FROM usuarios
    WHERE rol = v_regla.rol_aprobador 
      AND activo = true
    ORDER BY created_at
    LIMIT 1;
    
    -- Si se encontró aprobador, crear la aprobación
    IF v_aprobador_id IS NOT NULL THEN
      INSERT INTO aprobaciones (
        solicitud_id, 
        aprobador_id, 
        nivel_aprobacion, 
        orden_aprobacion, 
        estado, 
        fecha_limite, 
        comentarios
      )
      VALUES (
        NEW.id, 
        v_aprobador_id, 
        v_regla.nivel_aprobacion, 
        v_orden, 
        'pendiente', 
        NOW() + INTERVAL '3 days', 
        v_regla.descripcion
      );
      
      -- Crear alerta (si existe la tabla)
      BEGIN
        INSERT INTO alertas (usuario_id, solicitud_id, tipo, mensaje, leida)
        VALUES (
          v_aprobador_id, 
          NEW.id, 
          'nueva_aprobacion', 
          'Nueva solicitud pendiente: ' || COALESCE(NEW.descripcion, 'Sin descripción'), 
          false
        );
      EXCEPTION WHEN OTHERS THEN
        -- Si falla la alerta, continuar
        NULL;
      END;
      
      v_orden := v_orden + 1;
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_crear_aprobaciones 
  AFTER INSERT ON solicitudes
  FOR EACH ROW 
  EXECUTE FUNCTION crear_aprobaciones_automaticas();

-- ================================================================
-- PASO 6: TRIGGER PARA ACTUALIZAR ESTADO DE SOLICITUD
-- ================================================================

CREATE OR REPLACE FUNCTION actualizar_estado_solicitud()
RETURNS TRIGGER AS $$
DECLARE 
  v_total integer;
  v_aprobadas integer;
  v_rechazadas integer;
BEGIN
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE estado = 'aprobada'),
    COUNT(*) FILTER (WHERE estado = 'rechazada')
  INTO v_total, v_aprobadas, v_rechazadas
  FROM aprobaciones 
  WHERE solicitud_id = NEW.solicitud_id;
  
  IF v_rechazadas > 0 THEN
    UPDATE solicitudes 
    SET estado = 'rechazada', updated_at = NOW() 
    WHERE id = NEW.solicitud_id;
  ELSIF v_aprobadas = v_total AND v_total > 0 THEN
    UPDATE solicitudes 
    SET estado = 'aprobada', updated_at = NOW() 
    WHERE id = NEW.solicitud_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_actualizar_solicitud 
  AFTER UPDATE ON aprobaciones
  FOR EACH ROW 
  WHEN (OLD.estado IS DISTINCT FROM NEW.estado)
  EXECUTE FUNCTION actualizar_estado_solicitud();

-- ================================================================
-- PASO 7: CREAR APROBACIONES PARA SOLICITUDES EXISTENTES SIN ELLAS
-- ================================================================

DO $$
DECLARE
  v_solicitud RECORD;
BEGIN
  FOR v_solicitud IN 
    SELECT s.id, s.descripcion, s.solicitante_id, s.estado
    FROM solicitudes s
    WHERE s.estado = 'pendiente'
      AND NOT EXISTS (SELECT 1 FROM aprobaciones a WHERE a.solicitud_id = s.id)
  LOOP
    -- Simular el INSERT trigger para solicitudes existentes
    DECLARE
      v_monto numeric;
      v_regla RECORD;
      v_aprobador_id uuid;
      v_orden integer := 1;
    BEGIN
      v_monto := calcular_monto_solicitud(v_solicitud.id);
      IF v_monto = 0 THEN v_monto := 1500000; END IF;
      
      FOR v_regla IN 
        SELECT nivel_aprobacion, rol_aprobador, descripcion
        FROM reglas_aprobacion
        WHERE activo = true
          AND v_monto >= monto_minimo
          AND (monto_maximo IS NULL OR v_monto <= monto_maximo)
        ORDER BY nivel_aprobacion
      LOOP
        SELECT id INTO v_aprobador_id
        FROM usuarios
        WHERE rol = v_regla.rol_aprobador AND activo = true
        ORDER BY created_at LIMIT 1;
        
        IF v_aprobador_id IS NOT NULL THEN
          INSERT INTO aprobaciones (
            solicitud_id, aprobador_id, nivel_aprobacion, orden_aprobacion,
            estado, fecha_limite, comentarios
          )
          VALUES (
            v_solicitud.id, v_aprobador_id, v_regla.nivel_aprobacion, v_orden,
            'pendiente', NOW() + INTERVAL '3 days', v_regla.descripcion
          );
          
          v_orden := v_orden + 1;
        END IF;
      END LOOP;
    END;
  END LOOP;
END $$;

-- ================================================================
-- PASO 8: REFRESCAR SCHEMA CACHE
-- ================================================================

NOTIFY pgrst, 'reload schema';

-- ================================================================
-- VERIFICACIÓN FINAL
-- ================================================================

SELECT 
  'Solicitudes pendientes' as item, 
  COUNT(*)::text as valor 
FROM solicitudes WHERE estado = 'pendiente'
UNION ALL
SELECT 
  'Aprobaciones creadas', 
  COUNT(*)::text 
FROM aprobaciones
UNION ALL
SELECT 
  'Usuarios encargado', 
  COUNT(*)::text 
FROM usuarios WHERE rol = 'encargado' AND activo = true
UNION ALL
SELECT 
  'Usuarios admin_compras', 
  COUNT(*)::text 
FROM usuarios WHERE rol = 'admin_compras' AND activo = true
UNION ALL
SELECT 
  'Usuarios gerencia', 
  COUNT(*)::text 
FROM usuarios WHERE rol = 'gerencia' AND activo = true
UNION ALL
SELECT 
  'Reglas activas', 
  COUNT(*)::text 
FROM reglas_aprobacion WHERE activo = true;
