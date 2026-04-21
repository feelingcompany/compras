'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth'

export default function AprobacionesPage() {
  const { usuario } = useAuth()
  const router = useRouter()
  const supabase = createClient()
  
  const [aprobaciones, setAprobaciones] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [procesando, setProcesando] = useState<string | null>(null)
  const [selectedRechazo, setSelectedRechazo] = useState<any>(null)
  const [comentarioRechazo, setComentarioRechazo] = useState('')

  useEffect(() => {
    if (!usuario) {
      router.push('/login')
      return
    }
    
    if (usuario.rol === 'solicitante') {
      router.push('/')
      return
    }
    
    cargarAprobaciones()
    const interval = setInterval(cargarAprobaciones, 30000)
    return () => clearInterval(interval)
  }, [usuario])

  const cargarAprobaciones = async () => {
    if (!usuario) return
    
    try {
      // 1. Aprobaciones pendientes del usuario
      const { data: aprobacionesData, error } = await supabase
        .from('aprobaciones')
        .select('*')
        .eq('aprobador_id', usuario.id)
        .eq('estado', 'pendiente')
        .order('fecha_limite', { ascending: true })
      
      if (error) {
        console.error('Error:', error)
        setLoading(false)
        return
      }

      if (!aprobacionesData || aprobacionesData.length === 0) {
        setAprobaciones([])
        setLoading(false)
        return
      }

      // 2. Cargar solicitudes relacionadas
      const solicitudIds = aprobacionesData.map(a => a.solicitud_id)
      const { data: solicitudes } = await supabase
        .from('solicitudes')
        .select('*')
        .in('id', solicitudIds)

      // 3. Cargar solicitantes
      const solicitanteIds = [...new Set((solicitudes || []).map(s => s.solicitante_id))]
      const { data: solicitantes } = await supabase
        .from('usuarios')
        .select('id, nombre, email, rol')
        .in('id', solicitanteIds)

      // 4. Cargar items
      const { data: items } = await supabase
        .from('items_solicitud')
        .select('*')
        .in('solicitud_id', solicitudIds)

      // 5. Cargar OTRAS aprobaciones de las mismas solicitudes (para ver el flujo completo)
      const { data: todasAprobaciones } = await supabase
        .from('aprobaciones')
        .select('*')
        .in('solicitud_id', solicitudIds)

      // Armar estructura
      const enriched = aprobacionesData.map(apr => {
        const solicitud = (solicitudes || []).find(s => s.id === apr.solicitud_id)
        const solicitante = (solicitantes || []).find(u => u.id === solicitud?.solicitante_id)
        const solicitudItems = (items || []).filter(i => i.solicitud_id === apr.solicitud_id)
        const aprobacionesSolicitud = (todasAprobaciones || [])
          .filter(a => a.solicitud_id === apr.solicitud_id)
          .sort((a, b) => a.nivel_aprobacion - b.nivel_aprobacion)
        
        const montoTotal = solicitudItems.reduce((sum, item) => 
          sum + (parseFloat(item.presupuesto_estimado) || 0), 0
        )

        // Verificar si niveles previos están aprobados
        const nivelesPrevios = aprobacionesSolicitud.filter(a => a.nivel_aprobacion < apr.nivel_aprobacion)
        const puedeAprobar = nivelesPrevios.every(a => a.estado === 'aprobada')
        
        return {
          ...apr,
          solicitud,
          solicitante,
          items: solicitudItems,
          monto_total: montoTotal,
          todas_aprobaciones: aprobacionesSolicitud,
          puede_aprobar: puedeAprobar
        }
      })

      setAprobaciones(enriched)
      setLoading(false)
    } catch (error) {
      console.error('Error:', error)
      setLoading(false)
    }
  }

  const aprobar = async (aprobacionId: string) => {
    if (!confirm('¿Confirmar aprobación?')) return
    setProcesando(aprobacionId)
    
    const { error } = await supabase
      .from('aprobaciones')
      .update({ 
        estado: 'aprobada',
        fecha_aprobacion: new Date().toISOString()
      })
      .eq('id', aprobacionId)
    
    if (error) {
      alert('Error: ' + error.message)
    } else {
      // Actualizar estado de solicitud manualmente (fallback)
      const apr = aprobaciones.find(a => a.id === aprobacionId)
      if (apr) {
        const todasAprobadas = apr.todas_aprobaciones.every((a: any) => 
          a.id === aprobacionId ? true : a.estado === 'aprobada'
        )
        if (todasAprobadas) {
          await supabase
            .from('solicitudes')
            .update({ estado: 'aprobada', updated_at: new Date().toISOString() })
            .eq('id', apr.solicitud_id)
        }
      }
      cargarAprobaciones()
    }
    setProcesando(null)
  }

  const abrirRechazo = (apr: any) => {
    setSelectedRechazo(apr)
    setComentarioRechazo('')
  }

  const confirmarRechazo = async () => {
    if (!comentarioRechazo.trim()) {
      alert('Ingresá el motivo del rechazo')
      return
    }
    
    setProcesando(selectedRechazo.id)
    
    const { error } = await supabase
      .from('aprobaciones')
      .update({ 
        estado: 'rechazada',
        fecha_rechazo: new Date().toISOString(),
        comentarios: comentarioRechazo
      })
      .eq('id', selectedRechazo.id)
    
    if (error) {
      alert('Error: ' + error.message)
    } else {
      // Actualizar estado de solicitud a rechazada
      await supabase
        .from('solicitudes')
        .update({ estado: 'rechazada', updated_at: new Date().toISOString() })
        .eq('id', selectedRechazo.solicitud_id)
      
      setSelectedRechazo(null)
      setComentarioRechazo('')
      cargarAprobaciones()
    }
    setProcesando(null)
  }

  const getDiasRestantes = (fechaLimite: string) => {
    if (!fechaLimite) return null
    const dias = Math.ceil((new Date(fechaLimite).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    return dias
  }

  if (loading && aprobaciones.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#666' }}>
        Cargando aprobaciones...
      </div>
    )
  }

  const stats = {
    total: aprobaciones.length,
    urgentes: aprobaciones.filter(a => a.solicitud?.prioridad === 'urgente' || a.solicitud?.prioridad === 'critico').length,
    vencidas: aprobaciones.filter(a => {
      const dias = getDiasRestantes(a.fecha_limite)
      return dias !== null && dias < 0
    }).length,
    montoTotal: aprobaciones.reduce((sum, a) => sum + a.monto_total, 0)
  }

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1a1a1a', margin: 0, marginBottom: 4 }}>
          Aprobaciones Pendientes
        </h1>
        <div style={{ fontSize: 13, color: '#666' }}>
          Solicitudes que requieren tu aprobación
        </div>
      </div>

      {/* Stats */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 12, marginBottom: 24
      }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', padding: 14, borderRadius: 6 }}>
          <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>PENDIENTES</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{stats.total}</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', padding: 14, borderRadius: 6 }}>
          <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>URGENTES</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#F59E0B' }}>{stats.urgentes}</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', padding: 14, borderRadius: 6 }}>
          <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>VENCIDAS</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#EF4444' }}>{stats.vencidas}</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', padding: 14, borderRadius: 6 }}>
          <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>MONTO TOTAL</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#185FA5' }}>
            ${stats.montoTotal.toLocaleString('es-CO')}
          </div>
        </div>
      </div>

      {/* Lista */}
      {aprobaciones.length === 0 ? (
        <div style={{
          background: '#fff', border: '1px solid #e5e7eb', padding: 48,
          borderRadius: 6, textAlign: 'center'
        }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#666', marginBottom: 6 }}>
            No tenés aprobaciones pendientes
          </div>
          <div style={{ fontSize: 13, color: '#999' }}>
            Todas las solicitudes asignadas a vos están procesadas
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {aprobaciones.map(apr => {
            const diasRestantes = getDiasRestantes(apr.fecha_limite)
            const vencida = diasRestantes !== null && diasRestantes < 0
            const prioridadColor = apr.solicitud?.prioridad === 'critico' ? '#EF4444' :
                                    apr.solicitud?.prioridad === 'urgente' ? '#F59E0B' : '#185FA5'

            return (
              <div key={apr.id} style={{
                background: '#fff', border: '1px solid #e5e7eb',
                borderLeft: `4px solid ${vencida ? '#EF4444' : prioridadColor}`,
                borderRadius: 6, padding: 18
              }}>
                {/* Header solicitud */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span style={{
                        padding: '3px 8px', borderRadius: 3, fontSize: 10, fontWeight: 600,
                        background: '#EEF2FF', color: '#3730A3'
                      }}>
                        NIVEL {apr.nivel_aprobacion}
                      </span>
                      {apr.solicitud?.prioridad && (
                        <span style={{
                          padding: '3px 8px', borderRadius: 3, fontSize: 10, fontWeight: 600,
                          background: prioridadColor + '20', color: prioridadColor,
                          textTransform: 'uppercase'
                        }}>
                          {apr.solicitud.prioridad}
                        </span>
                      )}
                      {vencida && (
                        <span style={{
                          padding: '3px 8px', background: '#EF4444', color: '#fff',
                          fontSize: 10, fontWeight: 700, borderRadius: 3
                        }}>
                          VENCIDA
                        </span>
                      )}
                      {!apr.puede_aprobar && (
                        <span style={{
                          padding: '3px 8px', background: '#F3F4F6', color: '#666',
                          fontSize: 10, fontWeight: 600, borderRadius: 3
                        }}>
                          ESPERANDO NIVELES PREVIOS
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
                      {apr.solicitud?.descripcion || 'Sin descripción'}
                    </div>
                    <div style={{ fontSize: 12, color: '#666' }}>
                      Solicitante: <strong>{apr.solicitante?.nombre || 'Desconocido'}</strong>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#185FA5' }}>
                      ${apr.monto_total.toLocaleString('es-CO')}
                    </div>
                    {diasRestantes !== null && (
                      <div style={{
                        fontSize: 11,
                        color: vencida ? '#EF4444' : diasRestantes <= 1 ? '#F59E0B' : '#666'
                      }}>
                        {vencida 
                          ? `Vencida hace ${Math.abs(diasRestantes)}d`
                          : `${diasRestantes}d restante${diasRestantes !== 1 ? 's' : ''}`
                        }
                      </div>
                    )}
                  </div>
                </div>

                {/* Detalles */}
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12,
                  padding: 12, background: '#F9FAFB', borderRadius: 4,
                  marginBottom: 12, fontSize: 11
                }}>
                  <div>
                    <div style={{ color: '#666', marginBottom: 2 }}>Centro de Costo</div>
                    <div style={{ fontWeight: 600 }}>{apr.solicitud?.centro_costo || '—'}</div>
                  </div>
                  <div>
                    <div style={{ color: '#666', marginBottom: 2 }}>Ciudad</div>
                    <div style={{ fontWeight: 600 }}>{apr.solicitud?.ciudad || '—'}</div>
                  </div>
                  <div>
                    <div style={{ color: '#666', marginBottom: 2 }}>Fecha Requerida</div>
                    <div style={{ fontWeight: 600 }}>
                      {apr.solicitud?.fecha_requerida 
                        ? new Date(apr.solicitud.fecha_requerida).toLocaleDateString('es-CO') 
                        : '—'}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: '#666', marginBottom: 2 }}>OT/OS</div>
                    <div style={{ fontWeight: 600 }}>{apr.solicitud?.ot_os || '—'}</div>
                  </div>
                </div>

                {/* Items */}
                {apr.items.length > 0 && (
                  <div style={{
                    background: '#F9FAFB', borderRadius: 4, marginBottom: 12,
                    border: '1px solid #e5e7eb', overflow: 'hidden'
                  }}>
                    <div style={{ padding: '6px 12px', fontSize: 11, fontWeight: 600, 
                                   borderBottom: '1px solid #e5e7eb', background: '#fff' }}>
                      ÍTEMS ({apr.items.length})
                    </div>
                    <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                      <tbody>
                        {apr.items.map((item: any) => (
                          <tr key={item.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                            <td style={{ padding: '6px 12px' }}>
                              <div style={{ fontWeight: 500 }}>{item.descripcion}</div>
                              <div style={{ fontSize: 10, color: '#666' }}>{item.categoria}</div>
                            </td>
                            <td style={{ padding: '6px 12px', textAlign: 'right' }}>
                              {item.cantidad} {item.unidad}
                            </td>
                            <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600 }}>
                              ${parseFloat(item.presupuesto_estimado || 0).toLocaleString('es-CO')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Timeline niveles */}
                {apr.todas_aprobaciones.length > 1 && (
                  <div style={{
                    display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center',
                    padding: 8, background: '#F9FAFB', borderRadius: 4, fontSize: 10
                  }}>
                    <strong style={{ marginRight: 4 }}>Flujo:</strong>
                    {apr.todas_aprobaciones.map((a: any, idx: number) => (
                      <span key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{
                          padding: '2px 6px', borderRadius: 2, fontWeight: 500,
                          background: a.estado === 'aprobada' ? '#D1FAE5' :
                                     a.estado === 'rechazada' ? '#FEE2E2' :
                                     a.id === apr.id ? '#DBEAFE' : '#F3F4F6',
                          color: a.estado === 'aprobada' ? '#065F46' :
                                a.estado === 'rechazada' ? '#991B1B' :
                                a.id === apr.id ? '#1E40AF' : '#6B7280'
                        }}>
                          N{a.nivel_aprobacion}: {a.estado}
                          {a.id === apr.id && ' (ESTE)'}
                        </span>
                        {idx < apr.todas_aprobaciones.length - 1 && <span>→</span>}
                      </span>
                    ))}
                  </div>
                )}

                {/* Acciones */}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => router.push(`/solicitudes/${apr.solicitud_id}`)}
                    style={{
                      padding: '8px 16px', background: '#fff', color: '#374151',
                      border: '1px solid #d1d5db', borderRadius: 4,
                      fontSize: 13, cursor: 'pointer', fontWeight: 500
                    }}
                  >
                    Ver Detalle
                  </button>
                  <button
                    onClick={() => abrirRechazo(apr)}
                    disabled={procesando === apr.id || !apr.puede_aprobar}
                    style={{
                      padding: '8px 16px', background: '#fff', color: '#EF4444',
                      border: '1px solid #EF4444', borderRadius: 4,
                      fontSize: 13, cursor: 'pointer', fontWeight: 500,
                      opacity: (procesando === apr.id || !apr.puede_aprobar) ? 0.5 : 1
                    }}
                  >
                    Rechazar
                  </button>
                  <button
                    onClick={() => aprobar(apr.id)}
                    disabled={procesando === apr.id || !apr.puede_aprobar}
                    style={{
                      padding: '8px 16px', background: apr.puede_aprobar ? '#10B981' : '#9CA3AF',
                      color: '#fff', border: 'none', borderRadius: 4,
                      fontSize: 13, cursor: apr.puede_aprobar ? 'pointer' : 'not-allowed', 
                      fontWeight: 600,
                      opacity: procesando === apr.id ? 0.5 : 1
                    }}
                  >
                    {procesando === apr.id ? 'Procesando...' : 'Aprobar'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal Rechazo */}
      {selectedRechazo && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{
            background: '#fff', borderRadius: 8, padding: 24,
            maxWidth: 500, width: '100%'
          }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>
              Rechazar Solicitud
            </div>
            <div style={{ marginBottom: 16, fontSize: 13, color: '#666' }}>
              {selectedRechazo.solicitud?.descripcion}
            </div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600 }}>
              Motivo del rechazo *
            </label>
            <textarea
              value={comentarioRechazo}
              onChange={e => setComentarioRechazo(e.target.value)}
              placeholder="Explicá por qué rechazás esta solicitud..."
              rows={4}
              style={{
                width: '100%', padding: 10, border: '1px solid #d1d5db',
                borderRadius: 4, fontSize: 13, resize: 'vertical',
                fontFamily: 'inherit', marginBottom: 16
              }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setSelectedRechazo(null); setComentarioRechazo('') }}
                style={{
                  padding: '8px 16px', background: '#fff', color: '#374151',
                  border: '1px solid #d1d5db', borderRadius: 4,
                  fontSize: 13, cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={confirmarRechazo}
                disabled={!comentarioRechazo.trim() || !!procesando}
                style={{
                  padding: '8px 16px', background: '#EF4444', color: '#fff',
                  border: 'none', borderRadius: 4,
                  fontSize: 13, cursor: 'pointer', fontWeight: 600,
                  opacity: (!comentarioRechazo.trim() || !!procesando) ? 0.5 : 1
                }}
              >
                Confirmar Rechazo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
