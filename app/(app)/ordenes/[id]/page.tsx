'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth'

export default function DetalleOFPage() {
  const { usuario } = useAuth()
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const id = params?.id as string

  const [of, setOf] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    if (!usuario) {
      router.push('/login')
      return
    }
    if (!['encargado', 'admin_compras', 'gerencia'].includes(usuario.rol)) {
      router.push('/')
      return
    }
    if (id) cargar()
  }, [usuario, id])

  const cargar = async () => {
    try {
      const { data: ofData, error } = await supabase
        .from('ordenes_facturacion')
        .select('*')
        .eq('id', id)
        .single()

      if (error || !ofData) {
        setLoading(false)
        return
      }

      // Enriquecer con datos relacionados
      const [
        { data: proveedor },
        { data: solicitud },
        { data: encargado },
        { data: solicitante }
      ] = await Promise.all([
        ofData.proveedor_id
          ? supabase.from('proveedores').select('*').eq('id', ofData.proveedor_id).single()
          : Promise.resolve({ data: null }),
        ofData.solicitud_id
          ? supabase.from('solicitudes').select('*').eq('id', ofData.solicitud_id).single()
          : Promise.resolve({ data: null }),
        ofData.encargado_id
          ? supabase.from('usuarios').select('id, nombre, email, rol').eq('id', ofData.encargado_id).single()
          : Promise.resolve({ data: null }),
        ofData.solicitante_id
          ? supabase.from('usuarios').select('id, nombre, email, rol').eq('id', ofData.solicitante_id).single()
          : Promise.resolve({ data: null })
      ])

      // Traer ítems si viene de solicitud
      let items: any[] = []
      if (ofData.solicitud_id) {
        const { data } = await supabase
          .from('items_solicitud')
          .select('*')
          .eq('solicitud_id', ofData.solicitud_id)
        items = data || []
      }

      setOf({
        ...ofData,
        proveedor: proveedor || null,
        solicitud: solicitud || null,
        encargado: encargado || null,
        solicitante: solicitante || null,
        items
      })
      setLoading(false)
    } catch (err) {
      console.error(err)
      setLoading(false)
    }
  }

  const actualizarEstado = async (campo: string, valor: string, mensaje: string) => {
    if (!confirm(mensaje)) return
    setUpdating(true)
    try {
      await supabase
        .from('ordenes_facturacion')
        .update({ [campo]: valor, updated_at: new Date().toISOString() })
        .eq('id', id)
      await cargar()
    } catch (err: any) {
      alert('Error: ' + err.message)
    } finally {
      setUpdating(false)
    }
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Cargando...</div>
  }

  if (!of) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ color: '#6b7280', marginBottom: 12 }}>Orden no encontrada</div>
        <button onClick={() => router.push('/ordenes')} style={btnPrimary}>
          Volver
        </button>
      </div>
    )
  }

  const estadoConfig: Record<string, { bg: string; color: string; label: string }> = {
    PENDIENTE:    { bg: '#FEF3C7', color: '#92400E', label: 'Pendiente' },
    EN_PROCESO:   { bg: '#DBEAFE', color: '#1E40AF', label: 'En proceso' },
    EN_REVISION:  { bg: '#FEF3C7', color: '#92400E', label: 'En revisión' },
    APROBADA:     { bg: '#D1FAE5', color: '#065F46', label: 'Aprobada' },
    ENVIADA:      { bg: '#E0E7FF', color: '#3730A3', label: 'Enviada al proveedor' },
    PAGADA:       { bg: '#D1FAE5', color: '#065F46', label: 'Pagada' },
    PAGADO:       { bg: '#D1FAE5', color: '#065F46', label: 'Pagada' },
    PARCIAL:      { bg: '#FED7AA', color: '#9A3412', label: 'Pago parcial' },
    ANULADA:      { bg: '#FEE2E2', color: '#991B1B', label: 'Anulada' },
  }

  const verifInfo = estadoConfig[of.estado_verificacion] || estadoConfig.PENDIENTE
  const pagoInfo = estadoConfig[of.estado_pago] || estadoConfig.PENDIENTE
  const esAdminCompras = ['admin_compras', 'gerencia'].includes(usuario?.rol || '')

  return (
    <div style={{ padding: 32, maxWidth: 1000, margin: '0 auto' }}>
      {/* Breadcrumb */}
      <button
        onClick={() => router.push('/ordenes')}
        style={{
          background: 'none', border: 'none', color: '#185FA5',
          fontSize: 13, cursor: 'pointer', marginBottom: 16,
          textDecoration: 'underline', padding: 0
        }}
      >
        ← Volver a órdenes de facturación
      </button>

      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-start', marginBottom: 20,
        paddingBottom: 20, borderBottom: '1px solid #e5e7eb'
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Orden de Facturación
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#111', margin: 0, marginBottom: 8, fontFamily: 'monospace' }}>
            {of.codigo_of}
          </h1>
          <div style={{ fontSize: 13, color: '#6b7280' }}>
            Emitida el{' '}
            {of.created_at && new Date(of.created_at).toLocaleDateString('es-CO', {
              day: 'numeric', month: 'long', year: 'numeric'
            })}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>VALOR TOTAL</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#185FA5' }}>
            ${(parseFloat(of.valor_total) || 0).toLocaleString('es-CO')}
          </div>
        </div>
      </div>

      {/* Estados y acciones principales */}
      <div style={{
        background: '#fff', border: '1px solid #e5e7eb',
        borderRadius: 8, padding: 20, marginBottom: 20
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
              Estado de verificación
            </div>
            <span style={{
              padding: '6px 12px', borderRadius: 4, fontSize: 12,
              fontWeight: 600, background: verifInfo.bg, color: verifInfo.color
            }}>
              {verifInfo.label}
            </span>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
              Estado de pago
            </div>
            <span style={{
              padding: '6px 12px', borderRadius: 4, fontSize: 12,
              fontWeight: 600, background: pagoInfo.bg, color: pagoInfo.color
            }}>
              {pagoInfo.label}
            </span>
          </div>
        </div>

        {/* Acciones */}
        {esAdminCompras && (
          <div style={{
            paddingTop: 16, borderTop: '1px solid #e5e7eb',
            display: 'flex', gap: 8, flexWrap: 'wrap'
          }}>
            <button
              onClick={() => window.open(`/ordenes/${id}/imprimir`, '_blank')}
              style={btnPrimary}
            >
              Ver / Imprimir OF oficial
            </button>

            {['PENDIENTE', 'EN_PROCESO', 'EN_REVISION'].includes(of.estado_verificacion) && (
              <button
                onClick={() => actualizarEstado('estado_verificacion', 'APROBADA', '¿Confirmar aprobación de esta OF?')}
                disabled={updating}
                style={btnSuccess}
              >
                Aprobar OF
              </button>
            )}

            {of.estado_verificacion === 'APROBADA' && of.estado_pago !== 'ENVIADA' && (
              <button
                onClick={() => actualizarEstado('estado_verificacion', 'ENVIADA', '¿Marcar como enviada al proveedor?')}
                disabled={updating}
                style={btnSecondary}
              >
                Marcar enviada al proveedor
              </button>
            )}

            {of.estado_verificacion === 'APROBADA' && !['PAGADA', 'PAGADO'].includes(of.estado_pago) && (
              <button
                onClick={() => actualizarEstado('estado_pago', 'PAGADO', '¿Confirmar que esta OF ya fue pagada?')}
                disabled={updating}
                style={btnSuccess}
              >
                Marcar como pagada
              </button>
            )}

            {of.estado_verificacion !== 'ANULADA' && (
              <button
                onClick={() => actualizarEstado('estado_verificacion', 'ANULADA', '¿Anular esta OF? Esta acción no se revierte fácilmente.')}
                disabled={updating}
                style={btnDanger}
              >
                Anular OF
              </button>
            )}
          </div>
        )}
      </div>

      {/* Descripción */}
      <Section titulo="Descripción">
        <div style={{ fontSize: 14, color: '#111', lineHeight: 1.6 }}>
          {of.descripcion || '(sin descripción)'}
        </div>
      </Section>

      {/* Proveedor */}
      <Section titulo="Proveedor">
        {of.proveedor ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Campo label="Razón social" valor={of.proveedor.razon_social} />
            <Campo label="Código" valor={of.proveedor.codigo} />
            <Campo label="NIT" valor={of.proveedor.nit} />
            <Campo label="Contacto" valor={of.proveedor.contacto_nombre} />
            <Campo label="Email" valor={of.proveedor.contacto_email} />
            <Campo label="Teléfono" valor={of.proveedor.contacto_telefono} />
          </div>
        ) : (
          <div style={{ color: '#9ca3af', fontSize: 13, fontStyle: 'italic' }}>
            Sin proveedor asignado
          </div>
        )}
      </Section>

      {/* Solicitud origen */}
      {of.solicitud && (
        <Section titulo="Solicitud de origen">
          <div
            onClick={() => router.push(`/solicitudes/${of.solicitud.id}`)}
            style={{
              padding: 12, background: '#F9FAFB', borderRadius: 4,
              cursor: 'pointer', border: '1px solid #e5e7eb'
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: '#111', marginBottom: 4 }}>
              {of.solicitud.descripcion}
            </div>
            <div style={{ fontSize: 11, color: '#6b7280' }}>
              Centro: {of.solicitud.centro_costo || '—'} · Click para ver detalle →
            </div>
          </div>
        </Section>
      )}

      {/* Ítems */}
      {of.items.length > 0 && (
        <Section titulo={`Ítems (${of.items.length})`}>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F9FAFB', fontSize: 11, color: '#6b7280', textTransform: 'uppercase' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Descripción</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>Cantidad</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>Presupuesto</th>
              </tr>
            </thead>
            <tbody>
              {of.items.map((item: any) => (
                <tr key={item.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ fontWeight: 500, color: '#111' }}>{item.descripcion}</div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>{item.categoria}</div>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: '#374151' }}>
                    {item.cantidad} {item.unidad}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#185FA5' }}>
                    ${(parseFloat(item.presupuesto_estimado) || 0).toLocaleString('es-CO')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {/* Detalles administrativos */}
      <Section titulo="Detalles administrativos">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <Campo label="Ciudad" valor={of.ciudad} />
          <Campo label="Medio de pago" valor={of.medio_pago} />
          <Campo label="Encargado" valor={of.encargado?.nombre} />
          <Campo label="Fecha requerida" valor={of.fecha_requerida ? new Date(of.fecha_requerida).toLocaleDateString('es-CO') : null} />
          <Campo label="Plazo de pago" valor={of.plazo_pago} />
          <Campo label="Solicitante" valor={of.solicitante?.nombre} />
        </div>
      </Section>
    </div>
  )
}

const btnPrimary: React.CSSProperties = {
  padding: '9px 16px', background: '#185FA5', color: '#fff',
  border: 'none', borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: 'pointer'
}
const btnSuccess: React.CSSProperties = {
  padding: '9px 16px', background: '#10B981', color: '#fff',
  border: 'none', borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: 'pointer'
}
const btnSecondary: React.CSSProperties = {
  padding: '9px 16px', background: '#fff', color: '#374151',
  border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13, fontWeight: 500, cursor: 'pointer'
}
const btnDanger: React.CSSProperties = {
  padding: '9px 16px', background: '#fff', color: '#DC2626',
  border: '1px solid #DC2626', borderRadius: 4, fontSize: 13, fontWeight: 500, cursor: 'pointer'
}

function Section({ titulo, children }: any) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e5e7eb',
      borderRadius: 6, padding: 20, marginBottom: 16
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#111', marginBottom: 14 }}>
        {titulo}
      </div>
      {children}
    </div>
  )
}

function Campo({ label, valor }: any) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>
        {valor || '—'}
      </div>
    </div>
  )
}
