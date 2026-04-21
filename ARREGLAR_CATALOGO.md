# 🔧 SOLUCIÓN: Error en Catálogo de Servicios

## ⚠️ EL PROBLEMA

Al intentar usar el catálogo de servicios en el formulario de OFs, ves opciones como:
- "TECH-SERV-001 — Hosting y dominios ($ 450.000)"
- "TECH-LAP-001 — Laptop corporativa ($ 4.000.000)"

**Estos son datos de EJEMPLO que se insertaron automáticamente.**

También puede aparecer este error:
```
ERROR: column "codigo" of relation "catalogo_servicios" does not exist
```

---

## 🎯 SOLUCIONES

### **OPCIÓN 1: LIMPIAR TODO (Más Simple)** ✅ RECOMENDADO

**1. Abrí Supabase SQL Editor:**
https://supabase.com/dashboard/project/lxdeumwfzlfzzcmsrpyh/sql

**2. Ejecutá este SQL:**
```sql
TRUNCATE TABLE catalogo_servicios CASCADE;
```

**3. Listo!**
- El catálogo quedará vacío
- No habrá opciones predefinidas
- Podés llenar todo manualmente en las OFs
- O agregar tus propios servicios desde /admin/catalogo

---

### **OPCIÓN 2: LIMPIAR + AGREGAR TUS PROPIOS SERVICIOS**

**1. Ejecutá la limpieza:**
```sql
TRUNCATE TABLE catalogo_servicios CASCADE;
```

**2. Andá a la página de administración:**
https://compras-fc.vercel.app/admin/catalogo

**3. Agregá tus servicios reales:**
- Servicios que Feeling Company compra frecuentemente
- Con precios reales de referencia
- Organizados por categorías

**Ejemplo de servicios que podrías agregar:**
- Hosting mensual
- Equipos de producción
- Servicios de outsourcing
- Material de oficina recurrente

---

### **OPCIÓN 3: ELIMINAR LA FUNCIONALIDAD COMPLETA**

Si NO querés usar catálogo:

**1. Limpiar tabla:**
```sql
TRUNCATE TABLE catalogo_servicios CASCADE;
```

**2. Dejar vacío permanentemente**
- El campo seguirá siendo opcional
- Nunca mostrará opciones
- Siempre llenarás todo manual

---

## 💡 ¿PARA QUÉ SIRVE EL CATÁLOGO?

### **SIN Catálogo:**
Cada vez que creás una OF para hosting, escribís:
- "Hosting y dominios mes de mayo"
- "Descripción: Servicio de hosting cloud..."
- Valor: $450.000

### **CON Catálogo:**
Seleccionás del dropdown:
- "Hosting y dominios ($450.000)"
- Se autocompleta la descripción
- Solo ajustás lo específico del mes

**Ahorra tiempo en servicios recurrentes.**

---

## ✅ MI RECOMENDACIÓN

**Para Feeling Company:**

1. **Ejecutá la limpieza** (TRUNCATE)
2. **Agregá solo servicios que compran mensual/frecuentemente:**
   - Hosting
   - Servicios de mantenimiento
   - Material recurrente
3. **Para compras únicas/específicas:** Llenar manual

**No es obligatorio usar el catálogo — es solo una ayuda para ahorrar tiempo.**

---

## 📋 SCRIPT PARA EJECUTAR AHORA

```sql
-- Paso 1: Verificar qué hay
SELECT COUNT(*) as total, categoria FROM catalogo_servicios GROUP BY categoria;

-- Paso 2: Limpiar todo
TRUNCATE TABLE catalogo_servicios CASCADE;

-- Paso 3: Verificar que quedó vacío
SELECT COUNT(*) FROM catalogo_servicios;
-- Debe retornar: 0
```

---

**Ejecutá esto en:** https://supabase.com/dashboard/project/lxdeumwfzlfzzcmsrpyh/sql

¿Ejecuto esto y seguimos?
