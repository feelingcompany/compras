'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth'

// ============================================================
// AUDITORÍA Y CONTROL (unificado)
//
// Dos funciones en un solo módulo:
// 
// TAB 1 - "Por revisar": Control en curso
//   - OFs que esperan revisión antes de pagar
//   - Detectar sobrecostos vs presupuesto
//   - Verificar docs completos del proveedor
//
// TAB 2 - "Histórico auditado": Trazabilidad
//   - Solicitudes cerradas (completadas)
//   - Tiempos por etapa
//   - Quién aprobó qué y cuándo
// ============================================================

export default function AuditoriaPage() {
  const { usuario } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [tab, setTab] = useState<'revisar' | 'historico' | 'anomalias'>('revisar')
  const [loading, setLoading] = useState(true)
  const [porRevisar, setPorRevisar] = useState<any[]>([])
  const [historico, setHistorico] = useState<any[]>([])
  const [anomalias, setAnomalias] = useState<any[]>([])
  const [stats, setStats] = useState<any>({})

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
      // 1. POR REVISAR: OFs que esperan revisión pre-pago
      const { data: ofs } = await supabase
        .from('ordenes_facturacion')
        .select('*')
        .eq('estado_verificacion', 'APROBADA')
        .not('estado_pago', 'in', '(PAGADO,PAGADA)')
        .order('created_at', { ascending: false })

      let ofsEnriquecidas: any[] = []
      if (ofs && ofs.length > 0) {
        const provIds = [...new Set(ofs.map((o: any) => o.proveedor_id).filter(Boolean))]
        const solIds = [...new Set(ofs.map((o: any) => o.solicitud_id).filter(Boolean))]

        const [provs, sols, items] = await Promise.all([
          provIds.length > 0
            ? supabase.from('proveedores').select('id, razon_social, nit').in('id', provIds)
            : Promise.resolve({ data: [] }),
          solIds.length > 0
            ? supabase.from('solicitudes').select('id, descripcion, centro_costo, solicitante_id').in('id', solIds)
            : Promise.resolve({ data: [] }),
          solIds.length > 0
            ? supabase.from('items_solicitud').select('*').in('solicitud_id', solIds)
            : Promise.resolve({ data: [] })
        ])

        ofsEnriquecidas = ofs.map((o: any) => {
          const proveedor = (provs.data || []).find((p: any) => p.id === o.proveedor_id)
          const solicitud = (sols.data || []).find((s: any) => s.id === o.solicitud_id)
          const solicitudItems = (items.data || []).filter((i: any) => i.solicitud_id === o.solicitud_id)
          const presupuesto = solicitudItems.reduce((s: number, i: any) => s + (parseFloat(i.presupuesto_estimado) || 0), 0)
          const valorOF = parseFloat(o.valor_total) || 0

          // Flags de control
          const flags: string[] = []
          if (presupuesto > 0 && valorOF > presupuesto * 1.1) flags.push('SOBRECOSTO')
          if (!proveedor?.nit) flags.push('SIN_NIT')
          if (!solicitud) flags.push('SIN_SOLICITUD')

          return { ...o, proveedor, solicitud, presupuesto, flags }
        })
      }
      setPorRevisar(ofsEnriquecidas)

      // 2. HISTÓRICO: solicitudes completadas
      const { data: completadas } = await supabase
        .from('solicitudes')
        .select('*')
        .eq('estado', 'completada')
        .order('updated_at', { ascending: false, nullsFirst: false })
        .limit(50)

      let historicoEnriquecido: any[] = []
      if (completadas && completadas.length > 0) {
        const ids = completadas.map((s: any) => s.id)
        const solicitanteIds = [...new Set(completadas.map((s: any) => s.solicitante_id))]

        const [items, users, aprobs] = await Promise.all([
          supabase.from('items_solicitud').select('*').in('solicitud_id', ids),
          supabase.from('usuarios').select('id, nombre').in('id', solicitanteIds),
          supabase.from('aprobaciones').select('*').in('solicitud_id', ids)
        ])

        historicoEnriquecido = completadas.map((s: any) => {
          const its = (items.data || []).filter((i: any) => i.solicitud_id === s.id)
          const monto = its.reduce((sum: number, i: any) => sum + (parseFloat(i.presupuesto_estimado) || 0), 0)
          const solicitudAprobs = (aprobs.data || []).filter((a: any) => a.solicitud_id === s.id)
          const fechaCierre = s.updated_at ? new Date(s.updated_at) : null
          const fechaCreacion = s.created_at ? new Date(s.created_at) : null
          const diasTotales = fechaCreacion && fechaCierre
            ? Math.floor((fechaCierre.getTime() - fechaCreacion.getTime()) / (1000 * 60 * 60 * 24))
            : null

          return {
            ...s,
            monto,
            aprobaciones: solicitudAprobs,
            solicitante: (users.data || []).find((u: any) => u.id === s.solicitante_id),
            diasTotales
          }
        })
      }
      setHistorico(historicoEnriquecido)

      // 3. ANOMALÍAS: patrones sospechosos
      const anomaliasDetectadas: any[] = []
      ofsEnriquecidas.forEach(of => {
        if (of.flags.includes('SOBRECOSTO')) {
          anomaliasDetectadas.push({
            tipo: 'sobrecosto',
            severidad: 'alta',
            of,
            mensaje: `OF ${of.codigo_of} supera presupuesto en más del 10%`,
            detalle: `Presupuesto: $${of.presupuesto.toLocaleString('es-CO')} → OF: $${(parseFloat(of.valor_total) || 0).toLocaleString('es-CO')}`
          })
        }
        if (of.flags.includes('SIN_NIT')) {
          anomaliasDetectadas.push({
            tipo: 'proveedor_incompleto',
            severidad: 'media',
            of,
            mensaje: `OF ${of.codigo_of} tiene proveedor sin NIT registrado`,
            detalle: of.proveedor?.razon_social || 'Sin proveedor'
          })
        }
        if (of.flags.includes('SIN_SOLICITUD')) {
          anomaliasDetectadas.push({
            tipo: 'sin_solicitud',
            severidad: 'media',
            of,
            mensaje: `OF ${of.codigo_of} no está vinculada a una solicitud formal`,
            detalle: 'Creada sin proceso previo'
          })
        }
      })
      setAnomalias(anomaliasDetectadas)

      // Stats
      const montoPorRevisar = ofsEnriquecidas.reduce((s, o) => s + (parseFloat(o.valor_total) || 0), 0)
      const tiempoPromedio = historicoEnriquecido.length > 0
        ? historicoEnriquecido.reduce((s, h) => s + (h.diasTotales || 0), 0) / historicoEnriquecido.length
        : 0

      setStats({
        porRevisar: ofsEnriquecidas.length,
        montoPorRevisar,
        anomalias: anomaliasDetectadas.length,
        completadas: historicoEnriquecido.length,
        tiempoPromedio: Math.round(tiempoPromedio),
      })

      setLoading(false)
    } catch (err) {
      console.error(err)
      setLoading(false)
    }
  }

  const aprobarPago = async (ofId: string) => {
    if (!confirm('¿Autorizar el pago de esta OF? (después no se puede revertir fácilmente)')) return
    await supabase
      .from('ordenes_facturacion')
      .update({ estado_pago: 'PAGADO', updated_at: new Date().toISOString() })
      .eq('id', ofId)
    cargar()
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Cargando...</div>
  }

  return (
    <div style={{ padding: 32, maxWidth: 1300, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111', margin: 0, marginBottom: 4 }}>
          Auditoría y Control
        </h1>
        <div style={{ fontSize: 13, color: '#6b7280' }}>
          Revisión pre-pago, trazabilidad histórica y detección de anomalías
        </div>
      </div>

      {/* Explicación */}
      <div style={{
        background: '#EFF6FF', border: '1px solid #BFDBFE',
        borderRadius: 6, padding: 14, marginBottom: 20,
        fontSize: 12, color: '#1E40AF', lineHeight: 1.5
      }}>
        <strong>¿Qué hacés acá?</strong> Revisás OFs aprobadas antes de autorizar el pago (control pre-pago),
        auditás procesos ya cerrados para verificar tiempos/cumplimiento, y detectás anomalías
        (sobrecostos, proveedores incompletos, solicitudes sin respaldo).
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 20 }}>
        <StatCard label="Por revisar" valor={stats.porRevisar || 0} color="#DC2626" subtitulo="OFs pre-pago" />
        <StatCard
          label="Monto"
          valor={`$${((stats.montoPorRevisar || 0) / 1000000).toFixed(1)}M`}
          color="#185FA5"
          subtitulo="Esperando autorización"
        />
        <StatCard label="Anomalías" valor={stats.anomalias || 0} color="#F59E0B" subtitulo="Detectadas" />
        <StatCard label="Completadas" valor={stats.completadas || 0} color="#10B981" subtitulo="Auditadas" />
        <StatCard
          label="Días promedio"
          valor={stats.tiempoPromedio || 0}
          color="#3730A3"
          subtitulo="Ciclo completo"
        />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, borderBottom: '1px solid #e5e7eb' }}>
        <Tab activo={tab === 'revisar'} onClick={() => setTab('revisar')} count={porRevisar.length} color="#DC2626">
          Por revisar (pre-pago)
        </Tab>
        <Tab activo={tab === 'anomalias'} onClick={() => setTab('anomalias')} count={anomalias.length} color="#F59E0B">
          Anomalías detectadas
        </Tab>
        <Tab activo={tab === 'historico'} onClick={() => setTab('historico')} count={historico.length}>
          Histórico auditado
        </Tab>
      </div>

      {/* TAB: POR REVISAR */}
      {tab === 'revisar' && (
        <>
          {porRevisar.length === 0 ? (
            <Empty
              titulo="No hay OFs pendientes de revisión"
              subtitulo="Cuando una OF sea aprobada y esté lista para pago, aparecerá acá."
            />
          ) : (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden' }}>
              {porRevisar.map((of: any) => (
                <div key={of.id} style={{
                  padding: 16, borderBottom: '1px solid #f3f4f6'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                        <span style={{
                          fontFamily: 'monospace', fontSize: 12, fontWeight: 700,
                          color: '#185FA5'
                        }}>
                          {of.codigo_of}
                        </span>
                        {of.flags.map((f: string) => (
                          <span key={f} style={{
                            padding: '2px 7px', fontSize: 9, fontWeight: 700,
                            background: f === 'SOBRECOSTO' ? '#FEE2E2' : '#FEF3C7',
                            color: f === 'SOBRECOSTO' ? '#991B1B' : '#92400E',
                            borderRadius: 3, letterSpacing: '0.03em'
                          }}>
                            {f.replace('_', ' ')}
                          </span>
                        ))}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#111', marginBottom: 3 }}>
                        {of.descripcion || '(sin descripción)'}
                      </div>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>
                        {of.proveedor?.razon_social || 'Sin proveedor'} · 
                        {' '}{of.solicitud?.centro_costo || 'Sin centro'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', marginRight: 16 }}>
                      <div style={{ fontSize: 10, color: '#6b7280' }}>Valor OF</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#185FA5' }}>
                        ${(parseFloat(of.valor_total) || 0).toLocaleString('es-CO')}
                      </div>
                      {of.presupuesto > 0 && (
                        <div style={{ fontSize: 10, color: of.flags.includes('SOBRECOSTO') ? '#DC2626' : '#10B981' }}>
                          Presupuesto: ${of.presupuesto.toLocaleString('es-CO')}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => router.push(`/ordenes/${of.id}`)}
                      style={btnSecondary}
                    >
                      Ver detalle
                    </button>
                    <button
                      onClick={() => window.open(`/ordenes/${of.id}/imprimir`, '_blank')}
                      style={btnSecondary}
                    >
                      Ver documento
                    </button>
                    <button
                      onClick={() => aprobarPago(of.id)}
                      style={btnSuccess}
                    >
                      Autorizar pago
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* TAB: ANOMALÍAS */}
      {tab === 'anomalias' && (
        <>
          {anomalias.length === 0 ? (
            <Empty
              titulo="No se detectaron anomalías"
              subtitulo="Todo está dentro de parámetros normales."
            />
          ) : (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden' }}>
              {anomalias.map((a: any, idx) => (
                <div key={idx} style={{
                  padding: 16, borderBottom: '1px solid #f3f4f6',
                  borderLeft: `3px solid ${a.severidad === 'alta' ? '#DC2626' : '#F59E0B'}`,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                      <span style={{
                        padding: '2px 7px', fontSize: 9, fontWeight: 700,
                        background: a.severidad === 'alta' ? '#FEE2E2' : '#FEF3C7',
                        color: a.severidad === 'alta' ? '#991B1B' : '#92400E',
                        borderRadius: 3, textTransform: 'uppercase'
                      }}>
                        {a.severidad}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>
                        {a.mensaje}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>
                      {a.detalle}
                    </div>
                  </div>
                  <button
                    onClick={() => router.push(`/ordenes/${a.of.id}`)}
                    style={btnSecondary}
                  >
                    Revisar →
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* TAB: HISTÓRICO */}
      {tab === 'historico' && (
        <>
          {historico.length === 0 ? (
            <Empty
              titulo="Sin histórico aún"
              subtitulo="Cuando haya solicitudes completadas (Fase 4), aparecerán acá para auditoría."
            />
          ) : (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1.3fr 1fr 80px 100px 100px',
                padding: '10px 16px', background: '#F9FAFB',
                borderBottom: '1px solid #e5e7eb',
                fontSize: 10, fontWeight: 600, color: '#6b7280',
                textTransform: 'uppercase', letterSpacing: '0.04em'
              }}>
                <div>Solicitud</div>
                <div>Centro de costo</div>
                <div>Solicitante</div>
                <div style={{ textAlign: 'center' }}>Días</div>
                <div style={{ textAlign: 'center' }}>Niveles</div>
                <div style={{ textAlign: 'right' }}>Monto</div>
              </div>

              {historico.map((h: any) => (
                <div
                  key={h.id}
                  onClick={() => router.push(`/solicitudes/${h.id}`)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1.3fr 1fr 80px 100px 100px',
                    padding: '12px 16px', borderBottom: '1px solid #f3f4f6',
                    fontSize: 12, alignItems: 'center', cursor: 'pointer'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
                  onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                >
                  <div style={{ fontWeight: 500, color: '#111' }}>
                    {h.descripcion}
                  </div>
                  <div style={{ color: '#6b7280', fontSize: 11 }}>
                    {h.centro_costo || '—'}
                  </div>
                  <div style={{ color: '#374151', fontSize: 11 }}>
                    {h.solicitante?.nombre || '—'}
                  </div>
                  <div style={{ textAlign: 'center', fontSize: 11, color: h.diasTotales > 30 ? '#DC2626' : '#6b7280' }}>
                    {h.diasTotales !== null ? `${h.diasTotales}d` : '—'}
                  </div>
                  <div style={{ textAlign: 'center', fontSize: 11, color: '#6b7280' }}>
                    {h.aprobaciones.length}
                  </div>
                  <div style={{ textAlign: 'right', fontWeight: 600, color: '#185FA5' }}>
                    ${h.monto.toLocaleString('es-CO')}
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

const btnSecondary: React.CSSProperties = {
  padding: '7px 14px', background: '#fff', color: '#374151',
  border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12, fontWeight: 500, cursor: 'pointer'
}
const btnSuccess: React.CSSProperties = {
  padding: '7px 14px', background: '#10B981', color: '#fff',
  border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer'
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
      padding: '10px 16px', background: 'none', border: 'none',
      borderBottom: `2px solid ${activo ? '#185FA5' : 'transparent'}`,
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

function Empty({ titulo, subtitulo }: any) {
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
