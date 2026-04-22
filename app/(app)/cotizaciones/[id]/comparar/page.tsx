'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth'

// ============================================================
// COMPARAR Y ADJUDICAR COTIZACIONES
// Vista side-by-side para elegir ganador
// ============================================================

export default function CompararCotizacionesPage() {
  const { usuario } = useAuth()
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const solicitudId = params?.id as string

  const [solicitud, setSolicitud] = useState<any>(null)
  const [cotizaciones, setCotizaciones] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [adjudicando, setAdjudicando] = useState<string | null>(null)

  useEffect(() => {
    if (!usuario) {
      router.push('/login')
      return
    }
    if (!['admin_compras', 'gerencia'].includes(usuario.rol)) {
      router.push('/')
      return
    }
    if (solicitudId) cargar()
  }, [usuario, solicitudId])

  const cargar = async () => {
    try {
      const [
        { data: sol },
        { data: items },
        { data: cotz }
      ] = await Promise.all([
        supabase.from('solicitudes').select('*').eq('id', solicitudId).single(),
        supabase.from('items_solicitud').select('*').eq('solicitud_id', solicitudId),
        supabase.from('cotizaciones').select('*').eq('solicitud_id', solicitudId)
      ])

      if (!sol) {
        setLoading(false)
        return
      }

      // Enriquecer con proveedores
      let cotzEnriched: any[] = []
      if (cotz && cotz.length > 0) {
        const provIds = [...new Set(cotz.map((c: any) => c.proveedor_id).filter(Boolean))]
        const { data: provs } = await supabase
          .from('proveedores').select('id, razon_social, codigo, score, nit')
          .in('id', provIds)
        
        cotzEnriched = cotz.map((c: any) => ({
          ...c,
          proveedor: (provs || []).find((p: any) => p.id === c.proveedor_id)
        }))
      }

      const monto = (items || []).reduce(
        (s: number, i: any) => s + (parseFloat(i.presupuesto_estimado) || 0), 0
      )

      setSolicitud({ ...sol, items: items || [], monto })
      setCotizaciones(cotzEnriched)
      setLoading(false)
    } catch (err) {
      console.error(err)
      setLoading(false)
    }
  }

  const adjudicar = async (cotizacionId: string, proveedorId: string) => {
    const cotz = cotizaciones.find((c: any) => c.id === cotizacionId)
    if (!cotz) return

    if (!confirm(
      `¿Adjudicar esta solicitud a ${cotz.proveedor?.razon_social}?\n\n` +
      `Se va a emitir la OF automáticamente por $${Number(cotz.valor || 0).toLocaleString('es-CO')}`
    )) return

    setAdjudicando(cotizacionId)
    try {
      // 1. Marcar cotización como adjudicada
      await supabase.from('cotizaciones')
        .update({ estado: 'ADJUDICADA' })
        .eq('id', cotizacionId)

      // 2. Marcar las otras como descartadas
      const otrasIds = cotizaciones
        .filter((c: any) => c.id !== cotizacionId)
        .map((c: any) => c.id)
      if (otrasIds.length > 0) {
        await supabase.from('cotizaciones')
          .update({ estado: 'DESCARTADA' })
          .in('id', otrasIds)
      }

      // 3. Redirigir a crear OF con datos pre-llenados
      // El usuario decide si OF u OS en la siguiente pantalla
      router.push(`/solicitudes/${solicitudId}/crear-orden?proveedor=${proveedorId}&valor=${cotz.valor}`)
    } catch (err: any) {
      alert('Error: ' + err.message)
      setAdjudicando(null)
    }
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Cargando...</div>
  }

  if (!solicitud) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ color: '#6b7280', marginBottom: 12 }}>Solicitud no encontrada</div>
        <button onClick={() => router.push('/cotizaciones')} style={btnPrimary}>
          Volver
        </button>
      </div>
    )
  }

  const recibidas = cotizaciones.filter((c: any) =>
    c.estado === 'RECIBIDA' || c.estado === 'RESPONDIDA' || c.estado === 'ADJUDICADA'
  )
  const pendientes = cotizaciones.filter((c: any) =>
    c.estado === 'PENDIENTE' || c.estado === 'SOLICITADA'
  )
  
  // Ordenar recibidas por precio (menor a mayor)
  const recibidasOrdenadas = [...recibidas].sort((a, b) => 
    (Number(a.valor) || 0) - (Number(b.valor) || 0)
  )
  
  const mejor = recibidasOrdenadas[0]
  const presupuesto = solicitud.monto

  return (
    <div style={{ padding: 32, maxWidth: 1300, margin: '0 auto' }}>
      {/* Breadcrumb */}
      <button
        onClick={() => router.push('/cotizaciones')}
        style={{
          background: 'none', border: 'none', color: '#185FA5',
          fontSize: 13, cursor: 'pointer', marginBottom: 16,
          textDecoration: 'underline', padding: 0
        }}
      >
        ← Volver a Cotizaciones
      </button>

      {/* Header */}
      <div style={{ marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Paso 3 · Comparar y adjudicar
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111', margin: 0, marginBottom: 6 }}>
          {solicitud.descripcion}
        </h1>
        <div style={{ fontSize: 12, color: '#6b7280' }}>
          Presupuesto original: <strong style={{ color: '#185FA5' }}>${presupuesto.toLocaleString('es-CO')}</strong> · 
          {' '}{recibidas.length} cotización{recibidas.length !== 1 ? 'es' : ''} recibida{recibidas.length !== 1 ? 's' : ''}
          {pendientes.length > 0 && ` · ${pendientes.length} esperando respuesta`}
        </div>
      </div>

      {recibidas.length === 0 ? (
        <div style={{
          background: '#F9FAFB', border: '1px dashed #d1d5db',
          padding: 40, borderRadius: 6, textAlign: 'center'
        }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#6b7280', marginBottom: 6 }}>
            Aún no hay cotizaciones recibidas
          </div>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>
            Volvé al tab "Esperando respuestas" y registrá lo que te hayan enviado los proveedores.
          </div>
        </div>
      ) : (
        <>
          {/* Comparación side-by-side */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.min(recibidasOrdenadas.length, 3)}, 1fr)`,
            gap: 16, marginBottom: 24
          }}>
            {recibidasOrdenadas.slice(0, 3).map((c: any, idx: number) => {
              const esMejor = c.id === mejor?.id
              const diferenciaPct = presupuesto > 0
                ? ((Number(c.valor) - presupuesto) / presupuesto) * 100
                : 0

              return (
                <div key={c.id} style={{
                  background: '#fff',
                  border: `1px solid ${esMejor ? '#10B981' : '#e5e7eb'}`,
                  borderRadius: 8, padding: 20,
                  position: 'relative',
                  boxShadow: esMejor ? '0 4px 12px rgba(16,185,129,0.15)' : 'none'
                }}>
                  {esMejor && recibidasOrdenadas.length > 1 && (
                    <div style={{
                      position: 'absolute', top: -10, left: 16,
                      padding: '3px 10px', background: '#10B981', color: '#fff',
                      fontSize: 10, fontWeight: 700, borderRadius: 3,
                      textTransform: 'uppercase', letterSpacing: '0.05em'
                    }}>
                      Menor precio
                    </div>
                  )}

                  {/* Proveedor */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                      Proveedor
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>
                      {c.proveedor?.razon_social || 'Sin nombre'}
                    </div>
                    {c.proveedor?.codigo && (
                      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                        {c.proveedor.codigo}
                      </div>
                    )}
                  </div>

                  {/* Precio */}
                  <div style={{
                    padding: 14, background: '#F9FAFB',
                    borderRadius: 4, marginBottom: 14
                  }}>
                    <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                      Precio cotizado
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#185FA5' }}>
                      ${Number(c.valor || 0).toLocaleString('es-CO')}
                    </div>
                    {presupuesto > 0 && (
                      <div style={{
                        fontSize: 11, marginTop: 4,
                        color: diferenciaPct > 10 ? '#DC2626' : diferenciaPct < 0 ? '#10B981' : '#6b7280'
                      }}>
                        {diferenciaPct > 0 ? '▲' : '▼'} {Math.abs(diferenciaPct).toFixed(1)}% vs presupuesto
                      </div>
                    )}
                  </div>

                  {/* Tiempo entrega */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                      Tiempo de entrega
                    </div>
                    <div style={{ fontSize: 13, color: '#111' }}>
                      {c.tiempo_entrega || '—'}
                    </div>
                  </div>

                  {/* Condiciones */}
                  {c.condiciones && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                        Condiciones
                      </div>
                      <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.5 }}>
                        {c.condiciones}
                      </div>
                    </div>
                  )}

                  {/* Botón adjudicar */}
                  <button
                    onClick={() => adjudicar(c.id, c.proveedor_id)}
                    disabled={adjudicando !== null || c.estado === 'ADJUDICADA'}
                    style={{
                      width: '100%',
                      padding: '10px 16px',
                      background: c.estado === 'ADJUDICADA' ? '#10B981' : esMejor ? '#10B981' : '#185FA5',
                      color: '#fff', border: 'none', borderRadius: 4,
                      fontSize: 13, fontWeight: 600,
                      cursor: adjudicando ? 'wait' : c.estado === 'ADJUDICADA' ? 'default' : 'pointer',
                      opacity: adjudicando === c.id ? 0.6 : 1
                    }}
                  >
                    {c.estado === 'ADJUDICADA' ? '✓ Ya adjudicada' :
                     adjudicando === c.id ? 'Adjudicando...' : 'Adjudicar a este proveedor'}
                  </button>
                </div>
              )
            })}
          </div>

          {recibidasOrdenadas.length > 3 && (
            <div style={{ fontSize: 12, color: '#6b7280', textAlign: 'center', marginBottom: 16 }}>
              + {recibidasOrdenadas.length - 3} cotizaciones más (mostrando las 3 de menor precio)
            </div>
          )}

          {/* Resumen comparativo */}
          {recibidasOrdenadas.length >= 2 && (
            <div style={{
              background: '#fff', border: '1px solid #e5e7eb',
              borderRadius: 6, padding: 16
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#111', marginBottom: 10 }}>
                Resumen comparativo
              </div>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F9FAFB', fontSize: 10, color: '#6b7280', textTransform: 'uppercase' }}>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>Proveedor</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Precio</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Vs presupuesto</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Vs mejor</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>Entrega</th>
                  </tr>
                </thead>
                <tbody>
                  {recibidasOrdenadas.map((c: any) => {
                    const diferenciaPresup = presupuesto > 0
                      ? ((Number(c.valor) - presupuesto) / presupuesto) * 100 : 0
                    const diferenciaMejor = mejor && mejor.valor > 0
                      ? ((Number(c.valor) - Number(mejor.valor)) / Number(mejor.valor)) * 100 : 0
                    return (
                      <tr key={c.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '10px' }}>
                          <div style={{ fontWeight: 500, color: '#111' }}>
                            {c.proveedor?.razon_social}
                          </div>
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: '#185FA5' }}>
                          ${Number(c.valor || 0).toLocaleString('es-CO')}
                        </td>
                        <td style={{
                          padding: '10px', textAlign: 'right',
                          color: diferenciaPresup > 10 ? '#DC2626' : diferenciaPresup < 0 ? '#10B981' : '#6b7280'
                        }}>
                          {diferenciaPresup > 0 ? '+' : ''}{diferenciaPresup.toFixed(1)}%
                        </td>
                        <td style={{
                          padding: '10px', textAlign: 'right',
                          color: diferenciaMejor > 0 ? '#6b7280' : '#10B981',
                          fontWeight: c.id === mejor?.id ? 700 : 400
                        }}>
                          {c.id === mejor?.id ? '—' : `+${diferenciaMejor.toFixed(1)}%`}
                        </td>
                        <td style={{ padding: '10px', fontSize: 11, color: '#6b7280' }}>
                          {c.tiempo_entrega || '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

const btnPrimary: React.CSSProperties = {
  padding: '9px 18px', background: '#185FA5', color: '#fff',
  border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer'
}
