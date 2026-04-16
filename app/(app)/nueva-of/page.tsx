'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

const fmt = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

export default function NuevaOFPage() {
  const { usuario } = useAuth()
  const router = useRouter()
  const [proveedores, setProveedores] = useState<any[]>([])
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [centros, setCentros] = useState<any[]>([])
  const [servicios, setServicios] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [servicioSeleccionado, setServicioSeleccionado] = useState<any>(null)
  const [alertaPrecio, setAlertaPrecio] = useState<string | null>(null)

  const [form, setForm] = useState({
    codigo_of: '', proveedor_id: '', encargado_id: '', centro_costo_id: '',
    valor_total: '', descripcion: '', ciudad: 'Bogotá',
    medio_pago: 'TRANSFERENCIA', fecha_requerida: '', servicio_id: ''
  })

  useEffect(() => {
    async function load() {
      const [{ data: provs }, { data: users }, { data: cc }, { data: servs }] = await Promise.all([
        supabase.from('proveedores').select('id, codigo, razon_social').eq('activo', true).order('razon_social'),
        supabase.from('usuarios').select('id, nombre, rol').eq('activo', true).order('nombre'),
        supabase.from('centros_costo').select('id, codigo, nombre').eq('activo', true).order('codigo'),
        supabase.from('catalogo_servicios').select('*').eq('activo', true).order('nombre'),
      ])
      setProveedores(provs || [])
      setUsuarios(users || [])
      setCentros(cc || [])
      setServicios(servs || [])
    }
    load()
    // Generate OF code
    const mes = ['EN', 'FE', 'MA', 'AB', 'MY', 'JN', 'JL', 'AG', 'SE', 'OC', 'NO', 'DI'][new Date().getMonth()]
    const year = String(new Date().getFullYear()).slice(2)
    const rand = String(Math.floor(Math.random() * 900) + 100)
    setForm(f => ({ ...f, codigo_of: `02${rand}${mes}${year}` }))
  }, [])

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  // Detectar sobrecosto cuando cambia el valor o servicio
  useEffect(() => {
    if (servicioSeleccionado && form.valor_total) {
      const valorIngresado = Number(form.valor_total.replace(/\D/g, ''))
      const precioRef = Number(servicioSeleccionado.precio_referencia)
      
      if (precioRef > 0 && valorIngresado > 0) {
        const diferencia = ((valorIngresado - precioRef) / precioRef) * 100
        
        if (diferencia > 20) {
          setAlertaPrecio(`⚠️ SOBRECOSTO: ${diferencia.toFixed(0)}% sobre precio de referencia (${fmt(precioRef)})`)
        } else if (diferencia < -20) {
          setAlertaPrecio(`ℹ️ Precio ${Math.abs(diferencia).toFixed(0)}% inferior a referencia (${fmt(precioRef)})`)
        } else {
          setAlertaPrecio(null)
        }
      }
    }
  }, [form.valor_total, servicioSeleccionado])

  const handleServicioChange = (servicioId: string) => {
    set('servicio_id', servicioId)
    const servicio = servicios.find(s => s.id === servicioId)
    setServicioSeleccionado(servicio)
    
    if (servicio) {
      // Auto-rellenar descripción si está vacía
      if (!form.descripcion) {
        set('descripcion', servicio.descripcion || servicio.nombre)
      }
      // Auto-rellenar valor si hay precio de referencia
      if (servicio.precio_referencia && !form.valor_total) {
        set('valor_total', String(servicio.precio_referencia))
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    
    const valorFinal = Number(form.valor_total.replace(/\D/g, ''))
    
    const { error, data } = await supabase.from('ordenes_facturacion').insert({
      codigo_of: form.codigo_of,
      proveedor_id: form.proveedor_id,
      encargado_id: form.encargado_id,
      centro_costo_id: form.centro_costo_id,
      valor_total: valorFinal,
      descripcion: form.descripcion,
      ciudad: form.ciudad,
      medio_pago: form.medio_pago,
      fecha_requerida: form.fecha_requerida,
      solicitante_id: usuario?.id,
      estado_verificacion: 'EN_REVISION',
      estado_pago: 'PENDIENTE',
    }).select()
    
    if (!error && data && data[0]) {
      // Registrar en historial de precios si se seleccionó un servicio
      if (form.servicio_id) {
        await supabase.from('historial_precios').insert({
          servicio_id: form.servicio_id,
          of_id: data[0].id,
          proveedor_id: form.proveedor_id,
          precio: valorFinal,
          cantidad: 1,
          observaciones: alertaPrecio || null,
        })
      }
      
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

          {/* NUEVO: Selector de servicio del catálogo */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Servicio (opcional) — Autocompleta descripción y precio</label>
            <select 
              value={form.servicio_id} 
              onChange={e => handleServicioChange(e.target.value)} 
              style={inputStyle}
            >
              <option value="">Sin servicio / Otro...</option>
              {servicios.map(s => (
                <option key={s.id} value={s.id}>
                  {s.codigo} — {s.nombre} ({fmt(s.precio_referencia)})
                </option>
              ))}
            </select>
          </div>

          {/* NUEVO: Alerta de sobrecosto */}
          {alertaPrecio && (
            <div style={{ 
              marginBottom: 14, 
              padding: '10px 12px', 
              borderRadius: 8, 
              background: alertaPrecio.startsWith('⚠️') ? '#FCEBEB' : '#E6F1FB',
              border: alertaPrecio.startsWith('⚠️') ? '1px solid #E24B4A' : '1px solid #185FA5',
              color: alertaPrecio.startsWith('⚠️') ? '#791F1F' : '#0C447C',
              fontSize: 12,
              fontWeight: 500,
            }}>
              {alertaPrecio}
            </div>
          )}

          {/* NUEVO: Info del servicio seleccionado */}
          {servicioSeleccionado && (
            <div style={{ 
              marginBottom: 14, 
              padding: '10px 12px', 
              borderRadius: 8, 
              background: '#f8f8f8',
              border: '1px solid #e0e0e0',
              fontSize: 11,
              color: '#666',
            }}>
              <strong>{servicioSeleccionado.nombre}</strong><br/>
              Precio ref: {fmt(servicioSeleccionado.precio_referencia)} | 
              Unidad: {servicioSeleccionado.unidad_medida} | 
              {servicioSeleccionado.precio_min && servicioSeleccionado.precio_max && (
                <> Rango histórico: {fmt(servicioSeleccionado.precio_min)} - {fmt(servicioSeleccionado.precio_max)}</>
              )}
            </div>
          )}

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
