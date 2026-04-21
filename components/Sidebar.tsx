'use client'
import { useAuth } from '@/lib/auth'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'

// ============================================================
// NAVEGACIÓN - PROCESO OFICIAL FEELING COMPANY (4 FASES)
// ============================================================
// Fase 1: Activación y Convocatoria
// Fase 2: Formalización
// Fase 3: Ejecución y Liquidación
// Fase 4: Auditoría de Compras y Pago
// ============================================================

type NavItem = {
  label: string
  path: string
  roles: string[]
  sep?: never
}

type NavSeparator = {
  label: string
  sep: true
  roles: string[]
  path?: never
}

type NavEntry = NavItem | NavSeparator

const NAV: NavEntry[] = [
  // TRABAJO DIARIO
  { label: 'Inicio',             path: '/inicio',       roles: ['solicitante', 'encargado', 'admin_compras', 'gerencia'] },
  { label: 'Mis solicitudes',    path: '/solicitudes',  roles: ['solicitante', 'encargado', 'admin_compras', 'gerencia'] },
  { label: 'Aprobaciones',       path: '/aprobaciones', roles: ['encargado', 'admin_compras', 'gerencia'] },
  { label: 'Pipeline',           path: '/pipeline',     roles: ['encargado', 'admin_compras', 'gerencia'] },

  // FASE 1 - ACTIVACIÓN Y CONVOCATORIA
  { label: 'Fase 1 · Activación', sep: true, roles: ['encargado', 'admin_compras', 'gerencia'] },
  { label: 'Cotizaciones',       path: '/cotizaciones', roles: ['encargado', 'admin_compras', 'gerencia'] },

  // FASE 2 - FORMALIZACIÓN
  { label: 'Fase 2 · Formalización', sep: true, roles: ['encargado', 'admin_compras', 'gerencia'] },
  { label: 'Órdenes de Facturación', path: '/ordenes',           roles: ['encargado', 'admin_compras', 'gerencia'] },
  { label: 'Órdenes de Servicio',    path: '/ordenes-servicio',  roles: ['encargado', 'admin_compras', 'gerencia'] },

  // FASE 3 - EJECUCIÓN Y LIQUIDACIÓN
  { label: 'Fase 3 · Ejecución', sep: true, roles: ['admin_compras', 'gerencia'] },
  { label: 'Radicación',         path: '/radicacion',   roles: ['admin_compras', 'gerencia'] },
  { label: 'Pagos',              path: '/pagos',        roles: ['admin_compras', 'gerencia'] },

  // FASE 4 - AUDITORÍA DE COMPRAS Y PAGO
  { label: 'Fase 4 · Auditoría', sep: true, roles: ['admin_compras', 'gerencia'] },
  { label: 'Contraloría',        path: '/contraloria',  roles: ['admin_compras', 'gerencia'] },
  { label: 'Auditoría',          path: '/auditoria',    roles: ['admin_compras', 'gerencia'] },

  // ANÁLISIS Y GESTIÓN
  { label: 'Análisis', sep: true, roles: ['encargado', 'admin_compras', 'gerencia'] },
  { label: 'Dashboard',          path: '/dashboard',    roles: ['encargado', 'admin_compras', 'gerencia'] },
  { label: 'Alertas',            path: '/alertas',      roles: ['encargado', 'admin_compras', 'gerencia'] },
  { label: 'Score equipo',       path: '/score',        roles: ['admin_compras', 'gerencia'] },
  { label: 'Proveedores',        path: '/proveedores',  roles: ['encargado', 'admin_compras', 'gerencia'] },
  { label: 'Eval. proveedores',  path: '/evaluacion',   roles: ['admin_compras', 'gerencia'] },

  // CONFIGURACIÓN
  { label: 'Sistema', sep: true, roles: ['admin_compras', 'gerencia'] },
  { label: 'Configuración',      path: '/admin',        roles: ['admin_compras', 'gerencia'] },
]

export default function Sidebar() {
  const { usuario, logout } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  if (!usuario) return null

  // Filtrar por rol
  const visibles = NAV.filter(item => item.roles.includes(usuario.rol))

  // Limpiar separadores huérfanos (que no tienen items después)
  const navLimpio = visibles.filter((item, idx) => {
    if (!('sep' in item)) return true
    const siguiente = visibles[idx + 1]
    return siguiente && !('sep' in siguiente)
  })

  return (
    <aside style={{
      width: 230, minWidth: 230, background: '#fff',
      borderRight: '1px solid #e5e7eb', display: 'flex',
      flexDirection: 'column', height: '100vh', position: 'fixed', left: 0, top: 0
    }}>
      {/* Header */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>Compras FC</div>
        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>Feeling Company</div>
      </div>

      {/* Navegación */}
      <nav style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }}>
        {navLimpio.map((item, idx) => {
          if ('sep' in item) {
            return (
              <div key={`sep-${idx}`} style={{
                padding: '14px 20px 6px', fontSize: 10, fontWeight: 700,
                color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em'
              }}>
                {item.label}
              </div>
            )
          }

          const active = pathname === item.path || pathname.startsWith(item.path + '/')
          return (
            <Link key={item.path} href={item.path} style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', alignItems: 'center',
                padding: '8px 20px', fontSize: 13,
                color: active ? '#185FA5' : '#374151',
                fontWeight: active ? 600 : 400,
                background: active ? '#EFF6FF' : 'transparent',
                borderLeft: `3px solid ${active ? '#185FA5' : 'transparent'}`,
                cursor: 'pointer', transition: 'all 0.15s'
              }}>
                {item.label}
              </div>
            </Link>
          )
        })}
      </nav>

      {/* Footer con usuario */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid #e5e7eb' }}>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>
            {usuario.nombre}
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2, textTransform: 'capitalize' }}>
            {usuario.rol.replace('_', ' ')}
          </div>
        </div>
        <button
          onClick={() => { logout(); router.push('/login') }}
          style={{
            fontSize: 12, color: '#6b7280', background: 'none',
            border: 'none', cursor: 'pointer', padding: 0,
            textDecoration: 'underline'
          }}
        >
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
