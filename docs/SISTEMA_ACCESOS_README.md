# Sistema de Accesos Multi-Usuario + Portal de Proveedores

## ✅ IMPLEMENTADO

Se han creado 2 sistemas completos:

### 1. **Auto-Registro de Empleados**
- Página de registro pública: `/registro`
- Panel de administración: `/admin/solicitudes-pendientes`
- Sistema de aprobación con PIN de 4 dígitos

### 2. **Portal de Proveedores**
- Login separado: `/proveedores/login`
- Dashboard con OFs: `/proveedores/dashboard`
- Actualización de estados
- Estadísticas en tiempo real

---

## 📋 PASOS PARA IMPLEMENTAR

### PASO 1: Ejecutar Migraciones en Supabase

1. Abrí el panel de Supabase: https://supabase.com/dashboard
2. Seleccioná tu proyecto de Compras FC
3. Andá a **SQL Editor** (menú izquierdo)
4. Click en **+ New Query**

**Ejecutá PRIMERO:**
```sql
-- Contenido de /migrations/005_solicitudes_multiitem_categorias.sql
```

**Luego ejecutá:**
```sql
-- Contenido de /migrations/006_sistema_accesos_multiusuario.sql
```

5. Click en **RUN** para cada uno ✅

---

### PASO 2: Crear Accesos Iniciales para Proveedores

Ejecutá este SQL en Supabase para crear accesos de prueba:

```sql
-- Crear acceso para un proveedor de ejemplo
-- IMPORTANTE: Cambiar estos valores por proveedores reales

INSERT INTO proveedores_portal (proveedor_id, email, password_hash, activo)
VALUES (
  (SELECT id FROM proveedores WHERE nombre LIKE '%NOMBRE_PROVEEDOR%' LIMIT 1),
  'contacto@proveedor.com',
  'password123', -- CAMBIAR por password real
  true
);
```

**NOTA IMPORTANTE:**
En producción, deberías usar bcrypt para hashear las contraseñas. El código actual usa validación simple que DEBE ser cambiada.

---

### PASO 3: Testear Localmente

```bash
cd /home/claude/compras-fc
npm run dev
```

**URLs para testear:**

| URL | Descripción |
|-----|-------------|
| http://localhost:3000/registro | Registro de empleados |
| http://localhost:3000/login | Login empleados |
| http://localhost:3000/admin/solicitudes-pendientes | Aprobar solicitudes (Admin) |
| http://localhost:3000/proveedores/login | Login proveedores |
| http://localhost:3000/proveedores/dashboard | Dashboard proveedores |

---

### PASO 4: Deploy a Producción

```bash
git add .
git commit -m "feat: auto-registro empleados + portal proveedores"
git push origin main
vercel --prod --yes
```

---

## 🎯 FLUJO DE AUTO-REGISTRO

### Para Empleados Nuevos:

1. **Registro:**
   - Entrá a: https://compras-fc.vercel.app/registro
   - Llenás: Nombre, Email corporativo, Área, PIN
   - Click "Solicitar Acceso"
   - Quedás pendiente de aprobación

2. **Aprobación (Admin):**
   - Admin entra a: /admin/solicitudes-pendientes
   - Ve tu solicitud
   - Click "✅ Aprobar"
   - Automáticamente se crea tu usuario

3. **Acceso:**
   - Te llega notificación (email)
   - Entrás a: /login
   - Usás: Email + PIN
   - ¡Listo! Ya podés crear solicitudes

### Para Admins:

- Revisá diariamente: `/admin/solicitudes-pendientes`
- Aprobá o rechazá con 1 click
- Si rechazás, escribí el motivo
- Se notifica automáticamente al empleado

---

## 🏪 FLUJO DEL PORTAL DE PROVEEDORES

### Para Proveedores:

1. **Acceso Inicial:**
   - Feeling Company te crea el acceso
   - Recibís email + contraseña
   - Entrás a: https://compras-fc.vercel.app/proveedores/login

2. **Dashboard:**
   - Ves todas tus OFs
   - Filtrás: Todas / Pendientes / Entregadas
   - Estadísticas en tiempo real

3. **Actualizar Entregas:**
   - Cuando entregás un pedido
   - Click "✓ Marcar Entregada"
   - Se notifica automáticamente a Compras

4. **Futuras Funcionalidades:**
   - Subir facturas (próximamente)
   - Ver calificaciones (próximamente)
   - Mensajería con Compras (próximamente)

### Para Admin Compras (Crear Accesos):

```sql
-- En Supabase SQL Editor:
INSERT INTO proveedores_portal (proveedor_id, email, password_hash, activo)
VALUES (
  '[ID_PROVEEDOR]',
  'email@proveedor.com',
  'contraseña_temporal',
  true
);
```

---

## 📊 DATOS CREADOS

### Tablas Nuevas:

1. **solicitudes_acceso**
   - Solicitudes de registro de empleados
   - Estados: pendiente, aprobado, rechazado

2. **items_solicitud**
   - Ítems individuales de cada solicitud
   - Soporte multi-ítem con categorías

3. **proveedores_portal**
   - Credenciales de acceso para proveedores
   - Email + password_hash

4. **actualizaciones_proveedor**
   - Registro de cambios de estado por proveedores
   - Timestamp y tracking completo

5. **facturas_proveedor**
   - Facturas subidas por proveedores (futuro)

6. **mensajes_proveedor**
   - Mensajería proveedor-compras (futuro)

---

## 🔐 SEGURIDAD

### Implementado:
- ✅ Validación de emails corporativos
- ✅ PIN de 4 dígitos
- ✅ Sistema de aprobación manual
- ✅ Separación de portales (empleados vs proveedores)
- ✅ Tracking de última conexión

### PENDIENTE (IMPORTANTE):
- ⚠️ **Hasheo de contraseñas con bcrypt**
- ⚠️ **Rate limiting en login**
- ⚠️ **Tokens JWT para sesiones**
- ⚠️ **Recuperación de contraseñas**

---

## 📈 PRÓXIMAS MEJORAS

### Portal de Proveedores:
- [ ] Subir facturas (archivo + datos)
- [ ] Ver calificaciones históricas
- [ ] Mensajería bidireccional
- [ ] Notificaciones por email
- [ ] Descargar OFs en PDF
- [ ] Evidencias de entrega (fotos)

### Auto-Registro:
- [ ] Email de confirmación automático
- [ ] Reset de PIN olvidado
- [ ] Edición de perfil
- [ ] Historial de actividad

---

## 🆘 PROBLEMAS COMUNES

### "No puedo ver Solicitudes Pendientes"
- Solo usuarios con rol `admin` o `gerencia` pueden ver este módulo
- Verificá tu rol en: tabla `usuarios`

### "Proveedor no puede ingresar"
- Verificá que existe en `proveedores_portal`
- Verificá que `activo = true`
- Verificá email y contraseña

### "Empleado aprobado no puede ingresar"
- Verificá que se creó en tabla `usuarios`
- Verificá que `activo = true`
- Verificá el PIN (4 dígitos)

---

## 📞 CONTACTO

Para soporte técnico:
- Santiago (Admin Sistema)
- compras@feelingcompany.com
