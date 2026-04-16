'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth'
import { useRouter } from 'next/navigation'

export default function MiTrabajoPage() {
  const { usuario } = useAuth()
  const router = useRouter()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [aprobaciones, setAprobaciones] = useState<any[]>([])
  const [alertas, setAlertas] = useState<any[]>([])
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [quickView, setQuickView] = useState<any>(null)
  const [filtro, setFiltro] = useState('urgente')
  const [processing, setProcessing] = useState(false)
  
  const [stats, setStats] = useState({
    tiempoPromedioAprobacion: 2.3,
    procesadasHoy: 0,
    enInbox: 0,
    ahorrosMes: 15200000
  })
  
  useEffect(() => {
    if (usuario) {
      cargarTodo()
      calcularStats()
    }
  }, [usuario, filtro])
  
  const cargarTodo = async () => {
    setLoading(true)
    await Promise.all([
      cargarAprobaciones(),
      cargarAlertas()
    ])
    setLoading(false)
  }
  
  const cargarAprobaciones = async () => {
    if (!usuario) return
    
    const { data } = await supabase
      .from('aprobaciones')
      .select(`
        *,
        of:ofs(
          id,
          codigo,
          descripcion,
          valor_total,
          proveedor:proveedores(nombre),
          solicitud:solicitudes(
            descripcion,
            fecha_requerida,
            solicitante:usuarios(nombre)
          )
        )
      `)
      .eq('aprobador_id', usuario.id)
      .eq('estado', 'pendiente')
      .order('created_at', { ascending: false })
    
    setAprobaciones(data || [])
  }
  
  const cargarAlertas = async () => {
    const { data } = await supabase
      .from('alertas')
      .select(`
        *,
        of:ofs(codigo, descripcion, valor_total, proveedor:proveedores(nombre))
      `)
      .eq('activa', true)
      .in('tipo', ['sobrecosto', 'vencimiento'])
      .order('created_at', { ascending: false})
      .limit(5)
    
    setAlertas(data || [])
  }
  
  const calcularStats = async () => {
    if (!usuario) return
    
    const hoy = new Date()
    const inicioHoy = new Date(hoy.setHours(0, 0, 0, 0))
    
    const { count: procesadasHoy } = await supabase
      .from('aprobaciones')
      .select('*', { count: 'exact', head: true })
      .eq('aprobador_id', usuario.id)
      .in('estado', ['aprobada', 'rechazada'])
      .gte('updated_at', inicioHoy.toISOString())
    
    const { count: enInbox } = await supabase
      .from('aprobaciones')
      .select('*', { count: 'exact', head: true })
      .eq('aprobador_id', usuario.id)
      .eq('estado', 'pendiente')
    
    setStats(prev => ({
      ...prev,
      procesadasHoy: procesadasHoy || 0,
      enInbox: enInbox || 0
    }))
  }
  
  const aprobarOf = async (aprobacionId: string) => {
    setProcessing(true)
    
    try {
      const { error } = await supabase
        .from('aprobaciones')
        .update({
          estado: 'aprobada',
          fecha_aprobacion: new Date().toISOString(),
          comentarios: 'Aprobado desde Mi Trabajo'
        })
        .eq('id', aprobacionId)
      
      if (error) throw error
      
      setAprobaciones(aprobaciones.filter(a => a.id !== aprobacionId))
      setSelectedItems(prev => {
        const newSet = new Set(prev)
        newSet.delete(aprobacionId)
        return newSet
      })
      
      setStats(prev => ({
        ...prev,
        procesadasHoy: prev.procesadasHoy + 1,
        enInbox: prev.enInbox - 1
      }))
      
    } catch (error: any) {
      alert('Error al aprobar: ' + error.message)
    } finally {
      setProcessing(false)
    }
  }
  
  const rechazarOf = async (aprobacionId: string) => {
    const comentario = prompt('Motivo del rechazo:')
    if (!comentario) return
    
    setProcessing(true)
    
    try {
      const { error } = await supabase
        .from('aprobaciones')
        .update({
          estado: 'rechazada',
          fecha_aprobacion: new Date().toISOString(),
          comentarios: comentario
        })
        .eq('id', aprobacionId)
      
      if (error) throw error
      
      setAprobaciones(aprobaciones.filter(a => a.id !== aprobacionId))
      setSelectedItems(prev => {
        const newSet = new Set(prev)
        newSet.delete(aprobacionId)
        return newSet
      })
      
      setStats(prev => ({
        ...prev,
        procesadasHoy: prev.procesadasHoy + 1,
        enInbox: prev.enInbox - 1
      }))
      
    } catch (error: any) {
      alert('Error al rechazar: ' + error.message)
    } finally {
      setProcessing(false)
    }
  }
  
  const aprobarSeleccionadas = async () => {
    if (selectedItems.size === 0) return
    if (!confirm(`¿Aprobar ${selectedItems.size} OFs seleccionadas?`)) return
    
    setProcessing(true)
    
    for (const id of selectedItems) {
      await aprobarOf(id)
    }
    
    setProcessing(false)
    alert(`✅ ${selectedItems.size} OFs aprobadas`)
  }
  
  const toggleSelection = (id: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }
  
  const horasHastaVencimiento = (fechaRequerida: string) => {
    const ahora = new Date()
    const vencimiento = new Date(fechaRequerida)
    const diff = vencimiento.getTime() - ahora.getTime()
    return Math.floor(diff / (1000 * 60 * 60))
  }
  
  const formatearMonto = (monto: number) => {
    if (monto >= 1000000) {
      return `$${(monto / 1000000).toFixed(1)}M`
    }
    return `$${(monto / 1000).toFixed(0)}K`
  }
  
  if (loading) {
    return (
      <div style={{ padding: 'var(--space-6)' }}>
        <div style={{ textAlign: 'center', paddingTop: 'var(--space-12)', paddingBottom: 'var(--space-12)' }}>
          <div className="loading" style={{ width: '3rem', height: '3rem', margin: '0 auto var(--space-4)' }}></div>
          <div style={{ color: 'var(--gray-400)' }}>Cargando tu centro de comando...</div>
        </div>
      </div>
    )
  }
  
  return (
    <div style={{ padding: 'var(--space-6)', maxWidth: '80rem', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h1 style={{
          fontSize: 'var(--text-3xl)',
          fontWeight: 'var(--font-bold)',
          color: 'var(--gray-900)',
          marginBottom: 'var(--space-2)'
        }}>
          ⚡ Mi Trabajo — Command Center
        </h1>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-500)' }}>
          Centro de control para {usuario?.nombre}
        </p>
      </div>
      
      {/* Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 'var(--space-4)',
        marginBottom: 'var(--space-6)'
      }}>
        <div className="stat-card">
          <div className="stat-label">En Tu Inbox</div>
          <div className="stat-value" style={{ color: 'var(--primary-600)' }}>{stats.enInbox}</div>
          <div className="stat-description">Pendientes de aprobar</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Procesadas Hoy</div>
          <div className="stat-value" style={{ color: 'var(--success-600)' }}>{stats.procesadasHoy}</div>
          <div className="stat-description">Aprobadas/Rechazadas</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Tiempo Promedio</div>
          <div className="stat-value" style={{ color: 'var(--info-600)' }}>{stats.tiempoPromedioAprobacion}d</div>
          <div className="stat-description">Meta: &lt;3 días ✅</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Ahorros del Mes</div>
          <div className="stat-value" style={{ color: 'var(--warning-600)', fontSize: 'var(--text-2xl)' }}>
            {formatearMonto(stats.ahorrosMes)}
          </div>
          <div className="stat-description">vs mes pasado: +12%</div>
        </div>
      </div>
      
      {/* Filtros */}
      <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 'var(--space-4)'
        }}>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            {[
              { value: 'urgente', label: '🔴 Urgente' },
              { value: 'hoy', label: '📅 De Hoy' },
              { value: 'todas', label: '📊 Todas' }
            ].map(f => (
              <button
                key={f.value}
                onClick={() => setFiltro(f.value)}
                className={filtro === f.value ? 'btn btn-primary' : 'btn btn-secondary'}
              >
                {f.label}
              </button>
            ))}
          </div>
          
          {selectedItems.size > 0 && (
            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-600)' }}>
                {selectedItems.size} seleccionadas
              </span>
              <button
                onClick={aprobarSeleccionadas}
                disabled={processing}
                className="btn btn-success"
              >
                ✅ Aprobar Seleccionadas
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Aprobaciones */}
      {aprobaciones.length > 0 && (
        <div style={{ marginBottom: 'var(--space-8)' }}>
          <h2 style={{
            fontSize: 'var(--text-lg)',
            fontWeight: 'var(--font-semibold)',
            color: 'var(--gray-900)',
            marginBottom: 'var(--space-4)'
          }}>
            ⚡ {filtro === 'urgente' ? 'URGENTE HOY' : 'Aprobaciones Pendientes'} ({aprobaciones.length})
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {aprobaciones.map(aprobacion => {
              const of = aprobacion.of
              const horasRestantes = of?.solicitud?.fecha_requerida 
                ? horasHastaVencimiento(of.solicitud.fecha_requerida)
                : null
              const esUrgente = horasRestantes !== null && horasRestantes < 24
              
              return (
                <div
                  key={aprobacion.id}
                  className="card"
                  style={{
                    borderWidth: '2px',
                    borderColor: selectedItems.has(aprobacion.id)
                      ? 'var(--primary-500)'
                      : esUrgente
                      ? 'var(--error-200)'
                      : 'var(--gray-200)',
                    backgroundColor: selectedItems.has(aprobacion.id)
                      ? 'var(--primary-50)'
                      : esUrgente
                      ? 'var(--error-50)'
                      : 'white'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-4)' }}>
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={selectedItems.has(aprobacion.id)}
                      onChange={() => toggleSelection(aprobacion.id)}
                      style={{
                        marginTop: 'var(--space-1)',
                        width: '1.25rem',
                        height: '1.25rem',
                        accentColor: 'var(--primary-600)',
                        cursor: 'pointer'
                      }}
                    />
                    
                    {/* Contenido */}
                    <div style={{ flex: 1 }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        marginBottom: 'var(--space-2)',
                        flexWrap: 'wrap',
                        gap: 'var(--space-3)'
                      }}>
                        <div>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-3)',
                            flexWrap: 'wrap'
                          }}>
                            <h3 style={{
                              fontWeight: 'var(--font-bold)',
                              color: 'var(--gray-900)',
                              fontSize: 'var(--text-lg)'
                            }}>
                              {of?.codigo || 'OF-####'}
                            </h3>
                            <span style={{
                              fontSize: 'var(--text-2xl)',
                              fontWeight: 'var(--font-bold)',
                              color: 'var(--primary-600)'
                            }}>
                              {formatearMonto(of?.valor_total || 0)}
                            </span>
                            {esUrgente && horasRestantes !== null && (
                              <span className="badge badge-error" style={{
                                animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                              }}>
                                🔥 VENCE EN {horasRestantes}H
                              </span>
                            )}
                          </div>
                          <p style={{
                            fontSize: 'var(--text-sm)',
                            color: 'var(--gray-600)',
                            marginTop: 'var(--space-1)'
                          }}>
                            {of?.solicitud?.descripcion || of?.descripcion || 'Sin descripción'}
                          </p>
                        </div>
                      </div>
                      
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                        gap: 'var(--space-4)',
                        marginTop: 'var(--space-3)',
                        fontSize: 'var(--text-sm)'
                      }}>
                        <div>
                          <span style={{ color: 'var(--gray-500)' }}>Proveedor:</span>
                          <div style={{ fontWeight: 'var(--font-medium)', color: 'var(--gray-900)' }}>
                            {of?.proveedor?.nombre || 'Sin asignar'}
                          </div>
                        </div>
                        <div>
                          <span style={{ color: 'var(--gray-500)' }}>Solicitó:</span>
                          <div style={{ fontWeight: 'var(--font-medium)', color: 'var(--gray-900)' }}>
                            {of?.solicitud?.solicitante?.nombre || 'N/A'}
                          </div>
                        </div>
                        <div>
                          <span style={{ color: 'var(--gray-500)' }}>Fecha Requerida:</span>
                          <div style={{ fontWeight: 'var(--font-medium)', color: 'var(--gray-900)' }}>
                            {of?.solicitud?.fecha_requerida
                              ? new Date(of.solicitud.fecha_requerida).toLocaleDateString('es-CO')
                              : 'N/A'}
                          </div>
                        </div>
                      </div>
                      
                      {/* Botones */}
                      <div style={{
                        display: 'flex',
                        gap: 'var(--space-2)',
                        marginTop: 'var(--space-4)',
                        flexWrap: 'wrap'
                      }}>
                        <button
                          onClick={() => aprobarOf(aprobacion.id)}
                          disabled={processing}
                          className="btn btn-success"
                        >
                          ✅ Aprobar
                        </button>
                        <button
                          onClick={() => rechazarOf(aprobacion.id)}
                          disabled={processing}
                          className="btn btn-error"
                        >
                          ❌ Rechazar
                        </button>
                        <button
                          onClick={() => setQuickView(of)}
                          className="btn btn-secondary"
                        >
                          👁️ Ver Detalles
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
      
      {/* Alertas */}
      {alertas.length > 0 && (
        <div style={{ marginBottom: 'var(--space-8)' }}>
          <h2 style={{
            fontSize: 'var(--text-lg)',
            fontWeight: 'var(--font-semibold)',
            color: 'var(--gray-900)',
            marginBottom: 'var(--space-4)'
          }}>
            🔴 Alertas Críticas ({alertas.length})
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {alertas.map(alerta => (
              <div key={alerta.id} className="alert alert-error">
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  gap: 'var(--space-4)'
                }}>
                  <div>
                    <h3 style={{ fontWeight: 'var(--font-semibold)' }}>{alerta.of?.codigo}</h3>
                    <p style={{ marginTop: 'var(--space-1)' }}>{alerta.mensaje}</p>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <button className="btn btn-error btn-sm">📝 Justificar</button>
                    <button className="btn btn-secondary btn-sm">🔍 Investigar</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Quick View Modal */}
      {quickView && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: '40rem', width: '90%' }}>
            <div style={{ padding: 'var(--space-6)' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 'var(--space-4)'
              }}>
                <h2 style={{
                  fontSize: 'var(--text-xl)',
                  fontWeight: 'var(--font-bold)',
                  color: 'var(--gray-900)'
                }}>
                  Quick View: {quickView.codigo}
                </h2>
                <button
                  onClick={() => setQuickView(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: 'var(--text-2xl)',
                    color: 'var(--gray-400)',
                    cursor: 'pointer'
                  }}
                >
                  ✕
                </button>
              </div>
              
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-4)'
              }}>
                <div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-500)' }}>Descripción</div>
                  <div style={{ color: 'var(--gray-900)' }}>{quickView.descripcion || 'N/A'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-500)' }}>Valor Total</div>
                  <div style={{
                    fontSize: 'var(--text-2xl)',
                    fontWeight: 'var(--font-bold)',
                    color: 'var(--primary-600)'
                  }}>
                    {formatearMonto(quickView.valor_total || 0)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-500)' }}>Proveedor</div>
                  <div style={{ color: 'var(--gray-900)' }}>{quickView.proveedor?.nombre || 'Sin asignar'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-500)' }}>Estado</div>
                  <span className="badge badge-primary">{quickView.estado}</span>
                </div>
              </div>
              
              <div style={{
                display: 'flex',
                gap: 'var(--space-2)',
                marginTop: 'var(--space-6)'
              }}>
                <button
                  onClick={() => {
                    setQuickView(null)
                    router.push(`/ordenes/${quickView.id}`)
                  }}
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                >
                  Ver Completo
                </button>
                <button
                  onClick={() => setQuickView(null)}
                  className="btn btn-secondary"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Empty State */}
      {aprobaciones.length === 0 && alertas.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
          <div style={{
            fontSize: 'var(--text-2xl)',
            fontWeight: 'var(--font-semibold)',
            color: 'var(--gray-900)',
            marginBottom: 'var(--space-2)'
          }}>
            Inbox Vacío
          </div>
          <div style={{ fontSize: 'var(--text-base)', color: 'var(--gray-500)' }}>
            No tenés pendientes urgentes.
          </div>
        </div>
      )}
    </div>
  )
}
