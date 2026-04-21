# 🎯 SISTEMA DE APROBACIONES POR NIVELES - FEELING COMPANY

## ✅ IMPLEMENTADO

Sistema completo de aprobaciones automáticas con múltiples niveles jerárquicos, reglas por monto, y notificaciones.

---

## 📊 CÓMO FUNCIONA

### **Flujo Automático:**

```
1. Usuario crea solicitud
   ↓
2. Sistema calcula monto total
   ↓
3. Según reglas, asigna aprobadores necesarios
   ↓
4. Cada nivel aprueba en orden
   ↓
5. Si todos aprueban → solicitud "aprobada"
6. Si alguno rechaza → solicitud "rechazada"
```

---

## 💰 REGLAS DE APROBACIÓN (Por Monto)

### **Nivel 1: Hasta $1.000.000**
- **Aprobador:** Encargado de área
- **Niveles requeridos:** 1
- **Proceso:** Aprobación simple por el encargado

### **Nivel 2: Entre $1.000.001 y $5.000.000**
- **Aprobadores:** 
  1. Encargado de área (Nivel 1)
  2. Admin de compras (Nivel 2)
- **Niveles requeridos:** 2
- **Proceso:** Aprobación jerárquica (primero encargado, luego admin)

### **Nivel 3: Más de $5.000.000**
- **Aprobadores:**
  1. Encargado de área (Nivel 1)
  2. Admin de compras (Nivel 2)
  3. Gerencia (Nivel 3)
- **Niveles requeridos:** 3
- **Proceso:** Aprobación jerárquica completa

---

## 🔄 ASIGNACIÓN AUTOMÁTICA DE APROBADORES

### **Lógica de Asignación:**

1. **Por Área:** Prioridad al encargado de la misma área del solicitante
2. **Por Rol:** Si no hay encargado del área, busca cualquier usuario con el rol
3. **Por Antigüedad:** Si hay múltiples, selecciona el más antiguo

### **Ejemplo:**

```
Solicitud:
- Solicitante: Juan (Área: Producción)
- Monto: $3.500.000

Sistema asigna automáticamente:
- Nivel 1: Pedro (Encargado de Producción)
- Nivel 2: María (Admin de Compras)
```

---

## 📋 TABLA: REGLAS_APROBACION

```sql
+----------------+---------------+--------------------+-----------------+
| monto_minimo   | monto_maximo  | nivel_aprobacion   | rol_aprobador   |
+----------------+---------------+--------------------+-----------------+
| 0              | 1,000,000     | 1                  | encargado       |
| 1,000,001      | 5,000,000     | 1                  | encargado       |
| 1,000,001      | 5,000,000     | 2                  | admin_compras   |
| 5,000,001      | NULL          | 1                  | encargado       |
| 5,000,001      | NULL          | 2                  | admin_compras   |
| 5,000,001      | NULL          | 3                  | gerencia        |
+----------------+---------------+--------------------+-----------------+
```

---

## ⚙️ FUNCIONES SQL CREADAS

### **1. calcular_monto_solicitud(uuid)**
Suma los presupuestos estimados de todos los ítems de una solicitud.

### **2. obtener_aprobadores_requeridos(monto)**
Retorna los niveles y roles de aprobación necesarios según el monto.

### **3. asignar_aprobador(rol, area, centro_costo)**
Encuentra el aprobador específico más adecuado para un rol.

### **4. crear_aprobaciones_automaticas()**
Trigger que crea aprobaciones automáticamente al insertar una solicitud.

### **5. actualizar_estado_solicitud()**
Trigger que actualiza el estado de la solicitud según las aprobaciones.

---

## 📊 VISTA: VISTA_APROBACIONES_PENDIENTES

Vista consolidada que muestra:
- ID de aprobación
- Detalles de la solicitud
- Información del solicitante
- Nivel de aprobación
- Monto total calculado
- Fecha límite (3 días)
- Si está vencida

---

## 🔔 SISTEMA DE NOTIFICACIONES

### **Cuando se crea una solicitud:**
- Se crea una notificación en la tabla `alertas`
- Tipo: `'nueva_aprobacion'`
- Destinatario: Cada aprobador asignado
- Mensaje: "Nueva solicitud pendiente de aprobación: [descripción]"

---

## 📱 PÁGINAS DEL SISTEMA

### **/aprobaciones**
- Lista de aprobaciones pendientes del usuario
- Ordenadas por vencimiento y urgencia
- Stats en tiempo real
- Botones inline para aprobar/rechazar
- Modal de rechazo con comentario obligatorio

### **/mi-trabajo**
- Command Center con aprobaciones pendientes
- Vista consolidada de todas las tareas
- Acceso rápido a aprobaciones

### **/pipeline**
- Vista Kanban del proceso completo
- Muestra solicitudes en cada etapa

---

## 🚀 CÓMO USAR

### **Paso 1: Ejecutar Migración**

Abrí Supabase SQL Editor:
https://supabase.com/dashboard/project/lxdeumwfzlfzzcmsrpyh/sql

Ejecutá:
```sql
-- Ver archivo completo en:
-- /migrations/008_sistema_aprobaciones_niveles.sql
```

### **Paso 2: Crear Solicitud de Prueba**

1. Andá a `/solicitudes/nueva`
2. Creá una solicitud con monto >$1M
3. El sistema automáticamente:
   - Calcula el monto
   - Asigna aprobadores según reglas
   - Crea notificaciones
   - Solicitud queda en estado "pendiente"

### **Paso 3: Aprobar**

1. El aprobador nivel 1 andá a `/aprobaciones`
2. Ve la solicitud pendiente
3. Aprueba o rechaza
4. Si aprueba, pasa al nivel 2
5. Si rechaza, solicitud pasa a "rechazada"

---

## 🔒 VALIDACIONES

### **Al crear aprobación:**
- ✅ Usuario con el rol existe
- ✅ Usuario está activo
- ✅ Monto calculado correctamente
- ✅ Reglas aplicadas según monto

### **Al aprobar:**
- ✅ Solo el aprobador asignado puede aprobar
- ✅ Fecha límite de 3 días
- ✅ Historial completo en la tabla

### **Al rechazar:**
- ✅ Comentario obligatorio
- ✅ Fecha de rechazo guardada
- ✅ Solicitud pasa a "rechazada" automáticamente

---

## 📈 REPORTES Y AUDITORÍA

### **Consultas Útiles:**

**Ver aprobaciones por estado:**
```sql
SELECT 
  estado,
  COUNT(*) as total,
  SUM(calcular_monto_solicitud(solicitud_id)) as monto_total
FROM aprobaciones
GROUP BY estado;
```

**Ver aprobaciones vencidas:**
```sql
SELECT * FROM vista_aprobaciones_pendientes
WHERE vencida = true;
```

**Tiempo promedio de aprobación:**
```sql
SELECT 
  nivel_aprobacion,
  AVG(EXTRACT(EPOCH FROM (fecha_aprobacion - created_at))/3600) as horas_promedio
FROM aprobaciones
WHERE estado = 'aprobada'
GROUP BY nivel_aprobacion;
```

---

## 🛠️ PERSONALIZACIÓN

### **Cambiar Reglas de Monto:**

```sql
-- Actualizar rango de monto medio
UPDATE reglas_aprobacion
SET monto_maximo = 10000000
WHERE monto_minimo = 1000001
  AND nivel_aprobacion IN (1, 2);

-- Agregar nueva regla
INSERT INTO reglas_aprobacion (
  monto_minimo,
  monto_maximo,
  nivel_aprobacion,
  rol_aprobador,
  descripcion
) VALUES (
  10000001,
  20000000,
  4,
  'director',
  'Requiere aprobación de director'
);
```

### **Cambiar Fecha Límite:**

Editá la función `crear_aprobaciones_automaticas`:
```sql
fecha_limite: NOW() + INTERVAL '5 days'  -- Cambiar a 5 días
```

---

## ✅ VERIFICACIÓN

### **Después de ejecutar la migración:**

```sql
-- Verificar reglas
SELECT * FROM reglas_aprobacion ORDER BY nivel_aprobacion;

-- Verificar funciones
SELECT proname FROM pg_proc WHERE proname LIKE '%aprobacion%';

-- Verificar triggers
SELECT tgname FROM pg_trigger WHERE tgname LIKE '%aprobacion%';

-- Verificar vista
SELECT * FROM vista_aprobaciones_pendientes LIMIT 5;
```

---

## 🎯 PRÓXIMOS PASOS SUGERIDOS

1. **Notificaciones por Email** - Enviar emails cuando hay nuevas aprobaciones
2. **Firma Digital** - Requerir firma electrónica para aprobaciones
3. **Delegación** - Permitir delegar aprobaciones a otros usuarios
4. **Recordatorios** - Alertas automáticas para aprobaciones vencidas
5. **Reportes** - Dashboard de performance de aprobaciones

---

**¿Ejecutamos la migración y probamos el sistema?** 🚀
