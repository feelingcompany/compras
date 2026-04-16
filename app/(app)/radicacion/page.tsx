'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

const inputStyle = { width: '100%', padding: '8px 10px', border: '0.5px solid #d3d1c7', borderRadius: 8, fontSize: 13, background: '#fafafa', outline: 'none' }
const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4, display: 'block' }

export default function RadicacionPage() {
  const { usuario } = useAuth()
  const [radicaciones, setRadicaciones] = useState<any[]>([])
  const [ofs, setOfs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [selectedOf, setSelectedOf] = useState<any>(null)

  const [form, setForm] = useState({
    of_id: '', numero_factura: '', fecha_radicacion: '', fecha_limite_pago: '', observaciones: ''
  })

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: rads }, { data: ofList }] = await Promise.all([
      supabase.from('radicaciones')
        .select('*, ordenes_facturacion(codigo_of, valor_total, proveedores(razon_social))')
        .order('created_at', { ascending: false }),
      supabase.from('ordenes_facturacion')
        .select('id, codigo_of, valor_total, estado_verificacion, proveedores(razon_social)')
        .eq('estado_verificacion', 'OK')
        .order('codigo_of')
    ])
    setRadicaciones(rads || [])
    setOfs(ofList || [])
    setLoading(false)
  }

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleOfChange(ofId: string) {
    set('of_id', ofId)
    const found = ofs.find(o => o.id === ofId)
    setSelectedOf(found || null)
    // Calcular fecha límite de pago (10 días hábiles desde hoy)
    const today = new Date()
    today.setDate(today.getDate() + 10)
    set('fecha_limite_pago', today.toISOString().split('T')[0])
    set('fecha_radicacion', new Date().toISOString().split('T')[0])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('radicaciones').insert({
      ...form,
      estado: 'RADICADA'
    })
    if (!error) {
      setSuccess(true)
      setShowForm(false)
      setSelectedOf(null)
      setForm({ of_id: '', numero_factura: '', fecha_radicacion: '', fecha_limite_pago: '', observaciones: '' })
      await load()
      setTimeout(() => setSuccess(false), 3000)
    }
    setSaving(false)
  }

  const fmt = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

  const estadoColors: Record<string, { bg: string; color: string }> = {
    RADICADA:   { bg: '#E6F1FB', color: '#0C447C' },
    VERIFICADA: { bg: '#EAF3DE', color: '#27500A' },
    RECHAZADA:  { bg: '#FCEBEB', color: '#791F1F' },
  }

  const hoy = new Date()
  const vencidas = radicaciones.filter(r => r.fecha_limite_pago && new Date(r.fecha_limite_pago) < hoy && r.estado !== 'RECHAZADA')

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 500 }}>Radicación de facturas</div>
          <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>Etapa 8 · El proveedor entrega su factura — inicia el plazo de pago</div>
        </div>
        <button onClick={() => setShowForm(true)} style={{
          padding: '8px 18px', background: '#185FA5', color: '#fff',
          border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer'
        }}>
          + Radicar factura
        </button>
      </div>

      {success && (
        <div style={{ padding: '10px 14px', background: '#EAF3DE', border: '0.5px solid #b7d9a0', borderRadius: 8, fontSize: 13, color: '#27500A', marginBottom: 16 }}>
          ✓ Factura radicada — el ciclo de pago ha iniciado
        </div>
      )}

      {vencidas.length > 0 && (
        <div style={{ padding: '10px 14px', background: '#FCEBEB', border: '0.5px solid #F09595', borderRadius: 8, fontSize: 13, color: '#791F1F', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          ⚠ {vencidas.length} factura{vencidas.length > 1 ? 's' : ''} con plazo de pago vencido
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { l: 'Total radicadas', v: radicaciones.length, c: '#1a1a1a' },
          { l: 'Pendientes verificar', v: radicaciones.filter(r => r.estado === 'RADICADA').length, c: '#185FA5' },
          { l: 'Plazo vencido', v: vencidas.length, c: '#E24B4A' },
          { l: 'OFs listas para radicar', v: ofs.length, c: '#27500A' },
        ].map(s => (
          <div key={s.l} style={{ background: '#fff', border: '0.5px solid #ebebeb', borderRadius: 12, padding: '12px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 5 }}>{s.l}</div>
            <div style={{ fontSize: 22, fontWeight: 500, color: s.c }}>{s.v}</div>
          </div>
        ))}
      </div>

      <div style={{ background: '#fff', border: '0.5px solid #ebebeb', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 24, color: '#aaa', fontSize: 13 }}>Cargando radicaciones...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['OF', 'Proveedor', 'N° Factura', 'Valor', 'Radicación', 'Límite pago', 'Estado'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 600, color: '#999', borderBottom: '1px solid #f0f0f0', textTransform: 'uppercase', letterSpacing: '.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {radicaciones.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 24, color: '#aaa', fontSize: 13, textAlign: 'center' }}>No hay facturas radicadas aún</td></tr>
              ) : radicaciones.map(r => {
                const vencida = r.fecha_limite_pago && new Date(r.fecha_limite_pago) < hoy
                const ec = estadoColors[r.estado] || estadoColors.RADICADA
                return (
                  <tr key={r.id}>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid #f8f8f8', fontFamily: 'monospace', fontSize: 11 }}>{r.ordenes_facturacion?.codigo_of || '—'}</td>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid #f8f8f8', fontSize: 13, fontWeight: 500 }}>{r.ordenes_facturacion?.proveedores?.razon_social || '—'}</td>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid #f8f8f8', fontFamily: 'monospace', fontSize: 12 }}>{r.numero_factura}</td>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid #f8f8f8', fontSize: 13 }}>{r.ordenes_facturacion?.valor_total ? fmt(Number(r.ordenes_facturacion.valor_total)) : '—'}</td>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid #f8f8f8', fontSize: 12, color: '#888' }}>{r.fecha_radicacion}</td>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid #f8f8f8', fontSize: 12, color: vencida ? '#E24B4A' : '#888', fontWeight: vencida ? 600 : 400 }}>
                      {r.fecha_limite_pago} {vencida && '⚠'}
                    </td>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid #f8f8f8' }}>
                      <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: ec.bg, color: ec.color }}>{r.estado}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showForm && (
        <div onClick={() => setShowForm(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 60 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, padding: 28, width: 500 }}>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 20 }}>Radicar factura de proveedor</div>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Orden de Facturación (OF aprobada)</label>
                <select value={form.of_id} onChange={e => handleOfChange(e.target.value)} required style={inputStyle}>
                  <option value="">Seleccionar OF...</option>
                  {ofs.map(o => <option key={o.id} value={o.id}>{o.codigo_of} — {(o.proveedores as any)?.razon_social}</option>)}
                </select>
              </div>

              {selectedOf && (
                <div style={{ padding: '10px 14px', background: '#f8f8f8', borderRadius: 8, marginBottom: 14, fontSize: 12, color: '#666' }}>
                  Valor OF: <strong>{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(selectedOf.valor_total))}</strong>
                </div>
              )}

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Número de factura del proveedor</label>
                <input value={form.numero_factura} onChange={e => set('numero_factura', e.target.value)} required placeholder="Ej: FE-2026-0123" style={inputStyle} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={labelStyle}>Fecha de radicación</label>
                  <input type="date" value={form.fecha_radicacion} onChange={e => set('fecha_radicacion', e.target.value)} required style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Fecha límite de pago</label>
                  <input type="date" value={form.fecha_limite_pago} onChange={e => set('fecha_limite_pago', e.target.value)} required style={inputStyle} />
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Observaciones</label>
                <textarea value={form.observaciones} onChange={e => set('observaciones', e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Notas adicionales..." />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" onClick={() => setShowForm(false)} style={{ padding: '8px 18px', border: '0.5px solid #ddd', borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" disabled={saving} style={{ padding: '8px 18px', background: saving ? '#aaa' : '#185FA5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer' }}>
                  {saving ? 'Guardando...' : 'Radicar factura'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
