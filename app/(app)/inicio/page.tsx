'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth'

// ============================================================
// INICIO = Dashboard operativo
// Muestra TODO lo que requiere acción del usuario:
// - Aprobaciones pendientes (si rol aprobador)
// - Mis solicitudes activas
// - OFs por gestionar (si encargado/admin)
// - Cotizaciones abiertas
// - Pagos próximos (financiero/admin)
// - Alertas urgentes
// ============================================================

export default function InicioPage() {
  const { usuario } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [aprobacionesPend, setAprobacionesPend] = useState<any[]>([])
  const [misSolicitudes, setMisSolicitudes] = useState<any[]>([])
  const [ofsActivas, setOfsActivas] = useState<any[]>([])
  const [cotizacionesAbiertas, setCotizacionesAbiertas] = useState<any[]>([])
  const [alertas, setAlertas] = useState<any[]>([])
  const [resumenGlobal, setResumenGlobal] = useState<any>(null)

  useEffect(() => {
    if (!usuario) {
      router.push('/login')
      return
    }
    cargar()
  }, [usuario])

  const cargar = async () => {
    if (!usuario) return
    const esAprobador = ['encargado', 'admin_compras', 'gerencia'].includes(usuario.rol)
    const esCompras = ['admin_compras', 'gerencia'].includes(usuario.rol)

    try {
      // 1. Aprobaciones pendientes (si aplica)
      if (esAprobador) {
        const { data: aprs } = await supabase
          .from('aprobaciones')
          .select('*')
          .eq('aprobador_id', usuario.id)
          .eq('estado', 'pendiente')
          .limit(5)

        if (aprs && aprs.length > 0) {
          const solicitudIds = aprs.map(a => a.solicitud_id)
          const { data: sols } = await supabase
            .from('solicitudes').select('*').in('id', solicitudIds)
          const solicitanteIds = [...new Set((sols || []).map(s => s.solicitante_id))]
          const { data: usuarios } = await supabase
            .from('usuarios').select('id, nombre').in('id', solicitanteIds)
          const { data: items } = await supabase
            .from('items_solicitud').select('*').in('solicitud_id', solicitudIds)

          const enriched = aprs.map(apr => {
            const sol = (sols || []).find(s => s.id === apr.solicitud_id)
            const solicitante = (usuarios || []).find(u => u.id === sol?.solicitante_id)
            const solItems = (items || []).filter(i => i.solicitud_id === apr.solicitud_id)
            const monto = solItems.reduce((sum, i) => sum + (parseFloat(i.presupuesto_estimado) || 0), 0)
            return { ...apr, solicitud: sol, solicitante, monto }
          })
          setAprobacionesPend(enriched)
        }
      }

      // 2. Mis solicitudes activas (todas menos completadas/rechazadas)
      const { data: mias } = await supabase
        .from('solicitudes')
        .select('*')
        .eq('solicitante_id', usuario.id)
        .order('created_at', { ascending: false })
        .limit(5)

      if (mias && mias.length > 0) {
        const solicitudIds = mias.map(s => s.id)
        const { data: items } = await supabase
          .from('items_solicitud').select('*').in('solicitud_id', solicitudIds)
        const enriched = mias.map(s => {
          const solItems = (items || []).filter(i => i.solicitud_id === s.id)
          const monto = solItems.reduce((sum, i) => sum + (parseFloat(i.presupuesto_estimado) || 0), 0)
          return { ...s, monto, items_count: solItems.length }
        })
        setMisSolicitudes(enriched)
      }

      // 3. OFs activas (solo para encargado/admin/gerencia)
      if (esAprobador) {
        try {
          const { data: ofs } = await supabase
            .from('ordenes_facturacion')
            .select('id, codigo_of, valor_total, estado_verificacion, estado_pago, created_at, proveedores(razon_social)')
            .in('estado_verificacion', ['PENDIENTE', 'EN_PROCESO'])
            .order('created_at', { ascending: false })
            .limit(5)
          setOfsActivas(ofs || [])
        } catch (e) {
          // Tabla puede no existir, ignorar
        }
      }

      // 4. Cotizaciones abiertas (para admin/gerencia)
      if (esCompras) {
        try {
          const { data: cotz } = await supabase
            .from('cotizaciones')
            .select('id, created_at, estado, valor_total, proveedores(razon_social)')
            .eq('estado', 'PENDIENTE')
            .order('created_at', { ascending: false })
            .limit(5)
          setCotizacionesAbiertas(cotz || [])
        } catch (e) {
          // Tabla puede no existir
        }
      }

      // 5. Alertas del sistema
      try {
        const { data: alts } = await supabase
          .from('alertas')
          .select('*')
          .eq('usuario_id', usuario.id)
          .eq('leida', false)
          .order('created_at', { ascending: false })
          .limit(3)
        setAlertas(alts || [])
      } catch (e) {}

      // 6. Resumen global (solo admin/gerencia)
      if (esCompras) {
        try {
          const [
            { count: totalSolicitudes },
            { count: pendientesAprob },
            { count: aprobadas }
          ] = await Promise.all([
            supabase.from('solicitudes').select('*', { count: 'exact', head: true }),
            supabase.from('solicitudes').select('*', { count: 'exact', head: true }).eq('estado', 'pendiente'),
            supabase.from('solicitudes').select('*', { count: 'exact', head: true }).eq('estado', 'aprobada')
          ])
          setResumenGlobal({ totalSolicitudes, pendientesAprob, aprobadas })
        } catch (e) {}
      }

      setLoading(false)
    } catch (error) {
      console.error('Error:', error)
      setLoading(false)
    }
  }

  const getEstadoBadge = (estado: string) => {
    const config: Record<string, { bg: string; color: string; label: string }> = {
      pendiente:  { bg: '#FEF3C7', color: '#92400E', label: 'Pendiente' },
      aprobada:   { bg: '#D1FAE5', color: '#065F46', label: 'Aprobada' },
      rechazada:  { bg: '#FEE2E2', color: '#991B1B', label: 'Rechazada' },
      cotizando:  { bg: '#DBEAFE', color: '#1E40AF', label: 'Cotizando' },
      completada: { bg: '#F3F4F6', color: '#374151', label: 'Completada' },
    }
    const c = config[estado?.toLowerCase()] || config.pendiente
    return (
      <span style={{
        padding: '3px 8px', borderRadius: 3, fontSize: 10,
        fontWeight: 600, background: c.bg, color: c.color
      }}>
        {c.label}
      </span>
    )
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Cargando...</div>
  }

  const saludo = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Buenos días'
    if (h < 19) return 'Buenas tardes'
    return 'Buenas noches'
  })()

  const tareasPendientes = aprobacionesPend.length + ofsActivas.length + cotizacionesAbiertas.length

  return (
    <div style={{ padding: 32, maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>
          {saludo},
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#111', margin: 0, marginBottom: 8 }}>
          {usuario?.nombre}
        </h1>
        {tareasPendientes > 0 ? (
          <div style={{ fontSize: 13, color: '#6b7280' }}>
            Tenés <strong style={{ color: '#DC2626' }}>{tareasPendientes} tareas pendientes</strong> que requieren tu acción
          </div>
        ) : (
          <div style={{ fontSize: 13, color: '#6b7280' }}>
            Todo al día — no hay tareas pendientes
          </div>
        )}
      </div>

      {/* Acción rápida */}
      <div style={{ marginBottom: 28, display: 'flex', gap: 10 }}>
        <button
          onClick={() => router.push('/solicitudes/nueva')}
          style={{
            padding: '11px 22px', background: '#185FA5', color: '#fff',
            border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          + Nueva solicitud de compra
        </button>
      </div>

      {/* Resumen global (solo admin/gerencia) */}
      {resumenGlobal && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12, marginBottom: 28
        }}>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', padding: 14, borderRadius: 6 }}>
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Total solicitudes</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#111' }}>{resumenGlobal.totalSolicitudes || 0}</div>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', padding: 14, borderRadius: 6 }}>
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Pendientes aprobación</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#F59E0B' }}>{resumenGlobal.pendientesAprob || 0}</div>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', padding: 14, borderRadius: 6 }}>
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Aprobadas en curso</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#10B981' }}>{resumenGlobal.aprobadas || 0}</div>
          </div>
        </div>
      )}

      {/* Las 4 fases oficiales */}
      <div style={{
        background: '#fff', border: '1px solid #e5e7eb',
        borderRadius: 8, padding: 20, marginBottom: 28
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#111', marginBottom: 4 }}>
          Proceso oficial de compras — Feeling Company
        </div>
        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 14 }}>
          Las 4 fases que atraviesa toda solicitud
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {[
            { num: 1, label: 'Activación y Convocatoria', desc: 'Solicitud, aprobación, cotización' },
            { num: 2, label: 'Formalización', desc: 'Emisión de OF / OS' },
            { num: 3, label: 'Ejecución y Liquidación', desc: 'Ejecución, radicación, pago' },
            { num: 4, label: 'Auditoría de Compras y Pago', desc: 'Contraloría, cierre' },
          ].map(fase => (
            <div key={fase.num} style={{
              background: '#F9FAFB', padding: 12, borderRadius: 6,
              border: '1px solid #e5e7eb'
            }}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: '#185FA5',
                letterSpacing: '0.08em', marginBottom: 6
              }}>
                FASE {fase.num}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#111', marginBottom: 3 }}>
                {fase.label}
              </div>
              <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.4 }}>
                {fase.desc}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Layout en 2 columnas */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* COLUMNA IZQUIERDA: Tareas que requieren acción */}
        <div>
          {/* Aprobaciones pendientes */}
          {aprobacionesPend.length > 0 && (
            <Card
              titulo="Requieren tu aprobación"
              badge={aprobacionesPend.length}
              badgeColor="#DC2626"
              accion="Ver todas"
              onAccion={() => router.push('/aprobaciones')}
            >
              {aprobacionesPend.map(apr => (
                <div key={apr.id}
                  onClick={() => router.push(`/solicitudes/${apr.solicitud_id}`)}
                  style={{
                    padding: 10, borderLeft: '3px solid #F59E0B',
                    background: '#FFFBEB', borderRadius: 3,
                    marginBottom: 6, cursor: 'pointer', fontSize: 12
                  }}>
                  <div style={{ fontWeight: 600, color: '#111', marginBottom: 2 }}>
                    {apr.solicitud?.descripcion || 'Sin descripción'}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6b7280', fontSize: 11 }}>
                    <span>Por {apr.solicitante?.nombre || '—'}</span>
                    <span style={{ fontWeight: 600, color: '#185FA5' }}>
                      ${apr.monto.toLocaleString('es-CO')}
                    </span>
                  </div>
                </div>
              ))}
            </Card>
          )}

          {/* OFs activas */}
          {ofsActivas.length > 0 && (
            <Card
              titulo="Órdenes de Facturación activas"
              badge={ofsActivas.length}
              accion="Ver todas"
              onAccion={() => router.push('/ordenes')}
            >
              {ofsActivas.map(of => (
                <div key={of.id}
                  onClick={() => router.push('/ordenes')}
                  style={{
                    padding: 10, background: '#F9FAFB',
                    borderRadius: 3, marginBottom: 6,
                    cursor: 'pointer', fontSize: 12,
                    border: '1px solid #e5e7eb'
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600, color: '#111' }}>
                      {of.codigo_of || 'OF-' + of.id?.slice(0, 6)}
                    </span>
                    <span style={{ fontWeight: 600, color: '#185FA5' }}>
                      ${(of.valor_total || 0).toLocaleString('es-CO')}
                    </span>
                  </div>
                  <div style={{ color: '#6b7280', fontSize: 11, marginTop: 2 }}>
                    {of.proveedores?.razon_social || '—'} · {of.estado_verificacion}
                  </div>
                </div>
              ))}
            </Card>
          )}

          {/* Cotizaciones abiertas */}
          {cotizacionesAbiertas.length > 0 && (
            <Card
              titulo="Cotizaciones abiertas"
              badge={cotizacionesAbiertas.length}
              accion="Ver todas"
              onAccion={() => router.push('/cotizaciones')}
            >
              {cotizacionesAbiertas.map(ctz => (
                <div key={ctz.id}
                  onClick={() => router.push('/cotizaciones')}
                  style={{
                    padding: 10, background: '#F9FAFB',
                    borderRadius: 3, marginBottom: 6,
                    cursor: 'pointer', fontSize: 12,
                    border: '1px solid #e5e7eb'
                  }}>
                  <div style={{ color: '#111', fontWeight: 500 }}>
                    {ctz.proveedores?.razon_social || 'Sin proveedor'}
                  </div>
                  <div style={{ color: '#185FA5', fontWeight: 600, fontSize: 11, marginTop: 2 }}>
                    ${(ctz.valor_total || 0).toLocaleString('es-CO')}
                  </div>
                </div>
              ))}
            </Card>
          )}

          {/* Alertas */}
          {alertas.length > 0 && (
            <Card
              titulo="Alertas"
              badge={alertas.length}
              badgeColor="#F59E0B"
              accion="Ver todas"
              onAccion={() => router.push('/alertas')}
            >
              {alertas.map(a => (
                <div key={a.id} style={{
                  padding: 10, borderLeft: '3px solid #F59E0B',
                  background: '#FFFBEB', borderRadius: 3,
                  marginBottom: 6, fontSize: 12, color: '#78350F'
                }}>
                  {a.mensaje}
                </div>
              ))}
            </Card>
          )}

          {/* Empty state si no hay nada */}
          {aprobacionesPend.length === 0 && ofsActivas.length === 0 && 
           cotizacionesAbiertas.length === 0 && alertas.length === 0 && (
            <div style={{
              background: '#F9FAFB', border: '1px dashed #d1d5db',
              padding: 30, borderRadius: 6, textAlign: 'center',
              fontSize: 13, color: '#6b7280'
            }}>
              <div style={{ fontWeight: 500, marginBottom: 4 }}>Todo al día</div>
              <div style={{ fontSize: 12 }}>No hay tareas pendientes que requieran tu acción</div>
            </div>
          )}
        </div>

        {/* COLUMNA DERECHA: Mis solicitudes */}
        <div>
          <Card
            titulo="Mis solicitudes recientes"
            badge={misSolicitudes.length}
            accion="Ver todas"
            onAccion={() => router.push('/solicitudes')}
          >
            {misSolicitudes.length === 0 ? (
              <div style={{
                padding: 24, textAlign: 'center', fontSize: 12, color: '#9ca3af'
              }}>
                No has creado solicitudes
              </div>
            ) : (
              misSolicitudes.map(s => (
                <div key={s.id}
                  onClick={() => router.push(`/solicitudes/${s.id}`)}
                  style={{
                    padding: 10, background: '#F9FAFB',
                    borderRadius: 3, marginBottom: 6,
                    cursor: 'pointer', fontSize: 12,
                    border: '1px solid #e5e7eb'
                  }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 3 }}>
                    {getEstadoBadge(s.estado)}
                    <span style={{ fontWeight: 600, color: '#111' }}>{s.descripcion}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6b7280', fontSize: 11 }}>
                    <span>{s.items_count} ítem{s.items_count !== 1 ? 's' : ''} · {s.centro_costo || '—'}</span>
                    <span style={{ fontWeight: 600, color: '#185FA5' }}>
                      ${s.monto.toLocaleString('es-CO')}
                    </span>
                  </div>
                </div>
              ))
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

// Componente Card reusable
function Card({ titulo, badge, badgeColor, accion, onAccion, children }: any) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e5e7eb',
      borderRadius: 6, padding: 16, marginBottom: 14
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'baseline', marginBottom: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>
            {titulo}
          </span>
          {badge !== undefined && badge > 0 && (
            <span style={{
              fontSize: 11, fontWeight: 600,
              color: badgeColor || '#6b7280'
            }}>
              ({badge})
            </span>
          )}
        </div>
        {accion && (
          <button onClick={onAccion} style={{
            background: 'none', border: 'none',
            color: '#185FA5', fontSize: 11, cursor: 'pointer',
            textDecoration: 'underline', padding: 0
          }}>
            {accion}
          </button>
        )}
      </div>
      <div>{children}</div>
    </div>
  )
}
