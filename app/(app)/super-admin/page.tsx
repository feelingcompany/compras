'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth'

type SolicitudCompleta = {
  id: string
  descripcion: string
  estado: string
  prioridad: string
  centro_costo: string
  ot_os: string | null
  ciudad: string
  fecha_requerida: string
  created_at: string
  solicitante: { id: string, nombre: string, email: string, rol: string } | null
  items: any[]
  aprobaciones: any[]
  monto_total: number
}

export default function SuperAdminPage() {
  const { usuario } = useAuth()
  const router = useRouter()
  const supabase = createClient()
  
  const [solicitudes, setSolicitudes] = useState<SolicitudCompleta[]>([])
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filtroEstado, setFiltroEstado] = useState<string>('todos')

  useEffect(() => {
    if (!usuario) {
      router.push('/login')
      return
    }
    cargarDatos()
    const interval = setInterval(cargarDatos, 15000) // Refrescar cada 15s
    return () => clearInterval(interval)
  }, [usuario])

  const cargarDatos = async () => {
    setLoading(true)
    
    // Cargar todas las solicitudes
    const { data: solicitudesData } = await supabase
      .from('solicitudes')
      .select(`
        *,
        solicitante:solicitante_id(id, nombre, email, rol),
        items:items_solicitud(*),
        aprobaciones(
          *,
          aprobador:aprobador_id(id, nombre, email, rol)
        )
      `)
      .order('created_at', { ascending: false })
    
    if (solicitudesData) {
      const procesadas = solicitudesData.map((s: any) => ({
        ...s,
        monto_total: (s.items || []).reduce(
          (sum: number, item: any) => sum + (parseFloat(item.presupuesto_estimado) || 0), 
          0
        )
      }))
      setSolicitudes(procesadas)
    }
    
    // Cargar todos los usuarios
    const { data: usuariosData } = await supabase
      .from('usuarios')
      .select('*')
      .order('rol')
    
    if (usuariosData) setUsuarios(usuariosData)
    
    setLoading(false)
  }

  const aprobarNivel = async (aprobacionId: string) => {
    if (!confirm('¿Aprobar este nivel?')) return
    
    await supabase
      .from('aprobaciones')
      .update({ 
        estado: 'aprobada',
        fecha_aprobacion: new Date().toISOString()
      })
      .eq('id', aprobacionId)
    
    cargarDatos()
  }

  const rechazarNivel = async (aprobacionId: string) => {
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
    
    cargarDatos()
  }

  const borrarSolicitud = async (id: string) => {
    if (!confirm('¿BORRAR esta solicitud y sus aprobaciones?')) return
    
    await supabase.from('aprobaciones').delete().eq('solicitud_id', id)
    await supabase.from('items_solicitud').delete().eq('solicitud_id', id)
    await supabase.from('solicitudes').delete().eq('id', id)
    
    cargarDatos()
  }

  const crearAprobacionesManual = async (solicitudId: string, monto: number) => {
    if (!confirm('¿Crear aprobaciones manualmente para esta solicitud?')) return
    
    // Obtener reglas aplicables
    const { data: reglas } = await supabase
      .from('reglas_aprobacion')
      .select('*')
      .eq('activo', true)
      .lte('monto_minimo', monto)
      .order('nivel_aprobacion')
    
    if (!reglas || reglas.length === 0) {
      alert('No hay reglas aplicables para este monto')
      return
    }
    
    // Filtrar reglas donde monto_maximo sea NULL o mayor al monto
    const reglasAplicables = reglas.filter(r => 
      r.monto_maximo === null || r.monto_maximo >= monto
    )
    
    let orden = 1
    for (const regla of reglasAplicables) {
      // Buscar aprobador
      const { data: aprobador } = await supabase
        .from('usuarios')
        .select('id')
        .eq('rol', regla.rol_aprobador)
        .eq('activo', true)
        .limit(1)
        .single()
      
      if (aprobador) {
        await supabase.from('aprobaciones').insert({
          solicitud_id: solicitudId,
          aprobador_id: aprobador.id,
          nivel_aprobacion: regla.nivel_aprobacion,
          orden_aprobacion: orden,
          estado: 'pendiente',
          fecha_limite: new Date(Date.now() + 3*24*60*60*1000).toISOString(),
          comentarios: regla.descripcion
        })
        orden++
      }
    }
    
    alert('Aprobaciones creadas exitosamente')
    cargarDatos()
  }

  const solicitudesFiltradas = filtroEstado === 'todos' 
    ? solicitudes 
    : solicitudes.filter(s => s.estado === filtroEstado)

  if (loading && solicitudes.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div>Cargando...</div>
      </div>
    )
  }

  const stats = {
    total: solicitudes.length,
    pendientes: solicitudes.filter(s => s.estado === 'pendiente').length,
    aprobadas: solicitudes.filter(s => s.estado === 'aprobada').length,
    rechazadas: solicitudes.filter(s => s.estado === 'rechazada').length,
    sinAprobaciones: solicitudes.filter(s => s.aprobaciones.length === 0).length,
  }

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24, borderBottom: '2px solid #185FA5', paddingBottom: 16 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#185FA5', marginBottom: 4 }}>
          SUPER ADMIN - CONTROL TOTAL
        </h1>
        <p style={{ color: '#666', fontSize: 14 }}>
          Vista completa del sistema de compras • Auto-refresh cada 15s
        </p>
      </div>

      {/* Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: 12,
        marginBottom: 24
      }}>
        {[
          { label: 'Total Solicitudes', value: stats.total, color: '#185FA5' },
          { label: 'Pendientes', value: stats.pendientes, color: '#F59E0B' },
          { label: 'Aprobadas', value: stats.aprobadas, color: '#10B981' },
          { label: 'Rechazadas', value: stats.rechazadas, color: '#EF4444' },
          { label: '⚠️ SIN Aprobaciones', value: stats.sinAprobaciones, color: '#DC2626' },
        ].map(s => (
          <div key={s.label} style={{
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderLeft: `4px solid ${s.color}`,
            padding: 16,
            borderRadius: 6
          }}>
            <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Usuarios por Rol */}
      <div style={{
        background: '#f9fafb',
        border: '1px solid #e5e7eb',
        padding: 16,
        borderRadius: 6,
        marginBottom: 24
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
          Usuarios en el Sistema
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {['solicitante', 'encargado', 'admin_compras', 'gerencia'].map(rol => {
            const users = usuarios.filter(u => u.rol === rol && u.activo)
            return (
              <div key={rol}>
                <div style={{ fontSize: 11, color: '#666', marginBottom: 4, textTransform: 'uppercase' }}>
                  {rol.replace('_', ' ')}
                </div>
                <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>
                  {users.length} {users.length === 0 && '⚠️'}
                </div>
                <div style={{ fontSize: 11, color: '#888' }}>
                  {users.map(u => u.nombre).join(', ') || 'Ninguno'}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['todos', 'pendiente', 'aprobada', 'rechazada'].map(f => (
          <button
            key={f}
            onClick={() => setFiltroEstado(f)}
            style={{
              padding: '6px 14px',
              border: '1px solid',
              borderColor: filtroEstado === f ? '#185FA5' : '#d1d5db',
              background: filtroEstado === f ? '#185FA5' : '#fff',
              color: filtroEstado === f ? '#fff' : '#333',
              borderRadius: 4,
              fontSize: 13,
              cursor: 'pointer',
              textTransform: 'capitalize'
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Lista de Solicitudes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {solicitudesFiltradas.length === 0 && (
          <div style={{ 
            padding: 40, 
            textAlign: 'center', 
            background: '#f9fafb', 
            borderRadius: 6 
          }}>
            No hay solicitudes con este filtro
          </div>
        )}

        {solicitudesFiltradas.map(s => {
          const isExpanded = expandedId === s.id
          const aprobacionesPorNivel = [1, 2, 3].map(nivel => 
            s.aprobaciones.find(a => a.nivel_aprobacion === nivel)
          )
          
          return (
            <div key={s.id} style={{
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: 6,
              overflow: 'hidden'
            }}>
              {/* Header de la solicitud */}
              <div 
                onClick={() => setExpandedId(isExpanded ? null : s.id)}
                style={{ 
                  padding: 16, 
                  cursor: 'pointer',
                  background: s.aprobaciones.length === 0 ? '#FEF2F2' : '#fff',
                  borderLeft: `4px solid ${
                    s.estado === 'aprobada' ? '#10B981' :
                    s.estado === 'rechazada' ? '#EF4444' :
                    s.aprobaciones.length === 0 ? '#DC2626' :
                    '#F59E0B'
                  }`
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: 3,
                        fontSize: 10,
                        fontWeight: 600,
                        background: s.estado === 'aprobada' ? '#D1FAE5' :
                                   s.estado === 'rechazada' ? '#FEE2E2' : '#FEF3C7',
                        color: s.estado === 'aprobada' ? '#065F46' :
                               s.estado === 'rechazada' ? '#991B1B' : '#92400E'
                      }}>
                        {s.estado.toUpperCase()}
                      </span>
                      <span style={{ fontSize: 11, color: '#666' }}>
                        {s.prioridad}
                      </span>
                      {s.aprobaciones.length === 0 && s.estado === 'pendiente' && (
                        <span style={{ 
                          padding: '2px 8px',
                          background: '#DC2626', 
                          color: '#fff', 
                          fontSize: 10, 
                          fontWeight: 700,
                          borderRadius: 3
                        }}>
                          ⚠️ SIN APROBACIONES
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>
                      {s.descripcion}
                    </div>
                    <div style={{ fontSize: 12, color: '#666' }}>
                      Por: {s.solicitante?.nombre || 'Desconocido'} ({s.solicitante?.rol}) • 
                      Centro: {s.centro_costo} • 
                      OT/OS: {s.ot_os || 'N/A'} • 
                      {new Date(s.created_at).toLocaleString('es-CO')}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', marginLeft: 16 }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#185FA5' }}>
                      ${s.monto_total.toLocaleString('es-CO')}
                    </div>
                    <div style={{ fontSize: 11, color: '#666' }}>
                      {s.items.length} ítem{s.items.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>

                {/* Timeline de aprobaciones inline */}
                <div style={{ 
                  display: 'flex', 
                  gap: 8, 
                  marginTop: 12, 
                  alignItems: 'center' 
                }}>
                  {[1, 2, 3].map(nivel => {
                    const apr = aprobacionesPorNivel[nivel - 1]
                    const requerida = s.monto_total >= (nivel === 1 ? 0 : nivel === 2 ? 1000001 : 5000001)
                    
                    if (!requerida && !apr) return null
                    
                    return (
                      <div key={nivel} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{
                          padding: '3px 8px',
                          borderRadius: 3,
                          fontSize: 10,
                          fontWeight: 600,
                          background: apr?.estado === 'aprobada' ? '#D1FAE5' :
                                     apr?.estado === 'rechazada' ? '#FEE2E2' :
                                     apr ? '#FEF3C7' : '#F3F4F6',
                          color: apr?.estado === 'aprobada' ? '#065F46' :
                                apr?.estado === 'rechazada' ? '#991B1B' :
                                apr ? '#92400E' : '#6B7280',
                          border: apr ? 'none' : '1px dashed #9CA3AF'
                        }}>
                          N{nivel}: {apr ? (apr.aprobador?.nombre || 'Sin asignar').slice(0, 12) : 'NO CREADA'}
                          {apr && ` - ${apr.estado}`}
                        </div>
                        {nivel < 3 && <span style={{ color: '#9CA3AF' }}>→</span>}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Detalles expandidos */}
              {isExpanded && (
                <div style={{ padding: 16, background: '#F9FAFB', borderTop: '1px solid #e5e7eb' }}>
                  {/* Items */}
                  <div style={{ marginBottom: 16 }}>
                    <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                      ÍTEMS ({s.items.length})
                    </h4>
                    {s.items.length === 0 ? (
                      <div style={{ color: '#999', fontSize: 12 }}>No hay ítems</div>
                    ) : (
                      <table style={{ width: '100%', fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: '#fff', borderBottom: '1px solid #e5e7eb' }}>
                            <th style={{ padding: 6, textAlign: 'left' }}>Descripción</th>
                            <th style={{ padding: 6, textAlign: 'left' }}>Categoría</th>
                            <th style={{ padding: 6, textAlign: 'right' }}>Cantidad</th>
                            <th style={{ padding: 6, textAlign: 'right' }}>Presupuesto</th>
                          </tr>
                        </thead>
                        <tbody>
                          {s.items.map((item: any) => (
                            <tr key={item.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                              <td style={{ padding: 6 }}>{item.descripcion}</td>
                              <td style={{ padding: 6 }}>{item.categoria}</td>
                              <td style={{ padding: 6, textAlign: 'right' }}>{item.cantidad} {item.unidad}</td>
                              <td style={{ padding: 6, textAlign: 'right' }}>
                                ${parseFloat(item.presupuesto_estimado || 0).toLocaleString('es-CO')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {/* Aprobaciones */}
                  <div style={{ marginBottom: 16 }}>
                    <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                      APROBACIONES ({s.aprobaciones.length})
                    </h4>
                    {s.aprobaciones.length === 0 ? (
                      <div style={{ 
                        background: '#FEE2E2', 
                        padding: 12, 
                        borderRadius: 4, 
                        fontSize: 12,
                        color: '#991B1B'
                      }}>
                        <strong>⚠️ No se crearon aprobaciones automáticamente</strong>
                        <br />
                        <button 
                          onClick={() => crearAprobacionesManual(s.id, s.monto_total || 1500000)}
                          style={{
                            marginTop: 8,
                            padding: '6px 12px',
                            background: '#DC2626',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 4,
                            fontSize: 12,
                            cursor: 'pointer'
                          }}
                        >
                          CREAR APROBACIONES MANUALMENTE
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {s.aprobaciones.sort((a: any, b: any) => a.nivel_aprobacion - b.nivel_aprobacion).map((apr: any) => (
                          <div key={apr.id} style={{
                            background: '#fff',
                            padding: 10,
                            borderRadius: 4,
                            border: '1px solid #e5e7eb',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 600 }}>
                                Nivel {apr.nivel_aprobacion} - {apr.aprobador?.nombre || 'Sin asignar'}
                              </div>
                              <div style={{ fontSize: 11, color: '#666' }}>
                                {apr.aprobador?.email} ({apr.aprobador?.rol})
                              </div>
                              <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
                                Estado: <strong>{apr.estado}</strong>
                                {apr.fecha_limite && ` • Límite: ${new Date(apr.fecha_limite).toLocaleDateString('es-CO')}`}
                              </div>
                              {apr.comentarios && (
                                <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                                  {apr.comentarios}
                                </div>
                              )}
                            </div>
                            {apr.estado === 'pendiente' && (
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button
                                  onClick={() => aprobarNivel(apr.id)}
                                  style={{
                                    padding: '4px 10px',
                                    background: '#10B981',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: 3,
                                    fontSize: 11,
                                    cursor: 'pointer'
                                  }}
                                >
                                  APROBAR
                                </button>
                                <button
                                  onClick={() => rechazarNivel(apr.id)}
                                  style={{
                                    padding: '4px 10px',
                                    background: '#EF4444',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: 3,
                                    fontSize: 11,
                                    cursor: 'pointer'
                                  }}
                                >
                                  RECHAZAR
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Acciones */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => borrarSolicitud(s.id)}
                      style={{
                        padding: '6px 12px',
                        background: '#fff',
                        color: '#DC2626',
                        border: '1px solid #DC2626',
                        borderRadius: 4,
                        fontSize: 12,
                        cursor: 'pointer'
                      }}
                    >
                      BORRAR SOLICITUD
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
