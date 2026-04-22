'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth'

// ============================================================
// APROBACIONES — Bandeja de firmas unificada
//
// Todo lo que requiere la DECISIÓN / FIRMA del usuario actual:
//
// TAB 1 - "Autorizar gasto": solicitudes pendientes de aprobar
//   Decisión: ¿autorizo que se gaste este dinero?
//
// TAB 2 - "Autorizar pago": OFs aprobadas que esperan pago
//   Decisión: ¿autorizo que salga este pago al proveedor?
//
// ============================================================

export default function AprobacionesPage() {
  const { usuario } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [tab, setTab] = useState<'gasto' | 'pago'>('gasto')
  const [loading, setLoading] = useState(true)
  const [solicitudes, setSolicitudes] = useState<any[]>([])
  const [ofsPorPagar, setOfsPorPagar] = useState<any[]>([])
  const [filtroMonto, setFiltroMonto] = useState<'todos' | 'altos' | 'criticos'>('todos')

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
    try {
      // TAB 1: Solicitudes pendientes donde ME toca aprobar
      const { data: aprobs } = await supabase
        .from('aprobaciones')
        .select('*')
        .eq('aprobador_id', usuario!.id)
        .eq('estado', 'pendiente')
        .order('created_at', { ascending: false })

      let solicitudesEnriched: any[] = []
      if (aprobs && aprobs.length > 0) {
        const solIds = aprobs.map((a: any) => a.solicitud_id)
        const [sols, items] = await Promise.all([
          supabase.from('solicitudes').select('*').in('id', solIds),
          supabase.from('items_solicitud').select('*').in('solicitud_id', solIds)
        ])

        const solicitanteIds = [...new Set((sols.data || []).map((s: any) => s.solicitante_id))]
        const { data: users } = await supabase
          .from('usuarios').select('id, nombre, area, rol').in('id', solicitanteIds)

        // Solo incluir las aprobaciones donde los niveles previos YA fueron aprobados
        // (O sea, realmente me toca a MÍ ahora)
        const todasAprobsIds = aprobs.map((a: any) => a.solicitud_id)
        const { data: todasAprobsDeSols } = await supabase
          .from('aprobaciones').select('*').in('solicitud_id', todasAprobsIds)

        solicitudesEnriched = aprobs
          .map((apr: any) => {
            const sol = (sols.data || []).find((s: any) => s.id === apr.solicitud_id)
            if (!sol) return null
            const solItems = (items.data || []).filter((i: any) => i.solicitud_id === apr.solicitud_id)
            const monto = solItems.reduce((s: number, i: any) => s + (parseFloat(i.presupuesto_estimado) || 0), 0)

            // Verificar que niveles previos estén aprobados
            const nivelesPrevios = (todasAprobsDeSols || []).filter((a: any) =>
              a.solicitud_id === apr.solicitud_id &&
              a.nivel_aprobacion < apr.nivel_aprobacion
            )
            const previoTodoAprobado = nivelesPrevios.every((a: any) => a.estado === 'aprobada')
            
            return {
              ...apr,
              solicitud: sol,
              solicitante: (users || []).find((u: any) => u.id === sol.solicitante_id),
              monto,
              items_count: solItems.length,
              bloqueada: !previoTodoAprobado,
              dias_esperando: sol.created_at
                ? Math.floor((Date.now() - new Date(sol.created_at).getTime()) / (1000 * 60 * 60 * 24))
                : 0
            }
          })
          .filter(Boolean)
      }
      setSolicitudes(solicitudesEnriched)

      // TAB 2: OFs aprobadas pendientes de autorizar pago
      // Solo para admin_compras y gerencia (no encargados)
      if (['admin_compras', 'gerencia'].includes(usuario!.rol)) {
        const { data: ofs } = await supabase
          .from('ordenes_facturacion')
          .select('*')
          .eq('estado_verificacion', 'APROBADA')
          .not('estado_pago', 'in', '(PAGADO,PAGADA)')
          .order('created_at', { ascending: false })

        let ofsEnriched: any[] = []
        if (ofs && ofs.length > 0) {
          const provIds = [...new Set(ofs.map((o: any) => o.proveedor_id).filter(Boolean))]
          const solIds = [...new Set(ofs.map((o: any) => o.solicitud_id).filter(Boolean))]

          const [provs, sols, items] = await Promise.all([
            provIds.length > 0
              ? supabase.from('proveedores').select('id, razon_social, nit').in('id', provIds)
              : Promise.resolve({ data: [] }),
            solIds.length > 0
              ? supabase.from('solicitudes').select('id, descripcion, centro_costo').in('id', solIds)
              : Promise.resolve({ data: [] }),
            solIds.length > 0
              ? supabase.from('items_solicitud').select('*').in('solicitud_id', solIds)
              : Promise.resolve({ data: [] })
          ])

          ofsEnriched = ofs.map((o: any) => {
            const proveedor = (provs.data || []).find((p: any) => p.id === o.proveedor_id)
            const solicitud = (sols.data || []).find((s: any) => s.id === o.solicitud_id)
            const solItems = (items.data || []).filter((i: any) => i.solicitud_id === o.solicitud_id)
            const presupuesto = solItems.reduce((sum: number, i: any) => sum + (parseFloat(i.presupuesto_estimado) || 0), 0)
            const valorOF = parseFloat(o.valor_total) || 0
            const flags: string[] = []
            if (presupuesto > 0 && valorOF > presupuesto * 1.1) flags.push('SOBRECOSTO')
            if (!proveedor?.nit) flags.push('SIN_NIT')
            if (!solicitud) flags.push('SIN_SOLICITUD')
            
            return {
              ...o,
              proveedor,
              solicitud,
              presupuesto,
              flags,
              dias_esperando: o.created_at
                ? Math.floor((Date.now() - new Date(o.created_at).getTime()) / (1000 * 60 * 60 * 24))
                : 0
            }
          })
        }
        setOfsPorPagar(ofsEnriched)
      }

      setLoading(false)
    } catch (err) {
      console.error(err)
      setLoading(false)
    }
  }

  const aprobarSolicitud = async (aprobacionId: string, solicitudId: string) => {
    if (!confirm('¿Autorizar el gasto de esta solicitud?')) return

    await supabase
      .from('aprobaciones')
      .update({ estado: 'aprobada', fecha_aprobacion: new Date().toISOString() })
      .eq('id', aprobacionId)

    // Verificar si todas las aprobaciones de la solicitud ya están
    const { data: todas } = await supabase
      .from('aprobaciones')
      .select('*')
      .eq('solicitud_id', solicitudId)

    const todasAprobadas = (todas || []).every((a: any) => a.estado === 'aprobada')
    if (todasAprobadas) {
      await supabase
        .from('solicitudes')
        .update({ estado: 'aprobada', updated_at: new Date().toISOString() })
        .eq('id', solicitudId)
    }

    cargar()
  }

  const rechazarSolicitud = async (aprobacionId: string, solicitudId: string) => {
    const motivo = prompt('Motivo del rechazo:')
    if (!motivo) return

    await supabase
      .from('aprobaciones')
      .update({
        estado: 'rechazada',
        fecha_rechazo: new Date().toISOString(),
        comentarios: motivo
      })
      .eq('id', aprobacionId)

    await supabase
      .from('solicitudes')
      .update({ estado: 'rechazada', updated_at: new Date().toISOString() })
      .eq('id', solicitudId)

    cargar()
  }

  const autorizarPago = async (ofId: string) => {
    if (!confirm('¿Autorizar el pago de esta OF? Esta decisión autoriza el desembolso al proveedor.')) return
    await supabase
      .from('ordenes_facturacion')
      .update({ estado_pago: 'PAGADO', updated_at: new Date().toISOString() })
      .eq('id', ofId)
    cargar()
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Cargando...</div>
  }

  const aprobablesAhora = solicitudes.filter((s: any) => !s.bloqueada)
  const bloqueadas = solicitudes.filter((s: any) => s.bloqueada)

  const solicitudesFiltradas = aprobablesAhora.filter((s: any) => {
    if (filtroMonto === 'todos') return true
    if (filtroMonto === 'altos') return s.monto >= 1_000_000
    if (filtroMonto === 'criticos') return s.monto >= 5_000_000
    return true
  })

  const totalMontoGasto = aprobablesAhora.reduce((s: number, x: any) => s + x.monto, 0)
  const totalMontoPago = ofsPorPagar.reduce((s: number, x: any) => s + (parseFloat(x.valor_total) || 0), 0)
  const totalDecisiones = aprobablesAhora.length + ofsPorPagar.length
  const puedeVerPagos = ['admin_compras', 'gerencia'].includes(usuario!.rol)

  return (
    <div style={{ padding: 32, maxWidth: 1300, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111', margin: 0, marginBottom: 4 }}>
          Aprobaciones
        </h1>
        <div style={{ fontSize: 13, color: '#6b7280' }}>
          {totalDecisiones > 0
            ? <>Tenés <strong style={{ color: '#DC2626' }}>{totalDecisiones} decisiones pendientes</strong> de firma</>
            : 'Todo firmado. No hay pendientes.'}
        </div>
      </div>

      {/* Explicación */}
      <div style={{
        background: '#EFF6FF', border: '1px solid #BFDBFE',
        borderRadius: 6, padding: 14, marginBottom: 20,
        fontSize: 12, color: '#1E40AF', lineHeight: 1.5
      }}>
        <strong>Tu bandeja de firmas:</strong> todo lo que requiere tu decisión personal en un solo lugar.
        {puedeVerPagos ? (
          <> Aprobás <strong>gasto</strong> (antes de comprometer dinero) y autorizás <strong>pago</strong> (antes del desembolso).</>
        ) : (
          <> Aprobás el <strong>gasto</strong> de solicitudes de tu equipo antes de que se comprometa dinero.</>
        )}
      </div>

      {/* KPIs */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: puedeVerPagos ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)',
        gap: 10, marginBottom: 20
      }}>
        <StatCard label="Autorizar gasto" valor={aprobablesAhora.length} color="#DC2626" subtitulo="Solicitudes" />
        <StatCard label="Monto gasto" valor={`$${(totalMontoGasto / 1000000).toFixed(1)}M`} color="#185FA5" subtitulo="Pendientes" />
        {puedeVerPagos && (
          <>
            <StatCard label="Autorizar pago" valor={ofsPorPagar.length} color="#F59E0B" subtitulo="OFs aprobadas" />
            <StatCard label="Monto pago" valor={`$${(totalMontoPago / 1000000).toFixed(1)}M`} color="#3730A3" subtitulo="Por desembolsar" />
          </>
        )}
        {!puedeVerPagos && (
          <StatCard label="Bloqueadas" valor={bloqueadas.length} color="#9ca3af" subtitulo="Esperan otros" />
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, borderBottom: '1px solid #e5e7eb' }}>
        <Tab
          activo={tab === 'gasto'}
          onClick={() => setTab('gasto')}
          count={aprobablesAhora.length}
          color="#DC2626"
        >
          Autorizar gasto
        </Tab>
        {puedeVerPagos && (
          <Tab
            activo={tab === 'pago'}
            onClick={() => setTab('pago')}
            count={ofsPorPagar.length}
            color="#F59E0B"
          >
            Autorizar pago
          </Tab>
        )}
      </div>

      {/* ============ TAB AUTORIZAR GASTO ============ */}
      {tab === 'gasto' && (
        <>
          {/* Filtros por monto */}
          {aprobablesAhora.length > 0 && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              <FilterBtn activo={filtroMonto === 'todos'} onClick={() => setFiltroMonto('todos')}>
                Todos ({aprobablesAhora.length})
              </FilterBtn>
              <FilterBtn activo={filtroMonto === 'altos'} onClick={() => setFiltroMonto('altos')}>
                Altos ≥$1M ({aprobablesAhora.filter((s: any) => s.monto >= 1_000_000).length})
              </FilterBtn>
              <FilterBtn activo={filtroMonto === 'criticos'} onClick={() => setFiltroMonto('criticos')}>
                Críticos ≥$5M ({aprobablesAhora.filter((s: any) => s.monto >= 5_000_000).length})
              </FilterBtn>
            </div>
          )}

          {solicitudesFiltradas.length === 0 && bloqueadas.length === 0 ? (
            <Empty
              titulo="No hay solicitudes esperando tu firma"
              subtitulo="Cuando tus equipos creen solicitudes que requieran tu aprobación, aparecerán acá."
            />
          ) : (
            <>
              {/* Solicitudes aprobables ahora */}
              {solicitudesFiltradas.length > 0 && (
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden', marginBottom: 16 }}>
                  {solicitudesFiltradas.map((s: any) => {
                    const esCritico = s.monto >= 5_000_000
                    const esAlto = s.monto >= 1_000_000
                    const urgente = s.dias_esperando >= 3
                    
                    return (
                      <div key={s.id} style={{
                        padding: 16, borderBottom: '1px solid #f3f4f6',
                        borderLeft: `3px solid ${esCritico ? '#DC2626' : esAlto ? '#F59E0B' : '#10B981'}`
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                              {esCritico && (
                                <span style={{
                                  padding: '2px 7px', fontSize: 9, fontWeight: 700,
                                  background: '#FEE2E2', color: '#991B1B',
                                  borderRadius: 3, letterSpacing: '0.03em'
                                }}>
                                  CRÍTICO
                                </span>
                              )}
                              {!esCritico && esAlto && (
                                <span style={{
                                  padding: '2px 7px', fontSize: 9, fontWeight: 700,
                                  background: '#FEF3C7', color: '#92400E',
                                  borderRadius: 3, letterSpacing: '0.03em'
                                }}>
                                  ALTO
                                </span>
                              )}
                              {urgente && (
                                <span style={{
                                  padding: '2px 7px', fontSize: 9, fontWeight: 700,
                                  background: '#FED7AA', color: '#9A3412',
                                  borderRadius: 3, letterSpacing: '0.03em'
                                }}>
                                  {s.dias_esperando} DÍAS ESPERANDO
                                </span>
                              )}
                              <span style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>
                                {s.solicitud?.descripcion}
                              </span>
                            </div>
                            <div style={{ fontSize: 12, color: '#6b7280' }}>
                              Por <strong>{s.solicitante?.nombre}</strong>
                              {s.solicitante?.area && ` (${s.solicitante.area})`} · 
                              {' '}{s.solicitud?.centro_costo || 'Sin centro'} · 
                              {' '}Nivel {s.nivel_aprobacion}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', marginRight: 16 }}>
                            <div style={{ fontSize: 10, color: '#6b7280' }}>Monto</div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: '#185FA5' }}>
                              ${s.monto.toLocaleString('es-CO')}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                          <button onClick={() => router.push(`/solicitudes/${s.solicitud_id}`)} style={btnSecondary}>
                            Ver detalle
                          </button>
                          <button onClick={() => rechazarSolicitud(s.id, s.solicitud_id)} style={btnDanger}>
                            Rechazar
                          </button>
                          <button onClick={() => aprobarSolicitud(s.id, s.solicitud_id)} style={btnSuccess}>
                            Aprobar gasto
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Bloqueadas (esperando niveles previos) */}
              {bloqueadas.length > 0 && filtroMonto === 'todos' && (
                <div style={{
                  background: '#F9FAFB', border: '1px solid #e5e7eb',
                  borderRadius: 6, padding: 14
                }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {bloqueadas.length} solicitud{bloqueadas.length !== 1 ? 'es' : ''} esperando aprobación de niveles previos
                  </div>
                  {bloqueadas.slice(0, 3).map((s: any) => (
                    <div key={s.id} style={{
                      padding: 10, fontSize: 12, color: '#9ca3af',
                      display: 'flex', justifyContent: 'space-between',
                      borderBottom: '1px solid #f3f4f6'
                    }}>
                      <span>{s.solicitud?.descripcion}</span>
                      <span>Nivel {s.nivel_aprobacion} (tuyo) - bloqueado</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ============ TAB AUTORIZAR PAGO ============ */}
      {tab === 'pago' && puedeVerPagos && (
        <>
          {ofsPorPagar.length === 0 ? (
            <Empty
              titulo="No hay OFs esperando autorización de pago"
              subtitulo="Cuando una OF sea aprobada y esté lista para pagar, aparecerá acá."
            />
          ) : (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden' }}>
              {ofsPorPagar.map((of: any) => (
                <div key={of.id} style={{
                  padding: 16, borderBottom: '1px solid #f3f4f6',
                  borderLeft: `3px solid ${of.flags.includes('SOBRECOSTO') ? '#DC2626' : '#F59E0B'}`
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                        <span style={{
                          fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#185FA5'
                        }}>
                          {of.codigo_of}
                        </span>
                        {of.flags.map((f: string) => (
                          <span key={f} style={{
                            padding: '2px 7px', fontSize: 9, fontWeight: 700,
                            background: f === 'SOBRECOSTO' ? '#FEE2E2' : '#FEF3C7',
                            color: f === 'SOBRECOSTO' ? '#991B1B' : '#92400E',
                            borderRadius: 3
                          }}>
                            {f.replace('_', ' ')}
                          </span>
                        ))}
                        {of.dias_esperando >= 7 && (
                          <span style={{
                            padding: '2px 7px', fontSize: 9, fontWeight: 700,
                            background: '#FED7AA', color: '#9A3412', borderRadius: 3
                          }}>
                            {of.dias_esperando} días
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#111', marginBottom: 3 }}>
                        {of.descripcion || '(sin descripción)'}
                      </div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>
                        Pagar a <strong>{of.proveedor?.razon_social || 'Sin proveedor'}</strong> · 
                        {' '}{of.solicitud?.centro_costo || 'Sin centro'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', marginRight: 16 }}>
                      <div style={{ fontSize: 10, color: '#6b7280' }}>Monto a pagar</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#185FA5' }}>
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
                    <button onClick={() => router.push(`/ordenes/${of.id}`)} style={btnSecondary}>
                      Ver detalle
                    </button>
                    <button onClick={() => window.open(`/ordenes/${of.id}/imprimir`, '_blank')} style={btnSecondary}>
                      Ver OF oficial
                    </button>
                    <button onClick={() => autorizarPago(of.id)} style={btnSuccess}>
                      Autorizar pago
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

const btnSecondary: React.CSSProperties = {
  padding: '7px 14px', background: '#fff', color: '#374151',
  border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12, fontWeight: 500, cursor: 'pointer'
}
const btnSuccess: React.CSSProperties = {
  padding: '7px 14px', background: '#10B981', color: '#fff',
  border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer'
}
const btnDanger: React.CSSProperties = {
  padding: '7px 14px', background: '#fff', color: '#DC2626',
  border: '1px solid #DC2626', borderRadius: 4, fontSize: 12, fontWeight: 500, cursor: 'pointer'
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

function FilterBtn({ activo, onClick, children }: any) {
  return (
    <button onClick={onClick} style={{
      padding: '5px 12px',
      background: activo ? '#185FA5' : '#fff',
      color: activo ? '#fff' : '#374151',
      border: `1px solid ${activo ? '#185FA5' : '#d1d5db'}`,
      borderRadius: 4, fontSize: 11, fontWeight: 500,
      cursor: 'pointer'
    }}>
      {children}
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
