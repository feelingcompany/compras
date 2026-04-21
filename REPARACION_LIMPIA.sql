-- REPARACIÓN COMPLETA DEL SISTEMA COMPRAS FC
-- Ejecutá TODO este script de una vez

-- 1. Agregar columna centro_costo
ALTER TABLE solicitudes 
ADD COLUMN IF NOT EXISTS centro_costo text DEFAULT 'GENERAL';

-- 2. Crear usuario encargado
INSERT INTO usuarios (nombre, email, pin, rol, area, activo)
VALUES ('Encargado Compras', 'encargado@feelingcompany.com', '1234', 'encargado', 'Compras', true)
ON CONFLICT (email) 
DO UPDATE SET rol = 'encargado', activo = true;

-- 3. Función calcular monto
CREATE OR REPLACE FUNCTION calcular_monto_solicitud(solicitud_uuid uuid)
RETURNS numeric AS $$
DECLARE monto_total numeric;
BEGIN
  SELECT COALESCE(SUM(
    CASE WHEN presupuesto_estimado IS NOT NULL THEN presupuesto_estimado ELSE 0 END
  ), 0)
  INTO monto_total FROM items_solicitud WHERE solicitud_id = solicitud_uuid;
  RETURN monto_total;
END;
$$ LANGUAGE plpgsql;

-- 4. Función obtener aprobadores
CREATE OR REPLACE FUNCTION obtener_aprobadores_requeridos(monto_solicitud numeric)
RETURNS TABLE(nivel integer, rol text, descripcion text) AS $$
BEGIN
  RETURN QUERY
  SELECT r.nivel_aprobacion, r.rol_aprobador, r.descripcion
  FROM reglas_aprobacion r
  WHERE r.activo = true
    AND monto_solicitud >= r.monto_minimo
    AND (r.monto_maximo IS NULL OR monto_solicitud <= r.monto_maximo)
  ORDER BY r.nivel_aprobacion;
END;
$$ LANGUAGE plpgsql;

-- 5. Función asignar aprobador
CREATE OR REPLACE FUNCTION asignar_aprobador(
  rol_requerido text,
  area_solicitante text DEFAULT NULL,
  centro_costo_solicitud text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE aprobador_id uuid;
BEGIN
  SELECT id INTO aprobador_id FROM usuarios
  WHERE rol = rol_requerido AND activo = true
  ORDER BY created_at LIMIT 1;
  RETURN aprobador_id;
END;
$$ LANGUAGE plpgsql;

-- 6. Función trigger crear aprobaciones
CREATE OR REPLACE FUNCTION crear_aprobaciones_automaticas()
RETURNS TRIGGER AS $$
DECLARE
  monto_total numeric;
  aprobador_requerido record;
  aprobador_asignado uuid;
  orden_actual integer := 1;
BEGIN
  IF NEW.estado != 'pendiente' THEN RETURN NEW; END IF;
  
  monto_total := calcular_monto_solicitud(NEW.id);
  
  FOR aprobador_requerido IN SELECT * FROM obtener_aprobadores_requeridos(monto_total) LOOP
    aprobador_asignado := asignar_aprobador(aprobador_requerido.rol);
    
    IF aprobador_asignado IS NOT NULL THEN
      INSERT INTO aprobaciones (solicitud_id, aprobador_id, nivel_aprobacion, orden_aprobacion, estado, fecha_limite, comentarios)
      VALUES (NEW.id, aprobador_asignado, aprobador_requerido.nivel, orden_actual, 'pendiente', NOW() + INTERVAL '3 days', aprobador_requerido.descripcion);
      
      INSERT INTO alertas (usuario_id, solicitud_id, tipo, mensaje, leida)
      VALUES (aprobador_asignado, NEW.id, 'nueva_aprobacion', 'Nueva solicitud: ' || NEW.descripcion, false);
      
      orden_actual := orden_actual + 1;
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Función actualizar estado
CREATE OR REPLACE FUNCTION actualizar_estado_solicitud()
RETURNS TRIGGER AS $$
DECLARE total_aprobaciones integer; aprobaciones_aprobadas integer; aprobaciones_rechazadas integer;
BEGIN
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE estado = 'aprobada'),
    COUNT(*) FILTER (WHERE estado = 'rechazada')
  INTO total_aprobaciones, aprobaciones_aprobadas, aprobaciones_rechazadas
  FROM aprobaciones WHERE solicitud_id = NEW.solicitud_id;
  
  IF aprobaciones_rechazadas > 0 THEN
    UPDATE solicitudes SET estado = 'rechazada', updated_at = NOW() WHERE id = NEW.solicitud_id;
  ELSIF aprobaciones_aprobadas = total_aprobaciones AND total_aprobaciones > 0 THEN
    UPDATE solicitudes SET estado = 'aprobada', updated_at = NOW() WHERE id = NEW.solicitud_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. Crear triggers
DROP TRIGGER IF EXISTS trigger_crear_aprobaciones ON solicitudes;
CREATE TRIGGER trigger_crear_aprobaciones 
  AFTER INSERT ON solicitudes
  FOR EACH ROW EXECUTE FUNCTION crear_aprobaciones_automaticas();

DROP TRIGGER IF EXISTS trigger_actualizar_solicitud ON aprobaciones;
CREATE TRIGGER trigger_actualizar_solicitud 
  AFTER UPDATE ON aprobaciones
  FOR EACH ROW WHEN (OLD.estado IS DISTINCT FROM NEW.estado)
  EXECUTE FUNCTION actualizar_estado_solicitud();

-- 9. Limpiar datos de prueba
DELETE FROM aprobaciones;
DELETE FROM solicitudes WHERE descripcion LIKE '%prueba%' OR descripcion LIKE '%Prueba%';
