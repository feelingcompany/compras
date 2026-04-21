'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth'

type Solicitud = {
  id: string
  descripcion: string
  estado: string
  solicitante_id: string
  centro_costo: string
  fecha_requerida: string
  prioridad: string
  created_at: string
  usuarios?: { nombre: string }
  cotizaciones_recibidas?: number
  cotizaciones_minimas?: number
}

export default function PipelineComprasPage() {
  const { usuario } = useAuth()
  const router = useRouter()
  const supabase = createClient()
  
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!usuario) {
      router.push('/login')
      return
    }
    
    if (usuario.rol !== 'admin_compras' && usuario.rol !== 'gerencia') {
      alert('No tenés permisos para ver el pipeline de compras')
      router.push('/')
      return
    }
    
    cargarSolicitudes()
    
    // Recargar cada 30 segundos
    const interval = setInterval(cargarSolicitudes, 30000)
    return () => clearInterval(interval)
  }, [usuario])

  const cargarSolicitudes = async () => {
    const { data, error } = await supabase
      .from('solicitudes')
      .select(`
        *,
        usuarios (nombre)
      `)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Error:', error)
    } else {
      setSolicitudes(data || [])
    }
    
    setLoading(false)
  }

  // Agrupar solicitudes por etapa
  const etapas = [
    {
      id: 'pendiente',
      titulo: 'Pendiente Aprobación',
      color: 'var(--warning-600)',
      descripcion: 'Esperando aprobación',
      solicitudes: solicitudes.filter(s => s.estado === 'pendiente')
    },
    {
      id: 'aprobada',
      titulo: 'Solicitar Cotizaciones',
      color: 'var(--info-600)',
      descripcion: 'Aprobadas, solicitar mínimo 2 cotizaciones',
      solicitudes: solicitudes.filter(s => s.estado === 'aprobada' && (s.cotizaciones_recibidas || 0) < (s.cotizaciones_minimas || 2))
    },
    {
      id: 'cotizando',
      titulo: 'En Cotización',
      color: 'var(--primary-600)',
      descripcion: 'Recibiendo cotizaciones',
      solicitudes: solicitudes.filter(s => s.estado === 'aprobada' && (s.cotizaciones_recibidas || 0) >= (s.cotizaciones_minimas || 2))
    },
    {
      id: 'os',
      titulo: 'Crear Orden Servicio',
      color: 'var(--success-600)',
      descripcion: 'Listas para crear OS',
      solicitudes: [] // TODO: vincular con cotizaciones seleccionadas
    },
    {
      id: 'ejecucion',
      titulo: 'En Ejecución',
      color: 'var(--purple-600)',
      descripcion: 'Servicios en proceso',
      solicitudes: [] // TODO: vincular con OS en ejecución
    },
    {
      id: 'validacion',
      titulo: 'Por Validar',
      color: 'var(--orange-600)',
      descripcion: 'Servicios ejecutados',
      solicitudes: [] // TODO: vincular con OS ejecutadas
    }
  ]

  const getPrioridadColor = (prioridad: string) => {
    switch (prioridad) {
      case 'critico': return 'var(--error-600)'
      case 'urgente': return 'var(--warning-600)'
      default: return 'var(--gray-600)'
    }
  }

  const getDiasDesdeCreacion = (fecha: string) => {
    const ahora = new Date()
    const creacion = new Date(fecha)
    const diff = ahora.getTime() - creacion.getTime()
    return Math.floor(diff / (1000 * 60 * 60 * 24))
  }

  if (loading) {
    return (
      <div style={{ padding: 'var(--space-6)' }}>
        <div style={{ textAlign: 'center', paddingTop: 'var(--space-12)', paddingBottom: 'var(--space-12)' }}>
          <div className="loading" style={{ width: '3rem', height: '3rem', margin: '0 auto var(--space-4)' }}></div>
          <div style={{ color: 'var(--gray-400)' }}>Cargando pipeline...</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: 'var(--space-6)', minHeight: '100vh', background: 'var(--gray-50)' }}>
      {/* Header */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h1 style={{
          fontSize: 'var(--text-3xl)',
          fontWeight: 'var(--font-bold)',
          color: 'var(--gray-900)',
          marginBottom: 'var(--space-2)'
        }}>
          Pipeline de Compras
        </h1>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-500)' }}>
          Vista general del proceso de compras en tiempo real
        </p>
      </div>

      {/* Stats Rápidos */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 'var(--space-4)',
        marginBottom: 'var(--space-6)'
      }}>
        <div className="stat-card">
          <div className="stat-label">Total Activas</div>
          <div className="stat-value">{solicitudes.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pendiente Aprobación</div>
          <div className="stat-value" style={{ color: 'var(--warning-600)' }}>
            {etapas[0].solicitudes.length}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">En Cotización</div>
          <div className="stat-value" style={{ color: 'var(--primary-600)' }}>
            {etapas[1].solicitudes.length + etapas[2].solicitudes.length}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Críticas</div>
          <div className="stat-value" style={{ color: 'var(--error-600)' }}>
            {solicitudes.filter(s => s.prioridad === 'critico').length}
          </div>
        </div>
      </div>

      {/* Pipeline Kanban */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: 'var(--space-4)',
        overflowX: 'auto'
      }}>
        {etapas.map(etapa => (
          <div
            key={etapa.id}
            style={{
              background: 'white',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--gray-200)',
              display: 'flex',
              flexDirection: 'column',
              minHeight: '500px'
            }}
          >
            {/* Header de la columna */}
            <div style={{
              padding: 'var(--space-4)',
              borderBottom: '2px solid ' + etapa.color,
              background: 'var(--gray-50)'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 'var(--space-2)'
              }}>
                <h3 style={{
                  fontSize: 'var(--text-base)',
                  fontWeight: 'var(--font-bold)',
                  color: 'var(--gray-900)'
                }}>
                  {etapa.titulo}
                </h3>
                <div style={{
                  background: etapa.color,
                  color: 'white',
                  borderRadius: 'var(--radius-full)',
                  padding: '0.25rem 0.75rem',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 'var(--font-bold)'
                }}>
                  {etapa.solicitudes.length}
                </div>
              </div>
              <p style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--gray-500)'
              }}>
                {etapa.descripcion}
              </p>
            </div>

            {/* Tarjetas de solicitudes */}
            <div style={{
              flex: 1,
              padding: 'var(--space-3)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3)',
              overflowY: 'auto'
            }}>
              {etapa.solicitudes.length > 0 ? (
                etapa.solicitudes.map(sol => (
                  <div
                    key={sol.id}
                    onClick={() => router.push(`/solicitudes/${sol.id}`)}
                    style={{
                      padding: 'var(--space-4)',
                      border: '1px solid var(--gray-200)',
                      borderRadius: 'var(--radius-lg)',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      background: 'white',
                      borderLeft: `4px solid ${getPrioridadColor(sol.prioridad)}`
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = 'var(--shadow-md)'
                      e.currentTarget.style.transform = 'translateY(-2px)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = 'none'
                      e.currentTarget.style.transform = 'translateY(0)'
                    }}
                  >
                    {/* Prioridad */}
                    <div style={{ marginBottom: 'var(--space-2)' }}>
                      <span className="badge" style={{
                        background: getPrioridadColor(sol.prioridad),
                        color: 'white',
                        fontSize: 'var(--text-xs)'
                      }}>
                        {sol.prioridad.toUpperCase()}
                      </span>
                    </div>

                    {/* Descripción */}
                    <div style={{
                      fontSize: 'var(--text-sm)',
                      fontWeight: 'var(--font-semibold)',
                      color: 'var(--gray-900)',
                      marginBottom: 'var(--space-2)',
                      lineHeight: '1.4'
                    }}>
                      {sol.descripcion.substring(0, 80)}
                      {sol.descripcion.length > 80 && '...'}
                    </div>

                    {/* Centro de costo */}
                    <div style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--gray-600)',
                      marginBottom: 'var(--space-3)'
                    }}>
                      {sol.centro_costo}
                    </div>

                    {/* Footer */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingTop: 'var(--space-3)',
                      borderTop: '1px solid var(--gray-200)',
                      fontSize: 'var(--text-xs)',
                      color: 'var(--gray-500)'
                    }}>
                      <div>
                        {sol.usuarios?.nombre}
                      </div>
                      <div>
                        Hace {getDiasDesdeCreacion(sol.created_at)}d
                      </div>
                    </div>

                    {/* Progreso de cotizaciones si aplica */}
                    {etapa.id === 'aprobada' && (
                      <div style={{ marginTop: 'var(--space-2)' }}>
                        <div style={{
                          fontSize: 'var(--text-xs)',
                          color: 'var(--gray-600)',
                          marginBottom: 'var(--space-1)'
                        }}>
                          Cotizaciones: {sol.cotizaciones_recibidas || 0} / {sol.cotizaciones_minimas || 2}
                        </div>
                        <div style={{
                          height: '4px',
                          background: 'var(--gray-200)',
                          borderRadius: 'var(--radius-full)',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            height: '100%',
                            background: (sol.cotizaciones_recibidas || 0) >= (sol.cotizaciones_minimas || 2) 
                              ? 'var(--success-600)' 
                              : 'var(--warning-600)',
                            width: `${((sol.cotizaciones_recibidas || 0) / (sol.cotizaciones_minimas || 2)) * 100}%`,
                            transition: 'width 0.3s'
                          }}></div>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div style={{
                  padding: 'var(--space-8)',
                  textAlign: 'center',
                  color: 'var(--gray-400)',
                  fontSize: 'var(--text-sm)'
                }}>
                  No hay solicitudes en esta etapa
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
