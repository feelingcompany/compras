'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth'

// ============================================================
// RADICACIÓN — Etapa 5 del proceso
//
// TAB 1 "Esperando factura": OFs aprobadas sin factura recibida
//   Acción: Registrar factura del proveedor
//
// TAB 2 "Por verificar": Facturas radicadas sin verificar
//   Acción: Verificar (coincide con OF) → pasa a Pagos
//
// TAB 3 "Verificadas": Listas para pago
//   
// TAB 4 "Todas": histórico
// ============================================================

export default function RadicacionPage() {
  const { usuario } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [tab, setTab] = useState<'esperando' | 'verificar' | 'verificadas' | 'todas'>('esperando')
  const [loading, setLoading] = useState(true)

  const [ofsPorRadicar, setOfsPorRadicar] = useState<any[]>([])
  const [radicaciones, setRadicaciones] = useState<any[]>([])
  const [busqueda, setBusqueda] = useState('')

  // Modales
  const [modalRegistrar, setModalRegistrar] = useState<any>(null)

  useEffect(() => {
    if (!usuario) {
      router.push('/login')
      return
    }
    if (!['admin_compras', 'gerencia'].includes(usuario.rol)) {
      router.push('/')
      return
    }
    cargar()
  }, [usuario])

  const cargar = async () => {
    try {
      // 1. OFs aprobadas sin factura radicada (esperando)
      const { data: ofs } = await supabase
        .from('ordenes_facturacion')
        .select('*')
        .eq('estado_verificacion', 'APROBADA')
        .not('estado_pago', 'in', '(PAGADO,PAGADA)')
        .order('created_at', { ascending: false })
        .limit(200)

      let ofsEnriched: any[] = []
      if (ofs && ofs.length > 0) {
        const provIds = [...new Set(ofs.map((o: any) => o.proveedor_id).filter(Boolean))]
        const solIds = [...new Set(ofs.map((o: any) => o.solicitud_id).filter(Boolean))]

        const [provs, sols] = await Promise.all([
          provIds.length > 0
            ? supabase.from('proveedores').select('id, razon_social, codigo, nit').in('id', provIds)
            : Promise.resolve({ data: [] }),
          solIds.length > 0
            ? supabase.from('solicitudes').select('id, descripcion, centro_costo').in('id', solIds)
            : Promise.resolve({ data: [] })
        ])

        ofsEnriched = ofs.map((o: any) => ({
          ...o,
          proveedor: (provs.data || []).find((p: any) => p.id === o.proveedor_id),
          solicitud: (sols.data || []).find((s: any) => s.id === o.solicitud_id)
        }))
      }

      // 2. Radicaciones existentes
      let radsEnriched: any[] = []
      try {
        const { data: rads } = await supabase
          .from('radicaciones')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(200)

        if (rads && rads.length > 0) {
          const ofIds = [...new Set(rads.map((r: any) => r.of_id).filter(Boolean))]
          const { data: ofsRad } = await supabase
            .from('ordenes_facturacion')
            .select('*')
            .in('id', ofIds)

          const provIds2 = [...new Set((ofsRad || []).map((o: any) => o.proveedor_id).filter(Boolean))]
          const { data: provs2 } = provIds2.length > 0
            ? await supabase.from('proveedores').select('id, razon_social, codigo, nit').in('id', provIds2)
            : { data: [] }

          radsEnriched = rads.map((r: any) => {
            const of = (ofsRad || []).find((o: any) => o.id === r.of_id)
            const proveedor = of ? (provs2 || []).find((p: any) => p.id === of.proveedor_id) : null
            return {
              ...r,
              of,
              proveedor
            }
          })
        }
      } catch (err) {
        console.warn('Tabla radicaciones podría no existir:', err)
      }

      // Filtrar OFs que todavía no han sido radicadas
      const ofsYaRadicadas = new Set(radsEnriched.map((r: any) => r.of_id))
      setOfsPorRadicar(ofsEnriched.filter(o => !ofsYaRadicadas.has(o.id)))
      setRadicaciones(radsEnriched)

      setLoading(false)
    } catch (err) {
      console.error(err)
      setLoading(false)
    }
  }

  const verificar = async (radId: string) => {
    if (!confirm('¿Verificar esta radicación? Después de verificar, la OF queda lista para pago.')) return
    try {
      await supabase
        .from('radicaciones')
        .update({ estado: 'VERIFICADA', fecha_verificacion: new Date().toISOString() })
        .eq('id', radId)
      cargar()
    } catch (err: any) {
      alert('Error: ' + err.message)
    }
  }

  const rechazar = async (radId: string) => {
    const motivo = prompt('Motivo del rechazo (qué está mal con la factura):')
    if (!motivo) return
    try {
      await supabase
        .from('radicaciones')
        .update({
          estado: 'RECHAZADA',
          observaciones: motivo,
          fecha_rechazo: new Date().toISOString()
        })
        .eq('id', radId)
      cargar()
    } catch (err: any) {
      alert('Error: ' + err.message)
    }
  }

  // Clasificaciones
  const porVerificar = radicaciones.filter((r: any) =>
    r.estado === 'PENDIENTE' || r.estado === 'RADICADA' || !r.estado
  )
  const verificadas = radicaciones.filter((r: any) => r.estado === 'VERIFICADA')
  const rechazadas = radicaciones.filter((r: any) => r.estado === 'RECHAZADA')

  // Aplicar búsqueda
  const filtrar = (items: any[]) => {
    if (!busqueda) return items
    const q = busqueda.toLowerCase()
    return items.filter((item: any) => {
      const of = item.of || item
      return (
        of.codigo_of?.toLowerCase().includes(q) ||
        of.descripcion?.toLowerCase().includes(q) ||
        item.numero_factura?.toLowerCase().includes(q) ||
        item.proveedor?.razon_social?.toLowerCase().includes(q) ||
        of.proveedor?.razon_social?.toLowerCase().includes(q)
      )
    })
  }

  const datosTab = {
    esperando: filtrar(ofsPorRadicar),
    verificar: filtrar(porVerificar),
    verificadas: filtrar(verificadas),
    todas: filtrar(radicaciones)
  }[tab]

  const stats = {
    esperando: ofsPorRadicar.length,
    porVerificar: porVerificar.length,
    verificadas: verificadas.length,
    rechazadas: rechazadas.length,
    montoPorRadicar: ofsPorRadicar.reduce((s, o) => s + (parseFloat(o.valor_total) || 0), 0),
    montoPorVerificar: porVerificar.reduce((s, r) => s + (parseFloat(r.valor_facturado || r.of?.valor_total) || 0), 0),
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Cargando...</div>
  }

  return (
    <div style={{ padding: 32, maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Etapa 5 del proceso
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111', margin: 0, marginBottom: 4 }}>
          Radicación de facturas
        </h1>
        <div style={{ fontSize: 13, color: '#6b7280' }}>
          Recibir facturas del proveedor, verificar vs OF, y habilitar pago
        </div>
      </div>

      {/* Explicación */}
      <div style={{
        background: '#EFF6FF', border: '1px solid #BFDBFE',
        borderRadius: 6, padding: 14, marginBottom: 20,
        fontSize: 12, color: '#1E40AF', lineHeight: 1.6
      }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>¿Qué hacés acá?</div>
        Cuando un proveedor entrega el servicio/producto (según OF), trae su <strong>factura oficial</strong>.
        Acá la <strong>registrás</strong>, <strong>verificás</strong> que los datos coincidan con la OF 
        (monto, NIT, concepto), y la habilitás para <strong>pago</strong>. Si hay discrepancias, la rechazás
        para que el proveedor corrija.
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
        <StatCard
          label="Esperando factura"
          valor={stats.esperando}
          color="#DC2626"
          subtitulo={`$${(stats.montoPorRadicar / 1000000).toFixed(1)}M`}
        />
        <StatCard
          label="Por verificar"
          valor={stats.porVerificar}
          color="#F59E0B"
          subtitulo={`$${(stats.montoPorVerificar / 1000000).toFixed(1)}M`}
        />
        <StatCard label="Verificadas" valor={stats.verificadas} color="#10B981" subtitulo="Listas para pago" />
        <StatCard label="Rechazadas" valor={stats.rechazadas} color="#9ca3af" subtitulo="Requieren corrección" />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 16, borderBottom: '1px solid #e5e7eb' }}>
        <Tab activo={tab === 'esperando'} onClick={() => setTab('esperando')} count={stats.esperando} color="#DC2626">
          Esperando factura
        </Tab>
        <Tab activo={tab === 'verificar'} onClick={() => setTab('verificar')} count={stats.porVerificar} color="#F59E0B">
          Por verificar
        </Tab>
        <Tab activo={tab === 'verificadas'} onClick={() => setTab('verificadas')} count={stats.verificadas} color="#10B981">
          Verificadas
        </Tab>
        <Tab activo={tab === 'todas'} onClick={() => setTab('todas')} count={radicaciones.length}>
          Todas
        </Tab>
      </div>

      {/* Subtítulo */}
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 14, fontStyle: 'italic' }}>
        {tab === 'esperando' && 'Órdenes aprobadas esperando que el proveedor traiga su factura.'}
        {tab === 'verificar' && 'Facturas radicadas — revisá que todo esté bien antes de habilitar el pago.'}
        {tab === 'verificadas' && 'Facturas verificadas. Ya están listas para pago.'}
        {tab === 'todas' && 'Histórico completo de radicaciones.'}
      </div>

      {/* Búsqueda */}
      <div style={{ marginBottom: 14 }}>
        <input
          type="text"
          placeholder="Buscar por código OF, número factura, proveedor..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          style={{
            width: '100%', padding: '9px 14px',
            border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13, outline: 'none'
          }}
        />
      </div>

      {/* Lista */}
      {datosTab.length === 0 ? (
        <Empty
          titulo={
            tab === 'esperando' ? 'No hay OFs esperando factura' :
            tab === 'verificar' ? 'No hay facturas pendientes de verificación' :
            tab === 'verificadas' ? 'No hay facturas verificadas' :
            'No hay radicaciones todavía'
          }
          subtitulo={
            tab === 'esperando' ? 'Cuando se aprueben OFs, aparecerán acá esperando la factura del proveedor.' :
            undefined
          }
        />
      ) : (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden' }}>
          {tab === 'esperando' ? (
            /* VISTA: OFs esperando factura */
            datosTab.map((of: any) => (
              <div key={of.id} style={{
                padding: 16, borderBottom: '1px solid #f3f4f6',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#185FA5' }}>
                      {of.codigo_of}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>
                      {of.descripcion || '(sin descripción)'}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>
                    Proveedor: <strong>{of.proveedor?.razon_social || '—'}</strong> · 
                    {' '}Centro: {of.solicitud?.centro_costo || '—'}
                  </div>
                </div>
                <div style={{ textAlign: 'right', marginRight: 16 }}>
                  <div style={{ fontSize: 10, color: '#6b7280' }}>Valor OF</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#185FA5' }}>
                    ${(parseFloat(of.valor_total) || 0).toLocaleString('es-CO')}
                  </div>
                </div>
                <button
                  onClick={() => setModalRegistrar(of)}
                  style={btnPrimary}
                >
                  Registrar factura →
                </button>
              </div>
            ))
          ) : (
            /* VISTA: Radicaciones */
            datosTab.map((r: any) => {
              const of = r.of
              const valorOF = parseFloat(of?.valor_total) || 0
              const valorFact = parseFloat(r.valor_facturado) || valorOF
              const hayDiscrepancia = Math.abs(valorFact - valorOF) > 1

              return (
                <div key={r.id} style={{
                  padding: 16, borderBottom: '1px solid #f3f4f6',
                  borderLeft: `3px solid ${
                    r.estado === 'VERIFICADA' ? '#10B981' :
                    r.estado === 'RECHAZADA' ? '#DC2626' :
                    hayDiscrepancia ? '#F59E0B' : '#185FA5'
                  }`
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#185FA5' }}>
                          OF: {of?.codigo_of || '—'}
                        </span>
                        <span style={{ fontSize: 11, color: '#6b7280' }}>→</span>
                        <span style={{
                          padding: '2px 7px', fontSize: 11, fontWeight: 600,
                          background: '#F3F4F6', color: '#374151',
                          borderRadius: 3, fontFamily: 'monospace'
                        }}>
                          Factura: {r.numero_factura || '—'}
                        </span>
                        {hayDiscrepancia && (
                          <span style={{
                            padding: '2px 7px', fontSize: 9, fontWeight: 700,
                            background: '#FEF3C7', color: '#92400E',
                            borderRadius: 3, letterSpacing: '0.03em'
                          }}>
                            DISCREPANCIA DE MONTO
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#111', marginBottom: 3 }}>
                        {of?.descripcion || '(sin descripción)'}
                      </div>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>
                        Proveedor: <strong>{r.proveedor?.razon_social || of?.proveedor?.razon_social || '—'}</strong> · 
                        {' '}Radicada: {r.fecha_radicacion ? new Date(r.fecha_radicacion).toLocaleDateString('es-CO') : '—'}
                        {r.fecha_limite_pago && (
                          <> · Límite pago: {new Date(r.fecha_limite_pago).toLocaleDateString('es-CO')}</>
                        )}
                      </div>
                      {r.observaciones && r.estado === 'RECHAZADA' && (
                        <div style={{ fontSize: 11, color: '#991B1B', marginTop: 6, fontStyle: 'italic' }}>
                          Motivo rechazo: {r.observaciones}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', marginRight: 16 }}>
                      <div style={{ fontSize: 10, color: '#6b7280' }}>OF vs Factura</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#6b7280' }}>
                        ${valorOF.toLocaleString('es-CO')}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: hayDiscrepancia ? '#F59E0B' : '#185FA5' }}>
                        ${valorFact.toLocaleString('es-CO')}
                      </div>
                    </div>
                  </div>

                  {/* Acciones */}
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    {of && (
                      <button
                        onClick={() => router.push(`/ordenes/${of.id}`)}
                        style={btnSecondary}
                      >
                        Ver OF
                      </button>
                    )}
                    {(r.estado === 'PENDIENTE' || r.estado === 'RADICADA' || !r.estado) && (
                      <>
                        <button onClick={() => rechazar(r.id)} style={btnDanger}>
                          Rechazar
                        </button>
                        <button onClick={() => verificar(r.id)} style={btnSuccess}>
                          Verificar y habilitar pago
                        </button>
                      </>
                    )}
                    {r.estado === 'VERIFICADA' && (
                      <button
                        onClick={() => router.push('/pagos')}
                        style={btnPrimary}
                      >
                        Ir a pagos →
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Modal registrar factura */}
      {modalRegistrar && (
        <ModalRegistrarFactura
          of={modalRegistrar}
          onClose={() => setModalRegistrar(null)}
          onConfirm={async (datos: any) => {
            try {
              await supabase.from('radicaciones').insert({
                of_id: modalRegistrar.id,
                numero_factura: datos.numero_factura,
                valor_facturado: datos.valor_facturado,
                fecha_radicacion: datos.fecha_radicacion,
                fecha_limite_pago: datos.fecha_limite_pago,
                observaciones: datos.observaciones,
                estado: 'PENDIENTE'
              })
              setModalRegistrar(null)
              cargar()
            } catch (err: any) {
              alert('Error: ' + err.message)
            }
          }}
        />
      )}
    </div>
  )
}

// ============================================================
// MODAL: Registrar factura
// ============================================================
function ModalRegistrarFactura({ of, onClose, onConfirm }: any) {
  const valorOF = parseFloat(of.valor_total) || 0

  // Calcular fecha límite 10 días desde hoy
  const today = new Date().toISOString().split('T')[0]
  const limite = new Date()
  limite.setDate(limite.getDate() + 30)
  const limiteStr = limite.toISOString().split('T')[0]

  const [form, setForm] = useState({
    numero_factura: '',
    valor_facturado: String(valorOF),
    fecha_radicacion: today,
    fecha_limite_pago: limiteStr,
    observaciones: ''
  })

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const hayDiscrepancia = Number(form.valor_facturado) !== valorOF && Number(form.valor_facturado) > 0
  const pctDif = valorOF > 0 ? ((Number(form.valor_facturado) - valorOF) / valorOF) * 100 : 0

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={{ ...modalStyle, maxWidth: 600 }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: 20, borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#111', marginBottom: 4 }}>
            Registrar factura recibida
          </div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>
            OF: <strong>{of.codigo_of}</strong> · Proveedor: <strong>{of.proveedor?.razon_social || '—'}</strong>
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
            Valor OF: ${valorOF.toLocaleString('es-CO')}
          </div>
        </div>

        <div style={{ padding: 20, display: 'grid', gap: 14 }}>
          <div>
            <label style={labelStyle}>Número de factura *</label>
            <input
              type="text"
              value={form.numero_factura}
              onChange={e => set('numero_factura', e.target.value.toUpperCase())}
              placeholder="Ej: FE-001234"
              style={inputStyle}
            />
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
              Número oficial de la factura del proveedor
            </div>
          </div>

          <div>
            <label style={labelStyle}>Valor facturado (COP) *</label>
            <input
              type="text"
              value={form.valor_facturado ? Number(String(form.valor_facturado).replace(/\D/g, '')).toLocaleString('es-CO') : ''}
              onChange={e => set('valor_facturado', e.target.value.replace(/\D/g, ''))}
              placeholder="0"
              style={inputStyle}
            />
            {hayDiscrepancia && (
              <div style={{
                fontSize: 11, marginTop: 6,
                color: Math.abs(pctDif) > 5 ? '#DC2626' : '#F59E0B',
                padding: 8, background: Math.abs(pctDif) > 5 ? '#FEE2E2' : '#FEF3C7',
                borderRadius: 3
              }}>
                ⚠ <strong>Discrepancia:</strong> {pctDif > 0 ? '+' : ''}{pctDif.toFixed(1)}% vs OF 
                (${Math.abs(Number(form.valor_facturado) - valorOF).toLocaleString('es-CO')} de diferencia)
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Fecha de radicación</label>
              <input
                type="date"
                value={form.fecha_radicacion}
                onChange={e => set('fecha_radicacion', e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Fecha límite de pago</label>
              <input
                type="date"
                value={form.fecha_limite_pago}
                onChange={e => set('fecha_limite_pago', e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Observaciones (opcional)</label>
            <textarea
              value={form.observaciones}
              onChange={e => set('observaciones', e.target.value)}
              rows={2}
              placeholder="Notas sobre la factura recibida..."
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>
        </div>

        <div style={{ padding: 16, borderTop: '1px solid #e5e7eb', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={btnSecondary}>Cancelar</button>
          <button
            onClick={() => onConfirm(form)}
            disabled={!form.numero_factura || !form.valor_facturado}
            style={{ ...btnPrimary, opacity: (!form.numero_factura || !form.valor_facturado) ? 0.5 : 1 }}
          >
            Radicar factura
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// ESTILOS
// ============================================================
const btnPrimary: React.CSSProperties = {
  padding: '9px 18px', background: '#185FA5', color: '#fff',
  border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer',
  whiteSpace: 'nowrap'
}
const btnSuccess: React.CSSProperties = {
  padding: '9px 18px', background: '#10B981', color: '#fff',
  border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer',
  whiteSpace: 'nowrap'
}
const btnDanger: React.CSSProperties = {
  padding: '9px 18px', background: '#fff', color: '#DC2626',
  border: '1px solid #DC2626', borderRadius: 4, fontSize: 12, fontWeight: 500, cursor: 'pointer'
}
const btnSecondary: React.CSSProperties = {
  padding: '9px 16px', background: '#fff', color: '#374151',
  border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12, fontWeight: 500, cursor: 'pointer'
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', border: '1px solid #d1d5db',
  borderRadius: 4, fontSize: 13, background: '#fff', outline: 'none',
  fontFamily: 'inherit'
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 600,
  color: '#6b7280', textTransform: 'uppercase',
  letterSpacing: '0.04em', marginBottom: 5
}
const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 100, padding: 20
}
const modalStyle: React.CSSProperties = {
  background: '#fff', borderRadius: 8, width: '100%',
  maxHeight: '90vh', overflowY: 'auto',
  boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
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
      padding: '10px 16px', background: 'none', border: 'none',
      borderBottom: `2px solid ${activo ? '#185FA5' : 'transparent'}`,
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

function Empty({ titulo, subtitulo }: any) {
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
