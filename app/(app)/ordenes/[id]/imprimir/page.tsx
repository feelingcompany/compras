'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// ============================================================
// VISTA IMPRIMIBLE DE LA OF
// Documento oficial que se envía al proveedor.
// Se imprime con Ctrl+P o se guarda como PDF.
// ============================================================

export default function ImprimirOFPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const id = params?.id as string

  const [of, setOf] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) cargar()
  }, [id])

  const cargar = async () => {
    const { data: ofData } = await supabase
      .from('ordenes_facturacion')
      .select('*')
      .eq('id', id)
      .single()

    if (!ofData) {
      setLoading(false)
      return
    }

    const [
      { data: proveedor },
      { data: solicitud },
      { data: encargado }
    ] = await Promise.all([
      ofData.proveedor_id
        ? supabase.from('proveedores').select('*').eq('id', ofData.proveedor_id).single()
        : Promise.resolve({ data: null }),
      ofData.solicitud_id
        ? supabase.from('solicitudes').select('*').eq('id', ofData.solicitud_id).single()
        : Promise.resolve({ data: null }),
      ofData.encargado_id
        ? supabase.from('usuarios').select('*').eq('id', ofData.encargado_id).single()
        : Promise.resolve({ data: null })
    ])

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
      items
    })
    setLoading(false)
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center' }}>Cargando...</div>
  }

  if (!of) {
    return <div style={{ padding: 40, textAlign: 'center' }}>OF no encontrada</div>
  }

  const subtotal = of.items.reduce((s: number, i: any) => s + (parseFloat(i.presupuesto_estimado) || 0), 0) || parseFloat(of.valor_total) || 0
  const iva = subtotal * 0.19
  const total = parseFloat(of.valor_total) || subtotal

  return (
    <>
      {/* Barra de acciones (no se imprime) */}
      <div className="no-print" style={{
        background: '#1F2937', color: '#fff',
        padding: '12px 24px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        position: 'sticky', top: 0, zIndex: 10
      }}>
        <div style={{ fontSize: 13 }}>
          Vista previa — Orden de Facturación {of.codigo_of}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => router.push(`/ordenes/${id}`)}
            style={{
              padding: '8px 16px', background: 'transparent', color: '#fff',
              border: '1px solid #fff', borderRadius: 4,
              fontSize: 12, cursor: 'pointer'
            }}
          >
            Volver
          </button>
          <button
            onClick={() => window.print()}
            style={{
              padding: '8px 20px', background: '#fff', color: '#1F2937',
              border: 'none', borderRadius: 4,
              fontSize: 12, fontWeight: 600, cursor: 'pointer'
            }}
          >
            Imprimir / Guardar PDF
          </button>
        </div>
      </div>

      {/* DOCUMENTO IMPRIMIBLE */}
      <div className="documento" style={{
        maxWidth: 820, margin: '0 auto', padding: 40,
        background: '#fff', fontFamily: 'Arial, sans-serif',
        color: '#000', fontSize: 12, lineHeight: 1.5
      }}>
        {/* Encabezado corporativo */}
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'flex-start', paddingBottom: 16,
          borderBottom: '3px solid #185FA5', marginBottom: 24
        }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#185FA5', marginBottom: 4 }}>
              FEELING COMPANY
            </div>
            <div style={{ fontSize: 10, color: '#666', lineHeight: 1.4 }}>
              NIT: 900.xxx.xxx-x<br/>
              Bogotá D.C., Colombia<br/>
              www.feelingone.co
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: '#185FA5',
              letterSpacing: '0.1em', marginBottom: 4
            }}>
              ORDEN DE FACTURACIÓN
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace' }}>
              Nº {of.codigo_of}
            </div>
            <div style={{ fontSize: 10, color: '#666', marginTop: 4 }}>
              Fecha de emisión:{' '}
              {of.created_at && new Date(of.created_at).toLocaleDateString('es-CO', {
                day: '2-digit', month: '2-digit', year: 'numeric'
              })}
            </div>
          </div>
        </div>

        {/* Datos del proveedor */}
        <div style={{ marginBottom: 20 }}>
          <div style={{
            background: '#F3F4F6', padding: '6px 10px',
            fontSize: 10, fontWeight: 700, color: '#374151',
            textTransform: 'uppercase', letterSpacing: '0.05em',
            marginBottom: 10
          }}>
            Datos del proveedor
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 11 }}>
            <Field label="Razón social" valor={of.proveedor?.razon_social} bold />
            <Field label="NIT / Documento" valor={of.proveedor?.nit} />
            <Field label="Código proveedor" valor={of.proveedor?.codigo} />
            <Field label="Contacto" valor={of.proveedor?.contacto_nombre} />
            <Field label="Email" valor={of.proveedor?.contacto_email} />
            <Field label="Teléfono" valor={of.proveedor?.contacto_telefono} />
          </div>
        </div>

        {/* Detalles de la orden */}
        <div style={{ marginBottom: 20 }}>
          <div style={{
            background: '#F3F4F6', padding: '6px 10px',
            fontSize: 10, fontWeight: 700, color: '#374151',
            textTransform: 'uppercase', letterSpacing: '0.05em',
            marginBottom: 10
          }}>
            Detalles de la orden
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, fontSize: 11 }}>
            <Field label="Ciudad" valor={of.ciudad} />
            <Field label="Medio de pago" valor={of.medio_pago} />
            <Field label="Fecha requerida" valor={of.fecha_requerida ? new Date(of.fecha_requerida).toLocaleDateString('es-CO') : null} />
            <Field label="Responsable Feeling" valor={of.encargado?.nombre} />
            <Field label="Plazo de pago" valor={of.plazo_pago || 'Según condiciones'} />
            <Field label="Centro de costo" valor={of.solicitud?.centro_costo} />
          </div>
        </div>

        {/* Descripción */}
        <div style={{ marginBottom: 16 }}>
          <div style={{
            background: '#F3F4F6', padding: '6px 10px',
            fontSize: 10, fontWeight: 700, color: '#374151',
            textTransform: 'uppercase', letterSpacing: '0.05em',
            marginBottom: 8
          }}>
            Concepto
          </div>
          <div style={{ fontSize: 11, padding: '8px 4px', lineHeight: 1.6 }}>
            {of.descripcion || '—'}
          </div>
        </div>

        {/* Tabla de ítems */}
        {of.items && of.items.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{
              background: '#F3F4F6', padding: '6px 10px',
              fontSize: 10, fontWeight: 700, color: '#374151',
              textTransform: 'uppercase', letterSpacing: '0.05em',
              marginBottom: 8
            }}>
              Detalle de ítems
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #185FA5' }}>
                  <th style={{ padding: '8px 6px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#185FA5' }}>
                    DESCRIPCIÓN
                  </th>
                  <th style={{ padding: '8px 6px', textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#185FA5', width: 70 }}>
                    CANT.
                  </th>
                  <th style={{ padding: '8px 6px', textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#185FA5', width: 80 }}>
                    UNIDAD
                  </th>
                  <th style={{ padding: '8px 6px', textAlign: 'right', fontSize: 10, fontWeight: 700, color: '#185FA5', width: 110 }}>
                    VALOR UNIT.
                  </th>
                  <th style={{ padding: '8px 6px', textAlign: 'right', fontSize: 10, fontWeight: 700, color: '#185FA5', width: 110 }}>
                    TOTAL
                  </th>
                </tr>
              </thead>
              <tbody>
                {of.items.map((item: any) => {
                  const valorTotal = parseFloat(item.presupuesto_estimado) || 0
                  const valorUnit = item.cantidad > 0 ? valorTotal / item.cantidad : valorTotal
                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid #E5E7EB' }}>
                      <td style={{ padding: '10px 6px' }}>
                        <div style={{ fontWeight: 500 }}>{item.descripcion}</div>
                        {item.especificaciones && (
                          <div style={{ fontSize: 9, color: '#666', marginTop: 2 }}>{item.especificaciones}</div>
                        )}
                      </td>
                      <td style={{ padding: '10px 6px', textAlign: 'center' }}>{item.cantidad}</td>
                      <td style={{ padding: '10px 6px', textAlign: 'center', fontSize: 10 }}>{item.unidad}</td>
                      <td style={{ padding: '10px 6px', textAlign: 'right' }}>
                        ${valorUnit.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                      </td>
                      <td style={{ padding: '10px 6px', textAlign: 'right', fontWeight: 600 }}>
                        ${valorTotal.toLocaleString('es-CO')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Totales */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 30 }}>
          <div style={{ minWidth: 280 }}>
            <div style={{
              padding: '12px 16px', background: '#185FA5', color: '#fff',
              display: 'flex', justifyContent: 'space-between',
              fontSize: 13, fontWeight: 700
            }}>
              <span>VALOR TOTAL</span>
              <span>${total.toLocaleString('es-CO')}</span>
            </div>
            <div style={{ fontSize: 9, color: '#666', marginTop: 4, textAlign: 'right', fontStyle: 'italic' }}>
              Valor en pesos colombianos (COP)
            </div>
          </div>
        </div>

        {/* Condiciones */}
        <div style={{
          padding: 14, background: '#F9FAFB',
          borderLeft: '3px solid #185FA5',
          marginBottom: 30, fontSize: 10, lineHeight: 1.6
        }}>
          <div style={{ fontWeight: 700, marginBottom: 6, color: '#185FA5' }}>
            CONDICIONES DE LA ORDEN
          </div>
          <ol style={{ margin: 0, paddingLeft: 18 }}>
            <li>La presente orden autoriza al proveedor a emitir factura por los conceptos descritos.</li>
            <li>El proveedor debe facturar con el número de OF ({of.codigo_of}) como referencia obligatoria.</li>
            <li>Condiciones de pago según lo acordado y las políticas de Feeling Company.</li>
            <li>Cualquier modificación debe ser autorizada por escrito por el área de Compras.</li>
            <li>Esta orden no es válida sin la firma del responsable autorizado.</li>
          </ol>
        </div>

        {/* Firmas */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, marginTop: 50 }}>
          <div>
            <div style={{
              borderTop: '1px solid #000', paddingTop: 6,
              textAlign: 'center', fontSize: 10
            }}>
              <div style={{ fontWeight: 700 }}>{of.encargado?.nombre || 'Responsable de compras'}</div>
              <div style={{ color: '#666', marginTop: 2 }}>
                {of.encargado?.rol?.replace('_', ' ') || 'Feeling Company'}
              </div>
              <div style={{ color: '#666', fontSize: 9, marginTop: 2 }}>Autoriza</div>
            </div>
          </div>
          <div>
            <div style={{
              borderTop: '1px solid #000', paddingTop: 6,
              textAlign: 'center', fontSize: 10
            }}>
              <div style={{ fontWeight: 700 }}>{of.proveedor?.contacto_nombre || 'Proveedor'}</div>
              <div style={{ color: '#666', marginTop: 2 }}>
                {of.proveedor?.razon_social || '—'}
              </div>
              <div style={{ color: '#666', fontSize: 9, marginTop: 2 }}>Recibido / Acepta</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          marginTop: 40, paddingTop: 12,
          borderTop: '1px solid #E5E7EB',
          fontSize: 9, color: '#666', textAlign: 'center'
        }}>
          Feeling Company · Documento generado por Compras FC ·{' '}
          {new Date().toLocaleString('es-CO')}
        </div>
      </div>

      {/* Estilos de impresión */}
      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .documento { padding: 20px !important; max-width: 100% !important; }
        }
        @page {
          size: A4;
          margin: 15mm;
        }
      `}</style>
    </>
  )
}

function Field({ label, valor, bold }: any) {
  return (
    <div>
      <div style={{ fontSize: 9, color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
      <div style={{ fontSize: 11, fontWeight: bold ? 700 : 500, marginTop: 2 }}>
        {valor || '—'}
      </div>
    </div>
  )
}
