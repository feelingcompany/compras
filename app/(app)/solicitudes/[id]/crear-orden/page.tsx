'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth'

// ============================================================
// CREAR ORDEN DE FACTURACIÓN / SERVICIO DESDE UNA SOLICITUD
// 
// Solo admin_compras y gerencia.
// Parte de una solicitud APROBADA (o en cotización).
// Pre-llena con datos de la solicitud.
// Al confirmar: crea la OF/OS + cambia estado solicitud a 'ordenada'.
// ============================================================

export default function CrearOrdenDeSolicitudPage() {
  const { usuario } = useAuth()
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const solicitudId = params?.id as string

  const [solicitud, setSolicitud] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [proveedores, setProveedores] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [tipo, setTipo] = useState<'OF' | 'OS'>('OF')
  const [form, setForm] = useState({
    codigo: '',
    proveedor_id: '',
    valor_total: '',
    descripcion: '',
    medio_pago: 'TRANSFERENCIA',
    fecha_entrega: '',
    observaciones: '',
  })

  useEffect(() => {
    if (!usuario) {
      router.push('/login')
      return
    }
    if (!['admin_compras', 'gerencia'].includes(usuario.rol)) {
      alert('Solo el equipo de compras puede emitir OF/OS')
      router.push('/')
      return
    }
    if (solicitudId) cargar()
  }, [usuario, solicitudId])

  const cargar = async () => {
    try {
      const [
        { data: sol },
        { data: itemsData },
        { data: provs }
      ] = await Promise.all([
        supabase.from('solicitudes').select('*').eq('id', solicitudId).single(),
        supabase.from('items_solicitud').select('*').eq('solicitud_id', solicitudId),
        supabase.from('proveedores').select('id, codigo, razon_social').eq('activo', true).order('razon_social')
      ])

      if (!sol) {
        setError('Solicitud no encontrada')
        setLoading(false)
        return
      }

      if (!['aprobada', 'cotizando'].includes(sol.estado)) {
        setError(`La solicitud debe estar aprobada para emitir una OF. Estado actual: ${sol.estado}`)
        setLoading(false)
        return
      }

      setSolicitud(sol)
      setItems(itemsData || [])
      setProveedores(provs || [])

      // Calcular monto total
      const monto = (itemsData || []).reduce((sum, i) => sum + (parseFloat(i.presupuesto_estimado) || 0), 0)

      // Generar código
      const meses = ['EN', 'FE', 'MA', 'AB', 'MY', 'JN', 'JL', 'AG', 'SE', 'OC', 'NO', 'DI']
      const mes = meses[new Date().getMonth()]
      const year = String(new Date().getFullYear()).slice(2)
      const rand = String(Math.floor(Math.random() * 900) + 100)
      const codigo = `02${rand}${mes}${year}`

      // Pre-llenar formulario
      setForm({
        codigo,
        proveedor_id: '',
        valor_total: String(monto),
        descripcion: sol.descripcion || '',
        medio_pago: 'TRANSFERENCIA',
        fecha_entrega: sol.fecha_requerida || '',
        observaciones: sol.observaciones || '',
      })

      setLoading(false)
    } catch (err: any) {
      console.error(err)
      setError(err.message)
      setLoading(false)
    }
  }

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const guardar = async () => {
    if (!form.proveedor_id) {
      alert('Seleccioná un proveedor')
      return
    }
    if (!form.valor_total || Number(form.valor_total) <= 0) {
      alert('El valor debe ser mayor a cero')
      return
    }

    setSaving(true)

    try {
      const valor = Number(String(form.valor_total).replace(/\D/g, ''))

      if (tipo === 'OF') {
        // Crear Orden de Facturación
        const { data: of, error: errOf } = await supabase
          .from('ordenes_facturacion')
          .insert({
            codigo_of: form.codigo,
            proveedor_id: form.proveedor_id,
            solicitante_id: solicitud.solicitante_id,
            encargado_id: usuario!.id,
            valor_total: valor,
            descripcion: form.descripcion,
            ciudad: solicitud.ciudad || 'Bogotá',
            medio_pago: form.medio_pago,
            estado_verificacion: 'EN_PROCESO',
          })
          .select()
          .single()

        if (errOf) throw errOf

        // Intentar vincular con la solicitud (si la columna existe)
        try {
          await supabase.from('ordenes_facturacion')
            .update({ solicitud_id: solicitudId })
            .eq('id', of.id)
        } catch {}
      } else {
        // Crear Orden de Servicio
        const { error: errOs } = await supabase
          .from('ordenes_servicio')
          .insert({
            numero_os: form.codigo,
            solicitud_id: solicitudId,
            proveedor_id: form.proveedor_id,
            descripcion: form.descripcion,
            valor_total: valor,
            fecha_emision: new Date().toISOString(),
            fecha_inicio_servicio: form.fecha_entrega || null,
            estado: 'aprobada',
          })

        if (errOs) throw errOs
      }

      // Actualizar estado de la solicitud a 'ordenada'
      await supabase
        .from('solicitudes')
        .update({ estado: 'ordenada', updated_at: new Date().toISOString() })
        .eq('id', solicitudId)

      alert(`${tipo} emitida exitosamente. Código: ${form.codigo}`)
      router.push(tipo === 'OF' ? '/ordenes' : '/ordenes-servicio')
    } catch (err: any) {
      console.error(err)
      alert('Error al emitir: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Cargando solicitud...</div>
  }

  if (error) {
    return (
      <div style={{ padding: 32, maxWidth: 700, margin: '0 auto' }}>
        <div style={{
          background: '#FEE2E2', border: '1px solid #FCA5A5',
          borderRadius: 6, padding: 20
        }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#991B1B', marginBottom: 6 }}>
            No se puede emitir la OF/OS
          </div>
          <div style={{ fontSize: 13, color: '#7F1D1D', marginBottom: 14 }}>
            {error}
          </div>
          <button
            onClick={() => router.back()}
            style={{
              padding: '8px 16px', background: '#fff', color: '#991B1B',
              border: '1px solid #991B1B', borderRadius: 4,
              fontSize: 13, cursor: 'pointer'
            }}
          >
            Volver
          </button>
        </div>
      </div>
    )
  }

  const montoSolicitud = items.reduce((sum, i) => sum + (parseFloat(i.presupuesto_estimado) || 0), 0)

  return (
    <div style={{ padding: 32, maxWidth: 900, margin: '0 auto' }}>
      {/* Breadcrumb */}
      <button
        onClick={() => router.push(`/solicitudes/${solicitudId}`)}
        style={{
          background: 'none', border: 'none', color: '#185FA5',
          fontSize: 13, cursor: 'pointer', marginBottom: 16,
          textDecoration: 'underline', padding: 0
        }}
      >
        ← Volver a la solicitud
      </button>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Emitir orden al proveedor
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111', margin: 0, marginBottom: 6 }}>
          Crear {tipo === 'OF' ? 'Orden de Facturación' : 'Orden de Servicio'}
        </h1>
        <div style={{ fontSize: 13, color: '#6b7280' }}>
          A partir de: <strong>{solicitud.descripcion}</strong>
        </div>
      </div>

      {/* Info de la solicitud origen */}
      <div style={{
        background: '#EFF6FF', border: '1px solid #BFDBFE',
        borderRadius: 6, padding: 14, marginBottom: 20
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#1E40AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
          Solicitud de origen
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, fontSize: 12 }}>
          <div>
            <div style={{ color: '#6b7280', marginBottom: 2 }}>Centro de costo</div>
            <div style={{ fontWeight: 600 }}>{solicitud.centro_costo || '—'}</div>
          </div>
          <div>
            <div style={{ color: '#6b7280', marginBottom: 2 }}>Ciudad</div>
            <div style={{ fontWeight: 600 }}>{solicitud.ciudad || '—'}</div>
          </div>
          <div>
            <div style={{ color: '#6b7280', marginBottom: 2 }}>Fecha requerida</div>
            <div style={{ fontWeight: 600 }}>
              {solicitud.fecha_requerida ? new Date(solicitud.fecha_requerida).toLocaleDateString('es-CO') : '—'}
            </div>
          </div>
          <div>
            <div style={{ color: '#6b7280', marginBottom: 2 }}>Ítems</div>
            <div style={{ fontWeight: 600 }}>{items.length}</div>
          </div>
          <div>
            <div style={{ color: '#6b7280', marginBottom: 2 }}>Presupuesto original</div>
            <div style={{ fontWeight: 600, color: '#185FA5' }}>${montoSolicitud.toLocaleString('es-CO')}</div>
          </div>
          <div>
            <div style={{ color: '#6b7280', marginBottom: 2 }}>OT/OS del evento</div>
            <div style={{ fontWeight: 600 }}>{solicitud.ot_os || '—'}</div>
          </div>
        </div>
      </div>

      {/* Toggle OF/OS */}
      <div style={{
        background: '#fff', border: '1px solid #e5e7eb',
        borderRadius: 6, padding: 6,
        display: 'flex', gap: 4, marginBottom: 20
      }}>
        <button
          onClick={() => setTipo('OF')}
          style={{
            flex: 1, padding: '10px 16px',
            background: tipo === 'OF' ? '#185FA5' : 'transparent',
            color: tipo === 'OF' ? '#fff' : '#374151',
            border: 'none', borderRadius: 4,
            fontSize: 13, fontWeight: 600, cursor: 'pointer'
          }}
        >
          Orden de Facturación (OF)
        </button>
        <button
          onClick={() => setTipo('OS')}
          style={{
            flex: 1, padding: '10px 16px',
            background: tipo === 'OS' ? '#185FA5' : 'transparent',
            color: tipo === 'OS' ? '#fff' : '#374151',
            border: 'none', borderRadius: 4,
            fontSize: 13, fontWeight: 600, cursor: 'pointer'
          }}
        >
          Orden de Servicio (OS)
        </button>
      </div>

      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 16, fontStyle: 'italic', marginTop: -8 }}>
        {tipo === 'OF'
          ? 'OF: compra de bienes/productos que generarán factura del proveedor.'
          : 'OS: contratación de servicios profesionales/artísticos.'}
      </div>

      {/* Formulario */}
      <div style={{
        background: '#fff', border: '1px solid #e5e7eb',
        borderRadius: 6, padding: 24
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Código */}
          <Campo label="Código" requerido>
            <input
              type="text"
              value={form.codigo}
              onChange={e => set('codigo', e.target.value.toUpperCase())}
              style={inputStyle}
            />
          </Campo>

          {/* Proveedor */}
          <Campo label="Proveedor" requerido>
            <select
              value={form.proveedor_id}
              onChange={e => set('proveedor_id', e.target.value)}
              style={inputStyle}
            >
              <option value="">Seleccionar proveedor...</option>
              {proveedores.map(p => (
                <option key={p.id} value={p.id}>
                  {p.razon_social} {p.codigo && `(${p.codigo})`}
                </option>
              ))}
            </select>
            {proveedores.length === 0 && (
              <div style={{ fontSize: 11, color: '#DC2626', marginTop: 4 }}>
                No hay proveedores activos. Cargá uno en "Proveedores → Directorio".
              </div>
            )}
          </Campo>

          {/* Valor */}
          <Campo label="Valor total (COP)" requerido>
            <input
              type="text"
              value={form.valor_total ? Number(String(form.valor_total).replace(/\D/g, '')).toLocaleString('es-CO') : ''}
              onChange={e => set('valor_total', e.target.value.replace(/\D/g, ''))}
              placeholder="0"
              style={inputStyle}
            />
            {Number(form.valor_total) !== montoSolicitud && form.valor_total && (
              <div style={{ fontSize: 11, color: '#F59E0B', marginTop: 4 }}>
                Presupuesto solicitado: ${montoSolicitud.toLocaleString('es-CO')}
                {Number(form.valor_total) > montoSolicitud && ' — valor SUPERA el presupuesto'}
                {Number(form.valor_total) < montoSolicitud && ' — ahorro'}
              </div>
            )}
          </Campo>

          {/* Medio de pago */}
          <Campo label="Medio de pago">
            <select
              value={form.medio_pago}
              onChange={e => set('medio_pago', e.target.value)}
              style={inputStyle}
            >
              <option value="TRANSFERENCIA">Transferencia</option>
              <option value="CHEQUE">Cheque</option>
              <option value="EFECTIVO">Efectivo</option>
              <option value="TARJETA">Tarjeta</option>
              <option value="CREDITO">Crédito</option>
            </select>
          </Campo>

          {/* Fecha entrega */}
          <Campo label={tipo === 'OF' ? 'Fecha de entrega' : 'Fecha inicio servicio'}>
            <input
              type="date"
              value={form.fecha_entrega}
              onChange={e => set('fecha_entrega', e.target.value)}
              style={inputStyle}
            />
          </Campo>

          {/* Descripción */}
          <div style={{ gridColumn: 'span 2' }}>
            <Campo label="Descripción">
              <textarea
                value={form.descripcion}
                onChange={e => set('descripcion', e.target.value)}
                rows={3}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </Campo>
          </div>

          {/* Observaciones */}
          <div style={{ gridColumn: 'span 2' }}>
            <Campo label="Observaciones (opcional)">
              <textarea
                value={form.observaciones}
                onChange={e => set('observaciones', e.target.value)}
                rows={2}
                style={{ ...inputStyle, resize: 'vertical' }}
                placeholder="Notas adicionales, condiciones especiales..."
              />
            </Campo>
          </div>
        </div>

        {/* Ítems de la solicitud (referencia) */}
        <div style={{ marginTop: 20, padding: 14, background: '#F9FAFB', borderRadius: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', textTransform: 'uppercase', marginBottom: 8 }}>
            Ítems solicitados ({items.length})
          </div>
          {items.map((item: any) => (
            <div key={item.id} style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '6px 0', fontSize: 12,
              borderBottom: '1px solid #e5e7eb'
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, color: '#111' }}>{item.descripcion}</div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>
                  {item.cantidad} {item.unidad} · {item.categoria}
                </div>
              </div>
              <div style={{ fontWeight: 600, color: '#185FA5' }}>
                ${parseFloat(item.presupuesto_estimado || 0).toLocaleString('es-CO')}
              </div>
            </div>
          ))}
        </div>

        {/* Acciones */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24, paddingTop: 20, borderTop: '1px solid #e5e7eb' }}>
          <button
            onClick={() => router.push(`/solicitudes/${solicitudId}`)}
            style={{
              padding: '10px 20px', background: '#fff', color: '#374151',
              border: '1px solid #d1d5db', borderRadius: 4,
              fontSize: 13, cursor: 'pointer', fontWeight: 500
            }}
          >
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={saving || !form.proveedor_id || !form.valor_total}
            style={{
              padding: '10px 24px', background: '#185FA5', color: '#fff',
              border: 'none', borderRadius: 4,
              fontSize: 13, cursor: saving ? 'wait' : 'pointer', fontWeight: 600,
              opacity: (!form.proveedor_id || !form.valor_total) ? 0.5 : 1
            }}
          >
            {saving ? 'Emitiendo...' : `Emitir ${tipo}`}
          </button>
        </div>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '1px solid #d1d5db',
  borderRadius: 4, fontSize: 13, background: '#fff', outline: 'none',
  fontFamily: 'inherit'
}

function Campo({ label, requerido, children }: any) {
  return (
    <div>
      <label style={{
        display: 'block', fontSize: 11, fontWeight: 600,
        color: '#6b7280', textTransform: 'uppercase',
        letterSpacing: '0.04em', marginBottom: 5
      }}>
        {label} {requerido && <span style={{ color: '#DC2626' }}>*</span>}
      </label>
      {children}
    </div>
  )
}
