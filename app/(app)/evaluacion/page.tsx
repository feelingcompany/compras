'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

const inputStyle = { width: '100%', padding: '8px 10px', border: '0.5px solid #d3d1c7', borderRadius: 8, fontSize: 13, background: '#fafafa', outline: 'none' }
const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4, display: 'block' }

const DIMENSIONES = [
  { key: 'confiabilidad', label: '1.1 Confiabilidad general', desc: '¿El proveedor cumplió lo prometido?' },
  { key: 'calidad_materiales', label: '2.1 Calidad de materiales', desc: '¿Los materiales estuvieron a la altura?' },
  { key: 'calidad_producto', label: '2.2 Calidad del producto final', desc: '¿El resultado final fue el esperado?' },
  { key: 'tiempo_oportuno', label: '3.1 Tiempo oportuno', desc: '¿Entregó en el tiempo acordado?' },
  { key: 'disponibilidad', label: '4.1 Disponibilidad', desc: '¿Fue fácil de contactar y respondió rápido?' },
]

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {[1, 2, 3, 4, 5].map(s => (
        <button key={s} type="button" onClick={() => onChange(s)} style={{
          width: 36, height: 36, borderRadius: 8, border: '0.5px solid',
          background: s <= value ? '#185FA5' : '#f5f5f3',
          color: s <= value ? '#fff' : '#aaa',
          borderColor: s <= value ? '#185FA5' : '#ddd',
          fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'all .1s'
        }}>
          {s}
        </button>
      ))}
      <span style={{ fontSize: 12, color: '#aaa', alignSelf: 'center', marginLeft: 4 }}>
        {value === 0 ? '—' : value === 1 ? 'Muy malo' : value === 2 ? 'Malo' : value === 3 ? 'Regular' : value === 4 ? 'Bueno' : 'Excelente'}
      </span>
    </div>
  )
}

export default function EvaluacionPage() {
  const { usuario } = useAuth()
  const [evaluaciones, setEvaluaciones] = useState<any[]>([])
  const [ofs, setOfs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  const [form, setForm] = useState({
    of_id: '', confiabilidad: 0, calidad_materiales: 0,
    calidad_producto: 0, tiempo_oportuno: 0, disponibilidad: 0, observaciones: ''
  })

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: evals }, { data: ofList }] = await Promise.all([
      supabase.from('evaluaciones_proveedor')
        .select('*, ordenes_facturacion(codigo_of, proveedores(razon_social)), evaluador:usuarios!evaluador_id(nombre)')
        .order('created_at', { ascending: false }),
      supabase.from('ordenes_facturacion')
        .select('id, codigo_of, proveedores(razon_social)')
        .eq('estado_pago', 'PAGADO')
        .order('codigo_of')
    ])
    setEvaluaciones(evals || [])
    setOfs(ofList || [])
    setLoading(false)
  }

  const setScore = (k: string, v: number) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const scores = [form.confiabilidad, form.calidad_materiales, form.calidad_producto, form.tiempo_oportuno, form.disponibilidad]
    if (scores.some(s => s === 0)) {
      alert('Debes calificar todas las dimensiones')
      return
    }
    const promedio = scores.reduce((a, b) => a + b, 0) / 5
    setSaving(true)

    // Get proveedor_id from the OF
    const of = ofs.find(o => o.id === form.of_id)
    const { data: ofData } = await supabase.from('ordenes_facturacion').select('proveedor_id').eq('id', form.of_id).single()

    const { error } = await supabase.from('evaluaciones_proveedor').insert({
      of_id: form.of_id,
      proveedor_id: ofData?.proveedor_id,
      evaluador_id: usuario?.id,
      confiabilidad: form.confiabilidad,
      calidad_materiales: form.calidad_materiales,
      calidad_producto: form.calidad_producto,
      tiempo_oportuno: form.tiempo_oportuno,
      disponibilidad: form.disponibilidad,
      promedio: promedio.toFixed(2),
      observaciones: form.observaciones
    })

    if (!error && ofData?.proveedor_id) {
      // Update provider score
      const { data: allEvals } = await supabase.from('evaluaciones_proveedor')
        .select('promedio').eq('proveedor_id', ofData.proveedor_id)
      if (allEvals && allEvals.length > 0) {
        const newScore = allEvals.reduce((s, e) => s + Number(e.promedio), 0) / allEvals.length
        await supabase.from('proveedores').update({
          score: newScore.toFixed(1),
          total_ordenes: allEvals.length
        }).eq('id', ofData.proveedor_id)
      }
      setSuccess(true)
      setShowForm(false)
      setForm({ of_id: '', confiabilidad: 0, calidad_materiales: 0, calidad_producto: 0, tiempo_oportuno: 0, disponibilidad: 0, observaciones: '' })
      await load()
      setTimeout(() => setSuccess(false), 3000)
    }
    setSaving(false)
  }

  const scoreColor = (s: number) => s >= 4 ? '#27500A' : s >= 3 ? '#BA7517' : '#E24B4A'
  const avgGlobal = evaluaciones.length ? (evaluaciones.reduce((s, e) => s + Number(e.promedio), 0) / evaluaciones.length).toFixed(1) : '—'

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 500 }}>Evaluación de proveedores</div>
          <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>Etapa 7 · Calificación post-entrega en 5 dimensiones</div>
        </div>
        <button onClick={() => setShowForm(true)} style={{ padding: '8px 18px', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
          + Evaluar proveedor
        </button>
      </div>

      {success && (
        <div style={{ padding: '10px 14px', background: '#EAF3DE', border: '0.5px solid #b7d9a0', borderRadius: 8, fontSize: 13, color: '#27500A', marginBottom: 16 }}>
          ✓ Evaluación guardada — el score del proveedor fue actualizado
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { l: 'Evaluaciones totales', v: evaluaciones.length.toString(), c: '#1a1a1a' },
          { l: 'Score promedio global', v: avgGlobal, c: '#185FA5' },
          { l: 'OFs pendientes de evaluar', v: ofs.length.toString(), c: '#BA7517' },
        ].map(s => (
          <div key={s.l} style={{ background: '#fff', border: '0.5px solid #ebebeb', borderRadius: 12, padding: '12px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 5 }}>{s.l}</div>
            <div style={{ fontSize: 22, fontWeight: 500, color: s.c }}>{s.v}</div>
          </div>
        ))}
      </div>

      <div style={{ background: '#fff', border: '0.5px solid #ebebeb', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 24, color: '#aaa', fontSize: 13 }}>Cargando evaluaciones...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['OF', 'Proveedor', 'Confiab.', 'Cal. Mat.', 'Cal. Prod.', 'Tiempo', 'Dispon.', 'Promedio', 'Evaluador', 'Fecha'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 600, color: '#999', borderBottom: '1px solid #f0f0f0', textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {evaluaciones.length === 0 ? (
                <tr><td colSpan={10} style={{ padding: 24, color: '#aaa', fontSize: 13, textAlign: 'center' }}>No hay evaluaciones — la primera se genera al pagar y evaluar una OF</td></tr>
              ) : evaluaciones.map(ev => (
                <tr key={ev.id}>
                  <td style={{ padding: '9px 12px', borderBottom: '1px solid #f8f8f8', fontFamily: 'monospace', fontSize: 11 }}>{ev.ordenes_facturacion?.codigo_of || '—'}</td>
                  <td style={{ padding: '9px 12px', borderBottom: '1px solid #f8f8f8', fontSize: 13, fontWeight: 500 }}>{ev.ordenes_facturacion?.proveedores?.razon_social || '—'}</td>
                  {[ev.confiabilidad, ev.calidad_materiales, ev.calidad_producto, ev.tiempo_oportuno, ev.disponibilidad].map((v, i) => (
                    <td key={i} style={{ padding: '9px 12px', borderBottom: '1px solid #f8f8f8', fontSize: 13, fontWeight: 600, color: scoreColor(v) }}>{v}/5</td>
                  ))}
                  <td style={{ padding: '9px 12px', borderBottom: '1px solid #f8f8f8', fontSize: 14, fontWeight: 700, color: scoreColor(Number(ev.promedio)) }}>{Number(ev.promedio).toFixed(1)}</td>
                  <td style={{ padding: '9px 12px', borderBottom: '1px solid #f8f8f8', fontSize: 12 }}>{ev.evaluador?.nombre || '—'}</td>
                  <td style={{ padding: '9px 12px', borderBottom: '1px solid #f8f8f8', fontSize: 11, color: '#aaa', fontFamily: 'monospace' }}>{new Date(ev.created_at).toLocaleDateString('es-CO')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showForm && (
        <div onClick={() => setShowForm(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 40 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, padding: 28, width: 540, maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 20 }}>Evaluar proveedor post-entrega</div>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Orden de facturación (OFs pagadas)</label>
                <select value={form.of_id} onChange={e => { setForm(f => ({ ...f, of_id: e.target.value })) }} required style={inputStyle}>
                  <option value="">Seleccionar OF...</option>
                  {ofs.map(o => <option key={o.id} value={o.id}>{o.codigo_of} — {(o.proveedores as any)?.razon_social}</option>)}
                </select>
              </div>

              <div style={{ padding: '12px 14px', background: '#f8f8f8', borderRadius: 8, marginBottom: 20, fontSize: 12, color: '#666' }}>
                Califica de 1 (muy malo) a 5 (excelente) cada dimensión
              </div>

              {DIMENSIONES.map(dim => (
                <div key={dim.key} style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 3 }}>{dim.label}</div>
                  <div style={{ fontSize: 12, color: '#aaa', marginBottom: 8 }}>{dim.desc}</div>
                  <StarRating value={(form as any)[dim.key]} onChange={v => setScore(dim.key, v)} />
                </div>
              ))}

              <div style={{ marginBottom: 20, marginTop: 8 }}>
                <label style={labelStyle}>Observaciones adicionales</label>
                <textarea value={form.observaciones} onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))} rows={3}
                  style={{ ...inputStyle, resize: 'vertical' }} placeholder="Comentarios sobre la ejecución, novedades, recomendaciones..." />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" onClick={() => setShowForm(false)} style={{ padding: '8px 18px', border: '0.5px solid #ddd', borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" disabled={saving} style={{ padding: '8px 18px', background: saving ? '#aaa' : '#185FA5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer' }}>
                  {saving ? 'Guardando...' : 'Guardar evaluación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
