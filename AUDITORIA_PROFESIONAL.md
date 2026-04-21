# AUDITORÍA PROFESIONAL - COMPRAS FC

**Auditor:** Experto Producto / UX / Procesos de Compra  
**Sistema:** Compras FC - Feeling Company  
**Fecha:** Abril 2026

---

## RESUMEN EJECUTIVO

El sistema tiene **problemas serios de arquitectura de producto** que impiden su uso efectivo. Hay **dos sistemas en paralelo** que se contradicen, el menú tiene **21 opciones** cuando debería tener 5-6, y el flujo de compras no es **ni claro ni natural**.

**Veredicto:** No es utilizable en su estado actual. Necesita refactorización de producto, no más features.

---

## HALLAZGOS CRÍTICOS (por severidad)

### 🔴 CRÍTICO 1 — Sistema duplicado en paralelo

Existen **DOS implementaciones del mismo flujo**:

| Sistema Viejo (OF) | Sistema Nuevo (Solicitudes) |
|---|---|
| Tabla: `ordenes_facturacion` | Tabla: `solicitudes` + `items_solicitud` |
| Un ítem por orden | Múltiples ítems |
| Estados MAYÚSCULAS | Estados minúsculas |
| Página: `/nueva-of` | Página: `/solicitudes/nueva` |
| Página: `/ordenes` | Página: `/solicitudes` |

**Consecuencia:** El usuario nunca sabe dónde ir. El dashboard lee una tabla, mi-trabajo otra, aprobaciones otra.

### 🔴 CRÍTICO 2 — Menú con 21 items

**Menú actual:**
```
Mi Trabajo, Pipeline, Dashboard, Alertas, Score,
Solicitudes, Nueva OF, Cotizaciones, Aprobaciones,
Auditoría, Radicación, Pagos, Órdenes (OF),
Proveedores, Eval. Proveedores, Contraloría,
Admin, Solicitudes Pendientes
```

Para 10 usuarios. Ningún ERP serio tiene más de 6-7 secciones top-level.

### 🔴 CRÍTICO 3 — Emojis en menú (contraviene instrucciones explícitas)

Los requisitos de Feeling son claros: **sin emojis**. Aparecen: 🎯 🔄 📊 ⚡ ⭐ ⚙️ 👥

### 🔴 CRÍTICO 4 — Vocabulario inconsistente

- "OF" (Orden de Facturación) vs "Solicitud" vs "Orden" — ¿son lo mismo?
- "Auditoría" vs "Contraloría" — ¿en qué se diferencian?
- "Radicación" — ¿qué significa para el usuario?
- "Cotizaciones" en menú pero el flujo no las pide obligatoriamente

### 🟡 IMPORTANTE 5 — Flujo de aprobación roto

- El trigger de DB no dispara consistentemente
- El admin_compras no ve las aprobaciones aunque existan
- No existe un usuario encargado por defecto
- Sin feedback cuando una aprobación se crea

### 🟡 IMPORTANTE 6 — No hay una pantalla "Inicio"

El usuario llega y no sabe qué tiene que hacer. "Mi Trabajo" intenta serlo, pero mezcla datos de las dos tablas y confunde.

---

## PROCESO DE COMPRA - ESTÁNDAR INDUSTRIAL

Un proceso de compras profesional tiene **exactamente estas etapas**:

```
1. SOLICITAR    — Solicitante dice "necesito X"
2. APROBAR      — Jefe autoriza según monto/política
3. COTIZAR      — Compras busca proveedor
4. ORDENAR      — Se emite OC al proveedor
5. RECIBIR      — Llega el producto/servicio
6. PAGAR        — Financiero procesa pago
```

**Cada etapa es UN estado de UNA solicitud** — no son entidades separadas.

El sistema actual las tiene como páginas separadas, lo cual obliga al usuario a saltar entre pantallas sin entender dónde está cada solicitud.

---

## PROPUESTA DE REFACTOR

### Navegación simplificada (6 items)

```
1. Inicio          — Qué tengo que hacer hoy
2. Solicitudes     — Lista + crear + detalle (con Pipeline como vista)
3. Proveedores     — Gestión + evaluación
4. Reportes        — Dashboard + auditoría (solo admin/gerencia)
5. Configuración   — Usuarios, catálogo, reglas (solo admin)
6. Cerrar sesión   — (ya existe abajo)
```

### Unificación de conceptos

| Antes | Ahora |
|---|---|
| OF, Orden, Solicitud | **Solicitud** (único término) |
| Auditoría, Contraloría | **Auditoría** (único) |
| Radicación, Pagos | Incluido en el detalle de cada solicitud (timeline) |
| Pipeline | Vista dentro de Solicitudes (tab) |
| Cotizaciones, Aprobaciones | Etapas dentro del detalle de cada solicitud |

### Una solicitud tiene UN ciclo de vida visible:

```
Borrador → Enviada → Aprobada → Cotizando → Orden emitida 
  → Recibida → Pagada
```

El usuario ve una solicitud y entiende en qué etapa está. Si tiene que actuar, lo ve claramente.

### Pantalla de Inicio (reemplaza Mi Trabajo)

**Bloque 1:** "Necesitan tu acción" (aprobaciones pendientes, solicitudes a cotizar)  
**Bloque 2:** "Tus solicitudes" (las que creó el usuario)  
**Bloque 3:** "Últimos movimientos" (actividad reciente)

Sin stats de ahorros ficticios. Sin emojis. Información accionable.

---

## PLAN DE ACCIÓN PRIORIZADO

### Fase 1 — Limpieza (HOY)
1. ✅ Sistema único: quitar rutas del sistema viejo del menú
2. ✅ Menú nuevo de 5-6 items
3. ✅ Eliminar emojis
4. ✅ Unificar vocabulario

### Fase 2 — Flujo (esta semana)
5. ✅ Asegurar que aprobaciones se crean al enviar solicitud
6. ✅ Pantalla de Inicio útil
7. ✅ Detalle de solicitud con timeline de etapas

### Fase 3 — Profundidad (después)
8. Cotizaciones vinculadas a la solicitud
9. Recepción de producto/servicio
10. Integración con pagos

---

## MÉTRICAS DE ÉXITO

- **Tiempo de onboarding de un usuario nuevo:** <5 minutos (hoy >30 min)
- **Clicks para crear solicitud:** ≤ 3 desde inicio (hoy 5+)
- **% de usuarios que pueden aprobar sin ayuda:** 100% (hoy 0%)
- **Páginas en el menú:** 5-6 (hoy 21)
