'use client'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useAuth } from '@/lib/auth'

// ============================================================
// CENTRO DE MIGRACIÓN
// Para adoptar rápido el nuevo sistema sin parar el trabajo
// actual que viene de Google Sheets / Forms
// ============================================================

export default function MigracionPage() {
  const { usuario } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!usuario) {
      router.push('/login')
      return
    }
    if (!['admin_compras', 'gerencia'].includes(usuario.rol)) {
      router.push('/')
    }
  }, [usuario])

  const opciones = [
    {
      titulo: 'Entrada rápida individual',
      descripcion: 'Cargar UNA solicitud con su estado actual (pendiente, aprobada, ordenada, pagada). Ideal para procesos que ya están avanzados.',
      cuando: 'Usála cuando tengas pocos casos sueltos o quieras aprender el sistema.',
      path: '/migracion/rapida',
      color: '#185FA5',
      icono: '1',
      tiempo: '~2 min por solicitud'
    },
    {
      titulo: 'Importación masiva por pegado',
      descripcion: 'Copiar/pegar datos directamente desde Google Sheets. El sistema parsea, muestra preview y te deja corregir antes de importar.',
      cuando: 'Usála para migrar muchas solicitudes de una sola vez desde tu hoja de cálculo.',
      path: '/migracion/masiva',
      color: '#10B981',
      icono: '2',
      tiempo: '~5 min para 50 solicitudes'
    },
    {
      titulo: 'Guía para tu equipo',
      descripcion: 'Instrucciones paso a paso para que cada rol (solicitantes, encargados) se adapte al nuevo flujo sin fricciones.',
      cuando: 'Compartila con tu equipo en el primer día de transición.',
      path: '/migracion/guia',
      color: '#F59E0B',
      icono: '3',
      tiempo: 'Consulta rápida'
    }
  ]

  return (
    <div style={{ padding: 32, maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Centro de migración
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#111', margin: 0, marginBottom: 6 }}>
          Migrar desde Google Sheets sin parar el trabajo
        </h1>
        <div style={{ fontSize: 13, color: '#6b7280' }}>
          Herramientas para adoptar Compras FC de forma progresiva
        </div>
      </div>

      {/* Estrategia */}
      <div style={{
        background: '#EFF6FF', border: '1px solid #BFDBFE',
        borderRadius: 8, padding: 18, marginTop: 20, marginBottom: 28
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1E40AF', marginBottom: 8 }}>
          Estrategia recomendada: "Transición en paralelo"
        </div>
        <ol style={{ fontSize: 12, color: '#1E40AF', lineHeight: 1.7, margin: 0, paddingLeft: 20 }}>
          <li><strong>Hoy:</strong> Todo lo NUEVO arranca en Compras FC. Todo lo que ya está en curso, sigue en Sheets.</li>
          <li><strong>Esta semana:</strong> Usá la importación masiva para cargar las solicitudes en curso con su estado actual.</li>
          <li><strong>Próxima semana:</strong> Completá el flujo de las solicitudes importadas dentro de Compras FC.</li>
          <li><strong>Mes 2:</strong> Google Sheets queda como archivo histórico. Todo el proceso vive en Compras FC.</li>
        </ol>
      </div>

      {/* 3 opciones */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {opciones.map(op => (
          <div
            key={op.path}
            onClick={() => router.push(op.path)}
            style={{
              background: '#fff', border: '1px solid #e5e7eb',
              borderRadius: 8, padding: 20, cursor: 'pointer',
              transition: 'all 0.15s',
              borderTop: `3px solid ${op.color}`
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: op.color, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 15, fontWeight: 700, marginBottom: 14
            }}>
              {op.icono}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 8 }}>
              {op.titulo}
            </div>
            <div style={{ fontSize: 12, color: '#4b5563', lineHeight: 1.5, marginBottom: 12 }}>
              {op.descripcion}
            </div>
            <div style={{ fontSize: 11, color: '#6b7280', fontStyle: 'italic', marginBottom: 14 }}>
              {op.cuando}
            </div>
            <div style={{
              paddingTop: 12, borderTop: '1px solid #f3f4f6',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <span style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {op.tiempo}
              </span>
              <span style={{ fontSize: 12, color: op.color, fontWeight: 600 }}>
                Empezar →
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
