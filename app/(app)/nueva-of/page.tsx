'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

export default function NuevaOFPage() {
  const { usuario } = useAuth()
  const router = useRouter()
  const [proveedores, setProveedores] = useState<any[]>([])
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [centros, setCentros] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  const [form, setForm] = useState({
    codigo_of: '', proveedor_id: '', encargado_id: '', centro_costo_id: '',
    valor_total: '', descripcion: '', ciudad: 'Bogotá',
    medio_pago: 'TRANSFERENCIA', fecha_requerida: ''
  })

  useEffect(() => {
    async function load() {
      const [{ data: provs }, { data: users }, { data: cc }] = await Promise.all([
        supabase.from('proveedores').select('id, codigo, razon_social').eq('activo', true).order('razon_social'),
        supabase.from('usuarios').select('id, nombre, rol').eq('activo', true).order('nombre'),
        supabase.from('centros_costo').select('id, codigo, nombre').eq('activo', true).order('codigo'),
      ])
      setProveedores(provs || [])
      setUsuarios(users || [])
      setCentros(cc || [])
    }
    load()
    // Generate OF code
    const mes = ['EN', 'FE', 'MA', 'AB', 'MY', 'JN', 'JL', 'AG', 'SE', 'OC', 'NO', 'DI'][new Date().getMonth()]
    const year = String(new Date().getFullYear()).slice(2)
    const rand = String(Math.floor(Math.random() * 900) + 100)
    setForm(f => ({ ...f, codigo_of: `02${rand}${mes}${year}` }))
  }, [])

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('ordenes_facturacion').insert({
      ...form,
      valor_total: Number(form.valor_total.replace(/\D/g, '')),
      solicitante_id: usuario?.id,
      estado_verificacion: 'EN_REVISION',
      estado_pago: 'PENDIENTE',
    })
    if (!error) {
      setSuccess(true)
      setTimeout(() => router.push('/ordenes'), 1500)
    }
    setSaving(false)
  }

  const inputStyle = { width: '100%', padding: '8px 10px', border: '0.5px solid #d3d1c7', borderRadius: 8, fontSize: 13, background: '#fafafa' }
  const labelStyle = { fontSize: 11, fontWeight: 600, color: '#999', textTransform: 'uppercase' as const, letterSpacing: '.04em', marginBottom: 4, display: 'block' }

  if (success) return (
    <div style={{ padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
        <div style={{ fontSize: 15, fontWeight: 500 }}>OF creada exitosamente</div>
        <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>Redirigiendo a órdenes...</div>
      </div>
    </div>
  )

  return (
    <div style={{ padding: 24, maxWidth: 600 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 17, fontWeight: 500 }}>Nueva Orden de Facturación</div>
        <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>Completa todos los campos requeridos</div>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ background: '#fff', border: '0.5px solid #ebebeb', borderRadius: 12, padding: 24 }}>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Código OF</label>
              <input value={form.codigo_of} onChange={e => set('codigo_of', e.target.value)} required style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Valor total (COP)</label>
              <input value={form.valor_total} onChange={e => set('valor_total', e.target.value)} placeholder="0" required style={inputStyle} />
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Proveedor</label>
            <select value={form.proveedor_id} onChange={e => set('proveedor_id', e.target.value)} required style={inputStyle}>
              <option value="">Seleccionar...</option>
              {proveedores.map(p => <option key={p.id} value={p.id}>{p.razon_social}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Encargado</label>
            <select value={form.encargado_id} onChange={e => set('encargado_id', e.target.value)} required style={inputStyle}>
              <option value="">Seleccionar...</option>
              {usuarios.filter(u => ['admin_compras', 'encargado'].includes(u.rol)).map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Centro de costo</label>
            <select value={form.centro_costo_id} onChange={e => set('centro_costo_id', e.target.value)} required style={inputStyle}>
              <option value="">Seleccionar...</option>
              {centros.map(c => <option key={c.id} value={c.id}>{c.codigo} — {c.nombre}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Descripción</label>
            <textarea value={form.descripcion} onChange={e => set('descripcion', e.target.value)} required rows={3}
              style={{ ...inputStyle, resize: 'vertical' }} placeholder="Describe el servicio o bien a adquirir..." />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Ciudad</label>
              <input value={form.ciudad} onChange={e => set('ciudad', e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Medio de pago</label>
              <select value={form.medio_pago} onChange={e => set('medio_pago', e.target.value)} style={inputStyle}>
                <option value="TRANSFERENCIA">Transferencia</option>
                <option value="CHEQUE">Cheque</option>
                <option value="EFECTIVO">Efectivo</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Fecha requerida</label>
              <input type="date" value={form.fecha_requerida} onChange={e => set('fecha_requerida', e.target.value)} required style={inputStyle} />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <button type="button" onClick={() => router.push('/ordenes')}
            style={{ padding: '8px 20px', border: '0.5px solid #ddd', borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer' }}>
            Cancelar
          </button>
          <button type="submit" disabled={saving}
            style={{ padding: '8px 20px', background: saving ? '#aaa' : '#185FA5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Guardando...' : 'Crear OF'}
          </button>
        </div>
      </form>
    </div>
  )
}
