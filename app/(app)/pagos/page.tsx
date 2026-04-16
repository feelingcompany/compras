'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const fmt = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

export default function PagosPage() {
  const [pagos, setPagos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase
      .from('pagos')
      .select(`*, ordenes_facturacion(codigo_of, proveedores(razon_social)), registrado:usuarios!registrado_por(nombre)`)
      .order('created_at', { ascending: false })
    setPagos(data || [])
    setLoading(false)
  }

  const total = pagos.reduce((s, p) => s + Number(p.monto), 0)

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 17, fontWeight: 500 }}>Pagos</div>
        <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>Historial de pagos registrados</div>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
        <div style={{ background: '#fff', border: '0.5px solid #ebebeb', borderRadius: 12, padding: '14px 18px' }}>
          <div style={{ fontSize: 11, color: '#aaa', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>Total pagado</div>
          <div style={{ fontSize: 22, fontWeight: 500, color: '#27500A' }}>{fmt(total)}</div>
        </div>
        <div style={{ background: '#fff', border: '0.5px solid #ebebeb', borderRadius: 12, padding: '14px 18px' }}>
          <div style={{ fontSize: 11, color: '#aaa', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>Transacciones</div>
          <div style={{ fontSize: 22, fontWeight: 500 }}>{pagos.length}</div>
        </div>
      </div>

      <div style={{ background: '#fff', border: '0.5px solid #ebebeb', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 24, color: '#aaa', fontSize: 13 }}>Cargando pagos...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['OF', 'Proveedor', 'Monto', 'Comprobante', 'Fecha', 'Observaciones', 'Registrado por'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 600, color: '#999', borderBottom: '1px solid #f0f0f0', textTransform: 'uppercase', letterSpacing: '.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagos.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 24, color: '#aaa', fontSize: 13, textAlign: 'center' }}>No hay pagos registrados</td></tr>
              ) : pagos.map(p => (
                <tr key={p.id}>
                  <td style={{ padding: '9px 12px', borderBottom: '1px solid #f8f8f8', fontFamily: 'monospace', fontSize: 11 }}>{p.ordenes_facturacion?.codigo_of || '—'}</td>
                  <td style={{ padding: '9px 12px', borderBottom: '1px solid #f8f8f8', fontSize: 13, fontWeight: 500 }}>{p.ordenes_facturacion?.proveedores?.razon_social || '—'}</td>
                  <td style={{ padding: '9px 12px', borderBottom: '1px solid #f8f8f8', fontSize: 13, color: '#27500A', fontWeight: 500 }}>{fmt(Number(p.monto))}</td>
                  <td style={{ padding: '9px 12px', borderBottom: '1px solid #f8f8f8', fontFamily: 'monospace', fontSize: 11 }}>{p.comprobante || '—'}</td>
                  <td style={{ padding: '9px 12px', borderBottom: '1px solid #f8f8f8', fontSize: 12, color: '#888' }}>{p.fecha}</td>
                  <td style={{ padding: '9px 12px', borderBottom: '1px solid #f8f8f8', fontSize: 12, color: '#666' }}>{p.observaciones || '—'}</td>
                  <td style={{ padding: '9px 12px', borderBottom: '1px solid #f8f8f8', fontSize: 12, color: '#888' }}>{p.registrado?.nombre || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
