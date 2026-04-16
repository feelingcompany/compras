# 📘 MANUAL DE USUARIO — Sistema de Compras FC

## 🎯 Propósito del Sistema

**Compras FC** te acompaña en todo el proceso de compra, desde que alguien necesita algo hasta que se paga la factura.

El sistema:
- ✅ Detecta sobrecostos automáticamente
- ✅ Genera alertas cuando algo no está bien
- ✅ Pide aprobaciones según el monto
- ✅ Compara cotizaciones de proveedores
- ✅ Hace seguimiento de todo el proceso

---

## 📊 EL FLUJO COMPLETO (Paso a Paso)

### 🔵 PASO 1: Alguien Necesita Algo (SOLICITUD)

**¿Quién?** Cualquier empleado  
**¿Dónde?** Módulo: **Solicitudes**

**Qué hace:**
1. Empleado crea solicitud: "Necesito 3 laptops HP para marketing"
2. Especifica: qué necesita, cuándo lo necesita, presupuesto estimado
3. Sistema genera solicitud con número único

**Lo que pasa automáticamente:**
- Solicitud queda en estado "Pendiente"
- Admin de Compras recibe notificación
- Queda registrada en el sistema

**Ejemplo Real:**
```
Solicitud #SOL-2026-001
Título: Laptops para equipo marketing
Descripción: 3 laptops HP ProBook 450 G9, i7, 16GB RAM
Monto estimado: $12,000,000
Prioridad: Alta
Solicitante: María García (Marketing)
Estado: Pendiente
```

---

### 🟢 PASO 2: Admin de Compras Revisa (APROBACIÓN DE SOLICITUD)

**¿Quién?** Milton, Sebastian, Milena (Admin Compras)  
**¿Dónde?** Módulo: **Solicitudes**

**Qué hace:**
1. Admin revisa solicitud
2. Verifica que:
   - Está clara la necesidad
   - Presupuesto es razonable
   - Urgencia es real
3. **APRUEBA** o **RECHAZA**

**Si APRUEBA:**
- Solicitud cambia a "Aprobada"
- Admin puede crear OF directamente

**Si RECHAZA:**
- Solicitud cambia a "Rechazada"
- Admin escribe comentario explicando por qué
- Solicitante recibe notificación

---

### 🟡 PASO 3: Cotizar con Proveedores (COTIZACIONES)

**¿Quién?** Admin Compras  
**¿Dónde?** Módulo: **Cotizaciones**

**Qué hace:**
1. Busca proveedores que vendan lo que se necesita
2. Solicita cotización a 2-3 proveedores
3. Registra cada cotización en el sistema:
   - Proveedor
   - Precio
   - Tiempo de entrega
   - Condiciones de pago

**Lo que el sistema hace automáticamente:**
- Compara las 3 cotizaciones lado a lado
- Muestra cuál es la más barata
- Calcula % de diferencia entre ellas
- Muestra historial de precios de ese servicio

**Ejemplo Real:**
```
OF: Laptops HP ProBook 450 G9

Cotización 1 - Proveedor: Alkosto
Precio: $4,200,000 c/u = $12,600,000 total
Entrega: 5 días
Condiciones: 30 días

Cotización 2 - Proveedor: Éxito
Precio: $4,050,000 c/u = $12,150,000 total ← MÁS BARATA
Entrega: 7 días
Condiciones: 45 días

Cotización 3 - Proveedor: PC Factory
Precio: $4,300,000 c/u = $12,900,000 total
Entrega: 3 días
Condiciones: 30 días

✅ Sistema recomienda: Éxito (ahorro: $450,000)
```

---

### 🔴 PASO 4: Crear Orden de Facturación (NUEVA OF)

**¿Quién?** Admin Compras  
**¿Dónde?** Módulo: **Nueva OF**

**Qué hace:**
1. Crea OF formal con los datos de la cotización ganadora
2. Llena el formulario:
   - OT (proyecto al que pertenece)
   - Proveedor seleccionado
   - Descripción del servicio/producto
   - Valor total
   - Fecha de entrega

**🚨 LO MÁS IMPORTANTE: DETECCIÓN DE SOBRECOSTOS**

El sistema tiene un **CATÁLOGO** con precios de referencia de servicios comunes.

**Si creas OF de "Laptops HP ProBook" por $4,500,000 c/u:**
- Sistema busca en catálogo: precio referencia = $4,000,000
- Calcula: $4,500,000 vs $4,000,000 = +12.5% sobrecosto
- **ALERTA VISUAL:** "⚠️ Precio 12.5% sobre referencia"

**Si el sobrecosto es >20%:**
- ❌ ALERTA ROJA: "Precio muy alto, verificar"
- Sistema sugiere contactar más proveedores

**Ejemplo Real:**
```
Nueva OF

OT: OT-2026-045 (Renovación equipos marketing)
Proveedor: Éxito
Servicio: [Catálogo] Laptop HP ProBook 450 G9
  → Precio referencia: $4,000,000
  → Tu precio: $4,050,000
  → ✅ OK: Solo 1.25% sobre referencia

Cantidad: 3
Valor unitario: $4,050,000
Valor total: $12,150,000

[Guardar OF]
```

**Lo que pasa automáticamente al guardar:**
1. OF se crea con código único (OF-2026-123)
2. Sistema detecta que $12M requiere **Nivel 2 de aprobación**
3. Crea automáticamente:
   - Aprobación Nivel 1 (Encargado) → Pendiente
   - Aprobación Nivel 2 (Admin Compras) → Pendiente
4. OF queda en estado "EN_REVISION"

---

### 🟣 PASO 5: Aprobaciones Multinivel (APROBACIONES)

**¿Quién?** Depende del monto  
**¿Dónde?** Módulo: **Aprobaciones**

**REGLAS AUTOMÁTICAS:**

| Monto OF | Quién Aprueba | Ejemplo |
|----------|---------------|---------|
| $0 - $3M | Nivel 1: Encargado | Compra de papelería |
| $3M - $10M | Nivel 2: Admin Compras | Equipos de cómputo |
| $10M - $50M | Nivel 3: Gerencia | Renovación de mobiliario |
| >$50M | Nivel 4: Junta Directiva | Proyecto de construcción |

**Cómo funciona:**

**Ejemplo: OF de $12M (requiere Nivel 2)**

1. Sistema crea automáticamente:
   - Aprobación Nivel 1 → Asigna a Encargado
   - Aprobación Nivel 2 → Asigna a Admin Compras

2. **Encargado entra a `/aprobaciones`:**
   - Ve OF de $12M pendiente
   - Revisa detalles
   - Click "✅ Aprobar" o "❌ Rechazar"
   - Si rechaza: debe escribir comentario explicando

3. **Si Encargado aprueba:**
   - Nivel 1 cambia a "Aprobado"
   - OF sigue en "EN_REVISION" (falta Nivel 2)
   - Admin Compras ve ahora la OF en sus pendientes

4. **Admin Compras entra a `/aprobaciones`:**
   - Ve OF de $12M pendiente
   - Revisa detalles
   - Click "✅ Aprobar"

5. **Cuando Admin aprueba:**
   - Nivel 2 cambia a "Aprobado"
   - **OF cambia automáticamente a estado "OK"**
   - ✅ OF APROBADA, puede continuar

**Si alguien RECHAZA:**
- OF cambia inmediatamente a "DESESTIMADA"
- Proceso se detiene
- Solicitante recibe notificación

---

### 🔵 PASO 6: Auditoría (VERIFICACIÓN)

**¿Quién?** Equipo de auditoría  
**¿Dónde?** Módulo: **Auditoría**

**Qué hace:**
1. Revisa OFs aprobadas antes de ejecutar
2. Verifica:
   - Cotizaciones están completas
   - Proveedor cumple requisitos
   - Precios son razonables
   - Documentación está completa
3. Da **visto bueno final**

---

### 🟢 PASO 7: Radicación de Factura (RECEPCIÓN)

**¿Quién?** Admin Compras o Contabilidad  
**¿Dónde?** Módulo: **Radicación**

**Qué hace:**
1. Proveedor entrega producto/servicio
2. Proveedor envía factura
3. Admin registra en sistema:
   - Fecha de recepción
   - Número de factura
   - Fecha de vencimiento
   - Adjunta PDF de factura

**Lo que pasa automáticamente:**
- OF cambia a "RADICADA"
- Sistema calcula fecha límite de pago
- Contabilidad recibe notificación

---

### 🟡 PASO 8: Pago de Factura (CIERRE)

**¿Quién?** Tesorería  
**¿Dónde?** Módulo: **Pagos**

**Qué hace:**
1. Revisa facturas por pagar
2. Verifica fecha de vencimiento
3. Programa pago
4. Registra:
   - Fecha de pago
   - Método (transferencia/cheque)
   - Número de comprobante

**Lo que pasa automáticamente:**
- OF cambia a "PAGADA"
- ✅ PROCESO COMPLETO
- Sistema actualiza estadísticas de proveedor

---

## 🎯 MÓDULOS DE APOYO

### ⚡ Alertas (Dashboard de Problemas)

**¿Qué hace?**
Sistema genera alertas automáticamente cuando detecta problemas:

**Tipos de alertas:**
1. **Sin cotizaciones**: OF >$5M sin cotizaciones registradas
2. **Proveedor nuevo**: Proveedor nuevo con OF de alto valor
3. **Dependencia excesiva**: >30% del gasto en 1 solo proveedor
4. **Autoaprobación**: Mismo usuario es solicitante y encargado
5. **Fraccionamiento**: Varias OFs pequeñas que suman >$10M
6. **Precio inflado**: Precio >20% sobre referencia histórica
7. **Compra urgente recurrente**: Siempre compras "urgente"

**Ejemplo:**
```
⚠️ ALERTA CRÍTICA
Sin cotizaciones — OF-2026-089

OF por $15,000,000 no tiene cotizaciones registradas.
Se recomienda cotizar con mínimo 2 proveedores.

[Ver OF] [Marcar como atendida]
```

---

### ★ Score de Compradores (Ranking del Equipo)

**¿Qué hace?**
Califica objetivamente el desempeño de cada comprador.

**Fórmula:**
```
Score = (35% Cotizaciones) + (25% Alertas) + (20% Ahorro) + (20% Calidad)
```

**Detalle:**
- **35% Cotizaciones**: % de OFs con 3+ cotizaciones
- **25% Alertas**: Menos alertas = mejor score
- **20% Ahorro**: Ahorro generado vs presupuesto
- **20% Calidad**: Evaluación de proveedores

**Ejemplo:**
```
Ranking Mes de Abril 2026

1. Milena Giraldo - Score: 8.5/10
   - 85% OFs con cotizaciones ✅
   - 3 alertas generadas
   - $5M en ahorro
   
2. Milton Arango - Score: 7.8/10
   - 70% OFs con cotizaciones
   - 8 alertas generadas
   - $3M en ahorro
```

---

### 📊 Órdenes (Vista General)

**¿Qué hace?**
Vista completa de todas las OFs con filtros.

**Filtros disponibles:**
- Por estado: Pendiente, En Revisión, OK, Radicada, Pagada
- Por proveedor
- Por fecha
- Por monto
- Por encargado

**Exportar:**
- Excel
- PDF
- CSV

---

### 👥 Proveedores (Base de Datos)

**¿Qué hace?**
Gestión completa de proveedores.

**Información registrada:**
- Datos básicos (nombre, NIT, contacto)
- Historial de compras
- Evaluación de desempeño
- Alertas activas
- Documentos (RUT, certificados)

**Evaluación automática:**
```
Proveedor: Éxito
Calificación: 4.5/5.0

Entregas a tiempo: 95%
Calidad productos: 4.8/5
Servicio postventa: 4.2/5
Total OFs: 45
Valor total: $250,000,000
```

---

### ⚙️ Administración (Configuración)

**¿Quién?** Solo Gerencia  
**¿Dónde?** Módulo: **Admin**

**Qué hace:**
1. **Usuarios**: Crear, editar, desactivar usuarios
2. **Catálogo**: Gestionar servicios y precios de referencia
3. **Reglas**: Configurar reglas de aprobación
4. **Inicialización**: Cargar datos masivos

---

## 🚀 CASOS DE USO REALES

### Caso 1: Compra Urgente de Papelería ($800,000)

```
1. Asistente crea solicitud → Módulo: Solicitudes
2. Admin aprueba → Solicitud: Aprobada
3. Admin cotiza con 2 papelerías:
   - Papelería ABC: $800K
   - Papelería XYZ: $850K
4. Admin crea OF con ABC → Nueva OF
5. Sistema detecta: $800K = Nivel 1 (automático)
6. OF se aprueba automáticamente → Estado: OK
7. Compra se ejecuta
8. Se radica factura → Radicación
9. Tesorería paga → Pagos
✅ COMPLETO
```

**Tiempo total:** 1-2 días

---

### Caso 2: Renovación Equipos Marketing ($12M)

```
1. Jefe Marketing crea solicitud → Solicitudes
2. Admin Compras aprueba → Solicitud: Aprobada
3. Admin cotiza con 3 proveedores → Cotizaciones
4. Admin crea OF con mejor opción → Nueva OF
   - Sistema alerta: Precio OK vs catálogo ✅
5. Sistema detecta: $12M = Nivel 2 (requiere 2 aprobaciones)
6. Encargado aprueba Nivel 1 → Aprobaciones
7. Admin Compras aprueba Nivel 2 → Aprobaciones
8. OF cambia a: OK
9. Auditoría revisa → Auditoría
10. Se ejecuta compra
11. Se radica factura → Radicación
12. Tesorería paga → Pagos
✅ COMPLETO
```

**Tiempo total:** 5-7 días

---

### Caso 3: Proyecto Grande ($45M)

```
1. Gerencia crea solicitud → Solicitudes
2. Admin aprueba → Solicitud: Aprobada
3. Admin cotiza con 5 proveedores → Cotizaciones
4. Comité selecciona mejor opción
5. Admin crea OF → Nueva OF
   - Sistema detecta: precio 15% sobre referencia ⚠️
   - Admin justifica: "Incluye instalación"
6. Sistema detecta: $45M = Nivel 3 (requiere Gerencia)
7. Encargado aprueba Nivel 1 → Aprobaciones
8. Admin aprueba Nivel 2 → Aprobaciones
9. Gerencia aprueba Nivel 3 → Aprobaciones
10. OF cambia a: OK
11. Auditoría detallada → Auditoría
12. Legal revisa contrato
13. Se ejecuta proyecto
14. Se radica factura → Radicación
15. Tesorería programa pago → Pagos
✅ COMPLETO
```

**Tiempo total:** 15-30 días

---

## 📱 ACCESO RÁPIDO

**Login:** https://compras-fc.vercel.app/login

**Usuarios según rol:**

**Admin Compras:**
- milena.giraldo@feelingone.co | PIN: 1234
- milton.arango@feelingone.co | PIN: 1234
- sebastian.lopez@feelingone.co | PIN: 1234
- juridico@feelingcompany.com | PIN: 1234

**Gerencia:**
- santisosa@feelingcompany.com | PIN: 1234

---

## ❓ PREGUNTAS FRECUENTES

**P: ¿Puedo crear OF sin cotizaciones?**
R: Sí, pero el sistema generará alerta si el monto es >$5M

**P: ¿Qué pasa si rechazo una aprobación?**
R: La OF se marca como "Desestimada" y el proceso se detiene

**P: ¿Cómo sé si un precio está bien?**
R: El sistema compara vs catálogo y te alerta si está >20% sobre referencia

**P: ¿Puedo cambiar el aprobador?**
R: Solo Gerencia puede reasignar aprobaciones

**P: ¿Dónde veo todas mis OFs?**
R: Módulo "Órdenes" con filtro por tu nombre

---

**Preparado:** Abril 16, 2026  
**Versión:** 1.0  
**Soporte:** Claude AI Assistant
