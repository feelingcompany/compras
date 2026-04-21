'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth'

export default function SuperAdminPage() {
  const { usuario } = useAuth()
  const router = useRouter()
  const supabase = createClient()
  
  const [solicitudes, setSolicitudes] = useState<any[]>([])
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [reglas, setReglas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [filtroEstado, setFiltroEstado] = useState<string>('todos')
  const [mensaje, setMensaje] = useState<string>('')

  useEffect(() => {
    if (!usuario) {
      router.push('/login')
      return
    }
    cargarDatos()
    const interval = setInterval(cargarDatos, 20000)
    return () => clearInterval(interval)
  }, [usuario])

  const cargarDatos = async () => {
    try {
      // 1. Cargar solicitudes básicas primero
      const { data: solicitudesData, error: errSol } = await supabase
        .from('solicitudes')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (errSol) {
        console.error('Error solicitudes:', errSol)
        setMensaje('Error cargando solicitudes: ' + errSol.message)
        setLoading(false)
        return
      }

      if (!solicitudesData) {
        setLoading(false)
        return
      }

      // 2. Cargar usuarios
      const { data: usuariosData } = await supabase
        .from('usuarios')
        .select('*')
      
      // 3. Cargar items
      const { data: itemsData } = await supabase
        .from('items_solicitud')
        .select('*')
      
      // 4. Cargar aprobaciones
      const { data: aprobacionesData } = await supabase
        .from('aprobaciones')
        .select('*')

      // 5. Cargar reglas
      const { data: reglasData } = await supabase
        .from('reglas_aprobacion')
        .select('*')
        .eq('activo', true)
        .order('nivel_aprobacion')

      // Armar estructura completa
      const procesadas = solicitudesData.map((s: any) => {
        const solicitante = usuariosData?.find((u: any) => u.id === s.solicitante_id)
        const items = itemsData?.filter((i: any) => i.solicitud_id === s.id) || []
        const aprobaciones = (aprobacionesData?.filter((a: any) => a.solicitud_id === s.id) || [])
          .map((a: any) => ({
            ...a,
            aprobador: usuariosData?.find((u: any) => u.id === a.aprobador_id)
          }))
        const monto_total = items.reduce((sum: number, item: any) => 
          sum + (parseFloat(item.presupuesto_estimado) || 0), 0
        )
        
        return {
          ...s,
          solicitante,
          items,
          aprobaciones,
          monto_total
        }
      })

      setSolicitudes(procesadas)
      setUsuarios(usuariosData || [])
      setReglas(reglasData || [])
      setLoading(false)
    } catch (error: any) {
      console.error('Error:', error)
      setMensaje('Error: ' + error.message)
      setLoading(false)
    }
  }

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) newSet.delete(id)
      else newSet.add(id)
      return newSet
    })
  }

  const aprobarNivel = async (aprobacionId: string) => {
    if (!confirm('¿Aprobar este nivel?')) return
    const { error } = await supabase
      .from('aprobaciones')
      .update({ 
        estado: 'aprobada',
        fecha_aprobacion: new Date().toISOString()
      })
      .eq('id', aprobacionId)
    
    if (error) alert('Error: ' + error.message)
    else {
      setMensaje('Aprobación confirmada')
      cargarDatos()
    }
  }

  const rechazarNivel = async (aprobacionId: string) => {
    const motivo = prompt('Motivo del rechazo:')
    if (!motivo) return
    
    const { error } = await supabase
      .from('aprobaciones')
      .update({ 
        estado: 'rechazada',
        fecha_rechazo: new Date().toISOString(),
        comentarios: motivo
      })
      .eq('id', aprobacionId)
    
    if (error) alert('Error: ' + error.message)
    else {
      setMensaje('Rechazo registrado')
      cargarDatos()
    }
  }

  const borrarSolicitud = async (id: string) => {
    if (!confirm('¿BORRAR esta solicitud y todo lo relacionado?')) return
    
    await supabase.from('aprobaciones').delete().eq('solicitud_id', id)
    await supabase.from('items_solicitud').delete().eq('solicitud_id', id)
    await supabase.from('alertas').delete().eq('solicitud_id', id)
    const { error } = await supabase.from('solicitudes').delete().eq('id', id)
    
    if (error) alert('Error: ' + error.message)
    else {
      setMensaje('Solicitud eliminada')
      cargarDatos()
    }
  }

  const crearAprobacionesManual = async (solicitud: any) => {
    if (!confirm(`¿Crear aprobaciones para esta solicitud de $${solicitud.monto_total.toLocaleString('es-CO')}?`)) return
    
    const monto = solicitud.monto_total || 1500000
    
    // Filtrar reglas aplicables
    const reglasAplicables = reglas.filter(r => 
      r.activo && 
      monto >= r.monto_minimo && 
      (r.monto_maximo === null || monto <= r.monto_maximo)
    ).sort((a, b) => a.nivel_aprobacion - b.nivel_aprobacion)
    
    if (reglasAplicables.length === 0) {
      alert('No hay reglas aplicables para este monto')
      return
    }
    
    let orden = 1
    let creadas = 0
    
    for (const regla of reglasAplicables) {
      // Buscar aprobador con ese rol
      const aprobador = usuarios.find(u => u.rol === regla.rol_aprobador && u.activo)
      
      if (aprobador) {
        const { error } = await supabase.from('aprobaciones').insert({
          solicitud_id: solicitud.id,
          aprobador_id: aprobador.id,
          nivel_aprobacion: regla.nivel_aprobacion,
          orden_aprobacion: orden,
          estado: 'pendiente',
          fecha_limite: new Date(Date.now() + 3*24*60*60*1000).toISOString(),
          comentarios: regla.descripcion
        })
        
        if (!error) {
          creadas++
          orden++
        } else {
          console.error('Error creando aprobación:', error)
        }
      } else {
        alert(`FALTA un usuario con rol: ${regla.rol_aprobador}`)
        return
      }
    }
    
    setMensaje(`${creadas} aprobaciones creadas`)
    cargarDatos()
  }

  const crearAprobacionesPendientes = async () => {
    const solicitudesSinAprobaciones = solicitudes.filter(s => 
      s.estado === 'pendiente' && s.aprobaciones.length === 0
    )
    
    if (solicitudesSinAprobaciones.length === 0) {
      alert('Todas las solicitudes pendientes ya tienen aprobaciones')
      return
    }
    
    if (!confirm(`¿Crear aprobaciones para ${solicitudesSinAprobaciones.length} solicitudes?`)) return
    
    let total = 0
    for (const s of solicitudesSinAprobaciones) {
      const monto = s.monto_total || 1500000
      const reglasAplicables = reglas.filter(r => 
        r.activo && 
        monto >= r.monto_minimo && 
        (r.monto_maximo === null || monto <= r.monto_maximo)
      ).sort((a, b) => a.nivel_aprobacion - b.nivel_aprobacion)
      
      let orden = 1
      for (const regla of reglasAplicables) {
        const aprobador = usuarios.find(u => u.rol === regla.rol_aprobador && u.activo)
        if (aprobador) {
          const { error } = await supabase.from('aprobaciones').insert({
            solicitud_id: s.id,
            aprobador_id: aprobador.id,
            nivel_aprobacion: regla.nivel_aprobacion,
            orden_aprobacion: orden,
            estado: 'pendiente',
            fecha_limite: new Date(Date.now() + 3*24*60*60*1000).toISOString(),
            comentarios: regla.descripcion
          })
          if (!error) {
            total++
            orden++
          }
        }
      }
    }
    
    setMensaje(`${total} aprobaciones creadas en total`)
    cargarDatos()
  }

  const solicitudesFiltradas = filtroEstado === 'todos' 
    ? solicitudes 
    : solicitudes.filter(s => s.estado === filtroEstado)

  const stats = {
    total: solicitudes.length,
    pendientes: solicitudes.filter(s => s.estado === 'pendiente').length,
    aprobadas: solicitudes.filter(s => s.estado === 'aprobada').length,
    rechazadas: solicitudes.filter(s => s.estado === 'rechazada').length,
    sinAprobaciones: solicitudes.filter(s => s.estado === 'pendiente' && s.aprobaciones.length === 0).length,
  }

  if (loading && solicitudes.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#666' }}>
        Cargando datos del sistema...
      </div>
    )
  }

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto', fontSize: 14 }}>
      {/* Header */}
      <div style={{ marginBottom: 20, borderBottom: '2px solid #185FA5', paddingBottom: 12 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#185FA5', margin: 0, marginBottom: 4 }}>
          SUPER ADMIN — CONTROL TOTAL
        </h1>
        <div style={{ color: '#666', fontSize: 12 }}>
          Vista completa del sistema • Auto-refresh 20s
        </div>
      </div>

      {mensaje && (
        <div style={{
          background: '#D1FAE5', border: '1px solid #10B981', padding: 10,
          borderRadius: 4, marginBottom: 16, color: '#065F46', fontSize: 13
        }}>
          {mensaje} — <button onClick={() => setMensaje('')} style={{ background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>cerrar</button>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Total', value: stats.total, color: '#185FA5' },
          { label: 'Pendientes', value: stats.pendientes, color: '#F59E0B' },
          { label: 'Aprobadas', value: stats.aprobadas, color: '#10B981' },
          { label: 'Rechazadas', value: stats.rechazadas, color: '#EF4444' },
          { label: 'SIN Aprobaciones', value: stats.sinAprobaciones, color: '#DC2626' },
        ].map(s => (
          <div key={s.label} style={{
            background: '#fff', border: '1px solid #e5e7eb',
            borderLeft: `4px solid ${s.color}`, padding: 12, borderRadius: 4
          }}>
            <div style={{ fontSize: 10, color: '#666', marginBottom: 2, textTransform: 'uppercase' }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Acciones globales */}
      {stats.sinAprobaciones > 0 && (
        <div style={{
          background: '#FEF3C7', border: '1px solid #F59E0B', padding: 14,
          borderRadius: 4, marginBottom: 16, display: 'flex',
          justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div>
            <strong style={{ color: '#92400E' }}>
              {stats.sinAprobaciones} solicitudes pendientes sin aprobaciones asignadas
            </strong>
            <div style={{ fontSize: 12, color: '#78350F', marginTop: 2 }}>
              El trigger automático no funcionó. Podés crearlas manualmente:
            </div>
          </div>
          <button
            onClick={crearAprobacionesPendientes}
            style={{
              padding: '8px 16px', background: '#F59E0B', color: '#fff',
              border: 'none', borderRadius: 4, fontSize: 13, fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            CREAR APROBACIONES AHORA
          </button>
        </div>
      )}

      {/* Usuarios por Rol */}
      <div style={{
        background: '#f9fafb', border: '1px solid #e5e7eb', padding: 12,
        borderRadius: 4, marginBottom: 16
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>USUARIOS POR ROL</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {['solicitante', 'encargado', 'admin_compras', 'gerencia'].map(rol => {
            const users = usuarios.filter(u => u.rol === rol && u.activo)
            const falta = users.length === 0
            return (
              <div key={rol} style={{
                background: falta ? '#FEE2E2' : '#fff', 
                padding: 8, borderRadius: 3,
                border: falta ? '1px solid #DC2626' : '1px solid #e5e7eb'
              }}>
                <div style={{ fontSize: 10, color: '#666', marginBottom: 2, textTransform: 'uppercase' }}>
                  {rol.replace('_', ' ')} {falta && '⚠ FALTA'}
                </div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>
                  {users.length}
                </div>
                <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>
                  {users.map(u => u.nombre).join(', ') || 'Ninguno'}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {['todos', 'pendiente', 'aprobada', 'rechazada'].map(f => (
          <button
            key={f}
            onClick={() => setFiltroEstado(f)}
            style={{
              padding: '6px 12px',
              border: '1px solid',
              borderColor: filtroEstado === f ? '#185FA5' : '#d1d5db',
              background: filtroEstado === f ? '#185FA5' : '#fff',
              color: filtroEstado === f ? '#fff' : '#333',
              borderRadius: 3, fontSize: 12, cursor: 'pointer',
              textTransform: 'capitalize'
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Lista de Solicitudes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {solicitudesFiltradas.length === 0 && (
          <div style={{
            padding: 30, textAlign: 'center', background: '#f9fafb',
            borderRadius: 4, color: '#999'
          }}>
            No hay solicitudes con este filtro
          </div>
        )}

        {solicitudesFiltradas.map(s => {
          const isExpanded = expandedIds.has(s.id)
          const sinAprobaciones = s.estado === 'pendiente' && s.aprobaciones.length === 0
          
          return (
            <div key={s.id} style={{
              background: '#fff', border: '1px solid #e5e7eb',
              borderRadius: 4, overflow: 'hidden',
              borderLeft: `4px solid ${
                s.estado === 'aprobada' ? '#10B981' :
                s.estado === 'rechazada' ? '#EF4444' :
                sinAprobaciones ? '#DC2626' : '#F59E0B'
              }`
            }}>
              {/* Header clickeable */}
              <div 
                onClick={() => toggleExpand(s.id)}
                style={{ 
                  padding: 14, cursor: 'pointer',
                  background: sinAprobaciones ? '#FEF2F2' : '#fff',
                  borderBottom: isExpanded ? '1px solid #e5e7eb' : 'none'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ 
                        fontSize: 16, color: '#666',
                        display: 'inline-block', width: 16, textAlign: 'center'
                      }}>
                        {isExpanded ? '▼' : '▶'}
                      </span>
                      <span style={{
                        padding: '2px 7px', borderRadius: 3, fontSize: 10, fontWeight: 600,
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
                      {sinAprobaciones && (
                        <span style={{
                          padding: '2px 7px', background: '#DC2626', color: '#fff',
                          fontSize: 10, fontWeight: 700, borderRadius: 3
                        }}>
                          SIN APROBACIONES
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 3, marginLeft: 22 }}>
                      {s.descripcion || '(sin descripción)'}
                    </div>
                    <div style={{ fontSize: 11, color: '#666', marginLeft: 22 }}>
                      Por: <strong>{s.solicitante?.nombre || 'Desconocido'}</strong> ({s.solicitante?.rol || 'N/A'}) • 
                      Centro: <strong>{s.centro_costo || '—'}</strong> • 
                      OT/OS: {s.ot_os || 'N/A'} • 
                      {new Date(s.created_at).toLocaleString('es-CO')}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', marginLeft: 14 }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#185FA5' }}>
                      ${s.monto_total.toLocaleString('es-CO')}
                    </div>
                    <div style={{ fontSize: 10, color: '#666' }}>
                      {s.items.length} ítem{s.items.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>

                {/* Timeline aprobaciones */}
                <div style={{ 
                  display: 'flex', gap: 6, marginTop: 10, marginLeft: 22,
                  alignItems: 'center', flexWrap: 'wrap'
                }}>
                  {[1, 2, 3].map(nivel => {
                    const apr = s.aprobaciones.find((a: any) => a.nivel_aprobacion === nivel)
                    const requerida = s.monto_total >= (nivel === 1 ? 0 : nivel === 2 ? 1000001 : 5000001)
                    
                    if (!requerida && !apr) return null
                    
                    return (
                      <div key={nivel} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{
                          padding: '3px 7px', borderRadius: 3, fontSize: 10, fontWeight: 500,
                          background: apr?.estado === 'aprobada' ? '#D1FAE5' :
                                     apr?.estado === 'rechazada' ? '#FEE2E2' :
                                     apr ? '#FEF3C7' : '#F3F4F6',
                          color: apr?.estado === 'aprobada' ? '#065F46' :
                                apr?.estado === 'rechazada' ? '#991B1B' :
                                apr ? '#92400E' : '#6B7280',
                          border: apr ? 'none' : '1px dashed #9CA3AF'
                        }}>
                          N{nivel}: {apr 
                            ? `${(apr.aprobador?.nombre || 'Sin asignar').slice(0, 15)} · ${apr.estado}`
                            : 'NO CREADA'}
                        </div>
                        {nivel < 3 && <span style={{ color: '#9CA3AF', fontSize: 10 }}>→</span>}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Detalles expandidos */}
              {isExpanded && (
                <div style={{ padding: 14, background: '#F9FAFB' }}>
                  {/* Detalles generales */}
                  <div style={{
                    background: '#fff', padding: 10, borderRadius: 4,
                    border: '1px solid #e5e7eb', marginBottom: 12,
                    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, fontSize: 11
                  }}>
                    <div>
                      <div style={{ color: '#666', marginBottom: 2 }}>Centro de Costo</div>
                      <div style={{ fontWeight: 600 }}>{s.centro_costo || '—'}</div>
                    </div>
                    <div>
                      <div style={{ color: '#666', marginBottom: 2 }}>Ciudad</div>
                      <div style={{ fontWeight: 600 }}>{s.ciudad || '—'}</div>
                    </div>
                    <div>
                      <div style={{ color: '#666', marginBottom: 2 }}>Fecha Requerida</div>
                      <div style={{ fontWeight: 600 }}>
                        {s.fecha_requerida ? new Date(s.fecha_requerida).toLocaleDateString('es-CO') : '—'}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: '#666', marginBottom: 2 }}>OT/OS</div>
                      <div style={{ fontWeight: 600 }}>{s.ot_os || '—'}</div>
                    </div>
                  </div>

                  {/* Ítems */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                      ÍTEMS ({s.items.length})
                    </div>
                    {s.items.length === 0 ? (
                      <div style={{ color: '#999', fontSize: 11, padding: 8, background: '#fff', borderRadius: 3 }}>
                        No hay ítems
                      </div>
                    ) : (
                      <div style={{ background: '#fff', borderRadius: 3, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                        <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: '#f3f4f6' }}>
                              <th style={{ padding: 6, textAlign: 'left' }}>Descripción</th>
                              <th style={{ padding: 6, textAlign: 'left' }}>Categoría</th>
                              <th style={{ padding: 6, textAlign: 'right' }}>Cant.</th>
                              <th style={{ padding: 6, textAlign: 'right' }}>Presupuesto</th>
                            </tr>
                          </thead>
                          <tbody>
                            {s.items.map((item: any) => (
                              <tr key={item.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                                <td style={{ padding: 6 }}>{item.descripcion}</td>
                                <td style={{ padding: 6 }}>{item.categoria}</td>
                                <td style={{ padding: 6, textAlign: 'right' }}>
                                  {item.cantidad} {item.unidad}
                                </td>
                                <td style={{ padding: 6, textAlign: 'right', fontWeight: 600 }}>
                                  ${parseFloat(item.presupuesto_estimado || 0).toLocaleString('es-CO')}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Aprobaciones */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                      APROBACIONES ({s.aprobaciones.length})
                    </div>
                    {s.aprobaciones.length === 0 ? (
                      <div style={{
                        background: '#FEE2E2', padding: 10, borderRadius: 3,
                        fontSize: 11, color: '#991B1B'
                      }}>
                        <strong>No se crearon aprobaciones automáticamente</strong>
                        <div style={{ marginTop: 8 }}>
                          <button
                            onClick={() => crearAprobacionesManual(s)}
                            style={{
                              padding: '6px 12px', background: '#DC2626', color: '#fff',
                              border: 'none', borderRadius: 3, fontSize: 11,
                              cursor: 'pointer', fontWeight: 600
                            }}
                          >
                            CREAR APROBACIONES AHORA
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {s.aprobaciones
                          .sort((a: any, b: any) => a.nivel_aprobacion - b.nivel_aprobacion)
                          .map((apr: any) => (
                          <div key={apr.id} style={{
                            background: '#fff', padding: 10, borderRadius: 3,
                            border: '1px solid #e5e7eb',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                          }}>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 600 }}>
                                Nivel {apr.nivel_aprobacion} — {apr.aprobador?.nombre || 'Sin asignar'}
                              </div>
                              <div style={{ fontSize: 10, color: '#666' }}>
                                {apr.aprobador?.email} ({apr.aprobador?.rol})
                              </div>
                              <div style={{ fontSize: 10, color: '#666', marginTop: 2 }}>
                                Estado: <strong style={{ 
                                  color: apr.estado === 'aprobada' ? '#065F46' :
                                         apr.estado === 'rechazada' ? '#991B1B' : '#92400E'
                                }}>{apr.estado}</strong>
                                {apr.fecha_limite && ` • Límite: ${new Date(apr.fecha_limite).toLocaleDateString('es-CO')}`}
                              </div>
                              {apr.comentarios && (
                                <div style={{ fontSize: 10, color: '#888', marginTop: 2, fontStyle: 'italic' }}>
                                  {apr.comentarios}
                                </div>
                              )}
                            </div>
                            {apr.estado === 'pendiente' && (
                              <div style={{ display: 'flex', gap: 5 }}>
                                <button
                                  onClick={() => aprobarNivel(apr.id)}
                                  style={{
                                    padding: '5px 10px', background: '#10B981', color: '#fff',
                                    border: 'none', borderRadius: 3, fontSize: 11,
                                    cursor: 'pointer', fontWeight: 600
                                  }}
                                >
                                  APROBAR
                                </button>
                                <button
                                  onClick={() => rechazarNivel(apr.id)}
                                  style={{
                                    padding: '5px 10px', background: '#EF4444', color: '#fff',
                                    border: 'none', borderRadius: 3, fontSize: 11,
                                    cursor: 'pointer', fontWeight: 600
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
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => borrarSolicitud(s.id)}
                      style={{
                        padding: '6px 12px', background: '#fff', color: '#DC2626',
                        border: '1px solid #DC2626', borderRadius: 3, fontSize: 11,
                        cursor: 'pointer', fontWeight: 600
                      }}
                    >
                      BORRAR SOLICITUD
                    </button>
                    <button
                      onClick={() => router.push(`/solicitudes/${s.id}`)}
                      style={{
                        padding: '6px 12px', background: '#fff', color: '#185FA5',
                        border: '1px solid #185FA5', borderRadius: 3, fontSize: 11,
                        cursor: 'pointer', fontWeight: 600
                      }}
                    >
                      VER DETALLE COMPLETO
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
