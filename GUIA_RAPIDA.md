# 🚀 GUÍA RÁPIDA — Sistema de Compras FC

## ⚡ Flujo en 8 Pasos

```
1. SOLICITUD       → Empleado pide algo
2. APROBACIÓN      → Admin revisa y aprueba
3. COTIZACIÓN      → Admin pide precios a proveedores
4. CREAR OF        → Admin crea OF con mejor opción
                     🚨 Sistema detecta sobrecostos automáticamente
5. APROBACIONES    → Según monto, pasa por niveles
                     - $0-$3M: Automático
                     - $3M-$10M: Admin Compras
                     - $10M-$50M: Gerencia
                     - >$50M: Junta
6. AUDITORÍA       → Revisión final
7. RADICACIÓN      → Registrar factura cuando llega
8. PAGO            → Tesorería paga
```

---

## 📍 ¿Dónde Estoy en el Proceso?

| Estado OF | Qué Significa | Siguiente Paso |
|-----------|---------------|----------------|
| **PENDIENTE** | Solicitud creada, esperando aprobación | Admin debe revisar |
| **EN_REVISION** | OF creada, esperando aprobaciones | Aprobadores deben aprobar |
| **OK** | Todas las aprobaciones completadas | Ejecutar compra |
| **RADICADA** | Factura recibida y registrada | Programar pago |
| **PAGADA** | Factura pagada | ✅ Proceso completo |
| **DESESTIMADA** | Rechazada en algún paso | ❌ Proceso cancelado |

---

## 🎯 Módulos por Rol

### 👔 GERENCIA (Santiago Sosa)
```
✅ Dashboard      → Vista ejecutiva
✅ Alertas        → Problemas detectados
✅ Score          → Ranking del equipo
✅ Aprobaciones   → Aprobar OFs >$10M
✅ Todos los demás módulos
✅ Admin          → Configuración
```

### 💼 ADMIN COMPRAS (Milena, Milton, Sebastian, Santiago C.)
```
✅ Dashboard      → Vista de operaciones
✅ Alertas        → Atender problemas
✅ Score          → Ver desempeño
✅ Solicitudes    → Aprobar/rechazar
✅ Nueva OF       → Crear órdenes
✅ Cotizaciones   → Comparar proveedores
✅ Aprobaciones   → Aprobar OFs $3M-$10M
✅ Auditoría      → Revisar antes de ejecutar
✅ Órdenes        → Ver todas las OFs
✅ Proveedores    → Gestionar base de datos
```

### 📝 ENCARGADO
```
✅ Dashboard      → Vista personal
✅ Alertas        → Sus alertas
✅ Solicitudes    → Crear solicitudes
✅ Nueva OF       → Crear OFs asignadas
✅ Cotizaciones   → Registrar cotizaciones
✅ Aprobaciones   → Aprobar OFs <$3M
✅ Órdenes        → Ver solo sus OFs
✅ Proveedores    → Consultar
```

### 👤 SOLICITANTE
```
✅ Dashboard      → Vista básica
✅ Solicitudes    → Crear solicitudes
✅ Órdenes        → Ver OFs que solicitó
```

---

## 🚨 ALERTAS — Qué Significan

| Alerta | Qué Es | Acción |
|--------|--------|--------|
| **Sin cotizaciones** | OF >$5M sin cotizaciones | Cotizar con 2-3 proveedores |
| **Proveedor nuevo** | Proveedor nuevo + OF alta | Verificar documentación |
| **Dependencia** | >30% gasto en 1 proveedor | Diversificar proveedores |
| **Autoaprobación** | Mismo usuario solicitó y aprueba | Revisar separación de funciones |
| **Fraccionamiento** | Varias OFs pequeñas suman grande | Verificar si deberían ser una |
| **Precio inflado** | Precio >20% sobre catálogo | Renegociar o justificar |
| **Urgente recurrente** | Siempre es "urgente" | Mejorar planificación |

---

## 🎨 COLORES Y ESTADOS

### Aprobaciones
```
🟡 PENDIENTE     → Esperando aprobación
🟢 APROBADO      → Nivel aprobado
🔴 RECHAZADO     → Nivel rechazado
```

### Alertas
```
🔴 CRÍTICO       → Atención inmediata
🟠 ALTO          → Atender pronto
🟡 MEDIO         → Revisar esta semana
🔵 BAJO          → Para revisión
```

---

## 💰 DETECCIÓN DE SOBRECOSTOS

**¿Cómo funciona?**

1. Sistema tiene **catálogo** con precios de referencia
2. Cuando creas OF, busca el servicio en catálogo
3. Compara tu precio vs precio de referencia
4. Te alerta si está muy alto

**Ejemplos:**

```
Servicio: Laptop HP ProBook 450
Precio catálogo: $4,000,000
Tu precio: $4,100,000
Diferencia: +2.5%
🟢 OK: Dentro del rango

---

Servicio: Servicio de catering
Precio catálogo: $50,000/persona
Tu precio: $70,000/persona  
Diferencia: +40%
🔴 ALERTA: Verificar precio, muy alto
```

---

## ⚡ ATAJOS DE TECLADO

```
Ctrl + K         → Búsqueda global
Ctrl + N         → Nueva OF
Ctrl + A         → Ver alertas
Ctrl + O         → Ver órdenes
```

---

## 📞 SOPORTE

**Sistema:**
- URL: https://compras-fc.vercel.app
- Repo: https://github.com/feelingcompany/compras

**Documentación:**
- Manual completo: `MANUAL_USUARIO.md`
- Guía técnica: `README.md`
- Workflow aprobaciones: `WORKFLOW_APROBACIONES.md`

**Contacto:**
- Santiago Sosa (Gerencia)
- Milena Giraldo (Admin Compras)

---

## 🔑 CREDENCIALES INICIALES

**Todos los usuarios tienen PIN: 1234**

Cambiar después del primer login en:
Admin → Usuarios → [Tu usuario] → Resetear PIN

---

## 📊 MÉTRICAS CLAVE

**Para medir éxito del sistema:**

```
1. % OFs con 3+ cotizaciones → Meta: >80%
2. Tiempo promedio de aprobación → Meta: <3 días
3. Alertas críticas atendidas → Meta: <24 horas
4. Ahorro vs presupuesto → Meta: +5%
5. Compliance → Meta: 100%
```

---

**Última actualización:** Abril 16, 2026  
**Versión:** 1.0
