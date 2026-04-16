'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

const inputStyle = { width: '100%', padding: '8px 10px', border: '0.5px solid #d3d1c7', borderRadius: 8, fontSize: 13, background: '#fafafa', outline: 'none' }
const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4, display: 'block' }
const fmt = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

export default function AuditoriaPage() {
  const { usuario } = useAuth()
  const [auditorias, setAuditorias] = useState<any[]>([])
  const [ofsParaAudir, setOfsParaAudit] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOf, setSelectedOf] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')

  const [form, setForm] = useState({
    of_id: '', rentabilidad_ok: false, politicas_ok: false,
    legal_ok: false, observaciones: ''
  })

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: auds }, { data: ofList }] = await Promise.all([
      supabase.from('auditorias_of')
        .select('*, ordenes_facturacion(codigo_of, valor_total, descripcion, estado_verificacion, proveedores(razon_social)), auditor:usuarios!auditor_id(nombre)')
        .order('created_at', { ascending: false }),
      supabase.from('ordenes_facturacion')
        .select('id, codigo_of, valor_total, descripcion, estado_verificacion, proveedores(razon_social, score, condicion_pago)')
        .eq('estado_verificacion', 'EN_REVISION')
        .order('created_at', { ascending: false })
    ])
    setAuditorias(auds || [])
    setOfsParaAudit(ofList || [])
    setLoading(false)
  }

  async function loadOf(ofId: string) {
    setForm(f => ({ ...f, of_id: ofId }))
    const found = ofsParaAudir.find(o => o.id === ofId)
    setSelectedOf(found || null)
  }

  async function handleAudit(aprobada: boolean) {
    if (!form.of_id) return
    setSaving(true)
    const allOk = form.rentabilidad_ok && form.politicas_ok && form.legal_ok
    const estado = aprobada && allOk ? 'APROBADA' : 'RECHAZADA'

    const { error } = await supabase.from('auditorias_of').insert({
      of_id: form.of_id,
      auditor_id: usuario?.id,
      rentabilidad_ok: form.rentabilidad_ok,
      politicas_ok: form.politicas_ok,
      legal_ok: form.legal_ok,
      observaciones: form.observaciones,
      estado
    })

    if (!error) {
      // Update OF verification state
      await supabase.from('ordenes_facturacion').update({
        estado_verificacion: estado === 'APROBADA' ? 'OK' : 'ANULADA'
      }).eq('id', form.of_id)

      setSuccess(estado === 'APROBADA' ? 'OF aprobada — el proveedor puede ser notificado' : 'OF rechazada y anulada')
      setSelectedOf(null)
      setForm({ of_id: '', rentabilidad_ok: false, politicas_ok: false, legal_ok: false, observaciones: '' })
      await load()
      setTimeout(() => setSuccess(''), 3000)
    }
    setSaving(false)
  }

  const estadoColors: Record<string, { bg: string; color: string }> = {
    PENDIENTE: { bg: '#FAEEDA', color: '#633806' },
    APROBADA:  { bg: '#EAF3DE', color: '#27500A' },
    RECHAZADA: { bg: '#FCEBEB', color: '#791F1F' },
  }

  const CheckBox = ({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) => (
    <div onClick={() => onChange(!value)} style={{
      display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px',
      border: `0.5px solid ${value ? '#185FA5' : '#ebebeb'}`,
      background: value ? '#f0f7ff' : '#fafafa', borderRadius: 10, cursor: 'pointer', transition: 'all .15s'
    }}>
      <div style={{
        width: 20, height: 20, borderRadius: 6, border: `2px solid ${value ? '#185FA5' : '#ddd'}`,
        background: value ? '#185FA5' : '#fff', flexShrink: 0, marginTop: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13
      }}>
        {value && '✓'}
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{desc}</div>
      </div>
    </div>
  )

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 17, fontWeight: 500 }}>Auditoría de compras</div>
        <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>Fase 4 · Verificación de rentabilidad, políticas y documentos legales</div>
      </div>

      {success && (
        <div style={{ padding: '10px 14px', background: success.includes('aprobada') ? '#EAF3DE' : '#FCEBEB', border: `0.5px solid ${success.includes('aprobada') ? '#b7d9a0' : '#F09595'}`, borderRadius: 8, fontSize: 13, color: success.includes('aprobada') ? '#27500A' : '#791F1F', marginBottom: 16 }}>
          {success.includes('aprobada') ? '✓' : '✗'} {success}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* Panel de auditoría */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 14, color: '#666' }}>OFs EN REVISIÓN — {ofsParaAudir.length} pendientes</div>

          {loading ? (
            <div style={{ color: '#aaa', fontSize: 13 }}>Cargando...</div>
          ) : ofsParaAudir.length === 0 ? (
            <div style={{ background: '#fff', border: '0.5px solid #ebebeb', borderRadius: 12, padding: 24, textAlign: 'center', color: '#aaa', fontSize: 13 }}>
              No hay OFs pendientes de auditoría
            </div>
          ) : ofsParaAudir.map(of => (
            <div key={of.id} onClick={() => loadOf(of.id)} style={{
              background: '#fff', border: `0.5px solid ${form.of_id === of.id ? '#185FA5' : '#ebebeb'}`,
              borderRadius: 10, padding: '12px 14px', marginBottom: 8, cursor: 'pointer', transition: 'all .1s'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#aaa' }}>{of.codigo_of}</div>
                  <div style={{ fontSize: 13, fontWeight: 500, marginTop: 2 }}>{(of.proveedores as any)?.razon_social || '—'}</div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{of.descripcion}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: Number(of.valor_total) >= 15000000 ? '#E24B4A' : '#1a1a1a' }}>
                    {fmt(Number(of.valor_total))}
                  </div>
                  {Number(of.valor_total) >= 15000000 && (
                    <div style={{ fontSize: 10, color: '#E24B4A', marginTop: 2 }}>⚠ Requiere gerencia</div>
                  )}
                </div>
              </div>
              {(of.proveedores as any)?.score > 0 && (
                <div style={{ fontSize: 11, color: '#aaa', marginTop: 6 }}>
                  Score proveedor: <strong style={{ color: Number((of.proveedores as any).score) >= 4 ? '#27500A' : '#BA7517' }}>{(of.proveedores as any).score}</strong> · {(of.proveedores as any).condicion_pago}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Formulario de auditoría */}
        <div>
          {!selectedOf ? (
            <div style={{ background: '#fff', border: '0.5px solid #ebebeb', borderRadius: 12, padding: 32, textAlign: 'center', color: '#aaa', fontSize: 13 }}>
              Selecciona una OF de la lista para auditarla
            </div>
          ) : (
            <div style={{ background: '#fff', border: '0.5px solid #ebebeb', borderRadius: 12, padding: 20 }}>
              <div style={{ marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid #f0f0f0' }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{selectedOf.codigo_of} — {(selectedOf.proveedores as any)?.razon_social}</div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 3 }}>{selectedOf.descripcion}</div>
                <div style={{ fontSize: 16, fontWeight: 600, marginTop: 6, color: Number(selectedOf.valor_total) >= 15000000 ? '#E24B4A' : '#1a1a1a' }}>
                  {fmt(Number(selectedOf.valor_total))}
                </div>
              </div>

              <div style={{ fontSize: 12, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 12 }}>Verificar</div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
                <CheckBox
                  label="✓ Rentabilidad" value={form.rentabilidad_ok} onChange={v => setForm(f => ({ ...f, rentabilidad_ok: v }))}
                  desc="Está dentro de los estándares de margen definidos por Feeling"
                />
                <CheckBox
                  label="✓ Políticas de pago" value={form.politicas_ok} onChange={v => setForm(f => ({ ...f, politicas_ok: v }))}
                  desc="Cumple con las políticas de pago y apalancamiento de la compañía"
                />
                <CheckBox
                  label="✓ Documentos legales" value={form.legal_ok} onChange={v => setForm(f => ({ ...f, legal_ok: v }))}
                  desc="RUT, cámara de comercio y demás docs están en regla y en BBDD"
                />
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={labelStyle}>Observaciones de auditoría</label>
                <textarea value={form.observaciones} onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))} rows={3}
                  style={{ ...inputStyle, resize: 'vertical' }} placeholder="Notas, hallazgos, condiciones de aprobación..." />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button onClick={() => handleAudit(false)} disabled={saving} style={{
                  padding: '10px', border: '0.5px solid #F09595', borderRadius: 8,
                  background: '#FCEBEB', color: '#791F1F', fontSize: 13, fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer'
                }}>
                  ✗ Rechazar OF
                </button>
                <button onClick={() => handleAudit(true)} disabled={saving || !form.rentabilidad_ok || !form.politicas_ok || !form.legal_ok} style={{
                  padding: '10px', border: 'none', borderRadius: 8,
                  background: (!form.rentabilidad_ok || !form.politicas_ok || !form.legal_ok) ? '#ddd' : '#185FA5',
                  color: (!form.rentabilidad_ok || !form.politicas_ok || !form.legal_ok) ? '#aaa' : '#fff',
                  fontSize: 13, fontWeight: 500, cursor: (!form.rentabilidad_ok || !form.politicas_ok || !form.legal_ok) ? 'not-allowed' : 'pointer'
                }}>
                  ✓ Aprobar OF
                </button>
              </div>
              {(!form.rentabilidad_ok || !form.politicas_ok || !form.legal_ok) && (
                <div style={{ fontSize: 11, color: '#aaa', marginTop: 8, textAlign: 'center' }}>
                  Marca los 3 checks para habilitar la aprobación
                </div>
              )}
            </div>
          )}

          {/* Historial auditorías */}
          {auditorias.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 10 }}>Historial reciente</div>
              {auditorias.slice(0, 5).map(a => {
                const ec = estadoColors[a.estado] || estadoColors.PENDIENTE
                return (
                  <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f8f8f8', fontSize: 13 }}>
                    <div>
                      <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#aaa' }}>{a.ordenes_facturacion?.codigo_of}</span>
                      <span style={{ marginLeft: 8 }}>{a.ordenes_facturacion?.proveedores?.razon_social}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, color: '#aaa' }}>{a.auditor?.nombre}</span>
                      <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: ec.bg, color: ec.color }}>{a.estado}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
