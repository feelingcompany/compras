# 🚀 GUÍA: Ejecutar Migración del Catálogo

## ⏱️ Tiempo estimado: 2 minutos

---

## 📋 Paso 1: Abrir SQL Editor en Supabase

1. Abre este link en tu navegador:
   ```
   https://supabase.com/dashboard/project/lxdeumwfzlfzzcmsrpyh/sql
   ```

2. Deberías ver el SQL Editor de Supabase

---

## 📝 Paso 2: Copiar el Script SQL

Copia TODO el contenido del archivo:
```
migrations/002_catalogo_servicios.sql
```

O copia directamente desde aquí:

```sql
-- Tabla de catálogo de servicios
CREATE TABLE IF NOT EXISTS catalogo_servicios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(50) UNIQUE NOT NULL,
  nombre VARCHAR(200) NOT NULL,
  descripcion TEXT,
  categoria VARCHAR(100),
  unidad_medida VARCHAR(50),
  precio_referencia DECIMAL(15,2),
  precio_min DECIMAL(15,2),
  precio_max DECIMAL(15,2),
  proveedores_habituales TEXT[],
  ultima_compra TIMESTAMPTZ,
  total_compras INTEGER DEFAULT 0,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_catalogo_nombre ON catalogo_servicios(nombre);
CREATE INDEX IF NOT EXISTS idx_catalogo_categoria ON catalogo_servicios(categoria);
CREATE INDEX IF NOT EXISTS idx_catalogo_activo ON catalogo_servicios(activo);

CREATE TABLE IF NOT EXISTS historial_precios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  servicio_id UUID REFERENCES catalogo_servicios(id) ON DELETE CASCADE,
  of_id UUID REFERENCES ordenes_facturacion(id),
  proveedor_id UUID REFERENCES proveedores(id),
  precio DECIMAL(15,2) NOT NULL,
  cantidad DECIMAL(10,2),
  fecha TIMESTAMPTZ DEFAULT NOW(),
  observaciones TEXT
);

CREATE INDEX IF NOT EXISTS idx_historial_servicio ON historial_precios(servicio_id);
CREATE INDEX IF NOT EXISTS idx_historial_fecha ON historial_precios(fecha DESC);

CREATE OR REPLACE FUNCTION actualizar_estadisticas_catalogo()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE catalogo_servicios
  SET 
    precio_referencia = (
      SELECT AVG(precio) 
      FROM historial_precios 
      WHERE servicio_id = NEW.servicio_id 
        AND fecha >= NOW() - INTERVAL '6 months'
    ),
    precio_min = (
      SELECT MIN(precio) 
      FROM historial_precios 
      WHERE servicio_id = NEW.servicio_id
    ),
    precio_max = (
      SELECT MAX(precio) 
      FROM historial_precios 
      WHERE servicio_id = NEW.servicio_id
    ),
    total_compras = (
      SELECT COUNT(*) 
      FROM historial_precios 
      WHERE servicio_id = NEW.servicio_id
    ),
    ultima_compra = (
      SELECT MAX(fecha) 
      FROM historial_precios 
      WHERE servicio_id = NEW.servicio_id
    ),
    updated_at = NOW()
  WHERE id = NEW.servicio_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_actualizar_estadisticas ON historial_precios;
CREATE TRIGGER trigger_actualizar_estadisticas
  AFTER INSERT ON historial_precios
  FOR EACH ROW
  EXECUTE FUNCTION actualizar_estadisticas_catalogo();

INSERT INTO catalogo_servicios (codigo, nombre, descripcion, categoria, unidad_medida, precio_referencia, activo)
VALUES
  ('MAT-ELEC-001', 'Material eléctrico estándar', 'Cables, tomas, breakers', 'Materiales', 'unidad', 500000, true),
  ('SERV-CAT-001', 'Servicio de catering', 'Catering para eventos', 'Servicios', 'persona', 45000, true),
  ('SERV-MTO-001', 'Mantenimiento equipos', 'Mantenimiento preventivo', 'Servicios', 'hora', 80000, true),
  ('TECH-LAP-001', 'Laptop corporativa', 'Equipos de cómputo', 'Tecnología', 'unidad', 4000000, true),
  ('MAT-CONST-001', 'Material de construcción', 'Cemento, arena, ladrillos', 'Materiales', 'm3', 250000, true),
  ('SERV-LIMP-001', 'Servicio de aseo', 'Limpieza y aseo de oficinas', 'Servicios', 'mes', 1200000, true),
  ('TECH-SW-001', 'Licencias de software', 'Suscripciones y licencias', 'Tecnología', 'licencia', 350000, true),
  ('MAT-OFIC-001', 'Papelería y útiles', 'Material de oficina', 'Materiales', 'kit', 80000, true),
  ('SERV-SEG-001', 'Servicio de vigilancia', 'Seguridad física', 'Servicios', 'mes', 2500000, true),
  ('TECH-SERV-001', 'Hosting y dominios', 'Infraestructura cloud', 'Tecnología', 'mes', 450000, true)
ON CONFLICT (codigo) DO NOTHING;

COMMENT ON TABLE catalogo_servicios IS 'Catálogo de servicios y productos con precios de referencia';
COMMENT ON TABLE historial_precios IS 'Historial de precios pagados por servicio/producto';
```

---

## ▶️ Paso 3: Ejecutar el Script

1. Pega el script completo en el editor SQL
2. Click en el botón **"RUN"** (abajo a la derecha)
3. Deberías ver: ✅ **"Success. No rows returned"**

---

## ✅ Paso 4: Verificar que Funcionó

### Opción A: Verificar en Database

1. Ve a **Database** → **Tables** en el sidebar
2. Deberías ver 2 nuevas tablas:
   - ✅ `catalogo_servicios`
   - ✅ `historial_precios`

### Opción B: Verificar con SQL

En el mismo SQL Editor, ejecuta:
```sql
SELECT COUNT(*) as servicios FROM catalogo_servicios;
```

Deberías ver: **10 servicios** (los que hicimos seed)

---

## 🎯 Paso 5: Probar el Módulo

1. Abre https://compras-fc.vercel.app/admin/catalogo
2. Deberías ver los 10 servicios cargados:
   - MAT-ELEC-001 - Material eléctrico
   - SERV-CAT-001 - Catering
   - TECH-LAP-001 - Laptops
   - etc.

---

## 🚨 Si algo sale mal

**Error: "relation already exists"**
→ Ya está creada, todo bien. Continúa.

**Error: "permission denied"**
→ Verifica que estés logueado en Supabase con la cuenta correcta

**Error: otro**
→ Copia el mensaje y avísame

---

## ✨ Después de ejecutar

Ya puedes:
1. ✅ Usar `/admin/catalogo` para gestionar servicios
2. ✅ Agregar nuevos servicios con precios de referencia
3. ✅ El sistema rastreará automáticamente el historial de precios
4. 🔜 Próximo paso: Inicializar datos (alertas, scores, cotizaciones)

---

**¿Listo?** Ejecuta la migración y avísame cuando esté.
