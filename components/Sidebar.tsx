'use client'
import { useAuth } from '@/lib/auth'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { usePermissions, Modulo } from '@/lib/permissions'

const NAV = [
  { id: 'dashboard',    label: 'Dashboard',          path: '/dashboard',     modulo: 'dashboard' as Modulo },
  { id: 'alertas',      label: '⚡ Alertas',          path: '/alertas',       modulo: 'alertas' as Modulo },
  { id: 'score',        label: '★ Score equipo',      path: '/score',         modulo: 'score' as Modulo },
  { id: 'sep1',         label: '— PROCESO',          path: '', sep: true },
  { id: 'solicitudes',  label: '1. Solicitudes',      path: '/solicitudes',   modulo: 'solicitudes' as Modulo },
  { id: 'nueva',        label: '3. Nueva OF',         path: '/nueva-of',      modulo: 'nueva-of' as Modulo },
  { id: 'cotizaciones', label: '↳ Cotizaciones',      path: '/cotizaciones',  modulo: 'cotizaciones' as Modulo },
  { id: 'auditoria',    label: '4. Auditoría',        path: '/auditoria',     modulo: 'auditoria' as Modulo },
  { id: 'radicacion',   label: '8. Radicación',       path: '/radicacion',    modulo: 'radicacion' as Modulo },
  { id: 'pagos',        label: '9. Pagos',            path: '/pagos',         modulo: 'pagos' as Modulo },
  { id: 'sep2',         label: '— GESTIÓN',          path: '', sep: true },
  { id: 'ordenes',      label: 'Órdenes (OF)',        path: '/ordenes',       modulo: 'ordenes' as Modulo },
  { id: 'proveedores',  label: 'Proveedores',         path: '/proveedores',   modulo: 'proveedores' as Modulo },
  { id: 'evaluacion',   label: 'Eval. Proveedores',   path: '/evaluacion',    modulo: 'evaluacion' as Modulo },
  { id: 'contraloria',  label: 'Contraloría',         path: '/contraloria',   modulo: 'contraloria' as Modulo },
  { id: 'sep3',         label: '— SISTEMA',          path: '', sep: true },
  { id: 'admin',        label: '⚙️ Administración',   path: '/admin',         modulo: 'admin' as Modulo },
]

export default function Sidebar() {
  const { usuario, logout } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  // Obtener permisos del usuario actual
  const permisos = usuario ? usePermissions(usuario.rol, usuario.id) : null

  // Filtrar navegación según permisos
  const navFiltrado = NAV.filter(item => {
    // Siempre mostrar separadores
    if ((item as any).sep) return true
    
    // Si no hay permisos, no mostrar nada (loading state)
    if (!permisos || !item.modulo) return false
    
    // Verificar si tiene acceso al módulo
    return permisos.puedeAcceder(item.modulo)
  })

  // Filtrar separadores huérfanos (sin items después)
  const navLimpio = navFiltrado.filter((item, idx) => {
    if (!(item as any).sep) return true
    // Si es separador, verificar que el siguiente item no sea separador
    const siguiente = navFiltrado[idx + 1]
    return siguiente && !(siguiente as any).sep
  })

  return (
    <aside style={{
      width: 210, minWidth: 210, background: '#fff',
      borderRight: '0.5px solid #ebebeb', display: 'flex',
      flexDirection: 'column', height: '100vh', position: 'fixed', left: 0, top: 0
    }}>
      <div style={{ padding: '18px 16px 14px', borderBottom: '0.5px solid #ebebeb' }}>
        <div style={{ fontSize: 14, fontWeight: 500 }}>Compras FC</div>
        <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>Feeling Company</div>
      </div>
      <nav style={{ flex: 1, padding: '6px 0', overflowY: 'auto' }}>
        {navLimpio.map(n => {
          if ((n as any).sep) return (
            <div key={n.id} style={{ padding: '10px 16px 4px', fontSize: 10, fontWeight: 700, color: '#ccc', letterSpacing: '.06em' }}>{n.label}</div>
          )
          const active = pathname === n.path
          return (
            <Link key={n.id} href={n.path} style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 16px', fontSize: 13,
                color: active ? '#1a1a1a' : '#888', fontWeight: active ? 500 : 400,
                borderLeft: `2px solid ${active ? '#185FA5' : 'transparent'}`,
                background: active ? '#fafafa' : 'transparent',
                cursor: 'pointer', transition: 'all .12s'
              }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: active ? '#185FA5' : '#e0e0e0', flexShrink: 0 }} />
                {n.label}
              </div>
            </Link>
          )
        })}
      </nav>
      <div style={{ padding: '12px 16px', borderTop: '0.5px solid #ebebeb' }}>
        {usuario && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 500 }}>{usuario.nombre}</div>
            <div style={{ fontSize: 11, color: '#aaa', marginTop: 1 }}>{usuario.rol}</div>
          </div>
        )}
        <button onClick={() => { logout(); router.push('/login') }} style={{ fontSize: 11, color: '#bbb', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
