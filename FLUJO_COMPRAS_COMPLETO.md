# 📋 FLUJO COMPLETO DE COMPRAS - COMPRAS FC

## 🎯 Proceso Implementado

El sistema ahora incluye el flujo completo de compras con **Órdenes de Servicio (OS)** como paso intermedio crítico.

---

## 📊 WORKFLOW COMPLETO

```
1. SOLICITUD
   ↓
2. COTIZACIONES (mínimo 2)
   ↓
3. ORDEN DE SERVICIO (OS) ← NUEVO
   ↓
4. VALIDACIÓN DE SERVICIO
   ↓
5. ORDEN DE FACTURACIÓN
```

---

## 1️⃣ SOLICITUD

### Crear Nueva Solicitud
**URL:** `/solicitudes/nueva`

**Campos requeridos:**
- Centro de Costo
- Ciudad
- Fecha Requerida
- Prioridad (Normal, Urgente, Crítico)
- Justificación

**Por cada ítem:**
- Categoría (Talento, Producción, Logística, etc.)
- Descripción detallada
- Cantidad
- Unidad de medida
- Especificaciones (opcional)
- Presupuesto estimado (opcional)
- **NUEVO:** Fecha inicio y fin del servicio
- **NUEVO:** Días requeridos

**Estados:**
- `pendiente` → Creada, esperando aprobación
- `aprobada` → Autorizada para cotizar
- `rechazada` → No aprobada
- `cancelada` → Cancelada por el solicitante

---

## 2️⃣ COTIZACIONES

### Proceso de Cotización
**Mínimo:** 2 cotizaciones por solicitud

**Información por cotización:**
- Proveedor
- Valor total
- Plazo de entrega
- Observaciones
- Archivo adjunto (opcional)

**Estados:**
- `pendiente` → Recibida, en evaluación
- `seleccionada` → Elegida para crear OS
- `rechazada` → Descartada

---

## 3️⃣ ORDEN DE SERVICIO (OS) - NUEVO ✅

### Crear Orden de Servicio
**Desde:** Cotización aprobada

**Campos automáticos:**
- Número OS: `OS-YYYY-NNNN` (generado automáticamente)
- Solicitud vinculada
- Cotización vinculada
- Proveedor
- Valor total

**Campos configurables:**
- Descripción del servicio
- Fecha de emisión
- Fecha inicio del servicio
- Fecha fin del servicio
- Días de servicio
- Observaciones

### Estados de la OS

```
pendiente → aprobada → en_ejecucion → ejecutada → validada
                                                      ↓
                                            Orden de Facturación
```

**Descripción de estados:**

1. **`pendiente`** 
   - OS creada, esperando aprobación
   - Acción: Admin debe aprobar

2. **`aprobada`**
   - OS autorizada, proveedor puede iniciar
   - Acción: Esperar inicio del servicio

3. **`en_ejecucion`**
   - Proveedor prestando el servicio
   - Acción: Monitorear ejecución

4. **`ejecutada`**
   - Servicio completado por el proveedor
   - Acción: Requiere validación

5. **`validada`**
   - Servicio conforme, listo para facturar
   - Acción: Crear Orden de Facturación

6. **`rechazada`** / **`cancelada`**
   - No conforme o cancelada

---

## 4️⃣ VALIDACIÓN DE SERVICIO

### Proceso de Validación
**Cuando:** OS en estado `ejecutada`

**Aspectos a validar:**
- ✅ Cantidades correctas
- ✅ Calidad satisfactoria
- ✅ Entrega completa

**Validación por ítem:**
- Cantidad aprobada vs Cantidad entregada
- Fecha de entrega
- Conformidad (Sí/No)
- Observaciones

**Resultados posibles:**
1. **Aprobado** → OS pasa a `validada`
2. **Rechazado** → OS vuelve a `en_ejecucion` o `rechazada`
3. **Requiere ajustes** → Solicitar correcciones al proveedor

---

## 5️⃣ ORDEN DE FACTURACIÓN

### Crear Orden de Facturación
**Desde:** OS validada

**Campos:**
- Número de factura
- Valor (debe coincidir con OS)
- Fecha de factura
- Fecha de vencimiento
- Estado de pago

**Validaciones automáticas:**
- Verifica que la OS esté validada
- Compara cantidades con lo aprobado
- Valida montos totales

---

## 📍 PÁGINAS DEL SISTEMA

### Para Solicitantes:
- `/solicitudes/nueva` - Crear solicitud
- `/mi-trabajo` - Ver mis solicitudes

### Para Admin Compras:
- `/solicitudes` - Ver todas las solicitudes
- `/cotizaciones` - Gestionar cotizaciones
- `/ordenes-servicio` - **NUEVO** Gestionar OS
- `/ordenes-servicio/validar` - **NUEVO** Validar servicios
- `/facturacion` - Gestionar facturación

### Para Gerencia:
- `/mi-trabajo` - Aprobaciones pendientes
- `/dashboard` - Vista general

---

## 🔐 ROLES Y PERMISOS

### `solicitante`
- Crear solicitudes
- Ver sus propias solicitudes
- Cancelar solicitudes pendientes

### `encargado`
- Aprobar solicitudes de su área
- Ver solicitudes de su área

### `admin_compras`
- Gestionar cotizaciones
- Crear y aprobar OS
- Validar servicios ejecutados
- Crear órdenes de facturación

### `gerencia`
- Aprobar solicitudes de alto valor
- Vista completa del sistema
- Reportes y auditorías

---

## 📊 TABLAS DE BASE DE DATOS

### Tablas Principales:
1. `solicitudes` - Solicitudes de compra
2. `items_solicitud` - Ítems de cada solicitud
3. `cotizaciones` - Cotizaciones de proveedores
4. `ordenes_servicio` - **NUEVO** Órdenes de servicio
5. `items_orden_servicio` - **NUEVO** Ítems de cada OS
6. `validaciones_servicio` - **NUEVO** Validaciones de servicios
7. `ordenes_facturacion` - Órdenes de facturación

### Relaciones:
```
solicitudes (1) ──→ (N) cotizaciones
cotizaciones (1) ──→ (1) ordenes_servicio
ordenes_servicio (1) ──→ (N) items_orden_servicio
ordenes_servicio (1) ──→ (N) validaciones_servicio
ordenes_servicio (1) ──→ (1) ordenes_facturacion
```

---

## ✅ ESTADO ACTUAL DEL SISTEMA

### Implementado:
- ✅ Solicitudes multi-ítem
- ✅ Cotizaciones con contador (mínimo 2)
- ✅ Órdenes de Servicio completas
- ✅ Validación de servicios
- ✅ Integración con facturación
- ✅ Dashboard de OS
- ✅ Diseño profesional sin emojis

### Por implementar (próximas fases):
- ⏳ Página de validación de servicios
- ⏳ Reportes y auditorías
- ⏳ Notificaciones por email
- ⏳ Firma digital de documentos
- ⏳ Portal de proveedores completo

---

## 🚀 PRÓXIMOS PASOS

1. **Probar el flujo completo** con una solicitud de prueba
2. **Capacitar al equipo** en el nuevo proceso
3. **Migrar solicitudes existentes** al nuevo flujo
4. **Implementar reportes** de seguimiento
5. **Configurar notificaciones** automáticas

---

**Documentación actualizada:** 21 de abril de 2026
**Versión del sistema:** 2.0 con Órdenes de Servicio
