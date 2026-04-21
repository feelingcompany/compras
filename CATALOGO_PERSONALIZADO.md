# 🎯 CATÁLOGO PERSONALIZADO FEELING COMPANY

## ✅ LO QUE SE HIZO

Analicé el Excel **ORDEN_DE_FACTURACION_2026.xlsx** con el histórico real de compras de Feeling Company y creé un **catálogo personalizado** basado en los servicios que REALMENTE compran.

---

## 📊 ANÁLISIS REALIZADO

### **Datos procesados:**
- ✅ 1,212 órdenes de facturación del 2026
- ✅ 563 proveedores únicos
- ✅ 54 proyectos/clientes diferentes

### **Categorías identificadas automáticamente:**
- Servicios (234 registros)
- Logística/Transporte (148 registros)
- Alimentación (69 registros)
- Producción/Audiovisual (55 registros)
- Talento/Artistas (39 registros)
- Impresión/Gráfica (38 registros)
- Material/Construcción (27 registros)
- Tecnología (23 registros)

### **Análisis de precios:**
- Precio promedio: $3,053,067
- Precio mediano: $630,300
- Rango: $4,500 - $267,984,625

---

## 🎯 CATÁLOGO GENERADO

**Total de servicios:** 14 servicios recurrentes

### **Por Categoría:**

#### **MATERIALES (2 servicios)**
1. Insumos operacionales → $312,842 (72 órdenes en histórico)
2. Elementos operacionales → $200,000 (39 órdenes)

#### **ALIMENTACIÓN (2 servicios)**
1. Refrigerios para eventos → $2,085,382 (53 órdenes)
2. Servicio de alimentación → $12,968,020 (6 órdenes)

#### **TALENTO (2 servicios)**
1. Personal logístico → $2,985,804/día (23 órdenes)
2. Personal operativo → $150,000/día (36 órdenes)

#### **LOGÍSTICA (3 servicios)**
1. Transporte general → $15,307,383 (21 órdenes)
2. Servicio de transporte → $2,397,500 (6 órdenes)
3. Alquiler de vehículos → $2,000,000/día (51 órdenes)

#### **IMPRESIÓN (1 servicio)**
1. Servicio de impresión → $7,279,254 (11 órdenes)

#### **PRODUCCIÓN (1 servicio)**
1. Alquiler de equipos → $513,000 (3 órdenes)

#### **TECNOLOGÍA (2 servicios)**
1. Plan de telefonía (TIGO/CLARO) → $150,000/mes (139 órdenes)
2. Material de cómputo → $500,000 (29 órdenes)

#### **SERVICIOS (1 servicio)**
1. Alquiler de espacio → $4,325,911 (46 órdenes)

---

## 📋 CÓMO EJECUTAR LA MIGRACIÓN

### **Paso 1: Abrir Supabase SQL Editor**
https://supabase.com/dashboard/project/lxdeumwfzlfzzcmsrpyh/sql

### **Paso 2: Ejecutar el SQL**
El archivo está en: `/migrations/007_catalogo_personalizado_feeling.sql`

O copiá este SQL:

```sql
-- Limpiar tabla
TRUNCATE TABLE catalogo_servicios CASCADE;

-- Insertar servicios (ver archivo completo)
INSERT INTO catalogo_servicios (...) VALUES (...);

-- Verificar
SELECT categoria, COUNT(*) FROM catalogo_servicios GROUP BY categoria;
```

### **Paso 3: Verificar**
```sql
SELECT * FROM catalogo_servicios ORDER BY categoria, servicio;
```

Deberías ver **14 servicios** organizados en **7 categorías**.

---

## 💡 CÓMO USAR EL CATÁLOGO

### **Al crear una OF:**

**ANTES (sin catálogo):**
```
Descripción: Servicio de transporte para evento 
Valor: 2,500,000
```

**AHORA (con catálogo):**
1. Seleccionás del dropdown: "Servicio de transporte"
2. Se autocompleta:
   - Descripción: "Servicio de transporte"
   - Valor sugerido: $2,397,500
   - Unidad: servicio
3. Solo ajustás los detalles específicos

---

## 🔄 AGREGAR MÁS SERVICIOS

**Opción 1: Desde la UI**
https://compras-fc.vercel.app/admin/catalogo

**Opción 2: SQL Directo**
```sql
INSERT INTO catalogo_servicios (
  categoria,
  servicio,
  descripcion,
  unidad_medida,
  precio_referencia,
  activo
) VALUES (
  'Tu Categoría',
  'Tu Servicio',
  'Descripción del servicio',
  'unidad',
  500000,
  true
);
```

---

## 📈 BENEFICIOS DEL CATÁLOGO PERSONALIZADO

✅ **Datos reales** de Feeling Company (no ejemplos genéricos)
✅ **Precios de referencia** calculados del histórico
✅ **Servicios frecuentes** (solo los que realmente compran)
✅ **Ahorra tiempo** al crear OFs recurrentes
✅ **Consistencia** en descripciones
✅ **Fácil actualización** desde /admin/catalogo

---

## 🚀 PRÓXIMOS PASOS

1. **Ejecutar la migración** (SQL arriba)
2. **Probar el catálogo** al crear una OF
3. **Agregar más servicios** según necesidad
4. **Actualizar precios** periódicamente

---

## 📊 TOP 10 PROVEEDORES IDENTIFICADOS

Para referencia, estos son los proveedores más frecuentes:

1. RUBEN DARIO URIBE OROZCO (34 órdenes)
2. Milenio PC S.A. (27 órdenes)
3. SURTIFAMILIAR SA (22 órdenes)
4. LUIS EDUARDO ROJAS NIETO (21 órdenes)
5. FEELING COMPANY SAS (20 órdenes)
6. ALLY MEDIA COLOMBIA S.A.S. (19 órdenes)
7. Logística Y Eventos Rentamos S.A.S. (15 órdenes)
8. RD Publicidad Y Marketing S.A.S (15 órdenes)
9. SOMOS IMPRESION DIGITAL S.A.S (14 órdenes)
10. BOLSAS Y PLASTICOS LA 15 LTDA (14 órdenes)

---

**¿Querés que ejecute la migración o agregue más servicios al catálogo?**
