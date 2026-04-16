'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

const fmt = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
const inputStyle = { width: '100%', padding: '8px 10px', border: '0.5px solid #d3d1c7', borderRadius: 8, fontSize: 13, background: '#fafafa', outline: 'none' }
const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4, display: 'block' }

export default function CotizacionesPage() {
  const { usuario } = useAuth()
  const [ofs, setOfs] = useState<any[]>([])
  const [proveedores, setProveedores] = useState<any[]>([])
  const [categorias, setCategorias] = useState<any[]>([])
  const [cotizaciones, setCotizaciones] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOf, setSelectedOf] = useState<any>(null)
  const [ofCotizaciones, setOfCotizaciones] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')

  const [form, setForm] = useState({
    of_id: '', proveedor_id: '', descripcion_servicio: '',
    valor: '', tiempo_entrega: '', condiciones: '', categoria_id: ''
  })

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: ofList }, { data: provs }, { data: cats }, { data: cotz }] = await Promise.all([
      supabase.from('ordenes_facturacion')
        .select('id, codigo_of, valor_total, descripcion, estado_verificacion, proveedores(razon_social)')
        .eq('estado_verificacion', 'EN_REVISION')
        .order('created_at', { ascending: false })
        .limit(100),
      supabase.from('proveedores').select('id, razon_social, codigo, score').eq('activo', true).order('razon_social'),
      supabase.from('categorias_compra').select('*').eq('activo', true),
      supabase.from('cotizaciones')
        .select('*, proveedores(razon_social, score), ordenes_facturacion(codigo_of, valor_total), registrado:usuarios!registrado_por(nombre)')
        .order('created_at', { ascending: false })
        .limit(200)
    ])
    setOfs(ofList || [])
    setProveedores(provs || [])
    setCategorias(cats || [])
    setCotizaciones(cotz || [])
    setLoading(false)
  }

  async function selectOf(of: any) {
    setSelectedOf(of)
    const { data } = await supabase.from('cotizaciones')
      .select('*, proveedores(razon_social, score, condicion_pago)')
      .eq('of_id', of.id)
      .order('valor')
    setOfCotizaciones(data || [])
    setForm(f => ({ ...f, of_id: of.id }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('cotizaciones').insert({
      of_id: form.of_id,
      proveedor_id: form.proveedor_id || null,
      categoria_id: form.categoria_id || null,
      descripcion_servicio: form.descripcion_servicio,
      valor: Number(form.valor.replace(/\D/g, '')),
      tiempo_entrega: form.tiempo_entrega,
      condiciones: form.condiciones,
      registrado_por: usuario?.id,
      seleccionada: false
    })
    if (!error) {
      setSuccess('Cotización registrada')
      setShowForm(false)
      setForm(f => ({ ...f, proveedor_id: '', descripcion_servicio: '', valor: '', tiempo_entrega: '', condiciones: '' }))
      if (selectedOf) await selectOf(selectedOf)
      await load()
      setTimeout(() => setSuccess(''), 2000)
    }
    setSaving(false)
  }

  async function seleccionarGanadora(cotId: string, ofId: string) {
    // Mark all others as not selected
    await supabase.from('cotizaciones').update({ seleccionada: false }).eq('of_id', ofId)
    // Mark this one as selected
    await supabase.from('cotizaciones').update({ seleccionada: true }).eq('id', cotId)
    // Update OF status to OK
    await supabase.from('ordenes_facturacion').update({
      estado_verificacion: 'OK',
      cotizacion_seleccionada_id: cotId
    }).eq('id', ofId)
    setSuccess('¡Proveedor seleccionado! OF aprobada.')
    if (selectedOf) await selectOf(selectedOf)
    await load()
    setTimeout(() => setSuccess(''), 3000)
  }

  // Stats
  const totalCotizaciones = cotizaciones.length
  const ofsCon2Plus = new Set(cotizaciones.map(c => c.of_id)).size
  const ahorroEstimado = cotizaciones.reduce((acc, c) => {
    const ofCotz = cotizaciones.filter(x => x.of_id === c.of_id)
    if (ofCotz.length >= 2 && c.seleccionada) {
      const max = Math.max(...ofCotz.map((x: any) => Number(x.valor)))
      return acc + (max - Number(c.valor))
    }
    return acc
  }, 0)

  // Requeridas por monto
  const getRequeridas = (valor: number) => valor >= 15000000 ? 3 : valor >= 5000000 ? 2 : 1

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 500 }}>Cotizaciones</div>
          <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>Motor de negociación — compara proveedores antes de aprobar</div>
        </div>
        {selectedOf && (
          <button onClick={() => setShowForm(true)} style={{ padding: '8px 18px', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
            + Agregar cotización
          </button>
        )}
      </div>

      {success && (
        <div style={{ padding: '10px 14px', background: '#EAF3DE', border: '0.5px solid #b7d9a0', borderRadius: 8, fontSize: 13, color: '#27500A', marginBottom: 16 }}>
          ✓ {success}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { l: 'Cotizaciones registradas', v: totalCotizaciones.toString(), c: '#1a1a1a' },
          { l: 'OFs con competencia', v: ofsCon2Plus.toString(), c: '#185FA5' },
          { l: 'Ahorro estimado', v: ahorroEstimado > 0 ? fmt(ahorroEstimado) : '$0', c: '#27500A' },
          { l: 'OFs en revisión', v: ofs.length.toString(), c: '#BA7517' },
        ].map(s => (
          <div key={s.l} style={{ background: '#fff', border: '0.5px solid #ebebeb', borderRadius: 12, padding: '12px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 5 }}>{s.l}</div>
            <div style={{ fontSize: 20, fontWeight: 500, color: s.c }}>{s.v}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20 }}>

        {/* Lista OFs para cotizar */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 10 }}>
            OFs en revisión ({ofs.length})
          </div>
          <div style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
            {loading ? <div style={{ color: '#aaa', fontSize: 13 }}>Cargando...</div> :
              ofs.length === 0 ? (
                <div style={{ background: '#fff', border: '0.5px solid #ebebeb', borderRadius: 10, padding: 20, textAlign: 'center', color: '#aaa', fontSize: 13 }}>
                  No hay OFs en revisión
                </div>
              ) : ofs.map(of => {
                const requeridas = getRequeridas(Number(of.valor_total))
                const numCotz = cotizaciones.filter(c => c.of_id === of.id).length
                const ok = numCotz >= requeridas
                const isSelected = selectedOf?.id === of.id
                return (
                  <div key={of.id} onClick={() => selectOf(of)} style={{
                    background: '#fff', border: `0.5px solid ${isSelected ? '#185FA5' : '#ebebeb'}`,
                    borderRadius: 10, padding: '11px 14px', marginBottom: 8, cursor: 'pointer',
                    borderLeft: `3px solid ${ok ? '#639922' : '#EF9F27'}`
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#aaa' }}>{of.codigo_of}</div>
                        <div style={{ fontSize: 12, fontWeight: 500, marginTop: 2, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {(of.proveedores as any)?.razon_social || 'Sin proveedor'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{fmt(Number(of.valor_total))}</div>
                        <div style={{ fontSize: 10, marginTop: 2, color: ok ? '#27500A' : '#BA7517' }}>
                          {numCotz}/{requeridas} cotiz. {ok ? '✓' : '⚠'}
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: '#999', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {of.descripcion}
                    </div>
                  </div>
                )
              })}
          </div>
        </div>

        {/* Panel comparador */}
        <div>
          {!selectedOf ? (
            <div style={{ background: '#fff', border: '0.5px solid #ebebeb', borderRadius: 12, padding: 40, textAlign: 'center', color: '#aaa', fontSize: 13 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
              Selecciona una OF de la lista para ver y comparar cotizaciones
            </div>
          ) : (
            <div>
              {/* OF header */}
              <div style={{ background: '#fff', border: '0.5px solid #ebebeb', borderRadius: 12, padding: '14px 18px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#aaa' }}>{selectedOf.codigo_of}</div>
                  <div style={{ fontSize: 14, fontWeight: 500, marginTop: 2 }}>{selectedOf.descripcion?.substring(0, 80)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 18, fontWeight: 600 }}>{fmt(Number(selectedOf.valor_total))}</div>
                  <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>
                    Requiere {getRequeridas(Number(selectedOf.valor_total))} cotización(es)
                  </div>
                </div>
              </div>

              {/* Comparador */}
              {ofCotizaciones.length === 0 ? (
                <div style={{ background: '#fff', border: '0.5px solid #ebebeb', borderRadius: 12, padding: 32, textAlign: 'center' }}>
                  <div style={{ fontSize: 24, marginBottom: 10 }}>📝</div>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Sin cotizaciones aún</div>
                  <div style={{ fontSize: 12, color: '#aaa', marginBottom: 16 }}>
                    Agrega al menos {getRequeridas(Number(selectedOf.valor_total))} cotización(es) para poder aprobar esta OF
                  </div>
                  <button onClick={() => setShowForm(true)} style={{ padding: '8px 20px', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
                    + Primera cotización
                  </button>
                </div>
              ) : (
                <div>
                  {/* Tabla comparativa */}
                  <div style={{ background: '#fff', border: '0.5px solid #ebebeb', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>Comparador de cotizaciones</div>
                      <button onClick={() => setShowForm(true)} style={{ padding: '5px 12px', background: '#f5f5f3', border: '0.5px solid #ddd', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                        + Agregar otra
                      </button>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          {['Proveedor', 'Valor', 'Diferencia', 'Plazo', 'Score', 'Condiciones', 'Acción'].map(h => (
                            <th key={h} style={{ textAlign: 'left', padding: '9px 14px', fontSize: 11, fontWeight: 600, color: '#999', borderBottom: '1px solid #f0f0f0', textTransform: 'uppercase', letterSpacing: '.04em' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {ofCotizaciones.map((c, idx) => {
                          const minVal = Math.min(...ofCotizaciones.map((x: any) => Number(x.valor)))
                          const diff = Number(c.valor) - minVal
                          const diffPct = minVal > 0 ? ((diff / minVal) * 100).toFixed(1) : '0'
                          const isMejor = Number(c.valor) === minVal
                          const score = (c.proveedores as any)?.score || 0
                          return (
                            <tr key={c.id} style={{ background: c.seleccionada ? '#f0f7ff' : isMejor ? '#f8fff4' : 'white' }}>
                              <td style={{ padding: '10px 14px', borderBottom: '1px solid #f8f8f8' }}>
                                <div style={{ fontSize: 13, fontWeight: 500 }}>{(c.proveedores as any)?.razon_social || 'Sin nombre'}</div>
                                {isMejor && !c.seleccionada && <div style={{ fontSize: 10, color: '#27500A', marginTop: 2 }}>💚 Mejor precio</div>}
                                {c.seleccionada && <div style={{ fontSize: 10, color: '#185FA5', marginTop: 2 }}>✓ Seleccionada</div>}
                              </td>
                              <td style={{ padding: '10px 14px', borderBottom: '1px solid #f8f8f8', fontWeight: 600, fontSize: 14, color: isMejor ? '#27500A' : '#1a1a1a' }}>
                                {fmt(Number(c.valor))}
                              </td>
                              <td style={{ padding: '10px 14px', borderBottom: '1px solid #f8f8f8', fontSize: 13 }}>
                                {diff > 0 ? (
                                  <span style={{ color: '#E24B4A' }}>+{fmt(diff)} ({diffPct}%)</span>
                                ) : (
                                  <span style={{ color: '#27500A' }}>Base</span>
                                )}
                              </td>
                              <td style={{ padding: '10px 14px', borderBottom: '1px solid #f8f8f8', fontSize: 13, color: '#666' }}>{c.tiempo_entrega || '—'}</td>
                              <td style={{ padding: '10px 14px', borderBottom: '1px solid #f8f8f8' }}>
                                {score > 0 ? (
                                  <span style={{ fontWeight: 600, fontSize: 13, color: score >= 4 ? '#27500A' : score >= 3 ? '#BA7517' : '#E24B4A' }}>{Number(score).toFixed(1)}</span>
                                ) : <span style={{ color: '#ccc', fontSize: 12 }}>Nuevo</span>}
                              </td>
                              <td style={{ padding: '10px 14px', borderBottom: '1px solid #f8f8f8', fontSize: 12, color: '#888', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.condiciones || '—'}</td>
                              <td style={{ padding: '10px 14px', borderBottom: '1px solid #f8f8f8' }}>
                                {!c.seleccionada ? (
                                  <button onClick={() => seleccionarGanadora(c.id, c.of_id)} style={{
                                    padding: '5px 12px', background: '#185FA5', color: '#fff',
                                    border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 500
                                  }}>
                                    Seleccionar
                                  </button>
                                ) : (
                                  <span style={{ fontSize: 11, color: '#185FA5', fontWeight: 600 }}>✓ Elegida</span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Regla de cotizaciones */}
                  {(() => {
                    const req = getRequeridas(Number(selectedOf.valor_total))
                    const tiene = ofCotizaciones.length
                    const ok = tiene >= req
                    return (
                      <div style={{ padding: '10px 14px', background: ok ? '#EAF3DE' : '#FAEEDA', border: `0.5px solid ${ok ? '#b7d9a0' : '#f0c070'}`, borderRadius: 8, fontSize: 12, color: ok ? '#27500A' : '#633806' }}>
                        {ok
                          ? `✓ Cumple: ${tiene} cotizaciones registradas (requiere ${req})`
                          : `⚠ Faltan ${req - tiene} cotización(es) — valor $${(Number(selectedOf.valor_total) / 1000000).toFixed(1)}M requiere mínimo ${req}`
                        }
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal nueva cotización */}
      {showForm && (
        <div onClick={() => setShowForm(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 60 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, padding: 28, width: 500 }}>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 6 }}>Nueva cotización</div>
            {selectedOf && <div style={{ fontSize: 12, color: '#aaa', marginBottom: 20 }}>{selectedOf.codigo_of} — {selectedOf.descripcion?.substring(0, 60)}</div>}
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Proveedor</label>
                <select value={form.proveedor_id} onChange={e => setForm(f => ({ ...f, proveedor_id: e.target.value }))} required style={inputStyle}>
                  <option value="">Seleccionar proveedor...</option>
                  {proveedores.map(p => <option key={p.id} value={p.id}>{p.razon_social} {p.score > 0 ? `· ★${p.score}` : ''}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Categoría</label>
                <select value={form.categoria_id} onChange={e => setForm(f => ({ ...f, categoria_id: e.target.value }))} style={inputStyle}>
                  <option value="">Seleccionar categoría...</option>
                  {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Descripción del servicio cotizado</label>
                <textarea value={form.descripcion_servicio} onChange={e => setForm(f => ({ ...f, descripcion_servicio: e.target.value }))} required rows={2} style={{ ...inputStyle, resize: 'vertical' }} placeholder="¿Qué incluye esta cotización?" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={labelStyle}>Valor cotizado (COP)</label>
                  <input value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} required placeholder="Ej: 5000000" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Tiempo de entrega</label>
                  <input value={form.tiempo_entrega} onChange={e => setForm(f => ({ ...f, tiempo_entrega: e.target.value }))} placeholder="Ej: 3 días hábiles" style={inputStyle} />
                </div>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Condiciones / notas</label>
                <input value={form.condiciones} onChange={e => setForm(f => ({ ...f, condiciones: e.target.value }))} placeholder="Incluye IVA, requiere anticipo 50%, etc." style={inputStyle} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" onClick={() => setShowForm(false)} style={{ padding: '8px 18px', border: '0.5px solid #ddd', borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" disabled={saving} style={{ padding: '8px 18px', background: saving ? '#aaa' : '#185FA5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer' }}>
                  {saving ? 'Guardando...' : 'Registrar cotización'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
