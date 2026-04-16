# 📦 Compras FC — Feeling Company

Sistema integral de gestión de compras con alertas inteligentes, scores de compradores y control de permisos por rol.

## 🚀 Stack Tecnológico

- **Frontend**: Next.js 14 + React + TypeScript
- **Base de datos**: Supabase (PostgreSQL)
- **Deployment**: Vercel
- **Auth**: Sistema custom con PIN (4 dígitos)

## 🗄️ Infraestructura

```bash
# Producción
URL: https://compras-fc.vercel.app
Login: santisosa@feelingcompany.com | PIN: 1234

# Supabase
Proyecto: compras-feeling-company
ID: lxdeumwfzlfzzcmsrpyh
Dashboard: https://supabase.com/dashboard/project/lxdeumwfzlfzzcmsrpyh

# GitHub
Repo: https://github.com/feelingcompany/compras
Branch: main

# Vercel
Proyecto: compras-fc
Deployment automático desde main
```

## 📊 Base de Datos (17 tablas)

### Core
- `usuarios` - Equipo con roles y permisos
- `proveedores` - Base de proveedores activos
- `centros_costo` - Centros de costo
- `ordenes_trabajo` (OT) - Proyectos/clientes
- `ordenes_servicio` (OS) - Órdenes de servicio
- `ordenes_facturacion` (OF) - Órdenes de facturación (929 reales cargadas)

### Flujo de compras
- `solicitudes` - Solicitudes de compra
- `cotizaciones` - Comparación de cotizaciones
- `auditorias_of` - Auditorías de OFs
- `radicaciones` - Radicación de facturas
- `pagos` - Registro de pagos

### Inteligencia
- `alertas_sistema` - Alertas automáticas (fraccionamiento, dependencia, etc.)
- `score_compradores` - Ranking del equipo de compras
- `evaluaciones_proveedor` - Evaluación de proveedores
- `catalogo_servicios` - Precios de referencia
- `historial_precios` - Historial de precios pagados

### Auditoría
- `bitacora` - Log de acciones

## 🛠️ Setup Local

```bash
# 1. Clonar repo
git clone https://github.com/feelingcompany/compras.git
cd compras

# 2. Instalar dependencias
npm install

# 3. Variables de entorno (.env.local)
NEXT_PUBLIC_SUPABASE_URL=https://lxdeumwfzlfzzcmsrpyh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<tu-anon-key>

# 4. Ejecutar en desarrollo
npm run dev
# Abre http://localhost:3000
```

## 📦 Deployment

### Automático (Vercel)
```bash
git add -A
git commit -m "feat: descripción"
git push origin main
# Vercel despliega automáticamente
```

### Manual (Vercel CLI)
```bash
npm install -g vercel
vercel --prod
```

## 🗃️ Migraciones de Base de Datos

```bash
# 1. Abrir Supabase Dashboard
https://supabase.com/dashboard/project/lxdeumwfzlfzzcmsrpyh/sql

# 2. Ejecutar scripts en orden:
migrations/001_initial_schema.sql       # Tablas base (ya ejecutado)
migrations/002_catalogo_servicios.sql   # Catálogo de servicios (PENDIENTE)

# 3. Verificar en Database > Tables
```

## 👥 Sistema de Permisos

| Rol | Acceso | Filtrado |
|-----|--------|----------|
| **Gerencia** | Todos los módulos + Admin | Ve TODO |
| **Admin Compras** | Compras + Auditoría | Ve todas las OFs |
| **Encargado** | Dashboard + OFs propias | Solo sus OFs |
| **Solicitante** | Consulta + Solicitudes | Solo OFs que solicitó |

### Módulos por Rol

```typescript
// Gerencia
['dashboard', 'alertas', 'score', 'solicitudes', 'nueva-of', 
 'cotizaciones', 'auditoria', 'radicacion', 'pagos', 'ordenes', 
 'proveedores', 'evaluacion', 'contraloria', 'admin']

// Admin Compras
['dashboard', 'alertas', 'score', 'solicitudes', 'nueva-of', 
 'cotizaciones', 'auditoria', 'ordenes', 'proveedores', 'evaluacion']

// Encargado
['dashboard', 'alertas', 'solicitudes', 'nueva-of', 
 'cotizaciones', 'ordenes', 'proveedores']

// Solicitante
['dashboard', 'solicitudes', 'ordenes']
```

## 🔧 Módulos Construidos

### ⚡ Inteligencia
- `/dashboard` - Dashboard ejecutivo con gráficos reales
- `/alertas` - Alertas automáticas (fraccionamiento, dependencia, precio inflado)
- `/score` - Ranking de compradores con métricas objetivas

### 📋 Proceso de Compras (9 etapas)
1. `/solicitudes` - Solicitudes de compra
2. *(Etapa 2 en roadmap)*
3. `/nueva-of` - Crear orden de facturación
4. `/cotizaciones` - Comparación de cotizaciones (regla: >$5M = 2 cotiz., >$15M = 3)
5. `/auditoria` - Auditoría de OFs
6-7. *(Etapas en roadmap)*
8. `/radicacion` - Radicación de facturas
9. `/pagos` - Registro de pagos

### 📊 Gestión
- `/ordenes` - Todas las OFs con filtros
- `/proveedores` - Base de proveedores
- `/evaluacion` - Evaluación de proveedores
- `/contraloria` - Panel financiero

### ⚙️ Administración (solo Gerencia)
- `/admin` - Hub de administración
  - `/admin/usuarios` - Gestión de usuarios del equipo
  - `/admin/catalogo` - Catálogo de servicios con precios de referencia

## 🚀 Inicialización de Datos

```bash
# IMPORTANTE: Ejecutar DESPUÉS de cargar las OFs
# Esto genera alertas, scores y cotizaciones

1. Login como Gerencia (santisosa@feelingcompany.com | 1234)
2. Ir a /admin
3. Click "▶️ Inicializar Sistema Completo"
4. Esperar ~30 segundos (procesa 929 OFs)
5. Verificar en cada módulo que los datos aparezcan
```

### ¿Qué genera la inicialización?

- **Alertas**: ~150-200 alertas para OFs con problemas
  - Sin cotizaciones (>$5M)
  - Proveedor nuevo con alto valor
  - Dependencia excesiva (>30% concentración)
  - Autoaprobación

- **Scores**: Cálculo para todos los usuarios con rol compras
  - 35% cotizaciones
  - 25% alertas
  - 20% ahorro generado
  - 20% calidad de evaluaciones

- **Cotizaciones**: 2-3 cotizaciones por OF >$5M
  - Variación de ±10% sobre valor original
  - Proveedores aleatorios del catálogo

- **Solicitudes**: 5 solicitudes de ejemplo

## 📝 Próximos Pasos

### ✅ Completados
- [x] Sistema de permisos por rol
- [x] Módulo de administración
- [x] Gestión de usuarios
- [x] Catálogo de servicios

### 🔜 Roadmap
- [ ] Etapas 2, 6, 7 del flujo de compras
- [ ] Integración con catálogo en Nueva OF (autocomplete)
- [ ] Alertas de sobrecosto automáticas
- [ ] Dashboard de contraloría avanzado
- [ ] Exportación de reportes (Excel, PDF)
- [ ] Notificaciones por email
- [ ] Migración a cuenta oficial Feeling Company

## 🤝 Equipo

- **Santiago Sosa** - Gerencia (santisosa@feelingcompany.com)
- **Milton Arango** - Admin Compras (milton.arango@feelingone.co)
- **Sebastian Lopez** - Financiero (sebastian.lopez@feelingone.co)

## 📞 Soporte

Para issues o features: crear issue en GitHub o contactar a Santiago

---

**Última actualización**: Abril 2026  
**Versión**: 1.0.0  
**Status**: 🟢 Producción
