'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const fmt = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

export default function DashboardPage() {
  const [stats, setStats] = useState({ total: 0, pendiente: 0, pagado: 0, revision: 0, proveedores: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: ofs }, { data: provs }] = await Promise.all([
        supabase.from('ordenes_facturacion').select('valor_total, estado_pago, estado_verificacion'),
        supabase.from('proveedores').select('id').eq('activo', true)
      ])
      if (ofs) {
        const total = ofs.reduce((s, o) => s + Number(o.valor_total), 0)
        const pendiente = ofs.filter(o => o.estado_pago === 'PENDIENTE').reduce((s, o) => s + Number(o.valor_total), 0)
        const pagado = ofs.filter(o => o.estado_pago === 'PAGADO').reduce((s, o) => s + Number(o.valor_total), 0)
        const revision = ofs.filter(o => o.estado_verificacion === 'EN_REVISION').length
        setStats({ total, pendiente, pagado, revision, proveedores: provs?.length || 0 })
      }
      setLoading(false)
    }
    load()
  }, [])

  const cards = [
    { label: 'Total comprometido', value: fmt(stats.total), color: '#1a1a1a', dot: '#185FA5' },
    { label: 'Por pagar', value: fmt(stats.pendiente), color: '#E24B4A', dot: '#E24B4A' },
    { label: 'Pagado', value: fmt(stats.pagado), color: '#27500A', dot: '#639922' },
    { label: 'En revisión', value: stats.revision + ' OFs', color: '#BA7517', dot: '#EF9F27' },
    { label: 'Proveedores activos', value: stats.proveedores.toString(), color: '#1a1a1a', dot: '#185FA5' },
  ]

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 17, fontWeight: 500 }}>Control de compras — Feeling Company</div>
        <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>
          {new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {loading ? (
        <div style={{ color: '#aaa', fontSize: 13 }}>Cargando...</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 24 }}>
            {cards.map(c => (
              <div key={c.label} style={{
                background: '#fff', border: '0.5px solid #ebebeb', borderRadius: 12, padding: '14px 16px', position: 'relative'
              }}>
                <div style={{ position: 'absolute', top: 12, right: 12, width: 8, height: 8, borderRadius: '50%', background: c.dot }} />
                <div style={{ fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>{c.label}</div>
                <div style={{ fontSize: 20, fontWeight: 500, color: c.color }}>{c.value}</div>
              </div>
            ))}
          </div>

          <div style={{ background: '#fff', border: '0.5px solid #ebebeb', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Sistema activo</div>
            <div style={{ fontSize: 12, color: '#aaa' }}>
              Compras FC v1.0 — Feeling Company · Base de datos conectada · {new Date().toLocaleTimeString('es-CO')}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
