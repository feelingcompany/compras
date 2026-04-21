'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth'

type OrdenServicio = {
  id: string
  numero_os: string
  solicitud_id: string
  proveedor_id: string
  descripcion: string
  valor_total: number
  fecha_emision: string
  fecha_inicio_servicio: string
  fecha_fin_servicio: string
  estado: string
  proveedores?: { nombre: string }
}

export default function OrdenesServicioPage() {
  const { usuario } = useAuth()
  const router = useRouter()
  const supabase = createClient()
  
  const [ordenes, setOrdenes] = useState<OrdenServicio[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<string>('todas')

  useEffect(() => {
    if (!usuario) {
      router.push('/login')
      return
    }
    cargarOrdenes()
  }, [usuario])

  const cargarOrdenes = async () => {
    setLoading(true)
    
    const { data, error } = await supabase
      .from('ordenes_servicio')
      .select(`
        *,
        proveedores (nombre)
      `)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Error:', error)
      alert('Error al cargar órdenes de servicio')
    } else {
      setOrdenes(data || [])
    }
    
    setLoading(false)
  }

  const ordenesFiltradas = filtro === 'todas' 
    ? ordenes 
    : ordenes.filter(o => o.estado === filtro)

  const estadoColors: Record<string, string> = {
    pendiente: 'badge-warning',
    aprobada: 'badge-primary',
    en_ejecucion: 'badge-info',
    ejecutada: 'badge-success',
    validada: 'badge-success',
    rechazada: 'badge-error',
    cancelada: 'badge-error'
  }

  const estadoLabels: Record<string, string> = {
    pendiente: 'Pendiente',
    aprobada: 'Aprobada',
    en_ejecucion: 'En Ejecución',
    ejecutada: 'Ejecutada',
    validada: 'Validada',
    rechazada: 'Rechazada',
    cancelada: 'Cancelada'
  }

  if (loading) {
    return (
      <div style={{ padding: 'var(--space-6)' }}>
        <div style={{ textAlign: 'center', paddingTop: 'var(--space-12)', paddingBottom: 'var(--space-12)' }}>
          <div className="loading" style={{ width: '3rem', height: '3rem', margin: '0 auto var(--space-4)' }}></div>
          <div style={{ color: 'var(--gray-400)' }}>Cargando órdenes de servicio...</div>
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
          Órdenes de Servicio (OS)
        </h1>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-500)' }}>
          Gestión de órdenes de servicio aprobadas
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
          <div className="stat-label">Pendientes</div>
          <div className="stat-value" style={{ color: 'var(--warning-600)' }}>
            {ordenes.filter(o => o.estado === 'pendiente').length}
          </div>
          <div className="stat-description">Por aprobar</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">En Ejecución</div>
          <div className="stat-value" style={{ color: 'var(--info-600)' }}>
            {ordenes.filter(o => o.estado === 'en_ejecucion').length}
          </div>
          <div className="stat-description">Prestando servicio</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Ejecutadas</div>
          <div className="stat-value" style={{ color: 'var(--primary-600)' }}>
            {ordenes.filter(o => o.estado === 'ejecutada').length}
          </div>
          <div className="stat-description">Por validar</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Validadas</div>
          <div className="stat-value" style={{ color: 'var(--success-600)' }}>
            {ordenes.filter(o => o.estado === 'validada').length}
          </div>
          <div className="stat-description">Listas para facturar</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          {[
            { value: 'todas', label: 'Todas' },
            { value: 'pendiente', label: 'Pendientes' },
            { value: 'en_ejecucion', label: 'En Ejecución' },
            { value: 'ejecutada', label: 'Ejecutadas' },
            { value: 'validada', label: 'Validadas' }
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

      {/* Tabla de Órdenes */}
      {ordenesFiltradas.length > 0 ? (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Número OS</th>
                  <th>Proveedor</th>
                  <th>Descripción</th>
                  <th>Valor</th>
                  <th>Fecha Servicio</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {ordenesFiltradas.map(os => (
                  <tr key={os.id}>
                    <td style={{ fontWeight: 'var(--font-semibold)' }}>
                      {os.numero_os}
                    </td>
                    <td>{os.proveedores?.nombre || 'N/A'}</td>
                    <td>{os.descripcion.substring(0, 50)}...</td>
                    <td>
                      ${os.valor_total.toLocaleString('es-CO')}
                    </td>
                    <td style={{ fontSize: 'var(--text-sm)' }}>
                      {new Date(os.fecha_inicio_servicio).toLocaleDateString('es-CO')}
                      {' - '}
                      {new Date(os.fecha_fin_servicio).toLocaleDateString('es-CO')}
                    </td>
                    <td>
                      <span className={`badge ${estadoColors[os.estado]}`}>
                        {estadoLabels[os.estado]}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => router.push(`/ordenes-servicio/${os.id}`)}
                        className="btn btn-sm btn-secondary"
                      >
                        Ver Detalles
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
          <h2 style={{
            fontSize: 'var(--text-xl)',
            fontWeight: 'var(--font-semibold)',
            color: 'var(--gray-900)',
            marginBottom: 'var(--space-2)'
          }}>
            No hay órdenes de servicio
          </h2>
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--gray-500)' }}>
            Las órdenes de servicio se crean desde cotizaciones aprobadas
          </p>
        </div>
      )}
    </div>
  )
}
