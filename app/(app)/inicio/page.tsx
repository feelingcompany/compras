'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth'

export default function InicioPage() {
  const { usuario } = useAuth()
  const router = useRouter()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [aprobacionesPendientes, setAprobacionesPendientes] = useState<any[]>([])
  const [misSolicitudes, setMisSolicitudes] = useState<any[]>([])
  const [actividadReciente, setActividadReciente] = useState<any[]>([])

  useEffect(() => {
    if (!usuario) {
      router.push('/login')
      return
    }
    cargar()
  }, [usuario])

  const cargar = async () => {
    if (!usuario) return
    
    try {
      // 1. Aprobaciones que requieren mi acción
      if (['encargado', 'admin_compras', 'gerencia'].includes(usuario.rol)) {
        const { data: aprs } = await supabase
          .from('aprobaciones')
          .select('*')
          .eq('aprobador_id', usuario.id)
          .eq('estado', 'pendiente')
          .limit(5)
        
        if (aprs && aprs.length > 0) {
          // Enriquecer con solicitudes
          const solicitudIds = aprs.map(a => a.solicitud_id)
          const { data: sols } = await supabase
            .from('solicitudes')
            .select('*')
            .in('id', solicitudIds)
          
          const solicitanteIds = [...new Set((sols || []).map(s => s.solicitante_id))]
          const { data: usuarios } = await supabase
            .from('usuarios')
            .select('id, nombre')
            .in('id', solicitanteIds)
          
          const { data: items } = await supabase
            .from('items_solicitud')
            .select('*')
            .in('solicitud_id', solicitudIds)
          
          const enriched = aprs.map(apr => {
            const sol = (sols || []).find(s => s.id === apr.solicitud_id)
            const solicitante = (usuarios || []).find(u => u.id === sol?.solicitante_id)
            const solItems = (items || []).filter(i => i.solicitud_id === apr.solicitud_id)
            const monto = solItems.reduce((sum, i) => sum + (parseFloat(i.presupuesto_estimado) || 0), 0)
            return { ...apr, solicitud: sol, solicitante, monto }
          })
          
          setAprobacionesPendientes(enriched)
        }
      }

      // 2. Mis solicitudes (creadas por mí)
      const { data: mias } = await supabase
        .from('solicitudes')
        .select('*')
        .eq('solicitante_id', usuario.id)
        .order('created_at', { ascending: false })
        .limit(5)
      
      if (mias && mias.length > 0) {
        const solicitudIds = mias.map(s => s.id)
        const { data: items } = await supabase
          .from('items_solicitud')
          .select('*')
          .in('solicitud_id', solicitudIds)
        
        const enriched = mias.map(s => {
          const solItems = (items || []).filter(i => i.solicitud_id === s.id)
          const monto = solItems.reduce((sum, i) => sum + (parseFloat(i.presupuesto_estimado) || 0), 0)
          return { ...s, monto, items_count: solItems.length }
        })
        
        setMisSolicitudes(enriched)
      }

      // 3. Actividad reciente del sistema (últimas solicitudes para admin/gerencia)
      if (['admin_compras', 'gerencia'].includes(usuario.rol)) {
        const { data: recientes } = await supabase
          .from('solicitudes')
          .select('*')
          .order('updated_at', { ascending: false, nullsFirst: false })
          .limit(5)
        
        if (recientes) {
          const solicitanteIds = [...new Set(recientes.map(s => s.solicitante_id))]
          const { data: usuarios } = await supabase
            .from('usuarios')
            .select('id, nombre')
            .in('id', solicitanteIds)
          
          const enriched = recientes.map(s => ({
            ...s,
            solicitante: (usuarios || []).find(u => u.id === s.solicitante_id)
          }))
          
          setActividadReciente(enriched)
        }
      }

      setLoading(false)
    } catch (error) {
      console.error('Error:', error)
      setLoading(false)
    }
  }

  const getEstadoBadge = (estado: string) => {
    const config: Record<string, { bg: string; color: string; label: string }> = {
      pendiente: { bg: '#FEF3C7', color: '#92400E', label: 'Pendiente' },
      aprobada:  { bg: '#D1FAE5', color: '#065F46', label: 'Aprobada' },
      rechazada: { bg: '#FEE2E2', color: '#991B1B', label: 'Rechazada' },
      cotizando: { bg: '#DBEAFE', color: '#1E40AF', label: 'Cotizando' },
      completada:{ bg: '#E0E7FF', color: '#3730A3', label: 'Completada' },
    }
    const c = config[estado?.toLowerCase()] || config.pendiente
    return (
      <span style={{
        padding: '3px 8px', borderRadius: 3, fontSize: 10,
        fontWeight: 600, background: c.bg, color: c.color
      }}>
        {c.label}
      </span>
    )
  }

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
        Cargando...
      </div>
    )
  }

  const saludo = (() => {
    const hora = new Date().getHours()
    if (hora < 12) return 'Buenos días'
    if (hora < 19) return 'Buenas tardes'
    return 'Buenas noches'
  })()

  return (
    <div style={{ padding: 32, maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>
          {saludo},
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#111', margin: 0 }}>
          {usuario?.nombre}
        </h1>
      </div>

      {/* Acción rápida */}
      <div style={{ marginBottom: 32 }}>
        <button
          onClick={() => router.push('/solicitudes/nueva')}
          style={{
            padding: '12px 24px', background: '#185FA5', color: '#fff',
            border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          + Nueva solicitud de compra
        </button>
      </div>

      {/* Las 4 fases oficiales del proceso Feeling */}
      <div style={{
        background: '#fff', border: '1px solid #e5e7eb',
        borderRadius: 8, padding: 20, marginBottom: 32
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#111', marginBottom: 4 }}>
          Proceso oficial de compras — Feeling Company
        </div>
        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 16 }}>
          Toda solicitud atraviesa estas 4 fases
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {[
            { num: 1, label: 'Activación y Convocatoria', desc: 'Solicitud → Aprobación → Cotizaciones', path: '/cotizaciones', color: '#DBEAFE', colorText: '#1E40AF' },
            { num: 2, label: 'Formalización', desc: 'Emisión de OF / OS al proveedor', path: '/ordenes', color: '#E0E7FF', colorText: '#3730A3' },
            { num: 3, label: 'Ejecución y Liquidación', desc: 'Ejecución → Radicación → Pago', path: '/radicacion', color: '#FEF3C7', colorText: '#92400E' },
            { num: 4, label: 'Auditoría de Compras y Pago', desc: 'Contraloría y cierre', path: '/contraloria', color: '#F3F4F6', colorText: '#374151' },
          ].map(fase => (
            <div
              key={fase.num}
              onClick={() => ['admin_compras', 'gerencia'].includes(usuario?.rol || '') && router.push(fase.path)}
              style={{
                background: fase.color, padding: 14, borderRadius: 6,
                cursor: ['admin_compras', 'gerencia'].includes(usuario?.rol || '') ? 'pointer' : 'default',
                transition: 'transform 0.15s'
              }}
              onMouseEnter={e => {
                if (['admin_compras', 'gerencia'].includes(usuario?.rol || '')) {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }
              }}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <div style={{
                fontSize: 10, fontWeight: 700, color: fase.colorText,
                letterSpacing: '0.08em', marginBottom: 6
              }}>
                FASE {fase.num}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#111', marginBottom: 4 }}>
                {fase.label}
              </div>
              <div style={{ fontSize: 11, color: '#4b5563', lineHeight: 1.4 }}>
                {fase.desc}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sección 1: Aprobaciones pendientes (si aplica) */}
      {aprobacionesPendientes.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: '#111', margin: 0 }}>
              Requieren tu aprobación
              <span style={{ marginLeft: 8, fontSize: 13, color: '#DC2626', fontWeight: 500 }}>
                ({aprobacionesPendientes.length})
              </span>
            </h2>
            <button
              onClick={() => router.push('/aprobaciones')}
              style={{
                background: 'none', border: 'none', color: '#185FA5',
                fontSize: 13, cursor: 'pointer', textDecoration: 'underline'
              }}
            >
              Ver todas
            </button>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {aprobacionesPendientes.map(apr => (
              <div
                key={apr.id}
                onClick={() => router.push('/aprobaciones')}
                style={{
                  background: '#fff', border: '1px solid #e5e7eb',
                  borderLeft: '3px solid #F59E0B',
                  padding: 14, borderRadius: 4, cursor: 'pointer',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111', marginBottom: 3 }}>
                    {apr.solicitud?.descripcion || 'Solicitud sin descripción'}
                  </div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>
                    Por {apr.solicitante?.nombre || 'Desconocido'} · Nivel {apr.nivel_aprobacion} de aprobación
                  </div>
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#185FA5' }}>
                  ${apr.monto.toLocaleString('es-CO')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sección 2: Mis solicitudes */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: '#111', margin: 0 }}>
            Mis solicitudes recientes
          </h2>
          <button
            onClick={() => router.push('/solicitudes')}
            style={{
              background: 'none', border: 'none', color: '#185FA5',
              fontSize: 13, cursor: 'pointer', textDecoration: 'underline'
            }}
          >
            Ver todas
          </button>
        </div>

        {misSolicitudes.length === 0 ? (
          <div style={{
            background: '#F9FAFB', border: '1px dashed #d1d5db',
            padding: 24, borderRadius: 6, textAlign: 'center',
            fontSize: 13, color: '#6b7280'
          }}>
            No has creado solicitudes todavía
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {misSolicitudes.map(s => (
              <div
                key={s.id}
                onClick={() => router.push('/solicitudes')}
                style={{
                  background: '#fff', border: '1px solid #e5e7eb',
                  padding: 14, borderRadius: 4, cursor: 'pointer',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 3 }}>
                    {getEstadoBadge(s.estado)}
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>
                      {s.descripcion}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>
                    {s.items_count} ítem{s.items_count !== 1 ? 's' : ''} · {s.centro_costo || 'Sin centro'} · 
                    {' '}{new Date(s.created_at).toLocaleDateString('es-CO')}
                  </div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#185FA5' }}>
                  ${s.monto.toLocaleString('es-CO')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sección 3: Actividad reciente (solo admin/gerencia) */}
      {actividadReciente.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: '#111', marginBottom: 12 }}>
            Actividad reciente del sistema
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {actividadReciente.map(s => (
              <div
                key={s.id}
                style={{
                  background: '#fff', border: '1px solid #e5e7eb',
                  padding: 12, borderRadius: 4,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  fontSize: 12
                }}
              >
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {getEstadoBadge(s.estado)}
                  <span style={{ color: '#374151' }}>
                    {s.descripcion}
                  </span>
                  <span style={{ color: '#9ca3af' }}>
                    · {s.solicitante?.nombre}
                  </span>
                </div>
                <span style={{ color: '#6b7280' }}>
                  {new Date(s.updated_at || s.created_at).toLocaleDateString('es-CO')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
