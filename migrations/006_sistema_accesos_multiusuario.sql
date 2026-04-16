-- =====================================================
-- MIGRACIÓN 006: Sistema de Accesos Multi-Usuario + Portal Proveedores
-- =====================================================
-- Fecha: 2026-04-16
-- Descripción: Implementa auto-registro de empleados y portal de proveedores

-- =============================
-- PARTE 1: AUTO-REGISTRO EMPLEADOS
-- =============================

-- Tabla de solicitudes de acceso
CREATE TABLE IF NOT EXISTS solicitudes_acceso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_completo text NOT NULL,
  email text NOT NULL,
  pin text NOT NULL, -- PIN de 4 dígitos
  area text, -- Producción, Logística, Creatividad, etc.
  estado text DEFAULT 'pendiente', -- pendiente, aprobado, rechazado
  motivo_rechazo text,
  created_at timestamptz DEFAULT now(),
  aprobado_por uuid REFERENCES usuarios(id),
  aprobado_en timestamptz
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_solicitudes_acceso_estado ON solicitudes_acceso(estado);
CREATE INDEX IF NOT EXISTS idx_solicitudes_acceso_email ON solicitudes_acceso(email);

-- =============================
-- PARTE 2: PORTAL DE PROVEEDORES
-- =============================

-- Tabla de accesos al portal de proveedores
CREATE TABLE IF NOT EXISTS proveedores_portal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor_id uuid REFERENCES proveedores(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  activo boolean DEFAULT true,
  ultima_conexion timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Tabla de actualizaciones de proveedores
CREATE TABLE IF NOT EXISTS actualizaciones_proveedor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  of_id uuid REFERENCES ofs(id) ON DELETE CASCADE,
  proveedor_id uuid REFERENCES proveedores(id),
  tipo text NOT NULL, -- 'estado', 'factura', 'evidencia', 'comentario'
  estado_anterior text,
  estado_nuevo text,
  contenido text,
  archivos jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Tabla de facturas de proveedores
CREATE TABLE IF NOT EXISTS facturas_proveedor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  of_id uuid REFERENCES ofs(id) ON DELETE CASCADE,
  proveedor_id uuid REFERENCES proveedores(id),
  numero_factura text NOT NULL,
  fecha_factura date NOT NULL,
  valor numeric NOT NULL,
  archivo_url text,
  estado text DEFAULT 'pendiente', -- pendiente, aprobada, rechazada, pagada
  fecha_pago date,
  created_at timestamptz DEFAULT now()
);

-- Tabla de mensajes proveedor-compras
CREATE TABLE IF NOT EXISTS mensajes_proveedor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor_id uuid REFERENCES proveedores(id),
  usuario_id uuid REFERENCES usuarios(id),
  of_id uuid REFERENCES ofs(id),
  remitente text NOT NULL, -- 'proveedor' o 'compras'
  mensaje text NOT NULL,
  leido boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Índices para portal de proveedores
CREATE INDEX IF NOT EXISTS idx_proveedores_portal_proveedor_id ON proveedores_portal(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_actualizaciones_proveedor_of_id ON actualizaciones_proveedor(of_id);
CREATE INDEX IF NOT EXISTS idx_actualizaciones_proveedor_proveedor_id ON actualizaciones_proveedor(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_facturas_proveedor_of_id ON facturas_proveedor(of_id);
CREATE INDEX IF NOT EXISTS idx_facturas_proveedor_estado ON facturas_proveedor(estado);
CREATE INDEX IF NOT EXISTS idx_mensajes_proveedor_proveedor_id ON mensajes_proveedor(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_mensajes_proveedor_of_id ON mensajes_proveedor(of_id);

-- =============================
-- PARTE 3: MEJORAS A USUARIOS
-- =============================

-- Agregar campos adicionales a usuarios
ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS area text,
ADD COLUMN IF NOT EXISTS telefono text,
ADD COLUMN IF NOT EXISTS notificaciones_email boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS ultimo_login timestamptz;

-- =============================
-- COMENTARIOS
-- =============================

COMMENT ON TABLE solicitudes_acceso IS 'Solicitudes de acceso de nuevos empleados al sistema';
COMMENT ON TABLE proveedores_portal IS 'Credenciales de acceso al portal para proveedores';
COMMENT ON TABLE actualizaciones_proveedor IS 'Actualizaciones de estado y comentarios de proveedores sobre OFs';
COMMENT ON TABLE facturas_proveedor IS 'Facturas subidas por proveedores';
COMMENT ON TABLE mensajes_proveedor IS 'Mensajería entre proveedores y equipo de compras';

COMMENT ON COLUMN solicitudes_acceso.pin IS 'PIN de 4 dígitos para acceso rápido';
COMMENT ON COLUMN solicitudes_acceso.area IS 'Área o departamento del empleado';
COMMENT ON COLUMN proveedores_portal.password_hash IS 'Hash bcrypt de la contraseña del proveedor';
COMMENT ON COLUMN actualizaciones_proveedor.tipo IS 'Tipo de actualización: estado, factura, evidencia, comentario';
COMMENT ON COLUMN facturas_proveedor.estado IS 'Estado de la factura: pendiente, aprobada, rechazada, pagada';
