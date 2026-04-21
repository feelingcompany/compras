'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth'

export default function DetalleSolicitudPage() {
  const { usuario } = useAuth()
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const id = params?.id as string

  const [solicitud, setSolicitud] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!usuario) {
      router.push('/login')
      return
    }
    if (id) cargar()
  }, [usuario, id])

  const cargar = async () => {
    try {
      const { data: s } = await supabase
        .from('solicitudes')
        .select('*')
        .eq('id', id)
        .single()

      if (!s) {
        setLoading(false)
        return
      }

      const [
        { data: solicitante },
        { data: items },
        { data: aprobaciones }
      ] = await Promise.all([
        supabase.from('usuarios').select('*').eq('id', s.solicitante_id).single(),
        supabase.from('items_solicitud').select('*').eq('solicitud_id', id),
        supabase.from('aprobaciones').select('*').eq('solicitud_id', id)
          .order('nivel_aprobacion')
      ])

      // Enriquecer aprobaciones con datos del aprobador
      let aprobacionesEnriched: any[] = []
      if (aprobaciones && aprobaciones.length > 0) {
        const aprobadorIds = aprobaciones.map(a => a.aprobador_id).filter(Boolean)
        const { data: aprobadores } = await supabase
          .from('usuarios')
          .select('id, nombre, email, rol')
          .in('id', aprobadorIds)
        
        aprobacionesEnriched = aprobaciones.map(a => ({
          ...a,
          aprobador: (aprobadores || []).find(u => u.id === a.aprobador_id)
        }))
      }

      const monto = (items || []).reduce(
        (sum, i) => sum + (parseFloat(i.presupuesto_estimado) || 0), 0
      )

      setSolicitud({
        ...s,
        solicitante,
        items: items || [],
        aprobaciones: aprobacionesEnriched,
        monto_total: monto
      })
      setLoading(false)
    } catch (error) {
      console.error('Error:', error)
      setLoading(false)
    }
  }

  const aprobar = async (aprobacionId: string) => {
    if (!confirm('¿Confirmar aprobación?')) return

    await supabase
      .from('aprobaciones')
      .update({ estado: 'aprobada', fecha_aprobacion: new Date().toISOString() })
      .eq('id', aprobacionId)

    // Verificar si todas están aprobadas
    const todas = solicitud.aprobaciones.every((a: any) =>
      a.id === aprobacionId ? true : a.estado === 'aprobada'
    )
    if (todas) {
      await supabase
        .from('solicitudes')
        .update({ estado: 'aprobada', updated_at: new Date().toISOString() })
        .eq('id', id)
    }

    cargar()
  }

  const rechazar = async (aprobacionId: string) => {
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

    await supabase
      .from('solicitudes')
      .update({ estado: 'rechazada', updated_at: new Date().toISOString() })
      .eq('id', id)

    cargar()
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Cargando...</div>
  }

  if (!solicitud) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ color: '#6b7280', marginBottom: 12 }}>Solicitud no encontrada</div>
        <button
          onClick={() => router.push('/solicitudes')}
          style={{
            padding: '8px 16px', background: '#185FA5', color: '#fff',
            border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13
          }}
        >
          Volver a solicitudes
        </button>
      </div>
    )
  }

  // Timeline: 4 FASES OFICIALES DEL PROCESO FEELING COMPANY
  const fases = [
    {
      key: 'fase1',
      numero: 1,
      label: 'Activación y Convocatoria',
      descripcion: 'Solicitud, aprobación, cotizaciones',
      completada: ['aprobada', 'cotizando', 'ordenada', 'ejecucion', 'liquidacion', 'completada'].includes(solicitud.estado),
      activa: solicitud.estado === 'pendiente' || solicitud.estado === 'cotizando',
      rechazada: solicitud.estado === 'rechazada'
    },
    {
      key: 'fase2',
      numero: 2,
      label: 'Formalización',
      descripcion: 'OF / OS emitida',
      completada: ['ordenada', 'ejecucion', 'liquidacion', 'completada'].includes(solicitud.estado),
      activa: solicitud.estado === 'aprobada'
    },
    {
      key: 'fase3',
      numero: 3,
      label: 'Ejecución y Liquidación',
      descripcion: 'Ejecución, radicación, pago',
      completada: ['liquidacion', 'completada'].includes(solicitud.estado),
      activa: solicitud.estado === 'ordenada' || solicitud.estado === 'ejecucion'
    },
    {
      key: 'fase4',
      numero: 4,
      label: 'Auditoría de Compras y Pago',
      descripcion: 'Contraloría y cierre',
      completada: solicitud.estado === 'completada',
      activa: solicitud.estado === 'liquidacion'
    }
  ]

  const miAprobacion = solicitud.aprobaciones.find(
    (a: any) => a.aprobador_id === usuario?.id && a.estado === 'pendiente'
  )
  const puedeAprobar = miAprobacion && solicitud.aprobaciones
    .filter((a: any) => a.nivel_aprobacion < miAprobacion.nivel_aprobacion)
    .every((a: any) => a.estado === 'aprobada')

  return (
    <div style={{ padding: 32, maxWidth: 1000, margin: '0 auto' }}>
      {/* Breadcrumb */}
      <button
        onClick={() => router.push('/solicitudes')}
        style={{
          background: 'none', border: 'none', color: '#185FA5',
          fontSize: 13, cursor: 'pointer', marginBottom: 16,
          textDecoration: 'underline', padding: 0
        }}
      >
        ← Volver a solicitudes
      </button>

      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-start', marginBottom: 24,
        paddingBottom: 20, borderBottom: '1px solid #e5e7eb'
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Solicitud #{solicitud.id.slice(0, 8)}
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111', margin: 0, marginBottom: 6 }}>
            {solicitud.descripcion}
          </h1>
          <div style={{ fontSize: 13, color: '#6b7280' }}>
            Creada por <strong>{solicitud.solicitante?.nombre}</strong> el{' '}
            {new Date(solicitud.created_at).toLocaleDateString('es-CO', {
              day: 'numeric', month: 'long', year: 'numeric'
            })}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>MONTO TOTAL</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#185FA5' }}>
            ${solicitud.monto_total.toLocaleString('es-CO')}
          </div>
        </div>
      </div>

      {/* Banner de acción si me corresponde aprobar */}
      {miAprobacion && (
        <div style={{
          background: '#FEF3C7', border: '1px solid #F59E0B',
          borderRadius: 6, padding: 16, marginBottom: 24,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#92400E', marginBottom: 2 }}>
              Esta solicitud requiere tu aprobación (Nivel {miAprobacion.nivel_aprobacion})
            </div>
            <div style={{ fontSize: 12, color: '#78350F' }}>
              {puedeAprobar
                ? 'Podés aprobar o rechazar ahora'
                : 'Esperando aprobación de niveles previos'}
            </div>
          </div>
          {puedeAprobar && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => rechazar(miAprobacion.id)}
                style={{
                  padding: '8px 16px', background: '#fff', color: '#EF4444',
                  border: '1px solid #EF4444', borderRadius: 4,
                  fontSize: 13, cursor: 'pointer', fontWeight: 600
                }}
              >
                Rechazar
              </button>
              <button
                onClick={() => aprobar(miAprobacion.id)}
                style={{
                  padding: '8px 16px', background: '#10B981', color: '#fff',
                  border: 'none', borderRadius: 4,
                  fontSize: 13, cursor: 'pointer', fontWeight: 600
                }}
              >
                Aprobar solicitud
              </button>
            </div>
          )}
        </div>
      )}

      {/* Timeline horizontal - 4 FASES OFICIALES DE FEELING */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#111', marginBottom: 4 }}>
          Proceso oficial de compras Feeling
        </div>
        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 16 }}>
          Las 4 fases del ciclo de compra
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>
          {fases.map((fase, idx) => (
            <div key={fase.key} style={{ flex: 1, display: 'flex', alignItems: 'flex-start', position: 'relative' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: fase.rechazada ? '#EF4444' 
                    : fase.completada ? '#10B981' 
                    : fase.activa ? '#185FA5' 
                    : '#E5E7EB',
                  color: '#fff', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 700, marginBottom: 10,
                  border: fase.activa ? '3px solid #DBEAFE' : 'none',
                  boxShadow: fase.activa ? '0 0 0 3px #185FA5' : 'none'
                }}>
                  {fase.rechazada ? '✕' : fase.completada ? '✓' : fase.numero}
                </div>
                <div style={{
                  fontSize: 11, fontWeight: 700,
                  color: fase.completada ? '#065F46' 
                    : fase.activa ? '#185FA5'
                    : '#9ca3af',
                  textAlign: 'center', letterSpacing: '0.02em',
                  marginBottom: 3
                }}>
                  FASE {fase.numero}
                </div>
                <div style={{
                  fontSize: 12, fontWeight: 600,
                  color: fase.completada || fase.activa ? '#111' : '#9ca3af',
                  textAlign: 'center', marginBottom: 3
                }}>
                  {fase.label}
                </div>
                <div style={{
                  fontSize: 10, color: '#6b7280',
                  textAlign: 'center', maxWidth: 140,
                  lineHeight: 1.3
                }}>
                  {fase.descripcion}
                </div>
              </div>
              {idx < fases.length - 1 && (
                <div style={{
                  flex: 1, height: 3, 
                  background: fase.completada ? '#10B981' : '#E5E7EB',
                  marginTop: 20, marginLeft: -8, marginRight: -8
                }} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Info general */}
      <div style={{
        background: '#fff', border: '1px solid #e5e7eb',
        borderRadius: 6, padding: 20, marginBottom: 24
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#111', marginBottom: 14 }}>
          Información general
        </div>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20
        }}>
          <div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>Centro de costo</div>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>
              {solicitud.centro_costo || '—'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>Ciudad</div>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>
              {solicitud.ciudad || '—'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>Fecha requerida</div>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>
              {solicitud.fecha_requerida
                ? new Date(solicitud.fecha_requerida).toLocaleDateString('es-CO')
                : '—'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>OT / OS</div>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>
              {solicitud.ot_os || '—'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>Prioridad</div>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#111', textTransform: 'capitalize' }}>
              {solicitud.prioridad || 'Normal'}
            </div>
          </div>
          {solicitud.observaciones && (
            <div style={{ gridColumn: 'span 3' }}>
              <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>Observaciones</div>
              <div style={{ fontSize: 13, color: '#374151' }}>
                {solicitud.observaciones}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Ítems */}
      <div style={{
        background: '#fff', border: '1px solid #e5e7eb',
        borderRadius: 6, marginBottom: 24, overflow: 'hidden'
      }}>
        <div style={{
          padding: '14px 20px', borderBottom: '1px solid #e5e7eb',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>
            Ítems ({solicitud.items.length})
          </div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>
            Total: <strong style={{ color: '#185FA5' }}>${solicitud.monto_total.toLocaleString('es-CO')}</strong>
          </div>
        </div>
        {solicitud.items.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
            No hay ítems
          </div>
        ) : (
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F9FAFB', fontSize: 11, color: '#6b7280', textTransform: 'uppercase' }}>
                <th style={{ padding: '10px 20px', textAlign: 'left', fontWeight: 600 }}>Descripción</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600 }}>Categoría</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600 }}>Cantidad</th>
                <th style={{ padding: '10px 20px', textAlign: 'right', fontWeight: 600 }}>Presupuesto</th>
              </tr>
            </thead>
            <tbody>
              {solicitud.items.map((item: any) => (
                <tr key={item.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ fontWeight: 500, color: '#111', marginBottom: 2 }}>
                      {item.descripcion}
                    </div>
                    {item.especificaciones && (
                      <div style={{ fontSize: 11, color: '#6b7280' }}>
                        {item.especificaciones}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '14px 16px', color: '#6b7280', fontSize: 12 }}>
                    {item.categoria}
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'right', color: '#374151' }}>
                    {item.cantidad} {item.unidad}
                  </td>
                  <td style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 600, color: '#111' }}>
                    ${parseFloat(item.presupuesto_estimado || 0).toLocaleString('es-CO')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Flujo de aprobaciones */}
      {solicitud.aprobaciones.length > 0 && (
        <div style={{
          background: '#fff', border: '1px solid #e5e7eb',
          borderRadius: 6, padding: 20, marginBottom: 24
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#111', marginBottom: 14 }}>
            Flujo de aprobación
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {solicitud.aprobaciones.map((apr: any) => (
              <div key={apr.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: 12, background: '#F9FAFB', borderRadius: 4,
                border: `1px solid ${
                  apr.estado === 'aprobada' ? '#A7F3D0' :
                  apr.estado === 'rechazada' ? '#FCA5A5' : '#E5E7EB'
                }`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: apr.estado === 'aprobada' ? '#10B981' :
                                apr.estado === 'rechazada' ? '#EF4444' : '#F59E0B',
                    color: '#fff', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700
                  }}>
                    {apr.nivel_aprobacion}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>
                      Nivel {apr.nivel_aprobacion}: {apr.aprobador?.nombre || 'Sin asignar'}
                    </div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>
                      {apr.aprobador?.rol} · Estado: <strong style={{
                        color: apr.estado === 'aprobada' ? '#065F46' :
                               apr.estado === 'rechazada' ? '#991B1B' : '#92400E'
                      }}>{apr.estado}</strong>
                    </div>
                    {apr.comentarios && apr.estado === 'rechazada' && (
                      <div style={{ fontSize: 11, color: '#991B1B', marginTop: 4, fontStyle: 'italic' }}>
                        Motivo: {apr.comentarios}
                      </div>
                    )}
                  </div>
                </div>
                {apr.fecha_aprobacion && (
                  <div style={{ fontSize: 11, color: '#6b7280' }}>
                    {new Date(apr.fecha_aprobacion).toLocaleDateString('es-CO')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {solicitud.aprobaciones.length === 0 && solicitud.estado === 'pendiente' && (
        <div style={{
          background: '#FEE2E2', border: '1px solid #FCA5A5',
          borderRadius: 6, padding: 16, marginBottom: 24
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#991B1B', marginBottom: 4 }}>
            Esta solicitud no tiene aprobadores asignados
          </div>
          <div style={{ fontSize: 12, color: '#7F1D1D' }}>
            Contactá al administrador para configurar el flujo de aprobación.
          </div>
        </div>
      )}
    </div>
  )
}
