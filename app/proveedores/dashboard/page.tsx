'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ProveedoresDashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [proveedor, setProveedor] = useState<any>(null)
  const [ofs, setOfs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('todas')
  
  useEffect(() => {
    const sessionData = localStorage.getItem('proveedor_portal')
    if (!sessionData) {
      router.push('/proveedores/login')
      return
    }
    
    const proveedorData = JSON.parse(sessionData)
    setProveedor(proveedorData)
    cargarOfs(proveedorData.proveedor.id)
  }, [])
  
  const cargarOfs = async (proveedorId: string) => {
    setLoading(true)
    
    const { data, error } = await supabase
      .from('ofs')
      .select(`
        *,
        solicitud:solicitudes(
          descripcion,
          solicitante:usuarios(nombre)
        )
      `)
      .eq('proveedor_id', proveedorId)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Error:', error)
      alert('Error al cargar OFs')
    } else {
      setOfs(data || [])
    }
    
    setLoading(false)
  }
  
  const logout = () => {
    localStorage.removeItem('proveedor_portal')
    router.push('/proveedores/login')
  }
  
  const actualizarEstado = async (ofId: string, nuevoEstado: string) => {
    if (!confirm(`¿Cambiar estado a "${nuevoEstado}"?`)) return
    
    try {
      const { error: errorOf } = await supabase
        .from('ofs')
        .update({ estado: nuevoEstado })
        .eq('id', ofId)
      
      if (errorOf) throw errorOf
      
      const { error: errorUpdate } = await supabase
        .from('actualizaciones_proveedor')
        .insert({
          of_id: ofId,
          proveedor_id: proveedor.proveedor.id,
          tipo: 'estado',
          estado_nuevo: nuevoEstado,
          contenido: `Estado actualizado a ${nuevoEstado}`
        })
      
      if (errorUpdate) throw errorUpdate
      
      alert('✅ Estado actualizado')
      cargarOfs(proveedor.proveedor.id)
      
    } catch (error: any) {
      console.error('Error:', error)
      alert('Error al actualizar: ' + error.message)
    }
  }
  
  const ofsFiltradas = ofs.filter(of => {
    if (filtro === 'pendientes') {
      return of.estado === 'aprobada' || of.estado === 'radicada'
    }
    if (filtro === 'entregadas') {
      return of.estado === 'recibida' || of.estado === 'pagada'
    }
    return true
  })
  
  const estadisticas = {
    pendientes: ofs.filter(of => of.estado === 'aprobada' || of.estado === 'radicada').length,
    entregadas: ofs.filter(of => of.estado === 'recibida').length,
    pagadas: ofs.filter(of => of.estado === 'pagada').length,
    totalFacturado: ofs
      .filter(of => of.estado === 'pagada')
      .reduce((sum, of) => sum + (of.valor_total || 0), 0),
    pendientePago: ofs
      .filter(of => of.estado === 'recibida')
      .reduce((sum, of) => sum + (of.valor_total || 0), 0)
  }
  
  const formatearMonto = (monto: number) => {
    if (monto >= 1000000) {
      return `$${(monto / 1000000).toFixed(1)}M`
    }
    return `$${(monto / 1000).toFixed(0)}K`
  }
  
  if (!proveedor) {
    return null
  }
  
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--gray-50)' }}>
      {/* Header */}
      <div style={{
        backgroundColor: 'white',
        borderBottom: '1px solid var(--gray-200)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{
          maxWidth: '80rem',
          margin: '0 auto',
          padding: 'var(--space-6)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h1 style={{
              fontSize: 'var(--text-2xl)',
              fontWeight: 'var(--font-bold)',
              color: 'var(--gray-900)',
              marginBottom: 'var(--space-1)'
            }}>
              Portal de Proveedores
            </h1>
            <p style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--gray-500)'
            }}>
              {proveedor.proveedor.nombre}
            </p>
          </div>
          <button
            onClick={logout}
            className="btn btn-secondary"
          >
            Cerrar Sesión
          </button>
        </div>
      </div>
      
      <div style={{
        maxWidth: '80rem',
        margin: '0 auto',
        padding: 'var(--space-8)'
      }}>
        {/* Estadísticas */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-8)'
        }}>
          <div className="stat-card">
            <div className="stat-label">Pendientes de Entregar</div>
            <div className="stat-value" style={{ color: 'var(--warning-600)' }}>
              {estadisticas.pendientes}
            </div>
            <div className="stat-description">OFs aprobadas</div>
          </div>
          
          <div className="stat-card">
            <div className="stat-label">Entregadas</div>
            <div className="stat-value" style={{ color: 'var(--success-600)' }}>
              {estadisticas.entregadas}
            </div>
            <div className="stat-description">Sin pagar</div>
          </div>
          
          <div className="stat-card">
            <div className="stat-label">Pagadas</div>
            <div className="stat-value" style={{ color: 'var(--primary-600)' }}>
              {estadisticas.pagadas}
            </div>
            <div className="stat-description">Completadas</div>
          </div>
          
          <div className="stat-card">
            <div className="stat-label">Total Facturado</div>
            <div className="stat-value" style={{ color: 'var(--gray-900)', fontSize: 'var(--text-2xl)' }}>
              {formatearMonto(estadisticas.totalFacturado)}
            </div>
            <div className="stat-description">Pagado</div>
          </div>
          
          <div className="stat-card">
            <div className="stat-label">Pendiente de Pago</div>
            <div className="stat-value" style={{ color: 'var(--warning-600)', fontSize: 'var(--text-2xl)' }}>
              {formatearMonto(estadisticas.pendientePago)}
            </div>
            <div className="stat-description">Por cobrar</div>
          </div>
        </div>
        
        {/* Filtros */}
        <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            {[
              { value: 'todas', label: 'Todas las OFs' },
              { value: 'pendientes', label: 'Pendientes de Entregar' },
              { value: 'entregadas', label: 'Entregadas' }
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
        </div>
        
        {/* Lista de OFs */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {loading ? (
            <div style={{
              padding: 'var(--space-12)',
              textAlign: 'center',
              color: 'var(--gray-400)'
            }}>
              <div className="loading" style={{
                width: '3rem',
                height: '3rem',
                margin: '0 auto var(--space-4)'
              }}></div>
              Cargando...
            </div>
          ) : ofsFiltradas.length === 0 ? (
            <div style={{
              padding: 'var(--space-12)',
              textAlign: 'center'
            }}>
              <div style={{
                fontSize: 'var(--text-lg)',
                fontWeight: 'var(--font-semibold)',
                color: 'var(--gray-900)',
                marginBottom: 'var(--space-2)'
              }}>
                No hay OFs con este filtro
              </div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-500)' }}>
                Intentá con otro filtro
              </div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Descripción</th>
                    <th>Valor</th>
                    <th>Estado</th>
                    <th>Fecha</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {ofsFiltradas.map(of => (
                    <tr key={of.id}>
                      <td style={{ fontWeight: 'var(--font-semibold)' }}>{of.codigo}</td>
                      <td style={{ maxWidth: '300px' }}>
                        <div style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {of.solicitud?.descripcion || of.descripcion || '-'}
                        </div>
                      </td>
                      <td style={{ fontWeight: 'var(--font-semibold)' }}>
                        {formatearMonto(of.valor_total)}
                      </td>
                      <td>
                        <span className={`badge ${
                          of.estado === 'aprobada' ? 'badge-warning' :
                          of.estado === 'radicada' ? 'badge-warning' :
                          of.estado === 'recibida' ? 'badge-success' :
                          of.estado === 'pagada' ? 'badge-primary' :
                          'badge-primary'
                        }`}>
                          {of.estado}
                        </span>
                      </td>
                      <td>
                        {new Date(of.created_at).toLocaleDateString('es-CO')}
                      </td>
                      <td>
                        {(of.estado === 'aprobada' || of.estado === 'radicada') && (
                          <button
                            onClick={() => actualizarEstado(of.id, 'recibida')}
                            className="btn btn-success btn-sm"
                          >
                            Marcar Entregada
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
