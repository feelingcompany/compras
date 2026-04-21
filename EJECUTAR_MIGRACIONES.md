# 🚀 GUÍA EJECUTAR MIGRACIONES — Compras FC

## ⚠️ CRÍTICO: Sin estas migraciones, el sistema NO funciona

---

## PASO 1: Abrí el SQL Editor de Supabase

1. Abrí: **https://supabase.com/dashboard/project/lxdeumwfzlfzzcmsrpyh/sql**
2. Click en **"+ New Query"**

---

## PASO 2: MIGRACIÓN 1 — Solicitudes Multi-Ítem

**Copiá TODO este código y pegalo en el SQL Editor:**

```sql
-- =====================================================
-- MIGRACIÓN 005: Solicitudes Multi-Ítem con Categorías
-- =====================================================

-- 1. Tabla de ítems de solicitud
CREATE TABLE IF NOT EXISTS items_solicitud (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitud_id uuid REFERENCES solicitudes(id) ON DELETE CASCADE,
  categoria text NOT NULL,
  descripcion text NOT NULL,
  cantidad numeric NOT NULL,
  unidad text NOT NULL,
  especificaciones text,
  presupuesto_estimado numeric,
  created_at timestamptz DEFAULT now()
);

-- 2. Agregar campos nuevos a solicitudes
ALTER TABLE solicitudes
ADD COLUMN IF NOT EXISTS ciudad text,
ADD COLUMN IF NOT EXISTS prioridad text DEFAULT 'normal',
ADD COLUMN IF NOT EXISTS archivos_adjuntos jsonb DEFAULT '[]'::jsonb;

-- 3. Índices para performance
CREATE INDEX IF NOT EXISTS idx_items_solicitud_solicitud_id ON items_solicitud(solicitud_id);
CREATE INDEX IF NOT EXISTS idx_items_solicitud_categoria ON items_solicitud(categoria);

-- 4. Comentarios
COMMENT ON TABLE items_solicitud IS 'Ítems individuales de cada solicitud de compra';
COMMENT ON COLUMN items_solicitud.categoria IS 'Categoría del producto/servicio: Talento, Producción, Logística, etc.';
COMMENT ON COLUMN items_solicitud.descripcion IS 'Descripción específica del ítem';
COMMENT ON COLUMN items_solicitud.cantidad IS 'Cantidad solicitada';
COMMENT ON COLUMN items_solicitud.unidad IS 'Unidad de medida: Unidades, Horas, Días, Metros, etc.';
COMMENT ON COLUMN items_solicitud.especificaciones IS 'Detalles técnicos, marca, modelo, etc.';
COMMENT ON COLUMN items_solicitud.presupuesto_estimado IS 'Presupuesto aproximado si se conoce';

COMMENT ON COLUMN solicitudes.ciudad IS 'Ciudad donde se ejecutará el servicio/compra';
COMMENT ON COLUMN solicitudes.prioridad IS 'Prioridad de la solicitud: normal, urgente, critico';
COMMENT ON COLUMN solicitudes.archivos_adjuntos IS 'Array de archivos adjuntos {nombre, url, tipo}';

-- 5. Valores por defecto para registros existentes
UPDATE solicitudes
SET prioridad = 'normal'
WHERE prioridad IS NULL;

UPDATE solicitudes
SET archivos_adjuntos = '[]'::jsonb
WHERE archivos_adjuntos IS NULL;
```

**Click en RUN** (botón verde) ✅

**Esperá el mensaje:** "Success. No rows returned"

---

## PASO 3: MIGRACIÓN 2 — Sistema de Accesos

**Abrí OTRA New Query y pegá:**

```sql
-- =====================================================
-- MIGRACIÓN 006: Sistema de Accesos Multi-Usuario
-- =====================================================

-- Tabla de solicitudes de acceso
CREATE TABLE IF NOT EXISTS solicitudes_acceso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_completo text NOT NULL,
  email text NOT NULL,
  pin text NOT NULL,
  area text,
  estado text DEFAULT 'pendiente',
  motivo_rechazo text,
  created_at timestamptz DEFAULT now(),
  aprobado_por uuid REFERENCES usuarios(id),
  aprobado_en timestamptz
);

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
  tipo text NOT NULL,
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
  estado text DEFAULT 'pendiente',
  fecha_pago date,
  created_at timestamptz DEFAULT now()
);

-- Tabla de mensajes proveedor-compras
CREATE TABLE IF NOT EXISTS mensajes_proveedor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor_id uuid REFERENCES proveedores(id),
  usuario_id uuid REFERENCES usuarios(id),
  of_id uuid REFERENCES ofs(id),
  remitente text NOT NULL,
  mensaje text NOT NULL,
  leido boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_solicitudes_acceso_estado ON solicitudes_acceso(estado);
CREATE INDEX IF NOT EXISTS idx_solicitudes_acceso_email ON solicitudes_acceso(email);
CREATE INDEX IF NOT EXISTS idx_proveedores_portal_proveedor_id ON proveedores_portal(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_actualizaciones_proveedor_of_id ON actualizaciones_proveedor(of_id);
CREATE INDEX IF NOT EXISTS idx_facturas_proveedor_of_id ON facturas_proveedor(of_id);
CREATE INDEX IF NOT EXISTS idx_mensajes_proveedor_proveedor_id ON mensajes_proveedor(proveedor_id);

-- Campos adicionales a usuarios
ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS area text,
ADD COLUMN IF NOT EXISTS telefono text,
ADD COLUMN IF NOT EXISTS notificaciones_email boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS ultimo_login timestamptz;
```

**Click en RUN** ✅

**Esperá el mensaje:** "Success. No rows returned"

---

## PASO 4: Verificar que Funcionó

Ejecutá esta query para verificar:

```sql
SELECT 
  (SELECT COUNT(*) FROM items_solicitud) as items,
  (SELECT COUNT(*) FROM solicitudes_acceso) as accesos,
  (SELECT COUNT(*) FROM proveedores_portal) as proveedores;
```

**Deberías ver:** 
```
items: 0
accesos: 0  
proveedores: 0
```

---

## ✅ LISTO — El Sistema Ya Funciona

**Ahora podés probar:**

1. **Registro:** https://compras-fc.vercel.app/registro
2. **Login:** https://compras-fc.vercel.app/login
3. **Portal Proveedores:** https://compras-fc.vercel.app/proveedores/login
4. **Mi Trabajo:** https://compras-fc.vercel.app/mi-trabajo

---

## 🆘 Si Hay Errores:

**Error de tabla ya existe:**
- Normal, significa que ya se ejecutó antes
- Continuá con la siguiente migración

**Error de columna ya existe:**
- Normal, el `IF NOT EXISTS` lo maneja
- Continuá

**Error de foreign key:**
- Verificá que la tabla `solicitudes`, `proveedores`, `usuarios`, `ofs` existan
- Si no, hay un problema más grave con la base de datos

---

**Avisame cuando termines de ejecutar las 2 migraciones** ✅
