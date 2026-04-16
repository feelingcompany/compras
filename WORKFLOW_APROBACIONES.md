# 📋 WORKFLOW DE APROBACIONES MULTINIVEL

## 🎯 Cómo Funciona

### Reglas por Monto

| Monto OF | Nivel | Aprobador | Auto/Manual |
|----------|-------|-----------|-------------|
| $0 - $3M | Nivel 1 | Encargado | ✅ Automático |
| $3M - $10M | Nivel 2 | Admin Compras | 🔍 Manual |
| $10M - $50M | Nivel 3 | Gerencia | 🔍 Manual |
| >$50M | Nivel 4 | Junta/Gerencia | 🔍 Manual |

### Flujo Automático

```
1. Usuario crea OF de $8M
   ↓
2. Sistema detecta: Monto entre $3M-$10M → Nivel 2 requerido
   ↓
3. Sistema crea automáticamente:
   - Aprobación Nivel 1 (Encargado) → Estado: pendiente
   - Aprobación Nivel 2 (Admin Compras) → Estado: pendiente
   ↓
4. OF queda en estado: EN_REVISION
   ↓
5. Encargado aprueba → Nivel 1: aprobado
   ↓
6. Admin Compras aprueba → Nivel 2: aprobado
   ↓
7. Sistema actualiza OF → Estado: OK
```

### Estados de Aprobación

- **pendiente**: Esperando aprobación
- **aprobado**: Aprobado por el nivel
- **rechazado**: Rechazado por el nivel

### Estados de OF según Aprobaciones

- **EN_REVISION**: Hay aprobaciones pendientes
- **OK**: Todas las aprobaciones están aprobadas
- **DESESTIMADA**: Al menos una aprobación fue rechazada

---

## 🔧 Arquitectura Técnica

### Tablas

#### `aprobaciones`
```sql
id              UUID
of_id           UUID → ordenes_facturacion
nivel           INTEGER (1, 2, 3, 4)
aprobador_id    UUID → usuarios
estado          VARCHAR (pendiente, aprobado, rechazado)
comentarios     TEXT
fecha_aprobacion TIMESTAMPTZ
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

#### `reglas_aprobacion`
```sql
id              UUID
nombre          VARCHAR
monto_min       DECIMAL
monto_max       DECIMAL (NULL = sin límite)
nivel_requerido INTEGER
rol_aprobador   VARCHAR
activa          BOOLEAN
created_at      TIMESTAMPTZ
```

### Funciones

#### `get_nivel_aprobacion_requerido(monto)`
- Input: Monto de la OF
- Output: Nivel de aprobación requerido (1-4)
- Consulta tabla `reglas_aprobacion`

#### `crear_aprobaciones_of()`
- Trigger: AFTER INSERT en `ordenes_facturacion`
- Acción: Crea aprobaciones automáticamente según monto
- Asigna aprobadores aleatoriamente del rol correspondiente

#### `actualizar_estado_of()`
- Trigger: AFTER INSERT/UPDATE en `aprobaciones`
- Acción: Actualiza `estado_verificacion` de la OF
- Lógica:
  - Si hay rechazos → DESESTIMADA
  - Si todas aprobadas → OK
  - Si hay pendientes → EN_REVISION

---

## 📊 Ejemplos de Uso

### Ejemplo 1: OF de $2M (Nivel 1)
```
Monto: $2,000,000
Nivel requerido: 1 (Encargado)

Aprobaciones creadas:
- Nivel 1: Encargado → pendiente

Estado OF: EN_REVISION

Cuando Encargado aprueba:
- Nivel 1: aprobado
- Estado OF: OK ✅
```

### Ejemplo 2: OF de $8M (Nivel 2)
```
Monto: $8,000,000
Nivel requerido: 2 (Admin Compras)

Aprobaciones creadas:
- Nivel 1: Encargado → pendiente
- Nivel 2: Admin Compras → pendiente

Estado OF: EN_REVISION

Flujo:
1. Encargado aprueba → Nivel 1: aprobado
2. OF sigue EN_REVISION (falta Nivel 2)
3. Admin aprueba → Nivel 2: aprobado
4. Estado OF: OK ✅
```

### Ejemplo 3: OF de $35M (Nivel 3)
```
Monto: $35,000,000
Nivel requerido: 3 (Gerencia)

Aprobaciones creadas:
- Nivel 1: Encargado → pendiente
- Nivel 2: Admin Compras → pendiente
- Nivel 3: Gerencia → pendiente

Estado OF: EN_REVISION

Flujo:
1. Encargado aprueba → Nivel 1: aprobado
2. Admin aprueba → Nivel 2: aprobado
3. OF sigue EN_REVISION (falta Nivel 3)
4. Gerencia aprueba → Nivel 3: aprobado
5. Estado OF: OK ✅
```

### Ejemplo 4: OF Rechazada
```
Monto: $8,000,000
Nivel requerido: 2

Flujo:
1. Encargado aprueba → Nivel 1: aprobado
2. Admin RECHAZA → Nivel 2: rechazado
3. Estado OF: DESESTIMADA ❌

Comentarios del rechazo:
"Proveedor no cumple requisitos de calidad"
```

---

## 🚀 Próximos Pasos de Desarrollo

### Fase 1: Base de Datos (AHORA)
- ✅ Ejecutar migración `004_workflow_aprobaciones.sql`
- ✅ Verificar tablas y funciones creadas

### Fase 2: Módulo de Aprobaciones (2-3 horas)
- [ ] Crear `/aprobaciones/page.tsx`
- [ ] Vista de OFs pendientes de aprobación
- [ ] Filtros por nivel
- [ ] Botones Aprobar/Rechazar
- [ ] Modal de comentarios

### Fase 3: Integración en Nueva OF (1 hora)
- [ ] Mostrar nivel de aprobación requerido
- [ ] Info visual según monto
- [ ] Preview de aprobadores

### Fase 4: Integración en Órdenes (1 hora)
- [ ] Columna "Estado Aprobación"
- [ ] Badge visual según estado
- [ ] Link a detalle de aprobaciones

### Fase 5: Notificaciones (2 horas)
- [ ] Email a aprobador cuando OF pendiente
- [ ] Email a solicitante cuando aprobada/rechazada
- [ ] Notificaciones in-app

---

## ✅ Verificación Post-Migración

Ejecutar en Supabase SQL Editor:

```sql
-- 1. Verificar tablas
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' AND tablename IN ('aprobaciones', 'reglas_aprobacion');

-- 2. Verificar reglas
SELECT nombre, monto_min, monto_max, nivel_requerido, rol_aprobador 
FROM reglas_aprobacion 
ORDER BY nivel_requerido;

-- 3. Probar función de nivel
SELECT get_nivel_aprobacion_requerido(2500000);  -- Debería retornar 1
SELECT get_nivel_aprobacion_requerido(5000000);  -- Debería retornar 2
SELECT get_nivel_aprobacion_requerido(25000000); -- Debería retornar 3
SELECT get_nivel_aprobacion_requerido(75000000); -- Debería retornar 4

-- 4. Verificar triggers
SELECT tgname, tgrelid::regclass FROM pg_trigger 
WHERE tgname IN ('trigger_crear_aprobaciones', 'trigger_actualizar_estado_of');
```

**Resultados esperados:**
- 2 tablas creadas
- 4 reglas configuradas
- Función retorna niveles correctos
- 2 triggers activos

---

**Preparado:** 2026-04-16  
**Versión:** 1.0  
**Status:** Base de Datos Lista → Pending UI
