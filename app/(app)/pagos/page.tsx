'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth'

// ============================================================
// PAGOS — Etapa 6 del proceso (última)
//
// TAB 1 "Por pagar": radicaciones verificadas esperando desembolso
//   Acción: Registrar pago (fecha, medio, referencia)
//
// TAB 2 "Próximos a vencer": con fecha límite cercana
//   Alertas para priorizar
//
// TAB 3 "Pagados": histórico
//
// TAB 4 "Todas"
// ============================================================

export default function PagosPage() {
  const { usuario } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [tab, setTab] = useState<'por_pagar' | 'vencer' | 'pagados' | 'todas'>('por_pagar')
  const [loading, setLoading] = useState(true)
  const [radicaciones, setRadicaciones] = useState<any[]>([])
  const [ofs, setOfs] = useState<any[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [modalPagar, setModalPagar] = useState<any>(null)

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
      // Radicaciones verificadas + OFs con estado_pago
      let rads: any[] = []
      try {
        const { data } = await supabase
          .from('radicaciones')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(200)
        rads = data || []
      } catch {}

      // También OFs aprobadas (por si el flujo de radicación no existe)
      const { data: ofsData } = await supabase
        .from('ordenes_facturacion')
        .select('*')
        .eq('estado_verificacion', 'APROBADA')
        .order('created_at', { ascending: false })
        .limit(200)

      // Enriquecer radicaciones con OF + proveedor
      let radsEnriched: any[] = []
      if (rads.length > 0) {
        const ofIds = [...new Set(rads.map((r: any) => r.of_id).filter(Boolean))]
        const { data: ofsRad } = ofIds.length > 0
          ? await supabase.from('ordenes_facturacion').select('*').in('id', ofIds)
          : { data: [] }

        const provIds = [...new Set((ofsRad || []).map((o: any) => o.proveedor_id).filter(Boolean))]
        const { data: provs } = provIds.length > 0
          ? await supabase.from('proveedores').select('id, razon_social, codigo, nit').in('id', provIds)
          : { data: [] }

        radsEnriched = rads.map((r: any) => {
          const of = (ofsRad || []).find((o: any) => o.id === r.of_id)
          const proveedor = of ? (provs || []).find((p: any) => p.id === of.proveedor_id) : null
          return { ...r, of, proveedor }
        })
      }
      setRadicaciones(radsEnriched)

      // Enriquecer OFs sin radicación (fallback)
      let ofsEnriched: any[] = []
      if (ofsData && ofsData.length > 0) {
        const provIds2 = [...new Set(ofsData.map((o: any) => o.proveedor_id).filter(Boolean))]
        const { data: provs2 } = provIds2.length > 0
          ? await supabase.from('proveedores').select('id, razon_social, codigo, nit').in('id', provIds2)
          : { data: [] }

        // Solo OFs que NO tienen radicación
        const ofsConRad = new Set(radsEnriched.map((r: any) => r.of_id))
        ofsEnriched = ofsData
          .filter((o: any) => !ofsConRad.has(o.id))
          .map((o: any) => ({
            ...o,
            proveedor: (provs2 || []).find((p: any) => p.id === o.proveedor_id)
          }))
      }
      setOfs(ofsEnriched)

      setLoading(false)
    } catch (err) {
      console.error(err)
      setLoading(false)
    }
  }

  // Pagar una radicación (o OF directo)
  const registrarPago = async (datos: any) => {
    try {
      const hoy = new Date().toISOString()
      const ofId = modalPagar.of?.id || modalPagar.id
      const radId = modalPagar.of ? modalPagar.id : null

      // 1. Actualizar OF
      await supabase
        .from('ordenes_facturacion')
        .update({
          estado_pago: 'PAGADO',
          fecha_pago: datos.fecha_pago || hoy,
          medio_pago: datos.medio_pago,
          updated_at: hoy
        })
        .eq('id', ofId)

      // 2. Actualizar radicación si existe
      if (radId) {
        await supabase
          .from('radicaciones')
          .update({
            estado: 'PAGADA',
            fecha_pago: datos.fecha_pago || hoy,
            referencia_pago: datos.referencia
          })
          .eq('id', radId)
      }

      // 3. Si la OF tiene solicitud, marcarla como completada
      const ofInfo = modalPagar.of || modalPagar
      if (ofInfo.solicitud_id) {
        await supabase
          .from('solicitudes')
          .update({ estado: 'completada', updated_at: hoy })
          .eq('id', ofInfo.solicitud_id)
      }

      setModalPagar(null)
      cargar()
    } catch (err: any) {
      alert('Error: ' + err.message)
    }
  }

  // Combinar radicaciones verificadas + OFs sin radicación como "por pagar"
  const porPagar = [
    ...radicaciones.filter((r: any) => r.estado === 'VERIFICADA'),
    ...ofs.filter((o: any) => !['PAGADO', 'PAGADA'].includes(o.estado_pago))
  ]
  const pagados = radicaciones.filter((r: any) => r.estado === 'PAGADA')
  
  // Próximos a vencer (fecha_limite_pago en los próximos 7 días)
  const hoy = new Date()
  const proximaSemana = new Date()
  proximaSemana.setDate(proximaSemana.getDate() + 7)
  const proximosVencer = porPagar.filter((item: any) => {
    const limite = item.fecha_limite_pago ? new Date(item.fecha_limite_pago) : null
    return limite && limite <= proximaSemana && limite >= hoy
  })
  const vencidos = porPagar.filter((item: any) => {
    const limite = item.fecha_limite_pago ? new Date(item.fecha_limite_pago) : null
    return limite && limite < hoy
  })

  const filtrar = (items: any[]) => {
    if (!busqueda) return items
    const q = busqueda.toLowerCase()
    return items.filter((item: any) => {
      const of = item.of || item
      return (
        of.codigo_of?.toLowerCase().includes(q) ||
        item.numero_factura?.toLowerCase().includes(q) ||
        item.proveedor?.razon_social?.toLowerCase().includes(q) ||
        of.descripcion?.toLowerCase().includes(q)
      )
    })
  }

  const datosTab = {
    por_pagar: filtrar(porPagar),
    vencer: filtrar([...vencidos, ...proximosVencer]),
    pagados: filtrar(pagados),
    todas: filtrar([...porPagar, ...pagados])
  }[tab]

  const getValor = (item: any) =>
    parseFloat(item.valor_facturado || item.of?.valor_total || item.valor_total) || 0

  const stats = {
    porPagar: porPagar.length,
    montoPorPagar: porPagar.reduce((s: number, r: any) => s + getValor(r), 0),
    vencidos: vencidos.length,
    proximos: proximosVencer.length,
    pagados: pagados.length,
    montoPagado: pagados.reduce((s: number, r: any) => s + getValor(r), 0),
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Cargando...</div>
  }

  return (
    <div style={{ padding: 32, maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Etapa 6 del proceso (final)
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111', margin: 0, marginBottom: 4 }}>
          Pagos
        </h1>
        <div style={{ fontSize: 13, color: '#6b7280' }}>
          Desembolsar pagos a proveedores por facturas verificadas
        </div>
      </div>

      {/* Explicación */}
      <div style={{
        background: '#EFF6FF', border: '1px solid #BFDBFE',
        borderRadius: 6, padding: 14, marginBottom: 20,
        fontSize: 12, color: '#1E40AF', lineHeight: 1.6
      }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>¿Qué hacés acá?</div>
        Registrás los <strong>pagos ejecutados</strong> a los proveedores. Cada pago cierra el ciclo:
        OF → Factura radicada → Pago. Al registrar un pago, la solicitud queda <strong>completada</strong>
        y se actualiza el estado de la factura. <em>El pago efectivo lo hacés por tu banco como siempre;
        acá dejás registro.</em>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
        <StatCard
          label="Por pagar"
          valor={stats.porPagar}
          color="#185FA5"
          subtitulo={`$${(stats.montoPorPagar / 1000000).toFixed(1)}M total`}
        />
        <StatCard
          label="Vencidos"
          valor={stats.vencidos}
          color="#DC2626"
          subtitulo="Ya pasó la fecha"
        />
        <StatCard
          label="Próximos a vencer"
          valor={stats.proximos}
          color="#F59E0B"
          subtitulo="Próximos 7 días"
        />
        <StatCard
          label="Pagados"
          valor={stats.pagados}
          color="#10B981"
          subtitulo={`$${(stats.montoPagado / 1000000).toFixed(1)}M ya pagado`}
        />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 16, borderBottom: '1px solid #e5e7eb' }}>
        <Tab activo={tab === 'por_pagar'} onClick={() => setTab('por_pagar')} count={stats.porPagar} color="#185FA5">
          Por pagar
        </Tab>
        <Tab activo={tab === 'vencer'} onClick={() => setTab('vencer')} count={stats.vencidos + stats.proximos} color="#DC2626">
          Urgentes
        </Tab>
        <Tab activo={tab === 'pagados'} onClick={() => setTab('pagados')} count={stats.pagados} color="#10B981">
          Pagados
        </Tab>
        <Tab activo={tab === 'todas'} onClick={() => setTab('todas')} count={porPagar.length + pagados.length}>
          Todas
        </Tab>
      </div>

      {/* Subtítulo */}
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 14, fontStyle: 'italic' }}>
        {tab === 'por_pagar' && 'Facturas verificadas listas para desembolso.'}
        {tab === 'vencer' && 'Ordenadas por urgencia: primero las vencidas, luego las que vencen esta semana.'}
        {tab === 'pagados' && 'Histórico de pagos ejecutados.'}
        {tab === 'todas' && 'Todos los registros del módulo de pagos.'}
      </div>

      {/* Búsqueda */}
      <div style={{ marginBottom: 14 }}>
        <input
          type="text"
          placeholder="Buscar código OF, factura, proveedor..."
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
            tab === 'por_pagar' ? 'No hay pagos pendientes' :
            tab === 'vencer' ? 'No hay pagos urgentes' :
            tab === 'pagados' ? 'No hay pagos registrados todavía' :
            'No hay registros'
          }
        />
      ) : (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden' }}>
          {datosTab.map((item: any) => {
            const of = item.of || item
            const valor = getValor(item)
            const limite = item.fecha_limite_pago ? new Date(item.fecha_limite_pago) : null
            const vencido = limite && limite < hoy && item.estado !== 'PAGADA' && !['PAGADO', 'PAGADA'].includes(of.estado_pago)
            const proximo = limite && limite >= hoy && limite <= proximaSemana && item.estado !== 'PAGADA'
            const pagado = item.estado === 'PAGADA' || ['PAGADO', 'PAGADA'].includes(of.estado_pago)
            
            return (
              <div key={item.id} style={{
                padding: 16, borderBottom: '1px solid #f3f4f6',
                borderLeft: `3px solid ${
                  pagado ? '#10B981' :
                  vencido ? '#DC2626' :
                  proximo ? '#F59E0B' :
                  '#185FA5'
                }`
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#185FA5' }}>
                        {of.codigo_of}
                      </span>
                      {item.numero_factura && (
                        <>
                          <span style={{ fontSize: 10, color: '#9ca3af' }}>→</span>
                          <span style={{
                            padding: '2px 7px', fontSize: 11, fontWeight: 600,
                            background: '#F3F4F6', color: '#374151',
                            borderRadius: 3, fontFamily: 'monospace'
                          }}>
                            {item.numero_factura}
                          </span>
                        </>
                      )}
                      {vencido && (
                        <span style={{
                          padding: '2px 7px', fontSize: 9, fontWeight: 700,
                          background: '#FEE2E2', color: '#991B1B',
                          borderRadius: 3, letterSpacing: '0.03em'
                        }}>
                          VENCIDO
                        </span>
                      )}
                      {proximo && !vencido && (
                        <span style={{
                          padding: '2px 7px', fontSize: 9, fontWeight: 700,
                          background: '#FEF3C7', color: '#92400E',
                          borderRadius: 3, letterSpacing: '0.03em'
                        }}>
                          PRÓXIMO
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#111', marginBottom: 3 }}>
                      {of.descripcion || '(sin descripción)'}
                    </div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>
                      Pagar a: <strong>{item.proveedor?.razon_social || of.proveedor?.razon_social || '—'}</strong>
                      {item.proveedor?.nit && ` · NIT: ${item.proveedor.nit}`}
                      {limite && (
                        <> · Vence: <strong style={{ color: vencido ? '#DC2626' : '#6b7280' }}>
                          {limite.toLocaleDateString('es-CO')}
                        </strong></>
                      )}
                      {item.fecha_pago && (
                        <> · Pagado: <strong>{new Date(item.fecha_pago).toLocaleDateString('es-CO')}</strong></>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', marginRight: 16 }}>
                    <div style={{ fontSize: 10, color: '#6b7280' }}>
                      {pagado ? 'Pagado' : 'A pagar'}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: pagado ? '#10B981' : '#185FA5' }}>
                      ${valor.toLocaleString('es-CO')}
                    </div>
                  </div>

                  {/* Acciones */}
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {of.id && (
                      <button
                        onClick={() => router.push(`/ordenes/${of.id}`)}
                        style={btnSecondary}
                      >
                        Ver OF
                      </button>
                    )}
                    {!pagado && (
                      <button
                        onClick={() => setModalPagar(item)}
                        style={btnSuccess}
                      >
                        Registrar pago
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal registrar pago */}
      {modalPagar && (
        <ModalRegistrarPago
          item={modalPagar}
          onClose={() => setModalPagar(null)}
          onConfirm={registrarPago}
        />
      )}
    </div>
  )
}

// ============================================================
// MODAL: Registrar pago
// ============================================================
function ModalRegistrarPago({ item, onClose, onConfirm }: any) {
  const of = item.of || item
  const valor = parseFloat(item.valor_facturado || of.valor_total) || 0
  const proveedor = item.proveedor || of.proveedor

  const today = new Date().toISOString().split('T')[0]

  const [form, setForm] = useState({
    fecha_pago: today,
    medio_pago: 'TRANSFERENCIA',
    referencia: ''
  })

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={{ ...modalStyle, maxWidth: 500 }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: 20, borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#111', marginBottom: 4 }}>
            Registrar pago
          </div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>
            Proveedor: <strong>{proveedor?.razon_social || '—'}</strong>
            {proveedor?.nit && <> · NIT: {proveedor.nit}</>}
          </div>
          <div style={{
            fontSize: 16, fontWeight: 700, color: '#185FA5',
            marginTop: 8, padding: 10, background: '#EFF6FF', borderRadius: 4
          }}>
            Valor a pagar: ${valor.toLocaleString('es-CO')}
          </div>
        </div>

        <div style={{ padding: 20, display: 'grid', gap: 14 }}>
          <div>
            <label style={labelStyle}>Fecha de pago *</label>
            <input
              type="date"
              value={form.fecha_pago}
              onChange={e => set('fecha_pago', e.target.value)}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Medio de pago *</label>
            <select
              value={form.medio_pago}
              onChange={e => set('medio_pago', e.target.value)}
              style={inputStyle}
            >
              <option value="TRANSFERENCIA">Transferencia bancaria</option>
              <option value="CHEQUE">Cheque</option>
              <option value="EFECTIVO">Efectivo</option>
              <option value="TARJETA">Tarjeta</option>
              <option value="PSE">PSE</option>
              <option value="OTRO">Otro</option>
            </select>
          </div>

          <div>
            <label style={labelStyle}>Referencia / Número de transacción</label>
            <input
              type="text"
              value={form.referencia}
              onChange={e => set('referencia', e.target.value)}
              placeholder="Número de comprobante, cheque, transacción..."
              style={inputStyle}
            />
          </div>
        </div>

        <div style={{
          padding: 12, margin: '0 20px', background: '#FFFBEB',
          borderLeft: '3px solid #F59E0B', borderRadius: 3,
          fontSize: 11, color: '#78350F', lineHeight: 1.5
        }}>
          <strong>Importante:</strong> Este registro confirma que el pago FUE ejecutado. 
          Hacé primero la transferencia en tu banco, y luego registralo acá con la referencia.
        </div>

        <div style={{ padding: 16, borderTop: '1px solid #e5e7eb', display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} style={btnSecondary}>Cancelar</button>
          <button
            onClick={() => onConfirm(form)}
            disabled={!form.fecha_pago || !form.medio_pago}
            style={{
              ...btnSuccess,
              opacity: (!form.fecha_pago || !form.medio_pago) ? 0.5 : 1
            }}
          >
            Confirmar pago ejecutado
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// ESTILOS
// ============================================================
const btnSuccess: React.CSSProperties = {
  padding: '9px 18px', background: '#10B981', color: '#fff',
  border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer'
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

function Empty({ titulo }: any) {
  return (
    <div style={{
      background: '#F9FAFB', border: '1px dashed #d1d5db',
      padding: 40, borderRadius: 6, textAlign: 'center',
      fontSize: 14, color: '#6b7280'
    }}>
      {titulo}
    </div>
  )
}
