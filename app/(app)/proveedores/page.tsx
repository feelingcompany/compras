'use client'
import { useEffect, useState } from 'react'
import { supabase, Proveedor } from '@/lib/supabase'

export default function ProveedoresPage() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('proveedores').select('*').order('razon_social')
    setProveedores(data || [])
    setLoading(false)
  }

  const datos = proveedores.filter(p =>
    !busca || p.razon_social.toLowerCase().includes(busca.toLowerCase()) || p.nit.includes(busca)
  )

  const scoreColor = (s: number) => s >= 4 ? '#27500A' : s >= 3 ? '#BA7517' : '#E24B4A'

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 500 }}>Proveedores</div>
          <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>Directorio y evaluación</div>
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nombre o NIT..."
          style={{ padding: '7px 10px', border: '0.5px solid #d3d1c7', borderRadius: 8, fontSize: 13, width: 280 }} />
      </div>

      <div style={{ background: '#fff', border: '0.5px solid #ebebeb', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 24, color: '#aaa', fontSize: 13 }}>Cargando proveedores...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Código', 'Razón social', 'NIT', 'Ciudad', 'Condición pago', 'Score', 'Órdenes', 'Estado'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 600, color: '#999', borderBottom: '1px solid #f0f0f0', textTransform: 'uppercase', letterSpacing: '.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {datos.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 24, color: '#aaa', fontSize: 13, textAlign: 'center' }}>No hay proveedores</td></tr>
              ) : datos.map(p => (
                <tr key={p.id}>
                  <td style={{ padding: '9px 12px', borderBottom: '1px solid #f8f8f8', fontFamily: 'monospace', fontSize: 11 }}>{p.codigo}</td>
                  <td style={{ padding: '9px 12px', borderBottom: '1px solid #f8f8f8', fontWeight: 500, fontSize: 13 }}>{p.razon_social}</td>
                  <td style={{ padding: '9px 12px', borderBottom: '1px solid #f8f8f8', fontFamily: 'monospace', fontSize: 11 }}>{p.nit}</td>
                  <td style={{ padding: '9px 12px', borderBottom: '1px solid #f8f8f8', fontSize: 13 }}>{p.ciudad}</td>
                  <td style={{ padding: '9px 12px', borderBottom: '1px solid #f8f8f8', fontSize: 12, color: '#666' }}>{p.condicion_pago}</td>
                  <td style={{ padding: '9px 12px', borderBottom: '1px solid #f8f8f8' }}>
                    <span style={{ fontWeight: 600, color: scoreColor(p.score), fontSize: 13 }}>{p.score > 0 ? p.score.toFixed(1) : '—'}</span>
                  </td>
                  <td style={{ padding: '9px 12px', borderBottom: '1px solid #f8f8f8', fontSize: 13 }}>{p.total_ordenes}</td>
                  <td style={{ padding: '9px 12px', borderBottom: '1px solid #f8f8f8' }}>
                    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: p.activo ? '#EAF3DE' : '#f0f0f0', color: p.activo ? '#27500A' : '#999' }}>
                      {p.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
