'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth'

// ============================================================
// CONTROL Y ALERTAS
// 
// Módulo unificado que reemplaza Contraloría + Auditoría + Alertas.
// Propósito: dar al líder de compras visibilidad inmediata
// sobre todo lo que está "fuera de cauce" en el proceso.
//
// Secciones:
// 1. Alertas activas - cosas que requieren acción
// 2. Revisión de cumplimiento - desviaciones de presupuesto, SLA, etc.
// 3. Auditoría de transacciones - log de todo lo que pasó
// ============================================================

type Alerta = {
  tipo: 'critica' | 'advertencia' | 'info'
  categoria: string
  titulo: string
  descripcion: string
  afecta_a: { tipo: 'solicitud' | 'of' | 'os' | 'proveedor'; id: string; nombre: string }
  fecha: string
}

export default function ControlPage() {
  const { usuario } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [tab, setTab] = useState<'alertas' | 'cumplimiento' | 'auditoria'>('alertas')
  const [loading, setLoading] = useState(true)
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [cumplimiento, setCumplimiento] = useState<any>({})
  const [auditoria, setAuditoria] = useState<any[]>([])

  useEffect(() => {
    if (!usuario) {
      router.push('/login')
      return
    }
    if (!['admin_compras', 'gerencia'].includes(usuario.rol)) {
      router.push('/')
      return
    }
    cargar()
  }, [usuario])

  const cargar = async () => {
    try {
      const alertasGeneradas: Alerta[] = []

      // === ANÁLISIS PARA GENERAR ALERTAS ===

      // 1. Solicitudes pendientes hace más de 3 días
      const tresDiasAtras = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
      const { data: pendientesViejas } = await supabase
        .from('solicitudes')
        .select('id, descripcion, created_at')
        .eq('estado', 'pendiente')
        .lt('created_at', tresDiasAtras)

      if (pendientesViejas) {
        pendientesViejas.forEach(s => {
          const dias = Math.floor((Date.now() - new Date(s.created_at).getTime()) / (1000 * 60 * 60 * 24))
          alertasGeneradas.push({
            tipo: dias > 7 ? 'critica' : 'advertencia',
            categoria: 'Solicitudes estancadas',
            titulo: `Solicitud sin aprobar hace ${dias} días`,
            descripcion: `"${s.descripcion?.slice(0, 60)}" lleva ${dias} días pendiente. Contactá al aprobador.`,
            afecta_a: { tipo: 'solicitud', id: s.id, nombre: s.descripcion },
            fecha: s.created_at
          })
        })
      }

      // 2. Solicitudes aprobadas sin OF emitida hace más de 5 días
      const cincoDiasAtras = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
      const { data: aprobadasVacias } = await supabase
        .from('solicitudes')
        .select('id, descripcion, updated_at, created_at')
        .eq('estado', 'aprobada')
        .lt('updated_at', cincoDiasAtras)

      if (aprobadasVacias) {
        aprobadasVacias.forEach(s => {
          const dias = Math.floor((Date.now() - new Date(s.updated_at || s.created_at).getTime()) / (1000 * 60 * 60 * 24))
          alertasGeneradas.push({
            tipo: 'advertencia',
            categoria: 'Cuello de botella',
            titulo: 'Solicitud aprobada sin emitir OF',
            descripcion: `"${s.descripcion?.slice(0, 60)}" aprobada hace ${dias} días, falta OF/OS.`,
            afecta_a: { tipo: 'solicitud', id: s.id, nombre: s.descripcion },
            fecha: s.updated_at || s.created_at
          })
        })
      }

      // 3. OFs aprobadas sin pagar hace más de 30 días
      try {
        const treintaDiasAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        const { data: ofsSinPagar } = await supabase
          .from('ordenes_facturacion')
          .select('id, codigo_of, valor_total, descripcion, created_at, proveedor_id')
          .eq('estado_verificacion', 'APROBADA')
          .not('estado_pago', 'in', '(PAGADO,PAGADA)')
          .lt('created_at', treintaDiasAtras)

        if (ofsSinPagar && ofsSinPagar.length > 0) {
          const provIds = [...new Set(ofsSinPagar.map(o => o.proveedor_id).filter(Boolean))]
          const { data: provs } = await supabase.from('proveedores').select('id, razon_social').in('id', provIds)

          ofsSinPagar.forEach(of => {
            const dias = Math.floor((Date.now() - new Date(of.created_at).getTime()) / (1000 * 60 * 60 * 24))
            const prov = provs?.find(p => p.id === of.proveedor_id)
            alertasGeneradas.push({
              tipo: dias > 60 ? 'critica' : 'advertencia',
              categoria: 'Pagos vencidos',
              titulo: `OF sin pagar hace ${dias} días`,
              descripcion: `${of.codigo_of} a ${prov?.razon_social || 'proveedor'} por $${(of.valor_total || 0).toLocaleString('es-CO')}`,
              afecta_a: { tipo: 'of', id: of.id, nombre: of.codigo_of },
              fecha: of.created_at
            })
          })
        }
      } catch (e) {}

      setAlertas(alertasGeneradas.sort((a, b) => {
        const prio = { critica: 0, advertencia: 1, info: 2 }
        return prio[a.tipo] - prio[b.tipo]
      }))

      // === CUMPLIMIENTO ===
      const [
        { count: totalSolicitudes },
        { count: conAprobacion },
        { count: rechazadas },
        { count: totalOfs },
        { count: ofsAprobadas },
        { count: ofsPagadas }
      ] = await Promise.all([
        supabase.from('solicitudes').select('*', { count: 'exact', head: true }),
        supabase.from('solicitudes').select('*', { count: 'exact', head: true }).in('estado', ['aprobada', 'cotizando', 'ordenada', 'completada']),
        supabase.from('solicitudes').select('*', { count: 'exact', head: true }).eq('estado', 'rechazada'),
        supabase.from('ordenes_facturacion').select('*', { count: 'exact', head: true }),
        supabase.from('ordenes_facturacion').select('*', { count: 'exact', head: true }).eq('estado_verificacion', 'APROBADA'),
        supabase.from('ordenes_facturacion').select('*', { count: 'exact', head: true }).in('estado_pago', ['PAGADO', 'PAGADA'])
      ])

      setCumplimiento({
        solicitudes: {
          total: totalSolicitudes || 0,
          aprobadas: conAprobacion || 0,
          rechazadas: rechazadas || 0,
          tasaAprobacion: totalSolicitudes ? Math.round(((conAprobacion || 0) / totalSolicitudes) * 100) : 0
        },
        ofs: {
          total: totalOfs || 0,
          aprobadas: ofsAprobadas || 0,
          pagadas: ofsPagadas || 0,
          tasaEjecucion: totalOfs ? Math.round(((ofsPagadas || 0) / totalOfs) * 100) : 0
        }
      })

      // === AUDITORÍA: últimas acciones ===
      const { data: ultimasSols } = await supabase
        .from('solicitudes')
        .select('id, descripcion, estado, updated_at, created_at, solicitante_id')
        .order('updated_at', { ascending: false, nullsFirst: false })
        .limit(20)

      if (ultimasSols && ultimasSols.length > 0) {
        const userIds = [...new Set(ultimasSols.map(s => s.solicitante_id).filter(Boolean))]
        const { data: users } = await supabase.from('usuarios').select('id, nombre').in('id', userIds)
        
        const log = ultimasSols.map(s => ({
          ...s,
          solicitante: users?.find(u => u.id === s.solicitante_id)
        }))
        setAuditoria(log)
      }

      setLoading(false)
    } catch (err) {
      console.error(err)
      setLoading(false)
    }
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Analizando...</div>
  }

  const criticas = alertas.filter(a => a.tipo === 'critica').length
  const advertencias = alertas.filter(a => a.tipo === 'advertencia').length

  return (
    <div style={{ padding: 32, maxWidth: 1300, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111', margin: 0, marginBottom: 4 }}>
          Control y Alertas
        </h1>
        <div style={{ fontSize: 13, color: '#6b7280' }}>
          Detección de desviaciones, cumplimiento del proceso y auditoría de transacciones
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        <KPI label="Alertas críticas" valor={criticas} color="#DC2626" descripcion="Requieren acción inmediata" />
        <KPI label="Advertencias" valor={advertencias} color="#F59E0B" descripcion="Monitorear" />
        <KPI label="Tasa aprobación" valor={`${cumplimiento.solicitudes?.tasaAprobacion || 0}%`} color="#10B981" descripcion="Solicitudes aceptadas" />
        <KPI label="Tasa ejecución OF" valor={`${cumplimiento.ofs?.tasaEjecucion || 0}%`} color="#185FA5" descripcion="OFs emitidas y pagadas" />
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 2, marginBottom: 20,
        borderBottom: '1px solid #e5e7eb'
      }}>
        <Tab activo={tab === 'alertas'} onClick={() => setTab('alertas')} count={alertas.length} color="#DC2626">
          Alertas activas
        </Tab>
        <Tab activo={tab === 'cumplimiento'} onClick={() => setTab('cumplimiento')}>
          Cumplimiento
        </Tab>
        <Tab activo={tab === 'auditoria'} onClick={() => setTab('auditoria')}>
          Auditoría de transacciones
        </Tab>
      </div>

      {/* TAB: ALERTAS */}
      {tab === 'alertas' && (
        <>
          <div style={{
            background: '#EFF6FF', border: '1px solid #BFDBFE',
            borderRadius: 6, padding: 14, marginBottom: 16,
            fontSize: 12, color: '#1E40AF', lineHeight: 1.5
          }}>
            <strong>¿Qué mirar acá?</strong> Eventos que indican que algo se está desviando del flujo normal:
            solicitudes estancadas, pagos vencidos, OFs sin ejecutar, etc. Si hay alertas críticas, tratarlas
            antes que nada.
          </div>

          {alertas.length === 0 ? (
            <EmptyState
              titulo="Todo bajo control"
              subtitulo="No hay desviaciones en el proceso. El sistema re-analiza cada vez que cargás esta página."
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {alertas.map((a, idx) => (
                <div key={idx} style={{
                  background: a.tipo === 'critica' ? '#FEF2F2' : a.tipo === 'advertencia' ? '#FFFBEB' : '#EFF6FF',
                  border: `1px solid ${a.tipo === 'critica' ? '#FCA5A5' : a.tipo === 'advertencia' ? '#FDE68A' : '#BFDBFE'}`,
                  borderLeft: `4px solid ${a.tipo === 'critica' ? '#DC2626' : a.tipo === 'advertencia' ? '#F59E0B' : '#185FA5'}`,
                  borderRadius: 6, padding: 16,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4
                    }}>
                      <span style={{
                        padding: '2px 8px',
                        background: a.tipo === 'critica' ? '#DC2626' : a.tipo === 'advertencia' ? '#F59E0B' : '#185FA5',
                        color: '#fff', fontSize: 10, fontWeight: 700,
                        borderRadius: 3, textTransform: 'uppercase'
                      }}>
                        {a.tipo}
                      </span>
                      <span style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                        {a.categoria}
                      </span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#111', marginBottom: 4 }}>
                      {a.titulo}
                    </div>
                    <div style={{ fontSize: 12, color: '#4b5563' }}>
                      {a.descripcion}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (a.afecta_a.tipo === 'solicitud') router.push(`/solicitudes/${a.afecta_a.id}`)
                      else if (a.afecta_a.tipo === 'of') router.push(`/ordenes/${a.afecta_a.id}`)
                    }}
                    style={{
                      padding: '6px 14px', background: '#fff', color: '#374151',
                      border: '1px solid #d1d5db', borderRadius: 4,
                      fontSize: 12, cursor: 'pointer', fontWeight: 500,
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Ver →
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* TAB: CUMPLIMIENTO */}
      {tab === 'cumplimiento' && (
        <>
          <div style={{
            background: '#EFF6FF', border: '1px solid #BFDBFE',
            borderRadius: 6, padding: 14, marginBottom: 16,
            fontSize: 12, color: '#1E40AF', lineHeight: 1.5
          }}>
            <strong>Cumplimiento del proceso:</strong> Indicadores clave de cómo está fluyendo el proceso de compras.
            Bajas tasas de aprobación pueden indicar solicitudes mal hechas; bajas tasas de ejecución
            indican cuellos de botella entre emitir OF y pagar.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Solicitudes */}
            <Card titulo="Solicitudes">
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>Total procesadas</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#111' }}>
                  {cumplimiento.solicitudes?.total || 0}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>Aprobadas</div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: '#10B981' }}>
                    {cumplimiento.solicitudes?.aprobadas || 0}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>Rechazadas</div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: '#DC2626' }}>
                    {cumplimiento.solicitudes?.rechazadas || 0}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #f3f4f6' }}>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>Tasa de aprobación</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    flex: 1, height: 8, background: '#e5e7eb',
                    borderRadius: 4, overflow: 'hidden'
                  }}>
                    <div style={{
                      height: '100%', background: '#10B981',
                      width: `${cumplimiento.solicitudes?.tasaAprobacion || 0}%`,
                      transition: 'width 0.3s'
                    }} />
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#10B981' }}>
                    {cumplimiento.solicitudes?.tasaAprobacion || 0}%
                  </div>
                </div>
              </div>
            </Card>

            {/* OFs */}
            <Card titulo="Órdenes de Facturación">
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>Total emitidas</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#111' }}>
                  {cumplimiento.ofs?.total || 0}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>Aprobadas</div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: '#185FA5' }}>
                    {cumplimiento.ofs?.aprobadas || 0}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>Pagadas</div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: '#10B981' }}>
                    {cumplimiento.ofs?.pagadas || 0}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #f3f4f6' }}>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>Tasa de ejecución (pagadas / total)</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    flex: 1, height: 8, background: '#e5e7eb',
                    borderRadius: 4, overflow: 'hidden'
                  }}>
                    <div style={{
                      height: '100%', background: '#185FA5',
                      width: `${cumplimiento.ofs?.tasaEjecucion || 0}%`,
                      transition: 'width 0.3s'
                    }} />
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#185FA5' }}>
                    {cumplimiento.ofs?.tasaEjecucion || 0}%
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </>
      )}

      {/* TAB: AUDITORÍA */}
      {tab === 'auditoria' && (
        <>
          <div style={{
            background: '#EFF6FF', border: '1px solid #BFDBFE',
            borderRadius: 6, padding: 14, marginBottom: 16,
            fontSize: 12, color: '#1E40AF', lineHeight: 1.5
          }}>
            <strong>Auditoría de transacciones:</strong> Registro de las últimas acciones en el proceso.
            Útil para rastrear quién hizo qué y cuándo.
          </div>

          {auditoria.length === 0 ? (
            <EmptyState titulo="Sin actividad reciente" subtitulo="Las últimas acciones aparecerán acá cuando las haya." />
          ) : (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '140px 2fr 1fr 120px 140px',
                padding: '10px 16px', background: '#F9FAFB',
                borderBottom: '1px solid #e5e7eb',
                fontSize: 11, fontWeight: 600, color: '#6b7280',
                textTransform: 'uppercase', letterSpacing: '0.04em'
              }}>
                <div>Fecha</div>
                <div>Descripción</div>
                <div>Solicitante</div>
                <div>Estado</div>
                <div style={{ textAlign: 'right' }}>Acción</div>
              </div>
              {auditoria.map((item: any) => (
                <div key={item.id} style={{
                  display: 'grid',
                  gridTemplateColumns: '140px 2fr 1fr 120px 140px',
                  padding: '10px 16px', borderBottom: '1px solid #f3f4f6',
                  fontSize: 12, alignItems: 'center'
                }}>
                  <div style={{ color: '#6b7280', fontSize: 11 }}>
                    {new Date(item.updated_at || item.created_at).toLocaleString('es-CO', {
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                    })}
                  </div>
                  <div style={{ fontWeight: 500, color: '#111' }}>
                    {item.descripcion?.slice(0, 80)}
                  </div>
                  <div style={{ color: '#374151' }}>
                    {item.solicitante?.nombre || '—'}
                  </div>
                  <div>
                    <span style={{
                      padding: '2px 7px', fontSize: 10, fontWeight: 600,
                      background: '#F3F4F6', color: '#374151',
                      borderRadius: 3, textTransform: 'uppercase'
                    }}>
                      {item.estado}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <button
                      onClick={() => router.push(`/solicitudes/${item.id}`)}
                      style={{
                        padding: '4px 10px', background: 'none',
                        border: '1px solid #d1d5db', borderRadius: 3,
                        fontSize: 11, cursor: 'pointer', color: '#374151'
                      }}
                    >
                      Ver
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function KPI({ label, valor, color, descripcion }: any) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', padding: 14, borderRadius: 6 }}>
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{valor}</div>
      {descripcion && <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{descripcion}</div>}
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
      {count !== undefined && count > 0 && (
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

function Card({ titulo, children }: any) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#111', marginBottom: 12 }}>
        {titulo}
      </div>
      {children}
    </div>
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
