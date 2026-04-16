'use client'
import { useAuth } from '@/lib/auth'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'

const NAV = [
  { id: 'dashboard', label: 'Dashboard', path: '/dashboard' },
  { id: 'ordenes', label: 'Órdenes (OF)', path: '/ordenes' },
  { id: 'proveedores', label: 'Proveedores', path: '/proveedores' },
  { id: 'pagos', label: 'Pagos', path: '/pagos' },
  { id: 'nueva', label: 'Nueva OF', path: '/nueva-of' },
  { id: 'contraloria', label: 'Contraloría', path: '/contraloria' },
]

export default function Sidebar() {
  const { usuario, logout } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  return (
    <aside style={{
      width: 200, minWidth: 200, background: '#fff',
      borderRight: '0.5px solid #ebebeb', display: 'flex',
      flexDirection: 'column', height: '100vh', position: 'fixed', left: 0, top: 0
    }}>
      <div style={{ padding: '20px 16px 16px', borderBottom: '0.5px solid #ebebeb' }}>
        <div style={{ fontSize: 14, fontWeight: 500 }}>Compras FC</div>
        <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>Feeling Company</div>
      </div>

      <nav style={{ flex: 1, padding: '8px 0' }}>
        {NAV.map(n => {
          const active = pathname === n.path || pathname.startsWith(n.path + '/')
          return (
            <Link key={n.id} href={n.path} style={{ textDecoration: 'none' }}>
              <div style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 16px', fontSize: 13, background: 'transparent',
                color: active ? '#1a1a1a' : '#888', fontWeight: active ? 500 : 400,
                borderLeft: `2px solid ${active ? '#185FA5' : 'transparent'}`,
                cursor: 'pointer', transition: 'all .15s'
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: active ? '#185FA5' : '#ddd', flexShrink: 0, display: 'block'
                }} />
                {n.label}
              </div>
            </Link>
          )
        })}
      </nav>

      <div style={{ padding: '12px 16px', borderTop: '0.5px solid #ebebeb' }}>
        {usuario && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#1a1a1a' }}>{usuario.nombre}</div>
            <div style={{ fontSize: 11, color: '#aaa', marginTop: 1 }}>{usuario.rol}</div>
          </div>
        )}
        <button onClick={handleLogout} style={{
          fontSize: 11, color: '#aaa', background: 'none', border: 'none',
          cursor: 'pointer', padding: 0
        }}>
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
