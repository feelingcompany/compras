'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth'

// ============================================================
// ÓRDENES DE SERVICIO
// Sección operativa con acciones reales
// ============================================================

export default function OrdenesServicioPage() {
  const { usuario } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [oss, setOss] = useState<any[]>([])
  const [solicitudesAprobadas, setSolicitudesAprobadas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'emitir' | 'pendientes' | 'en_ejecucion' | 'ejecutadas' | 'todas'>('emitir')
  const [busqueda, setBusqueda] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!usuario) {
      router.push('/login')
      return
    }
    if (!['encargado', 'admin_compras', 'gerencia'].includes(usuario.rol)) {
      router.push('/')
      return
    }
    cargar()
  }, [usuario])

  const cargar = async () => {
    setError(null)
    try {
      // 1. OSs existentes
      const { data: ossData, error: errOs } = await supabase
        .from('ordenes_servicio')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)

      if (errOs) {
        setError(errOs.message)
      }

      let ossEnriched: any[] = []
      if (ossData && ossData.length > 0) {
        const provIds = [...new Set(ossData.map((o: any) => o.proveedor_id).filter(Boolean))]
        const solIds = [...new Set(ossData.map((o: any) => o.solicitud_id).filter(Boolean))]

        const [provs, sols] = await Promise.all([
          provIds.length > 0
            ? supabase.from('proveedores').select('id, razon_social, codigo').in('id', provIds)
            : Promise.resolve({ data: [] }),
          solIds.length > 0
            ? supabase.from('solicitudes').select('id, descripcion, centro_costo').in('id', solIds)
            : Promise.resolve({ data: [] })
        ])

        ossEnriched = ossData.map((o: any) => ({
          ...o,
          proveedor: (provs.data || []).find((p: any) => p.id === o.proveedor_id),
          solicitud: (sols.data || []).find((s: any) => s.id === o.solicitud_id)
        }))
      }
      setOss(ossEnriched)

      // 2. Solicitudes aprobadas listas para OS
      const { data: aprobs } = await supabase
        .from('solicitudes')
        .select('*')
        .in('estado', ['aprobada', 'cotizando'])
        .order('created_at', { ascending: false })

      if (aprobs && aprobs.length > 0) {
        const sIds = aprobs.map((s: any) => s.id)
        const solicitanteIds = [...new Set(aprobs.map((s: any) => s.solicitante_id))]

        const [items, users] = await Promise.all([
          supabase.from('items_solicitud').select('*').in('solicitud_id', sIds),
          supabase.from('usuarios').select('id, nombre').in('id', solicitanteIds)
        ])

        const enriched = aprobs.map((s: any) => {
          const its = (items.data || []).filter((i: any) => i.solicitud_id === s.id)
          const monto = its.reduce((sum: number, i: any) => sum + (parseFloat(i.presupuesto_estimado) || 0), 0)
          return {
            ...s,
            monto,
            items_count: its.length,
            solicitante: (users.data || []).find((u: any) => u.id === s.solicitante_id)
          }
        })
        setSolicitudesAprobadas(enriched)
      } else {
        setSolicitudesAprobadas([])
      }

      setLoading(false)
    } catch (err: any) {
      console.error(err)
      setError(err.message)
      setLoading(false)
    }
  }

  const accionRapida = async (osId: string, nuevoEstado: string, confirmacion: string) => {
    if (!confirm(confirmacion)) return
    await supabase
      .from('ordenes_servicio')
      .update({ estado: nuevoEstado })
      .eq('id', osId)
    cargar()
  }

  const estadoConfig: Record<string, { bg: string; color: string; label: string }> = {
    pendiente:    { bg: '#FEF3C7', color: '#92400E', label: 'Pendiente' },
    aprobada:     { bg: '#DBEAFE', color: '#1E40AF', label: 'Aprobada' },
    en_ejecucion: { bg: '#E0E7FF', color: '#3730A3', label: 'En ejecución' },
    ejecutada:    { bg: '#D1FAE5', color: '#065F46', label: 'Ejecutada' },
    validada:     { bg: '#D1FAE5', color: '#065F46', label: 'Validada' },
    rechazada:    { bg: '#FEE2E2', color: '#991B1B', label: 'Rechazada' },
    cancelada:    { bg: '#F3F4F6', color: '#374151', label: 'Cancelada' },
  }

  const ossFiltradas = oss
    .filter(o => {
      if (tab === 'todas') return true
      if (tab === 'pendientes') return o.estado === 'pendiente' || o.estado === 'aprobada'
      if (tab === 'en_ejecucion') return o.estado === 'en_ejecucion'
      if (tab === 'ejecutadas') return o.estado === 'ejecutada' || o.estado === 'validada'
      return true
    })
    .filter(o => {
      if (!busqueda) return true
      const q = busqueda.toLowerCase()
      return (
        o.numero_os?.toLowerCase().includes(q) ||
        o.descripcion?.toLowerCase().includes(q) ||
        o.proveedor?.razon_social?.toLowerCase().includes(q)
      )
    })

  const stats = {
    total: oss.length,
    porEmitir: solicitudesAprobadas.length,
    pendientes: oss.filter(o => o.estado === 'pendiente' || o.estado === 'aprobada').length,
    enEjecucion: oss.filter(o => o.estado === 'en_ejecucion').length,
    ejecutadas: oss.filter(o => o.estado === 'ejecutada' || o.estado === 'validada').length,
  }

  const esAdmin = ['admin_compras', 'gerencia'].includes(usuario?.rol || '')

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Cargando...</div>
  }

  return (
    <div style={{ padding: 32, maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Etapa 3 del proceso
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111', margin: 0, marginBottom: 4 }}>
            Órdenes de Servicio
          </h1>
          <div style={{ fontSize: 13, color: '#6b7280' }}>
            Contratar proveedores para servicios profesionales, artísticos o especializados
          </div>
        </div>
      </div>

      {error && (
        <div style={{
          background: '#FEE2E2', border: '1px solid #FCA5A5',
          borderRadius: 6, padding: 12, marginBottom: 16,
          fontSize: 12, color: '#991B1B'
        }}>
          <strong>Problema al cargar:</strong> {error}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 20 }}>
        <StatCard label="Por emitir" valor={stats.porEmitir} color="#DC2626" subtitulo="Solicitudes aprobadas" />
        <StatCard label="Pendientes" valor={stats.pendientes} color="#F59E0B" subtitulo="OS pendientes" />
        <StatCard label="En ejecución" valor={stats.enEjecucion} color="#185FA5" subtitulo="Con proveedor" />
        <StatCard label="Ejecutadas" valor={stats.ejecutadas} color="#10B981" subtitulo="Completadas" />
        <StatCard label="Total OS" valor={stats.total} color="#3730A3" subtitulo="Histórico" />
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 2, marginBottom: 20,
        borderBottom: '1px solid #e5e7eb'
      }}>
        <Tab activo={tab === 'emitir'} onClick={() => setTab('emitir')} count={solicitudesAprobadas.length} color="#DC2626">
          Por emitir
        </Tab>
        <Tab activo={tab === 'pendientes'} onClick={() => setTab('pendientes')} count={stats.pendientes} color="#F59E0B">
          Pendientes
        </Tab>
        <Tab activo={tab === 'en_ejecucion'} onClick={() => setTab('en_ejecucion')} count={stats.enEjecucion} color="#185FA5">
          En ejecución
        </Tab>
        <Tab activo={tab === 'ejecutadas'} onClick={() => setTab('ejecutadas')} count={stats.ejecutadas}>
          Ejecutadas
        </Tab>
        <Tab activo={tab === 'todas'} onClick={() => setTab('todas')} count={oss.length}>
          Todas
        </Tab>
      </div>

      {/* TAB: EMITIR OS - solicitudes listas */}
      {tab === 'emitir' && (
        <>
          <div style={{
            background: '#EFF6FF', border: '1px solid #BFDBFE',
            borderRadius: 6, padding: 14, marginBottom: 16,
            fontSize: 12, color: '#1E40AF', lineHeight: 1.5
          }}>
            <strong>Paso 3 del proceso:</strong> Estas solicitudes aprobadas son candidatas para emitir una OS
            (contratación de servicios). Elegí el proveedor ganador y emití la orden.
          </div>

          {solicitudesAprobadas.length === 0 ? (
            <EmptyState
              titulo="No hay solicitudes aprobadas esperando OS"
              subtitulo="Cuando se apruebe una solicitud de servicio, aparecerá acá."
            />
          ) : (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden' }}>
              {solicitudesAprobadas.map(s => (
                <div key={s.id} style={{
                  padding: 16, borderBottom: '1px solid #f3f4f6',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#111', marginBottom: 3 }}>
                      {s.descripcion}
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>
                      Por <strong>{s.solicitante?.nombre}</strong> · 
                      {' '}{s.items_count} ítem{s.items_count !== 1 ? 's' : ''} · 
                      {' '}{s.centro_costo || '—'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', marginRight: 16 }}>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>Presupuesto</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#185FA5' }}>
                      ${s.monto.toLocaleString('es-CO')}
                    </div>
                  </div>
                  {esAdmin && (
                    <button
                      onClick={() => router.push(`/solicitudes/${s.id}/crear-orden`)}
                      style={btnPrimary}
                    >
                      Emitir OS →
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* TABS DE LISTADO */}
      {tab !== 'emitir' && (
        <>
          <div style={{ marginBottom: 14 }}>
            <input
              type="text"
              placeholder="Buscar número OS, descripción, proveedor..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              style={{
                width: '100%', padding: '9px 14px',
                border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13, outline: 'none'
              }}
            />
          </div>

          {ossFiltradas.length === 0 ? (
            <EmptyState
              titulo={oss.length === 0 ? 'No hay OSs creadas' : 'No hay OSs en esta vista'}
              subtitulo={oss.length === 0 ? 'Las OSs se crean desde solicitudes aprobadas.' : ''}
            />
          ) : (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '130px 2fr 1.3fr 110px 120px 100px 260px',
                padding: '10px 16px', background: '#F9FAFB',
                borderBottom: '1px solid #e5e7eb',
                fontSize: 11, fontWeight: 600, color: '#6b7280',
                textTransform: 'uppercase', letterSpacing: '0.04em'
              }}>
                <div>N° OS</div>
                <div>Descripción</div>
                <div>Proveedor</div>
                <div style={{ textAlign: 'right' }}>Valor</div>
                <div>Estado</div>
                <div>Fecha</div>
                <div style={{ textAlign: 'right' }}>Acciones</div>
              </div>

              {ossFiltradas.map(os => {
                const c = estadoConfig[os.estado] || estadoConfig.pendiente
                return (
                  <div key={os.id} style={{
                    display: 'grid',
                    gridTemplateColumns: '130px 2fr 1.3fr 110px 120px 100px 260px',
                    padding: '12px 16px', borderBottom: '1px solid #f3f4f6',
                    fontSize: 12, alignItems: 'center'
                  }}>
                    <div style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: '#185FA5' }}>
                      {os.numero_os || `OS-${os.id?.slice(0, 6)}`}
                    </div>
                    <div>
                      <div style={{ fontWeight: 500, color: '#111', marginBottom: 2 }}>
                        {os.descripcion || '(sin descripción)'}
                      </div>
                      {os.solicitud && (
                        <div style={{ fontSize: 10, color: '#9ca3af' }}>
                          De solicitud: {os.solicitud.descripcion?.slice(0, 40)}
                        </div>
                      )}
                    </div>
                    <div style={{ color: '#374151', fontSize: 11 }}>
                      {os.proveedor?.razon_social || '—'}
                    </div>
                    <div style={{ textAlign: 'right', fontWeight: 600, color: '#185FA5' }}>
                      ${(parseFloat(os.valor_total) || 0).toLocaleString('es-CO')}
                    </div>
                    <div>
                      <span style={{ padding: '3px 8px', borderRadius: 3, fontSize: 10, fontWeight: 600, background: c.bg, color: c.color }}>
                        {c.label}
                      </span>
                    </div>
                    <div style={{ color: '#6b7280', fontSize: 11 }}>
                      {os.fecha_emision
                        ? new Date(os.fecha_emision).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
                        : '—'}
                    </div>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      {esAdmin && os.estado === 'pendiente' && (
                        <button
                          onClick={() => accionRapida(os.id, 'aprobada', '¿Aprobar esta OS?')}
                          style={btnMiniSuccess}
                        >
                          Aprobar
                        </button>
                      )}
                      {esAdmin && os.estado === 'aprobada' && (
                        <button
                          onClick={() => accionRapida(os.id, 'en_ejecucion', '¿Marcar como en ejecución?')}
                          style={btnMiniPrimary}
                        >
                          Iniciar
                        </button>
                      )}
                      {esAdmin && os.estado === 'en_ejecucion' && (
                        <button
                          onClick={() => accionRapida(os.id, 'ejecutada', '¿Marcar como ejecutada?')}
                          style={btnMiniSuccess}
                        >
                          Ejecutada
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}

const btnPrimary: React.CSSProperties = {
  padding: '10px 20px', background: '#185FA5', color: '#fff',
  border: 'none', borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: 'pointer',
  whiteSpace: 'nowrap'
}
const btnMiniPrimary: React.CSSProperties = {
  padding: '5px 10px', background: '#185FA5', color: '#fff',
  border: 'none', borderRadius: 3, fontSize: 11, fontWeight: 600, cursor: 'pointer'
}
const btnMiniSuccess: React.CSSProperties = {
  padding: '5px 10px', background: '#10B981', color: '#fff',
  border: 'none', borderRadius: 3, fontSize: 11, fontWeight: 600, cursor: 'pointer'
}

function StatCard({ label, valor, color, subtitulo }: any) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', padding: 12, borderRadius: 6 }}>
      <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color }}>{valor}</div>
      {subtitulo && <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{subtitulo}</div>}
    </div>
  )
}

function Tab({ activo, onClick, count, color, children }: any) {
  return (
    <button onClick={onClick} style={{
      padding: '10px 16px', background: 'none',
      border: 'none', borderBottom: `2px solid ${activo ? '#185FA5' : 'transparent'}`,
      color: activo ? '#185FA5' : '#6b7280',
      fontSize: 13, fontWeight: activo ? 600 : 500,
      cursor: 'pointer', marginBottom: -1,
      display: 'flex', alignItems: 'center', gap: 6
    }}>
      {children}
      {count > 0 && (
        <span style={{
          padding: '1px 7px', background: color || '#9ca3af', color: '#fff',
          fontSize: 10, fontWeight: 700, borderRadius: 10
        }}>
          {count}
        </span>
      )}
    </button>
  )
}

function EmptyState({ titulo, subtitulo }: any) {
  return (
    <div style={{
      background: '#F9FAFB', border: '1px dashed #d1d5db',
      padding: 40, borderRadius: 6, textAlign: 'center'
    }}>
      <div style={{ fontSize: 14, fontWeight: 500, color: '#6b7280', marginBottom: 6 }}>{titulo}</div>
      {subtitulo && <div style={{ fontSize: 12, color: '#9ca3af' }}>{subtitulo}</div>}
    </div>
  )
}
