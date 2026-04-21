-- ================================================================
-- SISTEMA DE APROBACIONES POR NIVELES - FEELING COMPANY
-- ================================================================
-- 
-- FLUJO DE APROBACIÓN:
-- 1. Usuario crea solicitud
-- 2. Sistema calcula monto total
-- 3. Según reglas, asigna aprobadores necesarios
-- 4. Cada nivel aprueba en orden
-- 5. Si todos aprueban → solicitud "aprobada"
-- 6. Si alguno rechaza → solicitud "rechazada"
--
-- NIVELES DE APROBACIÓN:
-- Nivel 1: Encargado de área (montos bajos)
-- Nivel 2: Admin de compras (montos medios)
-- Nivel 3: Gerencia (montos altos)
-- ================================================================

-- ================================================================
-- 1. TABLA DE REGLAS DE APROBACIÓN
-- ================================================================

CREATE TABLE IF NOT EXISTS reglas_aprobacion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  monto_minimo numeric NOT NULL,
  monto_maximo numeric,
  nivel_aprobacion integer NOT NULL, -- 1, 2, 3
  rol_aprobador text NOT NULL, -- 'encargado', 'admin_compras', 'gerencia'
  descripcion text,
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insertar reglas por defecto
INSERT INTO reglas_aprobacion (monto_minimo, monto_maximo, nivel_aprobacion, rol_aprobador, descripcion, activo)
VALUES
  -- Montos bajos: Solo encargado
  (0, 1000000, 1, 'encargado', 'Hasta $1M - Aprueba encargado de área', true),
  
  -- Montos medios: Encargado + Admin Compras
  (1000001, 5000000, 1, 'encargado', 'Entre $1M y $5M - Nivel 1: Encargado', true),
  (1000001, 5000000, 2, 'admin_compras', 'Entre $1M y $5M - Nivel 2: Admin Compras', true),
  
  -- Montos altos: Encargado + Admin Compras + Gerencia
  (5000001, NULL, 1, 'encargado', 'Más de $5M - Nivel 1: Encargado', true),
  (5000001, NULL, 2, 'admin_compras', 'Más de $5M - Nivel 2: Admin Compras', true),
  (5000001, NULL, 3, 'gerencia', 'Más de $5M - Nivel 3: Gerencia', true);

-- ================================================================
-- 2. MEJORAR TABLA DE APROBACIONES
-- ================================================================

-- Agregar columnas faltantes a la tabla aprobaciones
ALTER TABLE aprobaciones
ADD COLUMN IF NOT EXISTS nivel_aprobacion integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS orden_aprobacion integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS fecha_limite timestamptz,
ADD COLUMN IF NOT EXISTS comentarios text,
ADD COLUMN IF NOT EXISTS fecha_aprobacion timestamptz,
ADD COLUMN IF NOT EXISTS fecha_rechazo timestamptz;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_aprobaciones_aprobador ON aprobaciones(aprobador_id, estado);
CREATE INDEX IF NOT EXISTS idx_aprobaciones_solicitud_nivel ON aprobaciones(solicitud_id, nivel_aprobacion);
CREATE INDEX IF NOT EXISTS idx_reglas_activas ON reglas_aprobacion(activo, monto_minimo, monto_maximo);

-- ================================================================
-- 3. FUNCIÓN: CALCULAR MONTO TOTAL DE SOLICITUD
-- ================================================================

CREATE OR REPLACE FUNCTION calcular_monto_solicitud(solicitud_uuid uuid)
RETURNS numeric AS $$
DECLARE
  monto_total numeric;
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
-- 4. FUNCIÓN: OBTENER APROBADORES SEGÚN MONTO
-- ================================================================

CREATE OR REPLACE FUNCTION obtener_aprobadores_requeridos(monto_solicitud numeric)
RETURNS TABLE(
  nivel integer,
  rol text,
  descripcion text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.nivel_aprobacion,
    r.rol_aprobador,
    r.descripcion
  FROM reglas_aprobacion r
  WHERE r.activo = true
    AND monto_solicitud >= r.monto_minimo
    AND (r.monto_maximo IS NULL OR monto_solicitud <= r.monto_maximo)
  ORDER BY r.nivel_aprobacion;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- 5. FUNCIÓN: ASIGNAR APROBADOR ESPECÍFICO POR ROL Y ÁREA
-- ================================================================

CREATE OR REPLACE FUNCTION asignar_aprobador(
  rol_requerido text,
  area_solicitante text DEFAULT NULL,
  centro_costo_solicitud text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  aprobador_id uuid;
BEGIN
  -- Buscar usuario con el rol requerido
  -- Prioridad: mismo área > cualquier admin del rol
  SELECT id INTO aprobador_id
  FROM usuarios
  WHERE rol = rol_requerido
    AND activo = true
    AND (area = area_solicitante OR area_solicitante IS NULL)
  ORDER BY 
    CASE WHEN area = area_solicitante THEN 1 ELSE 2 END,
    created_at
  LIMIT 1;
  
  -- Si no se encuentra por área, buscar cualquiera con el rol
  IF aprobador_id IS NULL THEN
    SELECT id INTO aprobador_id
    FROM usuarios
    WHERE rol = rol_requerido
      AND activo = true
    ORDER BY created_at
    LIMIT 1;
  END IF;
  
  RETURN aprobador_id;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- 6. FUNCIÓN: CREAR APROBACIONES AUTOMÁTICAS
-- ================================================================

CREATE OR REPLACE FUNCTION crear_aprobaciones_automaticas()
RETURNS TRIGGER AS $$
DECLARE
  monto_total numeric;
  aprobador_requerido record;
  aprobador_asignado uuid;
  solicitante_area text;
  solicitante_centro text;
  orden_actual integer := 1;
BEGIN
  -- Solo crear aprobaciones para solicitudes nuevas en estado 'pendiente'
  IF NEW.estado != 'pendiente' THEN
    RETURN NEW;
  END IF;
  
  -- Calcular monto total de la solicitud
  monto_total := calcular_monto_solicitud(NEW.id);
  
  -- Obtener datos del solicitante
  SELECT area INTO solicitante_area
  FROM usuarios
  WHERE id = NEW.solicitante_id;
  
  solicitante_centro := NEW.centro_costo;
  
  -- Obtener aprobadores requeridos según el monto
  FOR aprobador_requerido IN 
    SELECT * FROM obtener_aprobadores_requeridos(monto_total)
  LOOP
    -- Asignar un aprobador específico según el rol
    aprobador_asignado := asignar_aprobador(
      aprobador_requerido.rol,
      solicitante_area,
      solicitante_centro
    );
    
    -- Si se encontró un aprobador, crear la aprobación
    IF aprobador_asignado IS NOT NULL THEN
      INSERT INTO aprobaciones (
        solicitud_id,
        aprobador_id,
        nivel_aprobacion,
        orden_aprobacion,
        estado,
        fecha_limite,
        comentarios
      ) VALUES (
        NEW.id,
        aprobador_asignado,
        aprobador_requerido.nivel,
        orden_actual,
        'pendiente',
        NOW() + INTERVAL '3 days', -- 3 días para aprobar
        aprobador_requerido.descripcion
      );
      
      -- Crear notificación para el aprobador
      INSERT INTO alertas (
        usuario_id,
        solicitud_id,
        tipo,
        mensaje,
        leida
      ) VALUES (
        aprobador_asignado,
        NEW.id,
        'nueva_aprobacion',
        'Nueva solicitud pendiente de aprobación: ' || NEW.descripcion,
        false
      );
      
      orden_actual := orden_actual + 1;
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- 7. TRIGGER: CREAR APROBACIONES AL INSERTAR SOLICITUD
-- ================================================================

DROP TRIGGER IF EXISTS trigger_crear_aprobaciones ON solicitudes;

CREATE TRIGGER trigger_crear_aprobaciones
  AFTER INSERT ON solicitudes
  FOR EACH ROW
  EXECUTE FUNCTION crear_aprobaciones_automaticas();

-- ================================================================
-- 8. FUNCIÓN: ACTUALIZAR ESTADO DE SOLICITUD SEGÚN APROBACIONES
-- ================================================================

CREATE OR REPLACE FUNCTION actualizar_estado_solicitud()
RETURNS TRIGGER AS $$
DECLARE
  total_aprobaciones integer;
  aprobaciones_aprobadas integer;
  aprobaciones_rechazadas integer;
BEGIN
  -- Contar aprobaciones de esta solicitud
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE estado = 'aprobada'),
    COUNT(*) FILTER (WHERE estado = 'rechazada')
  INTO 
    total_aprobaciones,
    aprobaciones_aprobadas,
    aprobaciones_rechazadas
  FROM aprobaciones
  WHERE solicitud_id = NEW.solicitud_id;
  
  -- Si alguna fue rechazada, rechazar la solicitud
  IF aprobaciones_rechazadas > 0 THEN
    UPDATE solicitudes
    SET estado = 'rechazada',
        updated_at = NOW()
    WHERE id = NEW.solicitud_id;
    
  -- Si todas fueron aprobadas, aprobar la solicitud
  ELSIF aprobaciones_aprobadas = total_aprobaciones AND total_aprobaciones > 0 THEN
    UPDATE solicitudes
    SET estado = 'aprobada',
        updated_at = NOW()
    WHERE id = NEW.solicitud_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- 9. TRIGGER: ACTUALIZAR SOLICITUD CUANDO CAMBIA APROBACIÓN
-- ================================================================

DROP TRIGGER IF EXISTS trigger_actualizar_solicitud ON aprobaciones;

CREATE TRIGGER trigger_actualizar_solicitud
  AFTER UPDATE ON aprobaciones
  FOR EACH ROW
  WHEN (OLD.estado IS DISTINCT FROM NEW.estado)
  EXECUTE FUNCTION actualizar_estado_solicitud();

-- ================================================================
-- 10. VISTA: APROBACIONES PENDIENTES CON DETALLES
-- ================================================================

CREATE OR REPLACE VIEW vista_aprobaciones_pendientes AS
SELECT 
  a.id as aprobacion_id,
  a.solicitud_id,
  a.aprobador_id,
  a.nivel_aprobacion,
  a.orden_aprobacion,
  a.estado,
  a.fecha_limite,
  a.comentarios,
  s.descripcion as solicitud_descripcion,
  s.centro_costo,
  s.fecha_requerida,
  s.prioridad,
  s.created_at as solicitud_fecha,
  u_solicitante.nombre as solicitante_nombre,
  u_solicitante.email as solicitante_email,
  u_aprobador.nombre as aprobador_nombre,
  u_aprobador.rol as aprobador_rol,
  calcular_monto_solicitud(s.id) as monto_total,
  CASE 
    WHEN a.fecha_limite < NOW() THEN true
    ELSE false
  END as vencida
FROM aprobaciones a
JOIN solicitudes s ON a.solicitud_id = s.id
JOIN usuarios u_solicitante ON s.solicitante_id = u_solicitante.id
JOIN usuarios u_aprobador ON a.aprobador_id = u_aprobador.id
WHERE a.estado = 'pendiente';

-- ================================================================
-- COMENTARIOS Y DOCUMENTACIÓN
-- ================================================================

COMMENT ON TABLE reglas_aprobacion IS 'Define las reglas de aprobación según rangos de monto';
COMMENT ON FUNCTION crear_aprobaciones_automaticas() IS 'Crea aprobaciones automáticas al insertar una solicitud según el monto';
COMMENT ON FUNCTION actualizar_estado_solicitud() IS 'Actualiza el estado de la solicitud cuando cambian las aprobaciones';
COMMENT ON VIEW vista_aprobaciones_pendientes IS 'Vista consolidada de aprobaciones pendientes con toda la información relevante';

-- ================================================================
-- FIN DE LA MIGRACIÓN
-- ================================================================
