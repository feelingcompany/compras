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
  const [solicitudes, setSolicitudes] = useState<any[]>([])
  const [ofsSinCotizacion, setOfsSinCotizacion] = useState<any[]>([])
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [quickView, setQuickView] = useState<any>(null)
  const [filtro, setFiltro] = useState('urgente') // urgente, todas, hoy
  const [processing, setProcessing] = useState(false)
  
  // Stats
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
      cargarAlertas(),
      cargarSolicitudes(),
      cargarOfsSinCotizacion()
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
        of:ofs(
          codigo,
          descripcion,
          valor_total,
          proveedor:proveedores(nombre)
        )
      `)
      .eq('activa', true)
      .in('tipo', ['sobrecosto', 'vencimiento'])
      .order('created_at', { ascending: false})
      .limit(5)
    
    setAlertas(data || [])
  }
  
  const cargarSolicitudes = async () => {
    const { data } = await supabase
      .from('solicitudes')
      .select(`
        *,
        solicitante:usuarios(nombre)
      `)
      .eq('estado', 'pendiente')
      .order('created_at', { ascending: false })
      .limit(5)
    
    setSolicitudes(data || [])
  }
  
  const cargarOfsSinCotizacion = async () => {
    const { data } = await supabase
      .from('ofs')
      .select(`
        *,
        proveedor:proveedores(nombre),
        solicitud:solicitudes(descripcion, solicitante:usuarios(nombre))
      `)
      .eq('estado', 'borrador')
      .is('proveedor_id', null)
      .order('created_at', { ascending: false })
      .limit(5)
    
    setOfsSinCotizacion(data || [])
  }
  
  const calcularStats = async () => {
    if (!usuario) return
    
    const hoy = new Date()
    const inicioHoy = new Date(hoy.setHours(0, 0, 0, 0))
    
    // Procesadas hoy
    const { count: procesadasHoy } = await supabase
      .from('aprobaciones')
      .select('*', { count: 'exact', head: true })
      .eq('aprobador_id', usuario.id)
      .in('estado', ['aprobada', 'rechazada'])
      .gte('updated_at', inicioHoy.toISOString())
    
    // En inbox
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
      
      // Quitar de la lista
      setAprobaciones(aprobaciones.filter(a => a.id !== aprobacionId))
      setSelectedItems(prev => {
        const newSet = new Set(prev)
        newSet.delete(aprobacionId)
        return newSet
      })
      
      // Actualizar stats
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
      const { error} = await supabase
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
      <div className="p-6">
        <div className="text-center py-12">
          <div className="text-gray-400">Cargando tu centro de comando...</div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">⚡ Mi Trabajo — Command Center</h1>
        <p className="text-sm text-gray-500 mt-1">Centro de control para {usuario?.nombre}</p>
      </div>
      
      {/* Stats Rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-xs text-gray-500 uppercase font-medium">En Tu Inbox</div>
          <div className="text-3xl font-bold text-blue-600 mt-1">{stats.enInbox}</div>
          <div className="text-xs text-gray-400 mt-1">Pendientes de aprobar</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-xs text-gray-500 uppercase font-medium">Procesadas Hoy</div>
          <div className="text-3xl font-bold text-green-600 mt-1">{stats.procesadasHoy}</div>
          <div className="text-xs text-gray-400 mt-1">Aprobadas/Rechazadas</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-xs text-gray-500 uppercase font-medium">Tiempo Promedio</div>
          <div className="text-3xl font-bold text-purple-600 mt-1">{stats.tiempoPromedioAprobacion}d</div>
          <div className="text-xs text-gray-400 mt-1">Meta: &lt;3 días ✅</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-xs text-gray-500 uppercase font-medium">Ahorros del Mes</div>
          <div className="text-2xl font-bold text-orange-600 mt-1">{formatearMonto(stats.ahorrosMes)}</div>
          <div className="text-xs text-gray-400 mt-1">vs mes pasado: +12%</div>
        </div>
      </div>
      
      {/* Filtros */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex gap-2">
            {[
              { value: 'urgente', label: '🔴 Urgente' },
              { value: 'hoy', label: '📅 De Hoy' },
              { value: 'todas', label: '📊 Todas' }
            ].map(f => (
              <button
                key={f.value}
                onClick={() => setFiltro(f.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filtro === f.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          
          {selectedItems.size > 0 && (
            <div className="flex gap-2 items-center">
              <span className="text-sm text-gray-600">{selectedItems.size} seleccionadas</span>
              <button
                onClick={aprobarSeleccionadas}
                disabled={processing}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-50"
              >
                ✅ Aprobar Seleccionadas
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* APROBACIONES PENDIENTES */}
      {aprobaciones.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            ⚡ {filtro === 'urgente' ? 'URGENTE HOY' : 'Aprobaciones Pendientes'} ({aprobaciones.length})
          </h2>
          <div className="space-y-3">
            {aprobaciones.map(aprobacion => {
              const of = aprobacion.of
              const horasRestantes = of?.solicitud?.fecha_requerida 
                ? horasHastaVencimiento(of.solicitud.fecha_requerida)
                : null
              const esUrgente = horasRestantes !== null && horasRestantes < 24
              
              return (
                <div
                  key={aprobacion.id}
                  className={`bg-white rounded-lg border-2 p-4 transition-all ${
                    selectedItems.has(aprobacion.id)
                      ? 'border-blue-500 bg-blue-50'
                      : esUrgente
                      ? 'border-red-200 bg-red-50'
                      : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={selectedItems.has(aprobacion.id)}
                      onChange={() => toggleSelection(aprobacion.id)}
                      className="mt-1 w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    
                    {/* Contenido */}
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="flex items-center gap-3 flex-wrap">
                            <h3 className="font-bold text-gray-900 text-lg">
                              {of?.codigo || 'OF-####'}
                            </h3>
                            <span className="text-2xl font-bold text-blue-600">
                              {formatearMonto(of?.valor_total || 0)}
                            </span>
                            {esUrgente && horasRestantes !== null && (
                              <span className="px-2 py-1 bg-red-600 text-white text-xs font-bold rounded-full animate-pulse">
                                🔥 VENCE EN {horasRestantes}H
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            {of?.solicitud?.descripcion || of?.descripcion || 'Sin descripción'}
                          </p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3 text-sm">
                        <div>
                          <span className="text-gray-500">Proveedor:</span>
                          <div className="font-medium text-gray-900">
                            {of?.proveedor?.nombre || 'Sin asignar'}
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-500">Solicitó:</span>
                          <div className="font-medium text-gray-900">
                            {of?.solicitud?.solicitante?.nombre || 'N/A'}
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-500">Fecha Requerida:</span>
                          <div className="font-medium text-gray-900">
                            {of?.solicitud?.fecha_requerida
                              ? new Date(of.solicitud.fecha_requerida).toLocaleDateString('es-CO')
                              : 'N/A'}
                          </div>
                        </div>
                      </div>
                      
                      {/* Botones de Acción */}
                      <div className="flex gap-2 mt-4 flex-wrap">
                        <button
                          onClick={() => aprobarOf(aprobacion.id)}
                          disabled={processing}
                          className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50 transition-colors"
                        >
                          ✅ Aprobar
                        </button>
                        <button
                          onClick={() => rechazarOf(aprobacion.id)}
                          disabled={processing}
                          className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50 transition-colors"
                        >
                          ❌ Rechazar
                        </button>
                        <button
                          onClick={() => setQuickView(of)}
                          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
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
      
      {/* ALERTAS CRÍTICAS */}
      {alertas.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">🔴 Alertas Críticas ({alertas.length})</h2>
          <div className="space-y-2">
            {alertas.map(alerta => (
              <div key={alerta.id} className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex justify-between items-start flex-wrap gap-4">
                  <div>
                    <h3 className="font-semibold text-red-900">{alerta.of?.codigo}</h3>
                    <p className="text-sm text-red-700 mt-1">{alerta.mensaje}</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700">
                      📝 Justificar
                    </button>
                    <button className="px-3 py-1 border border-red-300 text-red-700 rounded text-sm hover:bg-red-100">
                      🔍 Investigar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Grid de Secciones Secundarias */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* SOLICITUDES PENDIENTES */}
        {solicitudes.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3">📋 Solicitudes Pendientes ({solicitudes.length})</h3>
            <div className="space-y-2">
              {solicitudes.slice(0, 3).map(sol => (
                <div key={sol.id} className="p-3 bg-gray-50 rounded border border-gray-200 hover:bg-gray-100 cursor-pointer">
                  <div className="text-sm font-medium text-gray-900">{sol.descripcion}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Por: {sol.solicitante?.nombre || 'N/A'}
                  </div>
                </div>
              ))}
              <button
                onClick={() => router.push('/solicitudes')}
                className="w-full text-sm text-blue-600 hover:text-blue-700 font-medium mt-2"
              >
                Ver todas →
              </button>
            </div>
          </div>
        )}
        
        {/* OFs SIN COTIZACIÓN */}
        {ofsSinCotizacion.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3">💰 OFs Sin Cotización ({ofsSinCotizacion.length})</h3>
            <div className="space-y-2">
              {ofsSinCotizacion.slice(0, 3).map(of => (
                <div key={of.id} className="p-3 bg-orange-50 rounded border border-orange-200">
                  <div className="text-sm font-medium text-gray-900">{of.codigo}</div>
                  <div className="text-xs text-gray-600 mt-1">{of.solicitud?.descripcion}</div>
                  <button className="text-xs text-orange-600 hover:text-orange-700 font-medium mt-2">
                    Asignar a Encargado →
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Quick View Modal */}
      {quickView && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-bold text-gray-900">Quick View: {quickView.codigo}</h2>
                <button
                  onClick={() => setQuickView(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ✕
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <div className="text-sm text-gray-500">Descripción</div>
                  <div className="text-gray-900">{quickView.descripcion || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Valor Total</div>
                  <div className="text-2xl font-bold text-blue-600">
                    {formatearMonto(quickView.valor_total || 0)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Proveedor</div>
                  <div className="text-gray-900">{quickView.proveedor?.nombre || 'Sin asignar'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Estado</div>
                  <div className="text-gray-900">{quickView.estado}</div>
                </div>
              </div>
              
              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => {
                    setQuickView(null)
                    router.push(`/ordenes/${quickView.id}`)
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Ver Completo
                </button>
                <button
                  onClick={() => setQuickView(null)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Empty State */}
      {aprobaciones.length === 0 && alertas.length === 0 && solicitudes.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <div className="text-6xl mb-4">🎉</div>
          <div className="text-xl font-semibold text-gray-900">¡Inbox Vacío!</div>
          <div className="text-gray-500 mt-2">No tenés pendientes urgentes. Buen trabajo.</div>
        </div>
      )}
    </div>
  )
}
