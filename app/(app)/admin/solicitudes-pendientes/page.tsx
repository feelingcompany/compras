'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth'
import { useRouter } from 'next/navigation'

export default function SolicitudesPendientesPage() {
  const { usuario } = useAuth()
  const router = useRouter()
  const supabase = createClient()
  
  const [solicitudes, setSolicitudes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  
  useEffect(() => {
    if (!usuario) {
      router.push('/login')
      return
    }
    
    if (usuario.rol !== 'admin_compras' && usuario.rol !== 'gerencia') {
      alert('No tenés permisos para acceder a esta página')
      router.push('/')
      return
    }
    
    cargarSolicitudes()
  }, [usuario])
  
  const cargarSolicitudes = async () => {
    setLoading(true)
    
    const { data, error } = await supabase
      .from('solicitudes_acceso')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Error:', error)
      alert('Error al cargar solicitudes')
    } else {
      setSolicitudes(data || [])
    }
    
    setLoading(false)
  }
  
  const aprobar = async (solicitud: any) => {
    if (!confirm(`¿Aprobar acceso para ${solicitud.nombre_completo}?`)) return
    
    setProcessing(solicitud.id)
    
    try {
      const { error: errorUsuario } = await supabase
        .from('usuarios')
        .insert({
          nombre: solicitud.nombre_completo,
          email: solicitud.email,
          pin: solicitud.pin,
          rol: 'solicitante',
          area: solicitud.area,
          activo: true
        })
      
      if (errorUsuario) throw errorUsuario
      
      const { error: errorSolicitud } = await supabase
        .from('solicitudes_acceso')
        .update({
          estado: 'aprobado',
          aprobado_por: usuario?.id,
          aprobado_en: new Date().toISOString()
        })
        .eq('id', solicitud.id)
      
      if (errorSolicitud) throw errorSolicitud
      
      alert(`Acceso aprobado para ${solicitud.nombre_completo}`)
      cargarSolicitudes()
      
    } catch (error: any) {
      console.error('Error:', error)
      alert('Error al aprobar: ' + error.message)
    } finally {
      setProcessing(null)
    }
  }
  
  const rechazar = async (solicitud: any) => {
    const motivo = prompt('¿Por qué se rechaza esta solicitud?')
    if (!motivo) return
    
    setProcessing(solicitud.id)
    
    try {
      const { error } = await supabase
        .from('solicitudes_acceso')
        .update({
          estado: 'rechazado',
          motivo_rechazo: motivo,
          aprobado_por: usuario?.id,
          aprobado_en: new Date().toISOString()
        })
        .eq('id', solicitud.id)
      
      if (error) throw error
      
      alert('Solicitud rechazada')
      cargarSolicitudes()
      
    } catch (error: any) {
      console.error('Error:', error)
      alert('Error al rechazar: ' + error.message)
    } finally {
      setProcessing(null)
    }
  }
  
  const pendientes = solicitudes.filter(s => s.estado === 'pendiente')
  const aprobadas = solicitudes.filter(s => s.estado === 'aprobado')
  const rechazadas = solicitudes.filter(s => s.estado === 'rechazado')
  
  if (loading) {
    return (
      <div style={{ padding: 'var(--space-6)' }}>
        <div style={{ textAlign: 'center', paddingTop: 'var(--space-12)', paddingBottom: 'var(--space-12)' }}>
          <div className="loading" style={{ width: '3rem', height: '3rem', margin: '0 auto var(--space-4)' }}></div>
          <div style={{ color: 'var(--gray-400)' }}>Cargando solicitudes...</div>
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
          Solicitudes de Acceso
        </h1>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-500)' }}>
          Aprobá o rechazá solicitudes de nuevos empleados
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
          <div className="stat-value" style={{ color: 'var(--warning-600)' }}>{pendientes.length}</div>
          <div className="stat-description">Por aprobar</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Aprobadas</div>
          <div className="stat-value" style={{ color: 'var(--success-600)' }}>{aprobadas.length}</div>
          <div className="stat-description">Acceso concedido</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Rechazadas</div>
          <div className="stat-value" style={{ color: 'var(--error-600)' }}>{rechazadas.length}</div>
          <div className="stat-description">Sin acceso</div>
        </div>
      </div>
      
      {/* Pendientes */}
      {pendientes.length > 0 && (
        <div style={{ marginBottom: 'var(--space-8)' }}>
          <h2 style={{
            fontSize: 'var(--text-lg)',
            fontWeight: 'var(--font-semibold)',
            color: 'var(--gray-900)',
            marginBottom: 'var(--space-4)'
          }}>
            Pendientes de Aprobación
          </h2>
          <div className="card" style={{ padding: 0 }}>
            {pendientes.map((solicitud, index) => (
              <div
                key={solicitud.id}
                style={{
                  padding: 'var(--space-6)',
                  borderBottom: index < pendientes.length - 1 ? '1px solid var(--gray-200)' : 'none'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)', flexWrap: 'wrap' }}>
                      <span className="badge badge-primary">{solicitud.area}</span>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-500)' }}>
                        {new Date(solicitud.created_at).toLocaleDateString('es-CO')}
                      </span>
                    </div>
                    <h3 style={{
                      fontSize: 'var(--text-lg)',
                      fontWeight: 'var(--font-semibold)',
                      color: 'var(--gray-900)'
                    }}>
                      {solicitud.nombre_completo}
                    </h3>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-600)', marginTop: 'var(--space-1)' }}>
                      {solicitud.email}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <button
                      onClick={() => aprobar(solicitud)}
                      disabled={processing === solicitud.id}
                      className="btn btn-success"
                    >
                      Aprobar
                    </button>
                    <button
                      onClick={() => rechazar(solicitud)}
                      disabled={processing === solicitud.id}
                      className="btn btn-error"
                    >
                      Rechazar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Aprobadas */}
      {aprobadas.length > 0 && (
        <div style={{ marginBottom: 'var(--space-8)' }}>
          <h2 style={{
            fontSize: 'var(--text-lg)',
            fontWeight: 'var(--font-semibold)',
            color: 'var(--gray-900)',
            marginBottom: 'var(--space-4)'
          }}>
            Aprobadas
          </h2>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Email</th>
                    <th>Área</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {aprobadas.map(solicitud => (
                    <tr key={solicitud.id}>
                      <td>{solicitud.nombre_completo}</td>
                      <td style={{ color: 'var(--gray-600)' }}>{solicitud.email}</td>
                      <td>
                        <span className="badge badge-success">{solicitud.area}</span>
                      </td>
                      <td style={{ color: 'var(--gray-500)' }}>
                        {new Date(solicitud.aprobado_en).toLocaleDateString('es-CO')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      
      {/* Rechazadas */}
      {rechazadas.length > 0 && (
        <div>
          <h2 style={{
            fontSize: 'var(--text-lg)',
            fontWeight: 'var(--font-semibold)',
            color: 'var(--gray-900)',
            marginBottom: 'var(--space-4)'
          }}>
            Rechazadas
          </h2>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Email</th>
                    <th>Motivo</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {rechazadas.map(solicitud => (
                    <tr key={solicitud.id}>
                      <td>{solicitud.nombre_completo}</td>
                      <td style={{ color: 'var(--gray-600)' }}>{solicitud.email}</td>
                      <td style={{ color: 'var(--gray-600)' }}>{solicitud.motivo_rechazo}</td>
                      <td style={{ color: 'var(--gray-500)' }}>
                        {new Date(solicitud.aprobado_en).toLocaleDateString('es-CO')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      
      {/* Empty State */}
      {solicitudes.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
          <h2 style={{
            fontSize: 'var(--text-xl)',
            fontWeight: 'var(--font-semibold)',
            color: 'var(--gray-900)',
            marginBottom: 'var(--space-2)'
          }}>
            No hay solicitudes
          </h2>
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--gray-500)' }}>
            Las solicitudes de acceso aparecerán aquí
          </p>
        </div>
      )}
    </div>
  )
}
