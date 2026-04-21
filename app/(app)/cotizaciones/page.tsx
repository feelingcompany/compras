'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth'

// ============================================================
// COTIZACIONES — Lógica operativa real
// 
// Pestaña 1: "Por cotizar"  — Solicitudes aprobadas, sin cotizaciones
// Pestaña 2: "En cotización" — Con cotizaciones recibidas (comparar)
// Pestaña 3: "Adjudicadas"   — Ya se eligió proveedor (historial)
// ============================================================

export default function CotizacionesPage() {
  const { usuario } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [tab, setTab] = useState<'por_cotizar' | 'en_cotizacion' | 'adjudicadas'>('por_cotizar')
  const [loading, setLoading] = useState(true)
  
  const [porCotizar, setPorCotizar] = useState<any[]>([])
  const [enCotizacion, setEnCotizacion] = useState<any[]>([])
  const [adjudicadas, setAdjudicadas] = useState<any[]>([])

  useEffect(() => {
    if (!usuario) {
      router.push('/login')
      return
    }
    if (!['encargado', 'admin_compras', 'gerencia'].includes(usuario.rol)) {
      router.push('/')
      return
    }
    cargar()
  }, [usuario])

  const cargar = async () => {
    try {
      // Traer solicitudes aprobadas y sus ítems
      const { data: solicitudes } = await supabase
        .from('solicitudes')
        .select('*')
        .in('estado', ['aprobada', 'cotizando', 'ordenada', 'completada'])
        .order('updated_at', { ascending: false, nullsFirst: false })

      if (!solicitudes || solicitudes.length === 0) {
        setLoading(false)
        return
      }

      const solicitudIds = solicitudes.map((s: any) => s.id)
      const solicitanteIds = [...new Set(solicitudes.map((s: any) => s.solicitante_id))]

      // Traer datos relacionados
      const [
        { data: items },
        { data: usuarios }
      ] = await Promise.all([
        supabase.from('items_solicitud').select('*').in('solicitud_id', solicitudIds),
        supabase.from('usuarios').select('id, nombre').in('id', solicitanteIds),
      ])

      // Intentar traer cotizaciones (puede fallar si la tabla no existe)
      let cotizacionesData: any[] = []
      try {
        const { data: cots } = await supabase
          .from('cotizaciones')
          .select('*')
          .in('solicitud_id', solicitudIds)
        cotizacionesData = cots || []
      } catch (e) {
        cotizacionesData = []
      }

      // Enriquecer solicitudes
      const enriched = solicitudes.map((s: any) => {
        const solItems = (items || []).filter((i: any) => i.solicitud_id === s.id)
        const monto = solItems.reduce((sum: number, i: any) => sum + (parseFloat(i.presupuesto_estimado) || 0), 0)
        const solCotizaciones = cotizacionesData.filter((c: any) => c.solicitud_id === s.id)
        return {
          ...s,
          monto,
          items: solItems,
          items_count: solItems.length,
          solicitante: (usuarios || []).find((u: any) => u.id === s.solicitante_id),
          cotizaciones: solCotizaciones,
          cotizaciones_count: solCotizaciones.length
        }
      })

      // Separar por tab
      setPorCotizar(enriched.filter(s => s.estado === 'aprobada' && s.cotizaciones_count === 0))
      setEnCotizacion(enriched.filter(s => s.estado === 'cotizando' || (s.estado === 'aprobada' && s.cotizaciones_count > 0)))
      setAdjudicadas(enriched.filter(s => ['ordenada', 'completada'].includes(s.estado)))

      setLoading(false)
    } catch (error) {
      console.error('Error:', error)
      setLoading(false)
    }
  }

  const iniciarCotizacion = async (solicitudId: string) => {
    await supabase
      .from('solicitudes')
      .update({ estado: 'cotizando', updated_at: new Date().toISOString() })
      .eq('id', solicitudId)
    
    cargar()
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Cargando...</div>
  }

  const tabActiva = tab === 'por_cotizar' ? porCotizar : tab === 'en_cotizacion' ? enCotizacion : adjudicadas

  return (
    <div style={{ padding: 32, maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111', margin: 0, marginBottom: 4 }}>
          Cotizaciones
        </h1>
        <div style={{ fontSize: 13, color: '#6b7280' }}>
          Solicitudes aprobadas · Buscá proveedores · Compará propuestas
        </div>
      </div>

      {/* Explicación del proceso */}
      <div style={{
        background: '#EFF6FF', border: '1px solid #BFDBFE',
        borderRadius: 6, padding: 14, marginBottom: 20,
        fontSize: 12, color: '#1E40AF', lineHeight: 1.5
      }}>
        <strong>¿Qué hacés acá?</strong> Una vez que una solicitud está <strong>aprobada</strong>, tenés que
        buscar proveedores, recibir sus cotizaciones, comparar precios/tiempos/condiciones, y adjudicar el trabajo
        al proveedor ganador. Al adjudicar, se emite la OF/OS.
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 20,
        borderBottom: '1px solid #e5e7eb'
      }}>
        <TabBtn activa={tab === 'por_cotizar'} onClick={() => setTab('por_cotizar')}>
          Por cotizar {porCotizar.length > 0 && <Badge color="#DC2626">{porCotizar.length}</Badge>}
        </TabBtn>
        <TabBtn activa={tab === 'en_cotizacion'} onClick={() => setTab('en_cotizacion')}>
          En cotización {enCotizacion.length > 0 && <Badge color="#F59E0B">{enCotizacion.length}</Badge>}
        </TabBtn>
        <TabBtn activa={tab === 'adjudicadas'} onClick={() => setTab('adjudicadas')}>
          Adjudicadas {adjudicadas.length > 0 && <Badge color="#10B981">{adjudicadas.length}</Badge>}
        </TabBtn>
      </div>

      {/* Explicación por tab */}
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 14, fontStyle: 'italic' }}>
        {tab === 'por_cotizar' && 'Solicitudes aprobadas esperando que pidas cotizaciones a proveedores.'}
        {tab === 'en_cotizacion' && 'Con cotizaciones ya recibidas. Compará y adjudicá.'}
        {tab === 'adjudicadas' && 'Ya decididas — OF/OS emitidas al proveedor ganador.'}
      </div>

      {/* Lista */}
      {tabActiva.length === 0 ? (
        <div style={{
          background: '#F9FAFB', border: '1px dashed #d1d5db',
          padding: 40, borderRadius: 6, textAlign: 'center'
        }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#6b7280', marginBottom: 4 }}>
            {tab === 'por_cotizar' && 'No hay solicitudes aprobadas esperando cotización'}
            {tab === 'en_cotizacion' && 'No hay cotizaciones activas'}
            {tab === 'adjudicadas' && 'Todavía no has adjudicado ninguna solicitud'}
          </div>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>
            {tab === 'por_cotizar' && 'Cuando se aprueben solicitudes, aparecerán acá para que las cotices.'}
          </div>
        </div>
      ) : (
        <div style={{
          background: '#fff', border: '1px solid #e5e7eb',
          borderRadius: 6, overflow: 'hidden'
        }}>
          {tabActiva.map(s => (
            <div key={s.id} style={{
              padding: 16, borderBottom: '1px solid #f3f4f6'
            }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'flex-start', marginBottom: 10
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>
                      {s.descripcion}
                    </span>
                    {s.prioridad === 'urgente' && (
                      <span style={{
                        padding: '2px 7px', background: '#FEF3C7', color: '#92400E',
                        fontSize: 10, fontWeight: 600, borderRadius: 3
                      }}>
                        URGENTE
                      </span>
                    )}
                    {s.prioridad === 'critico' && (
                      <span style={{
                        padding: '2px 7px', background: '#FEE2E2', color: '#991B1B',
                        fontSize: 10, fontWeight: 600, borderRadius: 3
                      }}>
                        CRÍTICA
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    Solicita: <strong>{s.solicitante?.nombre}</strong> · 
                    {' '}Centro: <strong>{s.centro_costo || '—'}</strong> · 
                    {' '}Requerida: <strong>{s.fecha_requerida ? new Date(s.fecha_requerida).toLocaleDateString('es-CO') : '—'}</strong>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>Presupuesto</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#185FA5' }}>
                    ${s.monto.toLocaleString('es-CO')}
                  </div>
                </div>
              </div>

              {/* Ítems resumidos */}
              <div style={{
                background: '#F9FAFB', padding: 10, borderRadius: 4,
                marginBottom: 12, fontSize: 12
              }}>
                <div style={{ fontWeight: 600, color: '#374151', marginBottom: 6, fontSize: 11, textTransform: 'uppercase' }}>
                  {s.items_count} ítem{s.items_count !== 1 ? 's' : ''} a cotizar
                </div>
                {s.items.slice(0, 3).map((item: any) => (
                  <div key={item.id} style={{
                    display: 'flex', justifyContent: 'space-between',
                    padding: '4px 0', fontSize: 12
                  }}>
                    <div>
                      <span style={{ fontWeight: 500, color: '#111' }}>{item.descripcion}</span>
                      <span style={{ color: '#6b7280', marginLeft: 6 }}>
                        ({item.cantidad} {item.unidad})
                      </span>
                    </div>
                    <span style={{ fontWeight: 600, color: '#185FA5' }}>
                      ${parseFloat(item.presupuesto_estimado || 0).toLocaleString('es-CO')}
                    </span>
                  </div>
                ))}
                {s.items_count > 3 && (
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                    + {s.items_count - 3} más
                  </div>
                )}
              </div>

              {/* Acciones */}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => router.push(`/solicitudes/${s.id}`)}
                  style={{
                    padding: '8px 14px', background: '#fff', color: '#374151',
                    border: '1px solid #d1d5db', borderRadius: 4,
                    fontSize: 12, cursor: 'pointer', fontWeight: 500
                  }}
                >
                  Ver solicitud
                </button>
                {tab === 'por_cotizar' && (
                  <button
                    onClick={() => iniciarCotizacion(s.id)}
                    style={{
                      padding: '8px 14px', background: '#185FA5', color: '#fff',
                      border: 'none', borderRadius: 4,
                      fontSize: 12, cursor: 'pointer', fontWeight: 600
                    }}
                  >
                    Iniciar cotización
                  </button>
                )}
                {tab === 'en_cotizacion' && (
                  <button
                    onClick={() => router.push(`/solicitudes/${s.id}`)}
                    style={{
                      padding: '8px 14px', background: '#185FA5', color: '#fff',
                      border: 'none', borderRadius: 4,
                      fontSize: 12, cursor: 'pointer', fontWeight: 600
                    }}
                  >
                    Comparar y adjudicar
                  </button>
                )}
                {tab === 'adjudicadas' && (
                  <button
                    onClick={() => router.push('/ordenes')}
                    style={{
                      padding: '8px 14px', background: '#fff', color: '#185FA5',
                      border: '1px solid #185FA5', borderRadius: 4,
                      fontSize: 12, cursor: 'pointer', fontWeight: 500
                    }}
                  >
                    Ver OF/OS
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TabBtn({ activa, onClick, children }: any) {
  return (
    <button onClick={onClick} style={{
      padding: '10px 20px', background: 'none',
      border: 'none', borderBottom: `2px solid ${activa ? '#185FA5' : 'transparent'}`,
      color: activa ? '#185FA5' : '#6b7280',
      fontSize: 13, fontWeight: activa ? 600 : 500,
      cursor: 'pointer', marginBottom: -1,
      display: 'flex', alignItems: 'center', gap: 6
    }}>
      {children}
    </button>
  )
}

function Badge({ color, children }: any) {
  return (
    <span style={{
      padding: '1px 7px', background: color, color: '#fff',
      fontSize: 10, fontWeight: 700, borderRadius: 10
    }}>
      {children}
    </span>
  )
}
