'use client'
import { useAuth } from '@/lib/auth'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'

// Navegación simplificada — principios de diseño:
// 1. Sin emojis (corporativo)
// 2. Máximo 6 items top-level
// 3. Vocabulario unificado (todo "Solicitud", no "OF")
// 4. Agrupación por rol, no por feature

type NavItem = {
  label: string
  path: string
  roles: string[]  // qué roles pueden ver este item
}

const NAV: NavItem[] = [
  // TRABAJO DIARIO — todos los roles
  { label: 'Inicio',         path: '/inicio',       roles: ['solicitante', 'encargado', 'admin_compras', 'gerencia'] },
  { label: 'Solicitudes',    path: '/solicitudes',  roles: ['solicitante', 'encargado', 'admin_compras', 'gerencia'] },
  { label: 'Aprobaciones',   path: '/aprobaciones', roles: ['encargado', 'admin_compras', 'gerencia'] },
  
  // GESTIÓN — compras/gerencia
  { label: 'Proveedores',    path: '/proveedores',  roles: ['encargado', 'admin_compras', 'gerencia'] },
  
  // ANÁLISIS — admin/gerencia
  { label: 'Reportes',       path: '/dashboard',    roles: ['admin_compras', 'gerencia'] },
  
  // CONFIGURACIÓN — solo admin
  { label: 'Configuración',  path: '/admin',        roles: ['admin_compras', 'gerencia'] },
]

export default function Sidebar() {
  const { usuario, logout } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  if (!usuario) return null

  const navFiltrado = NAV.filter(item => item.roles.includes(usuario.rol))

  return (
    <aside style={{
      width: 220, minWidth: 220, background: '#fff',
      borderRight: '1px solid #e5e7eb', display: 'flex',
      flexDirection: 'column', height: '100vh', position: 'fixed', left: 0, top: 0
    }}>
      {/* Header */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>Compras FC</div>
        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>Feeling Company</div>
      </div>

      {/* Navegación */}
      <nav style={{ flex: 1, padding: '12px 0', overflowY: 'auto' }}>
        {navFiltrado.map(item => {
          const active = pathname === item.path || pathname.startsWith(item.path + '/')
          return (
            <Link key={item.path} href={item.path} style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', alignItems: 'center',
                padding: '10px 20px', fontSize: 13,
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
