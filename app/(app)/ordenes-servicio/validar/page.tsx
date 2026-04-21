'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth'

type OrdenServicio = {
  id: string
  numero_os: string
  descripcion: string
  valor_total: number
  fecha_inicio_servicio: string
  fecha_fin_servicio: string
  proveedor_id: string
  proveedores?: { nombre: string }
}

type ItemOS = {
  id: string
  descripcion: string
  cantidad_aprobada: number
  cantidad_entregada: number | null
  unidad: string
  precio_unitario: number
  conforme: boolean
}

export default function ValidarServiciosPage() {
  const { usuario } = useAuth()
  const router = useRouter()
  const supabase = createClient()
  
  const [ordenes, setOrdenes] = useState<OrdenServicio[]>([])
  const [selectedOS, setSelectedOS] = useState<OrdenServicio | null>(null)
  const [items, setItems] = useState<ItemOS[]>([])
  const [loading, setLoading] = useState(true)
  const [validando, setValidando] = useState(false)
  
  // Campos de validación
  const [cantidadesCorrectas, setCantidadesCorrectas] = useState(true)
  const [calidadSatisfactoria, setCalidadSatisfactoria] = useState(true)
  const [entregaCompleta, setEntregaCompleta] = useState(true)
  const [observaciones, setObservaciones] = useState('')
  const [requiereAjustes, setRequiereAjustes] = useState(false)
  const [ajustesSolicitados, setAjustesSolicitados] = useState('')

  useEffect(() => {
    if (!usuario) {
      router.push('/login')
      return
    }
    
    if (usuario.rol !== 'admin_compras' && usuario.rol !== 'gerencia') {
      alert('No tenés permisos para validar servicios')
      router.push('/')
      return
    }
    
    cargarOrdenesEjecutadas()
  }, [usuario])

  const cargarOrdenesEjecutadas = async () => {
    setLoading(true)
    
    const { data, error } = await supabase
      .from('ordenes_servicio')
      .select(`
        *,
        proveedores (nombre)
      `)
      .eq('estado', 'ejecutada')
      .order('fecha_fin_servicio', { ascending: true })
    
    if (error) {
      console.error('Error:', error)
      alert('Error al cargar órdenes ejecutadas')
    } else {
      setOrdenes(data || [])
    }
    
    setLoading(false)
  }

  const cargarItems = async (osId: string) => {
    const { data, error } = await supabase
      .from('items_orden_servicio')
      .select('*')
      .eq('orden_servicio_id', osId)
    
    if (error) {
      console.error('Error:', error)
      alert('Error al cargar ítems')
    } else {
      setItems(data || [])
    }
  }

  const seleccionarOS = async (os: OrdenServicio) => {
    setSelectedOS(os)
    await cargarItems(os.id)
  }

  const actualizarCantidadEntregada = (itemId: string, cantidad: number) => {
    setItems(items.map(item => 
      item.id === itemId ? { ...item, cantidad_entregada: cantidad } : item
    ))
  }

  const toggleConforme = (itemId: string) => {
    setItems(items.map(item => 
      item.id === itemId ? { ...item, conforme: !item.conforme } : item
    ))
  }

  const validarServicio = async () => {
    if (!selectedOS) return
    
    if (!confirm('¿Confirmar validación de este servicio?')) return
    
    setValidando(true)
    
    try {
      // Determinar resultado
      let resultado: 'aprobado' | 'rechazado' | 'requiere_ajustes'
      
      if (requiereAjustes) {
        resultado = 'requiere_ajustes'
      } else if (cantidadesCorrectas && calidadSatisfactoria && entregaCompleta) {
        resultado = 'aprobado'
      } else {
        resultado = 'rechazado'
      }
      
      // 1. Crear registro de validación
      const { error: errorValidacion } = await supabase
        .from('validaciones_servicio')
        .insert({
          orden_servicio_id: selectedOS.id,
          validador_id: usuario?.id,
          cantidades_correctas: cantidadesCorrectas,
          calidad_satisfactoria: calidadSatisfactoria,
          entrega_completa: entregaCompleta,
          observaciones,
          requiere_ajustes: requiereAjustes,
          ajustes_solicitados: requiereAjustes ? ajustesSolicitados : null,
          resultado
        })
      
      if (errorValidacion) throw errorValidacion
      
      // 2. Actualizar cantidades entregadas y conformidad de items
      for (const item of items) {
        const { error: errorItem } = await supabase
          .from('items_orden_servicio')
          .update({
            cantidad_entregada: item.cantidad_entregada,
            conforme: item.conforme
          })
          .eq('id', item.id)
        
        if (errorItem) throw errorItem
      }
      
      // 3. Actualizar estado de la OS
      const nuevoEstado = resultado === 'aprobado' ? 'validada' : 
                         resultado === 'requiere_ajustes' ? 'en_ejecucion' : 'rechazada'
      
      const { error: errorOS } = await supabase
        .from('ordenes_servicio')
        .update({
          estado: nuevoEstado,
          validado_por: usuario?.id,
          fecha_validacion: new Date().toISOString(),
          comentarios_validacion: observaciones
        })
        .eq('id', selectedOS.id)
      
      if (errorOS) throw errorOS
      
      alert(`Servicio ${resultado === 'aprobado' ? 'validado exitosamente' : 
             resultado === 'requiere_ajustes' ? 'requiere ajustes - notificado al proveedor' : 
             'rechazado'}`)
      
      // Limpiar y recargar
      setSelectedOS(null)
      setItems([])
      resetFormulario()
      cargarOrdenesEjecutadas()
      
    } catch (error: any) {
      console.error('Error:', error)
      alert('Error al validar servicio: ' + error.message)
    } finally {
      setValidando(false)
    }
  }

  const resetFormulario = () => {
    setCantidadesCorrectas(true)
    setCalidadSatisfactoria(true)
    setEntregaCompleta(true)
    setObservaciones('')
    setRequiereAjustes(false)
    setAjustesSolicitados('')
  }

  if (loading) {
    return (
      <div style={{ padding: 'var(--space-6)' }}>
        <div style={{ textAlign: 'center', paddingTop: 'var(--space-12)', paddingBottom: 'var(--space-12)' }}>
          <div className="loading" style={{ width: '3rem', height: '3rem', margin: '0 auto var(--space-4)' }}></div>
          <div style={{ color: 'var(--gray-400)' }}>Cargando servicios...</div>
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
          Validar Servicios Ejecutados
        </h1>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-500)' }}>
          Validá la conformidad de los servicios prestados
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedOS ? '1fr 2fr' : '1fr', gap: 'var(--space-6)' }}>
        {/* Lista de Órdenes Ejecutadas */}
        <div className="card" style={{ padding: 'var(--space-6)' }}>
          <h2 style={{
            fontSize: 'var(--text-lg)',
            fontWeight: 'var(--font-semibold)',
            color: 'var(--gray-900)',
            marginBottom: 'var(--space-4)'
          }}>
            Servicios Ejecutados ({ordenes.length})
          </h2>
          
          {ordenes.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {ordenes.map(os => (
                <div
                  key={os.id}
                  onClick={() => seleccionarOS(os)}
                  style={{
                    padding: 'var(--space-4)',
                    border: selectedOS?.id === os.id ? '2px solid var(--primary-600)' : '1px solid var(--gray-300)',
                    borderRadius: 'var(--radius-lg)',
                    cursor: 'pointer',
                    background: selectedOS?.id === os.id ? 'var(--primary-50)' : 'white',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ fontWeight: 'var(--font-semibold)', color: 'var(--gray-900)', marginBottom: 'var(--space-1)' }}>
                    {os.numero_os}
                  </div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-600)', marginBottom: 'var(--space-2)' }}>
                    {os.proveedores?.nombre}
                  </div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-500)' }}>
                    Fin: {new Date(os.fecha_fin_servicio).toLocaleDateString('es-CO')}
                  </div>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--gray-900)', marginTop: 'var(--space-2)' }}>
                    ${os.valor_total.toLocaleString('es-CO')}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--gray-400)' }}>
              No hay servicios ejecutados pendientes de validación
            </div>
          )}
        </div>

        {/* Panel de Validación */}
        {selectedOS && (
          <div className="card" style={{ padding: 'var(--space-6)' }}>
            <h2 style={{
              fontSize: 'var(--text-xl)',
              fontWeight: 'var(--font-bold)',
              color: 'var(--gray-900)',
              marginBottom: 'var(--space-4)'
            }}>
              Validar: {selectedOS.numero_os}
            </h2>

            {/* Información de la OS */}
            <div style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-4)', background: 'var(--gray-50)', borderRadius: 'var(--radius-lg)' }}>
              <div style={{ marginBottom: 'var(--space-2)' }}>
                <strong>Proveedor:</strong> {selectedOS.proveedores?.nombre}
              </div>
              <div style={{ marginBottom: 'var(--space-2)' }}>
                <strong>Período:</strong> {new Date(selectedOS.fecha_inicio_servicio).toLocaleDateString('es-CO')} - {new Date(selectedOS.fecha_fin_servicio).toLocaleDateString('es-CO')}
              </div>
              <div>
                <strong>Valor Total:</strong> ${selectedOS.valor_total.toLocaleString('es-CO')}
              </div>
            </div>

            {/* Ítems del Servicio */}
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', marginBottom: 'var(--space-3)' }}>
              Ítems del Servicio
            </h3>
            
            <div style={{ marginBottom: 'var(--space-6)' }}>
              {items.map(item => (
                <div key={item.id} style={{
                  padding: 'var(--space-4)',
                  border: '1px solid var(--gray-300)',
                  borderRadius: 'var(--radius-lg)',
                  marginBottom: 'var(--space-3)'
                }}>
                  <div style={{ marginBottom: 'var(--space-3)' }}>
                    <strong>{item.descripcion}</strong>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                    <div>
                      <label className="label">Cantidad Aprobada</label>
                      <input
                        type="number"
                        value={item.cantidad_aprobada}
                        disabled
                        className="input"
                        style={{ background: 'var(--gray-100)' }}
                      />
                    </div>
                    
                    <div>
                      <label className="label label-required">Cantidad Entregada</label>
                      <input
                        type="number"
                        value={item.cantidad_entregada || ''}
                        onChange={(e) => actualizarCantidadEntregada(item.id, parseFloat(e.target.value) || 0)}
                        className="input"
                        placeholder="0"
                      />
                    </div>
                    
                    <div>
                      <label className="label">Unidad</label>
                      <input
                        type="text"
                        value={item.unidad}
                        disabled
                        className="input"
                        style={{ background: 'var(--gray-100)' }}
                      />
                    </div>
                  </div>
                  
                  <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={item.conforme}
                      onChange={() => toggleConforme(item.id)}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-700)' }}>
                      Conforme con la entrega
                    </span>
                  </label>
                </div>
              ))}
            </div>

            {/* Checklist de Validación */}
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', marginBottom: 'var(--space-3)' }}>
              Validación General
            </h3>
            
            <div style={{ marginBottom: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={cantidadesCorrectas}
                  onChange={(e) => setCantidadesCorrectas(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <span>Cantidades correctas</span>
              </label>
              
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={calidadSatisfactoria}
                  onChange={(e) => setCalidadSatisfactoria(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <span>Calidad satisfactoria</span>
              </label>
              
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={entregaCompleta}
                  onChange={(e) => setEntregaCompleta(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <span>Entrega completa</span>
              </label>
            </div>

            {/* Requiere Ajustes */}
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer', marginBottom: 'var(--space-3)' }}>
                <input
                  type="checkbox"
                  checked={requiereAjustes}
                  onChange={(e) => setRequiereAjustes(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ fontWeight: 'var(--font-semibold)' }}>Requiere ajustes</span>
              </label>
              
              {requiereAjustes && (
                <div>
                  <label className="label label-required">Ajustes Solicitados</label>
                  <textarea
                    value={ajustesSolicitados}
                    onChange={(e) => setAjustesSolicitados(e.target.value)}
                    placeholder="Describe los ajustes necesarios..."
                    rows={3}
                    className="input"
                    style={{ resize: 'vertical' }}
                  />
                </div>
              )}
            </div>

            {/* Observaciones */}
            <div style={{ marginBottom: 'var(--space-6)' }}>
              <label className="label">Observaciones</label>
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Comentarios adicionales sobre la validación..."
                rows={4}
                className="input"
                style={{ resize: 'vertical' }}
              />
            </div>

            {/* Botones */}
            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setSelectedOS(null)
                  setItems([])
                  resetFormulario()
                }}
                className="btn btn-secondary"
              >
                Cancelar
              </button>
              <button
                onClick={validarServicio}
                disabled={validando || items.some(i => i.cantidad_entregada === null)}
                className="btn btn-success"
              >
                {validando ? 'Validando...' : 'Validar Servicio'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
