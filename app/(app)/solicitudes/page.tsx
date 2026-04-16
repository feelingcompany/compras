'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

const inputStyle = { width: '100%', padding: '8px 10px', border: '0.5px solid #d3d1c7', borderRadius: 8, fontSize: 13, background: '#fafafa', outline: 'none' }
const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4, display: 'block' }

const ESTADO_COLORS: Record<string, { bg: string; color: string }> = {
  PENDIENTE:   { bg: '#FAEEDA', color: '#633806' },
  EN_PROCESO:  { bg: '#E6F1FB', color: '#0C447C' },
  COMPLETADA:  { bg: '#EAF3DE', color: '#27500A' },
  RECHAZADA:   { bg: '#FCEBEB', color: '#791F1F' },
}

export default function SolicitudesPage() {
  const { usuario } = useAuth()
  const [solicitudes, setSolicitudes] = useState<any[]>([])
  const [ots, setOts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  const [form, setForm] = useState({
    ot_id: '', descripcion: '', monto_estimado: '',
    medio_pago_sugerido: 'TRANSFERENCIA', ciudad: 'Bogotá', plazo_pago: 'Inmediato'
  })

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: sols }, { data: otList }] = await Promise.all([
      supabase.from('solicitudes')
        .select('*, ordenes_trabajo(codigo, proyecto, cliente), solicitante:usuarios!solicitante_id(nombre)')
        .order('created_at', { ascending: false }),
      supabase.from('ordenes_trabajo').select('*').eq('activo', true).order('codigo')
    ])
    setSolicitudes(sols || [])
    setOts(otList || [])
    setLoading(false)
  }

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('solicitudes').insert({
      ...form,
      monto_estimado: form.monto_estimado ? Number(form.monto_estimado.replace(/\D/g, '')) : null,
      solicitante_id: usuario?.id,
      estado: 'PENDIENTE'
    })
    if (!error) {
      setSuccess(true)
      setShowForm(false)
      setForm({ ot_id: '', descripcion: '', monto_estimado: '', medio_pago_sugerido: 'TRANSFERENCIA', ciudad: 'Bogotá', plazo_pago: 'Inmediato' })
      await load()
      setTimeout(() => setSuccess(false), 3000)
    }
    setSaving(false)
  }

  const pendientes = solicitudes.filter(s => s.estado === 'PENDIENTE').length

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 500 }}>Solicitudes de compra</div>
          <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>Etapa 1 del proceso · El solicitante registra la necesidad</div>
        </div>
        <button onClick={() => setShowForm(true)} style={{
          padding: '8px 18px', background: '#185FA5', color: '#fff',
          border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer'
        }}>
          + Nueva solicitud
        </button>
      </div>

      {success && (
        <div style={{ padding: '10px 14px', background: '#EAF3DE', border: '0.5px solid #b7d9a0', borderRadius: 8, fontSize: 13, color: '#27500A', marginBottom: 16 }}>
          ✓ Solicitud registrada — el líder de compras la verá en su bandeja
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { l: 'Total solicitudes', v: solicitudes.length, c: '#1a1a1a' },
          { l: 'Pendientes', v: pendientes, c: '#BA7517' },
          { l: 'En proceso', v: solicitudes.filter(s => s.estado === 'EN_PROCESO').length, c: '#185FA5' },
          { l: 'Completadas', v: solicitudes.filter(s => s.estado === 'COMPLETADA').length, c: '#27500A' },
        ].map(s => (
          <div key={s.l} style={{ background: '#fff', border: '0.5px solid #ebebeb', borderRadius: 12, padding: '12px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 5 }}>{s.l}</div>
            <div style={{ fontSize: 22, fontWeight: 500, color: s.c }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Tabla */}
      <div style={{ background: '#fff', border: '0.5px solid #ebebeb', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 24, color: '#aaa', fontSize: 13 }}>Cargando solicitudes...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Proyecto (OT)', 'Descripción', 'Monto estimado', 'Ciudad', 'Solicitante', 'Estado', 'Fecha'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 600, color: '#999', borderBottom: '1px solid #f0f0f0', textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {solicitudes.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 24, color: '#aaa', fontSize: 13, textAlign: 'center' }}>
                  No hay solicitudes — crea la primera
                </td></tr>
              ) : solicitudes.map(s => {
                const ec = ESTADO_COLORS[s.estado] || ESTADO_COLORS.PENDIENTE
                return (
                  <tr key={s.id}>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid #f8f8f8' }}>
                      <div style={{ fontSize: 12, fontWeight: 500 }}>{s.ordenes_trabajo?.proyecto || '—'}</div>
                      <div style={{ fontSize: 11, color: '#aaa', fontFamily: 'monospace' }}>{s.ordenes_trabajo?.codigo}</div>
                    </td>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid #f8f8f8', fontSize: 13, maxWidth: 220 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.descripcion}</div>
                    </td>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid #f8f8f8', fontSize: 13 }}>
                      {s.monto_estimado ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(s.monto_estimado) : '—'}
                    </td>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid #f8f8f8', fontSize: 13 }}>{s.ciudad}</td>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid #f8f8f8', fontSize: 13 }}>{s.solicitante?.nombre || '—'}</td>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid #f8f8f8' }}>
                      <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: ec.bg, color: ec.color }}>{s.estado}</span>
                    </td>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid #f8f8f8', fontSize: 11, color: '#aaa', fontFamily: 'monospace' }}>
                      {new Date(s.created_at).toLocaleDateString('es-CO')}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal nueva solicitud */}
      {showForm && (
        <div onClick={() => setShowForm(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 60 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, padding: 28, width: 520, maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 20 }}>Nueva solicitud de compra</div>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Proyecto (OT)</label>
                <select value={form.ot_id} onChange={e => set('ot_id', e.target.value)} required style={inputStyle}>
                  <option value="">Seleccionar proyecto...</option>
                  {ots.map(o => <option key={o.id} value={o.id}>{o.codigo} — {o.proyecto} ({o.cliente})</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Descripción del pedido</label>
                <textarea value={form.descripcion} onChange={e => set('descripcion', e.target.value)} required rows={3}
                  placeholder="Describe qué necesitas, para qué y cuándo..." style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={labelStyle}>Monto estimado (COP)</label>
                  <input value={form.monto_estimado} onChange={e => set('monto_estimado', e.target.value)} placeholder="Ej: 5000000" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Ciudad del evento</label>
                  <input value={form.ciudad} onChange={e => set('ciudad', e.target.value)} style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
                <div>
                  <label style={labelStyle}>Medio de pago sugerido</label>
                  <select value={form.medio_pago_sugerido} onChange={e => set('medio_pago_sugerido', e.target.value)} style={inputStyle}>
                    <option value="TRANSFERENCIA">Transferencia</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="EFECTIVO">Efectivo</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Plazo de pago</label>
                  <select value={form.plazo_pago} onChange={e => set('plazo_pago', e.target.value)} style={inputStyle}>
                    <option value="Inmediato">Inmediato</option>
                    <option value="15 días">15 días</option>
                    <option value="30 días">30 días</option>
                    <option value="Contra entrega">Contra entrega</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" onClick={() => setShowForm(false)} style={{ padding: '8px 18px', border: '0.5px solid #ddd', borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" disabled={saving} style={{ padding: '8px 18px', background: saving ? '#aaa' : '#185FA5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer' }}>
                  {saving ? 'Guardando...' : 'Enviar solicitud'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
