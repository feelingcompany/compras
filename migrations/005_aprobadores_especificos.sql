-- ============================================
-- MIGRACIÓN: APROBADORES ESPECÍFICOS POR NIVEL
-- ============================================
-- Ejecutar en Supabase SQL Editor

-- 1. Crear tabla de aprobadores por nivel
CREATE TABLE IF NOT EXISTS aprobadores_nivel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nivel INTEGER NOT NULL,
  usuario_id UUID REFERENCES usuarios(id),
  orden INTEGER DEFAULT 1, -- Para rotar entre aprobadores del mismo nivel
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(nivel, usuario_id)
);

CREATE INDEX IF NOT EXISTS idx_aprobadores_nivel ON aprobadores_nivel(nivel, activo);

-- 2. Configurar aprobadores según jerarquía

-- NIVEL 1 ($0-$3M): Milton y Sebastian
INSERT INTO aprobadores_nivel (nivel, usuario_id, orden, activo)
SELECT 1, id, ROW_NUMBER() OVER (), true
FROM usuarios
WHERE email IN ('milton.arango@feelingone.co', 'sebastian.lopez@feelingone.co')
ON CONFLICT (nivel, usuario_id) DO NOTHING;

-- NIVEL 2 ($3M-$10M): Santiago Cardenas y Milena
INSERT INTO aprobadores_nivel (nivel, usuario_id, orden, activo)
SELECT 2, id, ROW_NUMBER() OVER (), true
FROM usuarios
WHERE email IN ('juridico@feelingcompany.com', 'milena.giraldo@feelingone.co')
ON CONFLICT (nivel, usuario_id) DO NOTHING;

-- NIVEL 3 ($10M-$50M): Santiago Sosa, Alejandro, Ana Patricia
INSERT INTO aprobadores_nivel (nivel, usuario_id, orden, activo)
SELECT 3, id, ROW_NUMBER() OVER (), true
FROM usuarios
WHERE email IN (
  'santisosa@feelingcompany.com',
  'alejandro.pelaez@feelingcompany.com',
  'ana.echavarria@feelingcompany.com'
)
ON CONFLICT (nivel, usuario_id) DO NOTHING;

-- NIVEL 4 (>$50M): Santiago Sosa, Alejandro, Ana Patricia
INSERT INTO aprobadores_nivel (nivel, usuario_id, orden, activo)
SELECT 4, id, ROW_NUMBER() OVER (), true
FROM usuarios
WHERE email IN (
  'santisosa@feelingcompany.com',
  'alejandro.pelaez@feelingcompany.com',
  'ana.echavarria@feelingcompany.com'
)
ON CONFLICT (nivel, usuario_id) DO NOTHING;

-- 3. Actualizar función para usar aprobadores específicos
CREATE OR REPLACE FUNCTION crear_aprobaciones_of()
RETURNS TRIGGER AS $$
DECLARE
  nivel_req INTEGER;
  aprobador_record RECORD;
  contador INTEGER;
BEGIN
  -- Determinar nivel requerido según monto
  nivel_req := get_nivel_aprobacion_requerido(NEW.valor_total);
  
  -- Crear aprobaciones necesarias según el nivel
  FOR i IN 1..nivel_req LOOP
    contador := 0;
    
    -- Buscar aprobadores para este nivel, rotando por orden
    FOR aprobador_record IN
      SELECT usuario_id
      FROM aprobadores_nivel
      WHERE nivel = i AND activo = true
      ORDER BY orden
    LOOP
      contador := contador + 1;
      
      -- Crear aprobación para cada aprobador del nivel
      INSERT INTO aprobaciones (of_id, nivel, aprobador_id, estado)
      VALUES (NEW.id, i, aprobador_record.usuario_id, 'pendiente');
    END LOOP;
    
    -- Si no hay aprobadores configurados para este nivel, crear sin asignar
    IF contador = 0 THEN
      INSERT INTO aprobaciones (of_id, nivel, aprobador_id, estado)
      VALUES (NEW.id, i, NULL, 'pendiente');
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Actualizar función de estado para considerar múltiples aprobadores por nivel
CREATE OR REPLACE FUNCTION actualizar_estado_of()
RETURNS TRIGGER AS $$
DECLARE
  total_niveles INTEGER;
  niveles_con_aprobacion INTEGER;
  tiene_rechazos BOOLEAN;
BEGIN
  -- Contar niveles distintos
  SELECT COUNT(DISTINCT nivel) INTO total_niveles
  FROM aprobaciones
  WHERE of_id = NEW.of_id;
  
  -- Contar niveles donde AL MENOS UNA aprobación está aprobada
  SELECT COUNT(DISTINCT nivel) INTO niveles_con_aprobacion
  FROM aprobaciones
  WHERE of_id = NEW.of_id AND estado = 'aprobado';
  
  -- Verificar si hay rechazos
  SELECT COUNT(*) > 0 INTO tiene_rechazos
  FROM aprobaciones
  WHERE of_id = NEW.of_id AND estado = 'rechazado';
  
  -- Si hay rechazos, marcar OF como DESESTIMADA
  IF tiene_rechazos THEN
    UPDATE ordenes_facturacion
    SET estado_verificacion = 'DESESTIMADA'
    WHERE id = NEW.of_id;
  
  -- Si todos los niveles tienen al menos una aprobación, marcar OF como OK
  ELSIF niveles_con_aprobacion = total_niveles THEN
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

-- 5. Recrear trigger con nueva función
DROP TRIGGER IF EXISTS trigger_crear_aprobaciones ON ordenes_facturacion;
CREATE TRIGGER trigger_crear_aprobaciones
  AFTER INSERT ON ordenes_facturacion
  FOR EACH ROW
  EXECUTE FUNCTION crear_aprobaciones_of();

DROP TRIGGER IF EXISTS trigger_actualizar_estado_of ON aprobaciones;
CREATE TRIGGER trigger_actualizar_estado_of
  AFTER INSERT OR UPDATE ON aprobaciones
  FOR EACH ROW
  EXECUTE FUNCTION actualizar_estado_of();

-- ============================================
-- VERIFICACIÓN
-- ============================================

SELECT 'Aprobadores configurados' as info, nivel, COUNT(*) as total_aprobadores
FROM aprobadores_nivel
WHERE activo = true
GROUP BY nivel
ORDER BY nivel;

SELECT 'Detalle por nivel' as info, an.nivel, u.nombre, u.email
FROM aprobadores_nivel an
JOIN usuarios u ON an.usuario_id = u.id
WHERE an.activo = true
ORDER BY an.nivel, an.orden;
