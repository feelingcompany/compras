'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

const fmt = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
const fmtM = (n: number) => `$${(n / 1000000).toFixed(1)}M`

export default function DashboardPage() {
  const { usuario } = useAuth()
  const [data, setData] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('gasto')

  useEffect(() => { load() }, [])

  async function load() {
    const [
      { data: ofs },
      { data: provs },
      { data: pagos },
      { data: cotz },
    ] = await Promise.all([
      supabase.from('ordenes_facturacion').select('id, valor_total, estado_pago, estado_verificacion, proveedor_id, ciudad, created_at, proveedores(razon_social)'),
      supabase.from('proveedores').select('id, razon_social, score, total_ordenes').eq('activo', true),
      supabase.from('pagos').select('monto, fecha, of_id'),
      supabase.from('cotizaciones').select('of_id, valor, seleccionada'),
    ])

    const ofList = ofs || []
    const totalCompromiso = ofList.reduce((s, o) => s + Number(o.valor_total), 0)
    const totalPagado = (pagos || []).reduce((s, p) => s + Number(p.monto), 0)
    const pendiente = ofList.filter(o => o.estado_pago === 'PENDIENTE').reduce((s, o) => s + Number(o.valor_total), 0)
    const enRevision = ofList.filter(o => o.estado_verificacion === 'EN_REVISION').length
    const aprobadas = ofList.filter(o => o.estado_verificacion === 'OK').length

    // Top proveedores por gasto
    const gastoPorProv: Record<string, { nombre: string; total: number; ofs: number }> = {}
    ofList.forEach(o => {
      const id = o.proveedor_id
      const nombre = (o.proveedores as any)?.razon_social || 'Sin proveedor'
      if (!id) return
      if (!gastoPorProv[id]) gastoPorProv[id] = { nombre, total: 0, ofs: 0 }
      gastoPorProv[id].total += Number(o.valor_total)
      gastoPorProv[id].ofs += 1
    })
    const topProveedores = Object.values(gastoPorProv)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)

    // Gasto por ciudad
    const gastoPorCiudad: Record<string, number> = {}
    ofList.forEach(o => {
      const c = o.ciudad || 'Sin ciudad'
      gastoPorCiudad[c] = (gastoPorCiudad[c] || 0) + Number(o.valor_total)
    })
    const topCiudades = Object.entries(gastoPorCiudad).sort((a, b) => b[1] - a[1]).slice(0, 5)

    // OFs por mes
    const porMes: Record<string, number> = {}
    ofList.forEach(o => {
      if (!o.created_at) return
      const mes = o.created_at.substring(0, 7)
      porMes[mes] = (porMes[mes] || 0) + Number(o.valor_total)
    })
    const meses = Object.entries(porMes).sort((a, b) => a[0].localeCompare(b[0])).slice(-6)

    // Concentracion proveedores
    const top3total = topProveedores.slice(0, 3).reduce((s, p) => s + p.total, 0)
    const concentracion = totalCompromiso > 0 ? Math.round(top3total / totalCompromiso * 100) : 0

    // Cotizaciones stats
    const cotzList = cotz || []
    const ofsConCotz = new Set(cotzList.map(c => c.of_id)).size
    const pctConCotz = ofList.length > 0 ? Math.round(ofsConCotz / ofList.length * 100) : 0

    // Ahorro generado
    let ahorro = 0
    const cotzByOf: Record<string, any[]> = {}
    cotzList.forEach(c => {
      if (!cotzByOf[c.of_id]) cotzByOf[c.of_id] = []
      cotzByOf[c.of_id].push(c)
    })
    Object.values(cotzByOf).forEach(cotzOf => {
      if (cotzOf.length >= 2) {
        const sel = cotzOf.find(c => c.seleccionada)
        if (sel) {
          const max = Math.max(...cotzOf.map((c: any) => Number(c.valor)))
          ahorro += max - Number(sel.valor)
        }
      }
    })

    setData({
      totalCompromiso, totalPagado, pendiente, enRevision, aprobadas,
      totalOfs: ofList.length, topProveedores, topCiudades, meses,
      concentracion, ofsConCotz, pctConCotz, ahorro,
      totalProveedores: (provs || []).length,
    })
    setLoading(false)
  }

  const TABS = [
    { id: 'gasto', label: 'Gasto' },
    { id: 'eficiencia', label: 'Eficiencia' },
    { id: 'proveedores', label: 'Proveedores' },
  ]

  if (loading) return (
    <div style={{ padding: 24, color: '#aaa', fontSize: 13 }}>Cargando dashboard...</div>
  )

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 500 }}>Dashboard ejecutivo</div>
          <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>
            {new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} · {data.totalOfs} OFs · {data.totalProveedores} proveedores
          </div>
        </div>
        <div style={{ display: 'flex', background: '#fff', border: '0.5px solid #eee', borderRadius: 8, overflow: 'hidden' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: '7px 18px', fontSize: 12, fontWeight: 500, border: 'none',
              background: tab === t.id ? '#185FA5' : 'transparent',
              color: tab === t.id ? '#fff' : '#aaa', cursor: 'pointer'
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* KPIs principales */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { l: 'Total comprometido', v: fmtM(data.totalCompromiso), c: '#1a1a1a', dot: '#185FA5' },
          { l: 'Por pagar', v: fmtM(data.pendiente), c: '#E24B4A', dot: '#E24B4A' },
          { l: 'Pagado', v: fmtM(data.totalPagado), c: '#27500A', dot: '#639922' },
          { l: 'En revisión', v: `${data.enRevision} OFs`, c: '#BA7517', dot: '#EF9F27' },
          { l: 'Aprobadas', v: `${data.aprobadas} OFs`, c: '#185FA5', dot: '#185FA5' },
        ].map(s => (
          <div key={s.l} style={{ background: '#fff', border: '0.5px solid #ebebeb', borderRadius: 12, padding: '14px 16px', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 12, right: 12, width: 8, height: 8, borderRadius: '50%', background: s.dot }} />
            <div style={{ fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>{s.l}</div>
            <div style={{ fontSize: 22, fontWeight: 500, color: s.c }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* TAB: GASTO */}
      {tab === 'gasto' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

          {/* Top 10 proveedores */}
          <div style={{ background: '#fff', border: '0.5px solid #ebebeb', borderRadius: 12, padding: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 16 }}>Top 10 proveedores por gasto</div>
            {data.topProveedores?.map((p: any, i: number) => {
              const pct = data.totalCompromiso > 0 ? (p.total / data.totalCompromiso * 100).toFixed(1) : 0
              return (
                <div key={i} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ fontWeight: 500, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nombre}</span>
                    <span style={{ color: '#888' }}>{fmtM(p.total)} <span style={{ color: '#aaa' }}>({pct}%)</span></span>
                  </div>
                  <div style={{ height: 5, background: '#f0f0f0', borderRadius: 3 }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: i === 0 ? '#185FA5' : i < 3 ? '#639922' : '#d3d1c7', borderRadius: 3 }} />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Gasto por ciudad + concentración */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: '#fff', border: '0.5px solid #ebebeb', borderRadius: 12, padding: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 14 }}>Gasto por ciudad</div>
              {data.topCiudades?.map(([ciudad, total]: [string, number], i: number) => {
                const pct = data.totalCompromiso > 0 ? (total / data.totalCompromiso * 100).toFixed(1) : 0
                return (
                  <div key={ciudad} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #f8f8f8', fontSize: 13 }}>
                    <span style={{ fontWeight: i === 0 ? 500 : 400 }}>{ciudad}</span>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontWeight: 500 }}>{fmtM(total)}</span>
                      <span style={{ fontSize: 11, color: '#aaa', marginLeft: 6 }}>{pct}%</span>
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{ background: '#fff', border: '0.5px solid #ebebeb', borderRadius: 12, padding: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Concentración de compras</div>
              <div style={{ fontSize: 11, color: '#aaa', marginBottom: 12 }}>% del gasto en los 3 principales proveedores</div>
              <div style={{ fontSize: 36, fontWeight: 500, color: data.concentracion >= 60 ? '#E24B4A' : data.concentracion >= 40 ? '#BA7517' : '#27500A' }}>
                {data.concentracion}%
              </div>
              <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>
                {data.concentracion >= 60 ? '⚠ Alta concentración — riesgo de dependencia' : data.concentracion >= 40 ? '⚠ Concentración moderada' : '✓ Concentración saludable'}
              </div>
              <div style={{ height: 6, background: '#f0f0f0', borderRadius: 3, marginTop: 10 }}>
                <div style={{ height: '100%', width: `${data.concentracion}%`, background: data.concentracion >= 60 ? '#E24B4A' : data.concentracion >= 40 ? '#EF9F27' : '#639922', borderRadius: 3 }} />
              </div>
            </div>
          </div>

          {/* Evolución mensual */}
          <div style={{ background: '#fff', border: '0.5px solid #ebebeb', borderRadius: 12, padding: 18, gridColumn: 'span 2' }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 16 }}>Gasto mensual 2026</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 120 }}>
              {data.meses?.map(([mes, total]: [string, number]) => {
                const maxVal = Math.max(...data.meses.map(([, v]: [string, number]) => v))
                const h = maxVal > 0 ? Math.round((total / maxVal) * 100) : 0
                const label = mes.substring(5) === '01' ? 'Ene' : mes.substring(5) === '02' ? 'Feb' : mes.substring(5) === '03' ? 'Mar' : mes.substring(5) === '04' ? 'Abr' : mes.substring(5) === '05' ? 'May' : mes.substring(5) === '06' ? 'Jun' : mes.substring(5)
                return (
                  <div key={mes} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <div style={{ fontSize: 10, color: '#888' }}>{fmtM(total)}</div>
                    <div style={{ width: '100%', height: `${h}%`, minHeight: 4, background: '#185FA5', borderRadius: '4px 4px 0 0', opacity: 0.8 }} />
                    <div style={{ fontSize: 11, color: '#aaa' }}>{label}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB: EFICIENCIA */}
      {tab === 'eficiencia' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
          <div style={{ background: '#fff', border: '0.5px solid #ebebeb', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>OFs con cotizaciones</div>
            <div style={{ fontSize: 11, color: '#aaa', marginBottom: 16 }}>Compras con competencia vs sin competencia</div>
            <div style={{ fontSize: 40, fontWeight: 500, color: data.pctConCotz >= 50 ? '#185FA5' : '#E24B4A' }}>{data.pctConCotz}%</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{data.ofsConCotz} de {data.totalOfs} OFs comparadas</div>
            <div style={{ height: 6, background: '#f0f0f0', borderRadius: 3, marginTop: 12 }}>
              <div style={{ height: '100%', width: `${data.pctConCotz}%`, background: '#185FA5', borderRadius: 3 }} />
            </div>
          </div>

          <div style={{ background: '#fff', border: '0.5px solid #ebebeb', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Ahorro generado</div>
            <div style={{ fontSize: 11, color: '#aaa', marginBottom: 16 }}>Diferencia entre cotización más cara y la seleccionada</div>
            <div style={{ fontSize: 32, fontWeight: 500, color: '#27500A' }}>{data.ahorro > 0 ? fmtM(data.ahorro) : '$0'}</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>en compras con múltiples cotizaciones</div>
          </div>

          <div style={{ background: '#fff', border: '0.5px solid #ebebeb', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Estados de verificación</div>
            <div style={{ fontSize: 11, color: '#aaa', marginBottom: 16 }}>Distribución actual de las OFs</div>
            {[
              { l: 'Aprobadas (OK)', v: data.aprobadas, c: '#27500A', bg: '#EAF3DE' },
              { l: 'En revisión', v: data.enRevision, c: '#BA7517', bg: '#FAEEDA' },
              { l: 'Total OFs', v: data.totalOfs, c: '#185FA5', bg: '#E6F1FB' },
            ].map(s => (
              <div key={s.l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: s.bg, borderRadius: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: s.c, fontWeight: 500 }}>{s.l}</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: s.c }}>{s.v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB: PROVEEDORES */}
      {tab === 'proveedores' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div style={{ background: '#fff', border: '0.5px solid #ebebeb', borderRadius: 12, padding: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 14 }}>Ranking por gasto — Top 15</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['#', 'Proveedor', 'Gasto', 'OFs'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '7px 10px', fontSize: 11, fontWeight: 600, color: '#999', borderBottom: '1px solid #f0f0f0', textTransform: 'uppercase', letterSpacing: '.04em' }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {data.topProveedores?.slice(0, 15).map((p: any, i: number) => (
                  <tr key={i}>
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid #f8f8f8', fontSize: 12, color: i < 3 ? '#185FA5' : '#aaa', fontWeight: 600 }}>{i + 1}</td>
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid #f8f8f8', fontSize: 13, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nombre}</td>
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid #f8f8f8', fontSize: 13, fontWeight: 500 }}>{fmtM(p.total)}</td>
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid #f8f8f8', fontSize: 13, color: '#666' }}>{p.ofs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: '#fff', border: '0.5px solid #ebebeb', borderRadius: 12, padding: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 14 }}>Resumen de proveedores</div>
              {[
                { l: 'Total en base de datos', v: data.totalProveedores, c: '#1a1a1a' },
                { l: 'Usados en 2026', v: Object.keys(data.topProveedores?.reduce((acc: any, p: any) => ({ ...acc, [p.nombre]: 1 }), {}) || {}).length, c: '#185FA5' },
                { l: 'Concentración top 3', v: `${data.concentracion}%`, c: data.concentracion >= 60 ? '#E24B4A' : '#BA7517' },
              ].map(s => (
                <div key={s.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #f8f8f8', fontSize: 13 }}>
                  <span style={{ color: '#666' }}>{s.l}</span>
                  <span style={{ fontWeight: 600, color: s.c }}>{s.v}</span>
                </div>
              ))}
            </div>

            <div style={{ background: '#fff', border: '0.5px solid #ebebeb', borderRadius: 12, padding: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Alertas de dependencia</div>
              <div style={{ fontSize: 12, color: '#aaa', marginBottom: 14 }}>Proveedores que superan el 10% del gasto total</div>
              {data.topProveedores?.filter((p: any) => data.totalCompromiso > 0 && p.total / data.totalCompromiso > 0.10).slice(0, 5).map((p: any, i: number) => {
                const pct = (p.total / data.totalCompromiso * 100).toFixed(1)
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: '#FAEEDA', borderRadius: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: '#633806', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nombre}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#633806' }}>{pct}%</span>
                  </div>
                )
              })}
              {data.topProveedores?.filter((p: any) => data.totalCompromiso > 0 && p.total / data.totalCompromiso > 0.10).length === 0 && (
                <div style={{ fontSize: 12, color: '#27500A' }}>✓ Sin concentración excesiva en un solo proveedor</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
