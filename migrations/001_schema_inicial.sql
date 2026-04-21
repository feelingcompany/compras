-- =====================================================
-- MIGRACIÓN 001: Schema Inicial - Compras FC
-- =====================================================
-- Este script crea TODAS las tablas base del sistema

-- 1. TABLA USUARIOS
CREATE TABLE IF NOT EXISTS usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  email text UNIQUE NOT NULL,
  pin text NOT NULL,
  rol text NOT NULL CHECK (rol IN ('admin_compras', 'encargado', 'solicitante', 'gerencia')),
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 2. TABLA PROVEEDORES
CREATE TABLE IF NOT EXISTS proveedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nit text UNIQUE NOT NULL,
  nombre text NOT NULL,
  contacto text,
  telefono text,
  email text,
  direccion text,
  ciudad text,
  calificacion numeric DEFAULT 0,
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 3. TABLA SOLICITUDES
CREATE TABLE IF NOT EXISTS solicitudes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitante_id uuid REFERENCES usuarios(id),
  centro_costo text NOT NULL,
  ot_os text,
  descripcion text NOT NULL,
  fecha_requerida date NOT NULL,
  observaciones text,
  estado text DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobada', 'rechazada', 'cancelada')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4. TABLA OFS (Órdenes de Compra)
CREATE TABLE IF NOT EXISTS ofs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_of text UNIQUE NOT NULL,
  solicitud_id uuid REFERENCES solicitudes(id),
  proveedor_id uuid REFERENCES proveedores(id),
  descripcion text NOT NULL,
  valor_total numeric NOT NULL,
  fecha_emision date NOT NULL,
  fecha_entrega date,
  estado text DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobada', 'en_proceso', 'entregada', 'cancelada')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 5. TABLA COTIZACIONES
CREATE TABLE IF NOT EXISTS cotizaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitud_id uuid REFERENCES solicitudes(id),
  proveedor_id uuid REFERENCES proveedores(id),
  valor numeric NOT NULL,
  plazo_entrega integer,
  observaciones text,
  archivo_url text,
  estado text DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'seleccionada', 'rechazada')),
  created_at timestamptz DEFAULT now()
);

-- 6. TABLA APROBACIONES
CREATE TABLE IF NOT EXISTS aprobaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitud_id uuid REFERENCES solicitudes(id),
  aprobador_id uuid REFERENCES usuarios(id),
  nivel integer NOT NULL,
  estado text DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobada', 'rechazada')),
  comentarios text,
  fecha_respuesta timestamptz,
  created_at timestamptz DEFAULT now()
);

-- 7. TABLA CENTROS DE COSTO
CREATE TABLE IF NOT EXISTS centros_costo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text UNIQUE NOT NULL,
  nombre text NOT NULL,
  presupuesto_anual numeric,
  responsable_id uuid REFERENCES usuarios(id),
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 8. TABLA CATEGORÍAS DE COMPRA
CREATE TABLE IF NOT EXISTS categorias_compra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text UNIQUE NOT NULL,
  nombre text NOT NULL,
  descripcion text,
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 9. TABLA ÓRDENES DE TRABAJO
CREATE TABLE IF NOT EXISTS ordenes_trabajo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_ot text UNIQUE NOT NULL,
  centro_costo text NOT NULL,
  descripcion text NOT NULL,
  valor_estimado numeric,
  estado text DEFAULT 'activa',
  created_at timestamptz DEFAULT now()
);

-- 10. TABLA ALERTAS DEL SISTEMA
CREATE TABLE IF NOT EXISTS alertas_sistema (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  titulo text NOT NULL,
  mensaje text NOT NULL,
  usuario_id uuid REFERENCES usuarios(id),
  leida boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 11. TABLA AUDITORÍAS DE OF
CREATE TABLE IF NOT EXISTS auditorias_of (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  of_id uuid REFERENCES ofs(id) ON DELETE CASCADE,
  usuario_id uuid REFERENCES usuarios(id),
  accion text NOT NULL,
  detalles text,
  created_at timestamptz DEFAULT now()
);

-- 12. TABLA EVALUACIONES DE PROVEEDORES
CREATE TABLE IF NOT EXISTS evaluaciones_proveedor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor_id uuid REFERENCES proveedores(id),
  of_id uuid REFERENCES ofs(id),
  calidad numeric CHECK (calidad >= 1 AND calidad <= 5),
  cumplimiento numeric CHECK (cumplimiento >= 1 AND cumplimiento <= 5),
  servicio numeric CHECK (servicio >= 1 AND servicio <= 5),
  comentarios text,
  evaluador_id uuid REFERENCES usuarios(id),
  created_at timestamptz DEFAULT now()
);

-- 13. TABLA HISTORIAL DE PRECIOS
CREATE TABLE IF NOT EXISTS historial_precios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor_id uuid REFERENCES proveedores(id),
  producto text NOT NULL,
  precio numeric NOT NULL,
  fecha date NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 14. TABLA PAGOS
CREATE TABLE IF NOT EXISTS pagos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  of_id uuid REFERENCES ofs(id),
  valor numeric NOT NULL,
  fecha_pago date,
  estado text DEFAULT 'pendiente',
  comprobante_url text,
  created_at timestamptz DEFAULT now()
);

-- 15. TABLA RADICACIONES
CREATE TABLE IF NOT EXISTS radicaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  of_id uuid REFERENCES ofs(id),
  numero_radicado text NOT NULL,
  fecha_radicacion date NOT NULL,
  observaciones text,
  created_at timestamptz DEFAULT now()
);

-- 16. TABLA SCORE DE COMPRADORES
CREATE TABLE IF NOT EXISTS score_compradores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid REFERENCES usuarios(id),
  ahorros_generados numeric DEFAULT 0,
  ofs_procesadas integer DEFAULT 0,
  tiempo_promedio_aprobacion numeric DEFAULT 0,
  calificacion_promedio numeric DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

-- 17. TABLA CATÁLOGO DE SERVICIOS
CREATE TABLE IF NOT EXISTS catalogo_servicios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria text NOT NULL,
  subcategoria text,
  servicio text NOT NULL,
  descripcion text,
  unidad_medida text,
  precio_referencia numeric,
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 18. TABLA ÓRDENES DE FACTURACIÓN
CREATE TABLE IF NOT EXISTS ordenes_facturacion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  of_id uuid REFERENCES ofs(id),
  numero_factura text NOT NULL,
  valor numeric NOT NULL,
  fecha_factura date NOT NULL,
  fecha_vencimiento date,
  estado text DEFAULT 'pendiente',
  created_at timestamptz DEFAULT now()
);

-- 19. TABLA ALERTAS (Workflow)
CREATE TABLE IF NOT EXISTS alertas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid REFERENCES usuarios(id),
  solicitud_id uuid REFERENCES solicitudes(id),
  tipo text NOT NULL,
  mensaje text NOT NULL,
  leida boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- ÍNDICES PARA PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios(rol);
CREATE INDEX IF NOT EXISTS idx_proveedores_nit ON proveedores(nit);
CREATE INDEX IF NOT EXISTS idx_solicitudes_estado ON solicitudes(estado);
CREATE INDEX IF NOT EXISTS idx_solicitudes_solicitante ON solicitudes(solicitante_id);
CREATE INDEX IF NOT EXISTS idx_ofs_estado ON ofs(estado);
CREATE INDEX IF NOT EXISTS idx_ofs_proveedor ON ofs(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_aprobaciones_solicitud ON aprobaciones(solicitud_id);
CREATE INDEX IF NOT EXISTS idx_aprobaciones_estado ON aprobaciones(estado);

-- COMENTARIOS
COMMENT ON TABLE usuarios IS 'Usuarios del sistema (admins, encargados, solicitantes)';
COMMENT ON TABLE proveedores IS 'Catálogo de proveedores';
COMMENT ON TABLE solicitudes IS 'Solicitudes de compra';
COMMENT ON TABLE ofs IS 'Órdenes de compra';
COMMENT ON TABLE cotizaciones IS 'Cotizaciones de proveedores';
COMMENT ON TABLE aprobaciones IS 'Flujo de aprobaciones de solicitudes';
