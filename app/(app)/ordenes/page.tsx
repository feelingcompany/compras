'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth'

// ============================================================
// ÓRDENES DE FACTURACIÓN
// Sección operativa - hace cosas:
// - Crear nueva OF (desde cero o desde solicitud aprobada)
// - Ver detalle de cualquier OF
// - Acciones rápidas: aprobar, imprimir, marcar pagada
// - Filtros por estado para priorizar trabajo
// ============================================================

export default function OrdenesFacturacionPage() {
  const { usuario } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [ofs, setOfs] = useState<any[]>([])
  const [solicitudesAprobadas, setSolicitudesAprobadas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'todas' | 'por_aprobar' | 'aprobadas' | 'pagadas' | 'emitir'>('emitir')
  const [busqueda, setBusqueda] = useState('')

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
      // 1. Cargar OFs existentes
      const { data: ofsData } = await supabase
        .from('ordenes_facturacion')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)

      let ofsEnriched: any[] = []
      if (ofsData && ofsData.length > 0) {
        const provIds = [...new Set(ofsData.map((o: any) => o.proveedor_id).filter(Boolean))]
        const solIds = [...new Set(ofsData.map((o: any) => o.solicitud_id).filter(Boolean))]

        const [provs, sols] = await Promise.all([
          provIds.length > 0
            ? supabase.from('proveedores').select('id, razon_social, codigo').in('id', provIds)
            : Promise.resolve({ data: [] }),
          solIds.length > 0
            ? supabase.from('solicitudes').select('id, descripcion, centro_costo').in('id', solIds)
            : Promise.resolve({ data: [] })
        ])

        ofsEnriched = ofsData.map((o: any) => ({
          ...o,
          proveedor: (provs.data || []).find((p: any) => p.id === o.proveedor_id),
          solicitud: (sols.data || []).find((s: any) => s.id === o.solicitud_id)
        }))
      }
      setOfs(ofsEnriched)

      // 2. Cargar solicitudes aprobadas listas para emitir OF
      const { data: aprobs } = await supabase
        .from('solicitudes')
        .select('*')
        .in('estado', ['aprobada', 'cotizando'])
        .order('created_at', { ascending: false })

      if (aprobs && aprobs.length > 0) {
        const sIds = aprobs.map((s: any) => s.id)
        const solicitanteIds = [...new Set(aprobs.map((s: any) => s.solicitante_id))]

        const [items, users] = await Promise.all([
          supabase.from('items_solicitud').select('*').in('solicitud_id', sIds),
          supabase.from('usuarios').select('id, nombre').in('id', solicitanteIds)
        ])

        const enriched = aprobs.map((s: any) => {
          const its = (items.data || []).filter((i: any) => i.solicitud_id === s.id)
          const monto = its.reduce((sum: number, i: any) => sum + (parseFloat(i.presupuesto_estimado) || 0), 0)
          return {
            ...s,
            monto,
            items_count: its.length,
            solicitante: (users.data || []).find((u: any) => u.id === s.solicitante_id)
          }
        })
        setSolicitudesAprobadas(enriched)
      } else {
        setSolicitudesAprobadas([])
      }

      setLoading(false)
    } catch (err) {
      console.error(err)
      setLoading(false)
    }
  }

  const accionRapida = async (ofId: string, campo: string, valor: string, confirmacion: string) => {
    if (!confirm(confirmacion)) return
    await supabase
      .from('ordenes_facturacion')
      .update({ [campo]: valor, updated_at: new Date().toISOString() })
      .eq('id', ofId)
    cargar()
  }

  const estadoConfig: Record<string, { bg: string; color: string; label: string }> = {
    PENDIENTE:    { bg: '#FEF3C7', color: '#92400E', label: 'Pendiente' },
    EN_PROCESO:   { bg: '#DBEAFE', color: '#1E40AF', label: 'En proceso' },
    EN_REVISION:  { bg: '#FEF3C7', color: '#92400E', label: 'En revisión' },
    APROBADA:     { bg: '#D1FAE5', color: '#065F46', label: 'Aprobada' },
    ENVIADA:      { bg: '#E0E7FF', color: '#3730A3', label: 'Enviada' },
    PAGADA:       { bg: '#D1FAE5', color: '#065F46', label: 'Pagada' },
    PAGADO:       { bg: '#D1FAE5', color: '#065F46', label: 'Pagada' },
    PARCIAL:      { bg: '#FED7AA', color: '#9A3412', label: 'Parcial' },
    ANULADA:      { bg: '#FEE2E2', color: '#991B1B', label: 'Anulada' },
  }

  const ofsFiltradas = ofs
    .filter(of => {
      if (tab === 'todas') return true
      if (tab === 'por_aprobar') return ['PENDIENTE', 'EN_PROCESO', 'EN_REVISION'].includes(of.estado_verificacion)
      if (tab === 'aprobadas') return of.estado_verificacion === 'APROBADA' && !['PAGADA', 'PAGADO'].includes(of.estado_pago)
      if (tab === 'pagadas') return ['PAGADA', 'PAGADO'].includes(of.estado_pago)
      return true
    })
    .filter(of => {
      if (!busqueda) return true
      const q = busqueda.toLowerCase()
      return (
        of.codigo_of?.toLowerCase().includes(q) ||
        of.descripcion?.toLowerCase().includes(q) ||
        of.proveedor?.razon_social?.toLowerCase().includes(q)
      )
    })

  const stats = {
    total: ofs.length,
    porEmitir: solicitudesAprobadas.length,
    porAprobar: ofs.filter(o => ['PENDIENTE', 'EN_PROCESO', 'EN_REVISION'].includes(o.estado_verificacion)).length,
    aprobadasSinPagar: ofs.filter(o => o.estado_verificacion === 'APROBADA' && !['PAGADA', 'PAGADO'].includes(o.estado_pago)).length,
    pagadas: ofs.filter(o => ['PAGADA', 'PAGADO'].includes(o.estado_pago)).length,
    montoPendiente: ofs
      .filter(o => !['PAGADA', 'PAGADO'].includes(o.estado_pago) && o.estado_verificacion !== 'ANULADA')
      .reduce((s, o) => s + (parseFloat(o.valor_total) || 0), 0)
  }

  const esAdmin = ['admin_compras', 'gerencia'].includes(usuario?.rol || '')

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Cargando...</div>
  }

  return (
    <div style={{ padding: 32, maxWidth: 1400, margin: '0 auto' }}>
      {/* Header con acciones principales */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Etapa 4 del proceso
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111', margin: 0, marginBottom: 4 }}>
            Órdenes de Facturación
          </h1>
          <div style={{ fontSize: 13, color: '#6b7280' }}>
            Autorizar al proveedor a facturar por los servicios/productos entregados
          </div>
        </div>
        {esAdmin && (
          <button
            onClick={() => router.push('/nueva-of')}
            style={{
              padding: '11px 22px', background: '#185FA5', color: '#fff',
              border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            + Nueva OF desde cero
          </button>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 20 }}>
        <StatCard label="Por emitir" valor={stats.porEmitir} color="#DC2626" subtitulo="Solicitudes aprobadas" />
        <StatCard label="Por aprobar" valor={stats.porAprobar} color="#F59E0B" subtitulo="OFs pendientes" />
        <StatCard label="Aprobadas" valor={stats.aprobadasSinPagar} color="#185FA5" subtitulo="Por pagar" />
        <StatCard label="Pagadas" valor={stats.pagadas} color="#10B981" subtitulo="Cerradas" />
        <StatCard label="Monto pendiente" valor={`$${(stats.montoPendiente / 1000000).toFixed(1)}M`} color="#3730A3" subtitulo="Por liquidar" />
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 2, marginBottom: 20,
        borderBottom: '1px solid #e5e7eb'
      }}>
        <Tab activo={tab === 'emitir'} onClick={() => setTab('emitir')} count={solicitudesAprobadas.length} color="#DC2626">
          Por emitir
        </Tab>
        <Tab activo={tab === 'por_aprobar'} onClick={() => setTab('por_aprobar')} count={stats.porAprobar} color="#F59E0B">
          Por aprobar
        </Tab>
        <Tab activo={tab === 'aprobadas'} onClick={() => setTab('aprobadas')} count={stats.aprobadasSinPagar} color="#185FA5">
          Aprobadas (sin pagar)
        </Tab>
        <Tab activo={tab === 'pagadas'} onClick={() => setTab('pagadas')} count={stats.pagadas}>
          Pagadas
        </Tab>
        <Tab activo={tab === 'todas'} onClick={() => setTab('todas')} count={ofs.length}>
          Todas
        </Tab>
      </div>

      {/* TAB: EMITIR OF - solicitudes aprobadas listas */}
      {tab === 'emitir' && (
        <>
          <div style={{
            background: '#EFF6FF', border: '1px solid #BFDBFE',
            borderRadius: 6, padding: 14, marginBottom: 16,
            fontSize: 12, color: '#1E40AF', lineHeight: 1.5
          }}>
            <strong>Paso 4 del proceso:</strong> Estas solicitudes ya fueron aprobadas.
            Tu trabajo es elegir el proveedor ganador y emitir la OF para que puedan facturarnos.
          </div>

          {solicitudesAprobadas.length === 0 ? (
            <EmptyState
              titulo="No hay solicitudes aprobadas esperando OF"
              subtitulo="Cuando una solicitud sea aprobada, aparecerá acá para que emitas la OF."
            />
          ) : (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden' }}>
              {solicitudesAprobadas.map(s => (
                <div key={s.id} style={{
                  padding: 16, borderBottom: '1px solid #f3f4f6',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#111', marginBottom: 3 }}>
                      {s.descripcion}
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>
                      Por <strong>{s.solicitante?.nombre}</strong> · 
                      {' '}{s.items_count} ítem{s.items_count !== 1 ? 's' : ''} · 
                      {' '}{s.centro_costo || '—'} · 
                      {' '}{s.ciudad || '—'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', marginRight: 16 }}>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>Presupuesto</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#185FA5' }}>
                      ${s.monto.toLocaleString('es-CO')}
                    </div>
                  </div>
                  {esAdmin && (
                    <button
                      onClick={() => router.push(`/solicitudes/${s.id}/crear-orden`)}
                      style={btnPrimary}
                    >
                      Emitir OF →
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* TABS: LISTADOS DE OFs */}
      {tab !== 'emitir' && (
        <>
          {/* Buscador */}
          <div style={{ marginBottom: 14 }}>
            <input
              type="text"
              placeholder="Buscar código, proveedor, descripción..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              style={{
                width: '100%', padding: '9px 14px',
                border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13, outline: 'none'
              }}
            />
          </div>

          {ofsFiltradas.length === 0 ? (
            <EmptyState
              titulo={ofs.length === 0 ? 'No hay OFs creadas' : 'No hay OFs en esta vista'}
              subtitulo={ofs.length === 0 ? 'Las OFs se crean desde solicitudes aprobadas.' : ''}
            />
          ) : (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden' }}>
              {/* Header */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '130px 2fr 1.3fr 110px 120px 120px 280px',
                padding: '10px 16px', background: '#F9FAFB',
                borderBottom: '1px solid #e5e7eb',
                fontSize: 11, fontWeight: 600, color: '#6b7280',
                textTransform: 'uppercase', letterSpacing: '0.04em'
              }}>
                <div>Código</div>
                <div>Descripción</div>
                <div>Proveedor</div>
                <div style={{ textAlign: 'right' }}>Valor</div>
                <div>Verificación</div>
                <div>Pago</div>
                <div style={{ textAlign: 'right' }}>Acciones</div>
              </div>

              {/* Rows */}
              {ofsFiltradas.map(of => {
                const verif = estadoConfig[of.estado_verificacion] || estadoConfig.PENDIENTE
                const pago = estadoConfig[of.estado_pago] || estadoConfig.PENDIENTE
                return (
                  <div
                    key={of.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '130px 2fr 1.3fr 110px 120px 120px 280px',
                      padding: '12px 16px', borderBottom: '1px solid #f3f4f6',
                      fontSize: 12, alignItems: 'center'
                    }}
                  >
                    <div
                      onClick={() => router.push(`/ordenes/${of.id}`)}
                      style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: '#185FA5', cursor: 'pointer' }}
                    >
                      {of.codigo_of}
                    </div>
                    <div onClick={() => router.push(`/ordenes/${of.id}`)} style={{ cursor: 'pointer' }}>
                      <div style={{ fontWeight: 500, color: '#111', marginBottom: 2 }}>
                        {of.descripcion || '(sin descripción)'}
                      </div>
                      {of.solicitud && (
                        <div style={{ fontSize: 10, color: '#9ca3af' }}>
                          {of.solicitud.centro_costo}
                        </div>
                      )}
                    </div>
                    <div style={{ color: '#374151', fontSize: 11 }}>
                      {of.proveedor?.razon_social || '—'}
                    </div>
                    <div style={{ textAlign: 'right', fontWeight: 600, color: '#185FA5' }}>
                      ${(parseFloat(of.valor_total) || 0).toLocaleString('es-CO')}
                    </div>
                    <div>
                      <span style={{ padding: '3px 8px', borderRadius: 3, fontSize: 10, fontWeight: 600, background: verif.bg, color: verif.color }}>
                        {verif.label}
                      </span>
                    </div>
                    <div>
                      <span style={{ padding: '3px 8px', borderRadius: 3, fontSize: 10, fontWeight: 600, background: pago.bg, color: pago.color }}>
                        {pago.label}
                      </span>
                    </div>
                    {/* Acciones rápidas */}
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => window.open(`/ordenes/${of.id}/imprimir`, '_blank')}
                        style={btnMiniSecondary}
                        title="Imprimir OF oficial"
                      >
                        Imprimir
                      </button>
                      {esAdmin && ['PENDIENTE', 'EN_PROCESO', 'EN_REVISION'].includes(of.estado_verificacion) && (
                        <button
                          onClick={() => accionRapida(of.id, 'estado_verificacion', 'APROBADA', '¿Aprobar esta OF?')}
                          style={btnMiniSuccess}
                          title="Aprobar OF"
                        >
                          Aprobar
                        </button>
                      )}
                      {esAdmin && of.estado_verificacion === 'APROBADA' && !['PAGADA', 'PAGADO'].includes(of.estado_pago) && (
                        <button
                          onClick={() => accionRapida(of.id, 'estado_pago', 'PAGADO', '¿Confirmar que esta OF fue pagada?')}
                          style={btnMiniSuccess}
                          title="Marcar pagada"
                        >
                          Pagada
                        </button>
                      )}
                      <button
                        onClick={() => router.push(`/ordenes/${of.id}`)}
                        style={btnMiniPrimary}
                      >
                        Ver →
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// Estilos
const btnPrimary: React.CSSProperties = {
  padding: '10px 20px', background: '#185FA5', color: '#fff',
  border: 'none', borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: 'pointer',
  whiteSpace: 'nowrap'
}
const btnMiniPrimary: React.CSSProperties = {
  padding: '5px 10px', background: '#185FA5', color: '#fff',
  border: 'none', borderRadius: 3, fontSize: 11, fontWeight: 600, cursor: 'pointer'
}
const btnMiniSuccess: React.CSSProperties = {
  padding: '5px 10px', background: '#10B981', color: '#fff',
  border: 'none', borderRadius: 3, fontSize: 11, fontWeight: 600, cursor: 'pointer'
}
const btnMiniSecondary: React.CSSProperties = {
  padding: '5px 10px', background: '#fff', color: '#374151',
  border: '1px solid #d1d5db', borderRadius: 3, fontSize: 11, fontWeight: 500, cursor: 'pointer'
}

function StatCard({ label, valor, color, subtitulo }: any) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', padding: 12, borderRadius: 6 }}>
      <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color }}>{valor}</div>
      {subtitulo && <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{subtitulo}</div>}
    </div>
  )
}

function Tab({ activo, onClick, count, color, children }: any) {
  return (
    <button onClick={onClick} style={{
      padding: '10px 16px', background: 'none',
      border: 'none', borderBottom: `2px solid ${activo ? '#185FA5' : 'transparent'}`,
      color: activo ? '#185FA5' : '#6b7280',
      fontSize: 13, fontWeight: activo ? 600 : 500,
      cursor: 'pointer', marginBottom: -1,
      display: 'flex', alignItems: 'center', gap: 6
    }}>
      {children}
      {count > 0 && (
        <span style={{
          padding: '1px 7px', background: color || '#9ca3af', color: '#fff',
          fontSize: 10, fontWeight: 700, borderRadius: 10
        }}>
          {count}
        </span>
      )}
    </button>
  )
}

function EmptyState({ titulo, subtitulo }: any) {
  return (
    <div style={{
      background: '#F9FAFB', border: '1px dashed #d1d5db',
      padding: 40, borderRadius: 6, textAlign: 'center'
    }}>
      <div style={{ fontSize: 14, fontWeight: 500, color: '#6b7280', marginBottom: 6 }}>{titulo}</div>
      {subtitulo && <div style={{ fontSize: 12, color: '#9ca3af' }}>{subtitulo}</div>}
    </div>
  )
}
