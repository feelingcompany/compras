'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const fmt = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
const fmtM = (n: number) => `$${new Intl.NumberFormat('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n / 1000000)}M`

const NIVEL_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  critico: { bg: '#FCEBEB', color: '#791F1F', border: '#E24B4A' },
  alto:    { bg: '#FAEEDA', color: '#633806', border: '#EF9F27' },
  medio:   { bg: '#E6F1FB', color: '#0C447C', border: '#185FA5' },
}

const TIPO_LABEL: Record<string, string> = {
  fraccionamiento:   'Fraccionamiento',
  proveedor_nuevo:   'Proveedor nuevo alto valor',
  sin_cotizacion:    'Sin cotizaciones',
  dependencia:       'Dependencia excesiva',
  precio_inflado:    'Precio inflado',
  compra_urgente:    'Compra urgente recurrente',
  autoaprobacion:    'Autoaprobación',
}

export default function AlertasPage() {
  const [alertas, setAlertas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [generando, setGenerando] = useState(false)
  const [filtro, setFiltro] = useState('todos')
  const [detalle, setDetalle] = useState<any>(null)

  useEffect(() => { loadAlertas() }, [])

  async function loadAlertas() {
    const { data } = await supabase
      .from('alertas_sistema')
      .select('*, ordenes_facturacion(codigo_of, valor_total), proveedores(razon_social), usuarios(nombre)')
      .order('created_at', { ascending: false })
    setAlertas(data || [])
    setLoading(false)
  }

  async function generarAlertas() {
    setGenerando(true)

    // 1. Cargar datos necesarios
    const { data: ofs } = await supabase
      .from('ordenes_facturacion')
      .select('id, codigo_of, valor_total, proveedor_id, encargado_id, solicitante_id, estado_verificacion, created_at, proveedores(razon_social, created_at, total_ordenes)')

    const { data: cotz } = await supabase
      .from('cotizaciones')
      .select('of_id')

    const { data: existentes } = await supabase
      .from('alertas_sistema')
      .select('of_id, tipo')

    const existenteSet = new Set((existentes || []).map(e => `${e.of_id}-${e.tipo}`))
    const cotzSet = new Set((cotz || []).map(c => c.of_id))
    const nuevasAlertas: any[] = []
    const ofList = ofs || []

    // 2. Calcular gasto total por proveedor
    const gastoPorProv: Record<string, number> = {}
    let totalGasto = 0
    ofList.forEach(o => {
      if (o.proveedor_id) {
        gastoPorProv[o.proveedor_id] = (gastoPorProv[o.proveedor_id] || 0) + Number(o.valor_total)
        totalGasto += Number(o.valor_total)
      }
    })

    for (const of_ of ofList) {
      // ALERTA: Sin cotizaciones en OFs >$5M
      if (Number(of_.valor_total) >= 5000000 && !cotzSet.has(of_.id)) {
        if (!existenteSet.has(`${of_.id}-sin_cotizacion`)) {
          nuevasAlertas.push({
            tipo: 'sin_cotizacion',
            nivel: Number(of_.valor_total) >= 15000000 ? 'critico' : 'alto',
            titulo: `Sin cotizaciones — ${(of_.proveedores as any)?.razon_social || of_.codigo_of}`,
            descripcion: `OF ${of_.codigo_of} por ${fmt(Number(of_.valor_total))} no tiene cotizaciones registradas. Monto supera umbral obligatorio.`,
            of_id: of_.id,
            proveedor_id: of_.proveedor_id,
            monto: Number(of_.valor_total),
          })
        }
      }

      // ALERTA: Proveedor nuevo con alto valor (creado recientemente con OF >$10M)
      const provCreatedAt = (of_.proveedores as any)?.created_at
      const totalOrdenesProveedor = (of_.proveedores as any)?.total_ordenes || 0
      if (Number(of_.valor_total) >= 10000000 && totalOrdenesProveedor <= 2) {
        if (!existenteSet.has(`${of_.id}-proveedor_nuevo`)) {
          nuevasAlertas.push({
            tipo: 'proveedor_nuevo',
            nivel: 'critico',
            titulo: `Proveedor nuevo con OF de alto valor`,
            descripcion: `${(of_.proveedores as any)?.razon_social} tiene ${totalOrdenesProveedor} orden(es) previa(s) y ya tiene OF por ${fmt(Number(of_.valor_total))}. Verificar NIT en DIAN.`,
            of_id: of_.id,
            proveedor_id: of_.proveedor_id,
            monto: Number(of_.valor_total),
          })
        }
      }

      // ALERTA: Autoaprobación (solicitante = encargado)
      if (of_.solicitante_id && of_.encargado_id && of_.solicitante_id === of_.encargado_id) {
        if (!existenteSet.has(`${of_.id}-autoaprobacion`)) {
          nuevasAlertas.push({
            tipo: 'autoaprobacion',
            nivel: 'critico',
            titulo: `Autoaprobación detectada — ${of_.codigo_of}`,
            descripcion: `Solicitante y encargado son la misma persona en OF ${of_.codigo_of} por ${fmt(Number(of_.valor_total))}. Viola segregación de funciones.`,
            of_id: of_.id,
            proveedor_id: of_.proveedor_id,
            usuario_id: of_.solicitante_id,
            monto: Number(of_.valor_total),
          })
        }
      }
    }

    // 3. Dependencia excesiva (proveedor >35% del gasto total)
    for (const [provId, gasto] of Object.entries(gastoPorProv)) {
      const pct = totalGasto > 0 ? gasto / totalGasto : 0
      if (pct >= 0.35) {
        const provOfs = ofList.filter(o => o.proveedor_id === provId)
        const nombreProv = (provOfs[0]?.proveedores as any)?.razon_social || 'Proveedor'
        const key = `dep-${provId}`
        if (!existenteSet.has(`null-dependencia`) && !nuevasAlertas.find(a => a.tipo === 'dependencia' && a.proveedor_id === provId)) {
          nuevasAlertas.push({
            tipo: 'dependencia',
            nivel: 'alto',
            titulo: `Dependencia excesiva — ${nombreProv}`,
            descripcion: `${nombreProv} concentra el ${(pct * 100).toFixed(1)}% del gasto total (${fmtM(gasto)} de ${fmtM(totalGasto)}). Supera el umbral recomendado del 35%.`,
            proveedor_id: provId,
            monto: gasto,
          })
        }
      }
    }

    // 4. Fraccionamiento — mismos encargado + proveedor en 48h
    const ofsPorEncProv: Record<string, any[]> = {}
    ofList.forEach(o => {
      const key = `${o.encargado_id}-${o.proveedor_id}`
      if (!ofsPorEncProv[key]) ofsPorEncProv[key] = []
      ofsPorEncProv[key].push(o)
    })
    for (const [key, grupo] of Object.entries(ofsPorEncProv)) {
      if (grupo.length < 3) continue
      const sorted = grupo.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      for (let i = 0; i < sorted.length - 2; i++) {
        const t1 = new Date(sorted[i].created_at).getTime()
        const t3 = new Date(sorted[i + 2].created_at).getTime()
        const diffH = (t3 - t1) / 3600000
        if (diffH <= 48) {
          const suma = sorted.slice(i, i + 3).reduce((s, o) => s + Number(o.valor_total), 0)
          if (suma >= 15000000) {
            const ofId = sorted[i].id
            if (!existenteSet.has(`${ofId}-fraccionamiento`) && !nuevasAlertas.find(a => a.tipo === 'fraccionamiento' && a.of_id === ofId)) {
              nuevasAlertas.push({
                tipo: 'fraccionamiento',
                nivel: 'critico',
                titulo: `Posible fraccionamiento detectado`,
                descripcion: `3 OFs del mismo encargado al mismo proveedor en ${diffH.toFixed(0)}h. Suma total ${fmt(suma)} supera umbral gerencial ($15M).`,
                of_id: ofId,
                proveedor_id: sorted[i].proveedor_id,
                usuario_id: sorted[i].encargado_id,
                monto: suma,
              })
            }
          }
        }
      }
    }

    // Insertar nuevas alertas
    if (nuevasAlertas.length > 0) {
      for (let i = 0; i < nuevasAlertas.length; i += 20) {
        await supabase.from('alertas_sistema').insert(nuevasAlertas.slice(i, i + 20))
      }
    }

    await loadAlertas()
    setGenerando(false)
  }

  async function marcarEstado(id: string, estado: string) {
    await supabase.from('alertas_sistema').update({ estado }).eq('id', id)
    await loadAlertas()
    setDetalle(null)
  }

  const datos = alertas.filter(a => filtro === 'todos' || a.nivel === filtro || a.tipo === filtro)
  const criticos = alertas.filter(a => a.nivel === 'critico' && a.estado === 'activo').length
  const altos = alertas.filter(a => a.nivel === 'alto' && a.estado === 'activo').length
  const activos = alertas.filter(a => a.estado === 'activo').length
  const montoRiesgo = alertas.filter(a => a.estado === 'activo').reduce((s, a) => s + Number(a.monto || 0), 0)

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 500 }}>Alertas inteligentes</div>
          <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>Detección automática de riesgos sobre los datos reales de Feeling</div>
        </div>
        <button onClick={generarAlertas} disabled={generando} style={{
          padding: '8px 18px', background: generando ? '#aaa' : '#1a1a1a',
          color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: generando ? 'not-allowed' : 'pointer'
        }}>
          {generando ? 'Analizando...' : '⚡ Analizar ahora'}
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { l: 'Alertas críticas', v: criticos, c: '#E24B4A', bg: '#FCEBEB' },
          { l: 'Alertas altas', v: altos, c: '#BA7517', bg: '#FAEEDA' },
          { l: 'Activas total', v: activos, c: '#1a1a1a', bg: '#fff' },
          { l: 'Monto en riesgo', v: montoRiesgo > 0 ? fmtM(montoRiesgo) : '$0', c: '#E24B4A', bg: '#fff' },
        ].map(s => (
          <div key={s.l} style={{ background: s.bg, border: '0.5px solid #ebebeb', borderRadius: 12, padding: '12px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 5 }}>{s.l}</div>
            <div style={{ fontSize: 24, fontWeight: 500, color: s.c }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { id: 'todos', label: 'Todas' },
          { id: 'critico', label: 'Críticas' },
          { id: 'alto', label: 'Altas' },
          { id: 'fraccionamiento', label: 'Fraccionamiento' },
          { id: 'sin_cotizacion', label: 'Sin cotización' },
          { id: 'proveedor_nuevo', label: 'Prov. nuevo' },
          { id: 'autoaprobacion', label: 'Autoaprobación' },
          { id: 'dependencia', label: 'Dependencia' },
        ].map(f => (
          <button key={f.id} onClick={() => setFiltro(f.id)} style={{
            padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500,
            border: '0.5px solid', cursor: 'pointer',
            background: filtro === f.id ? '#1a1a1a' : '#fff',
            color: filtro === f.id ? '#fff' : '#666',
            borderColor: filtro === f.id ? '#1a1a1a' : '#ddd',
          }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Lista alertas */}
      {loading ? (
        <div style={{ color: '#aaa', fontSize: 13 }}>Cargando alertas...</div>
      ) : datos.length === 0 ? (
        <div style={{ background: '#fff', border: '0.5px solid #ebebeb', borderRadius: 12, padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>✓</div>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>
            {alertas.length === 0 ? 'Sin alertas generadas aún' : 'Sin alertas en este filtro'}
          </div>
          <div style={{ fontSize: 12, color: '#aaa' }}>
            {alertas.length === 0 ? 'Presiona "Analizar ahora" para detectar riesgos en las 929 OFs' : 'Prueba con otro filtro'}
          </div>
        </div>
      ) : (
        <div>
          {datos.map(a => {
            const nc = NIVEL_STYLE[a.nivel] || NIVEL_STYLE.medio
            const isActiva = a.estado === 'activo'
            return (
              <div key={a.id} onClick={() => setDetalle(a)} style={{
                background: '#fff', border: '0.5px solid #ebebeb',
                borderLeft: `3px solid ${isActiva ? nc.border : '#ddd'}`,
                borderRadius: 10, padding: '12px 16px', marginBottom: 8,
                cursor: 'pointer', opacity: isActiva ? 1 : 0.5,
                transition: 'background .1s'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: nc.bg, color: nc.color }}>
                      {a.nivel.toUpperCase()}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{a.titulo}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {a.monto > 0 && <span style={{ fontSize: 12, fontWeight: 600, color: '#E24B4A' }}>{fmtM(Number(a.monto))}</span>}
                    {!isActiva && <span style={{ fontSize: 10, color: '#aaa', background: '#f0f0f0', padding: '2px 6px', borderRadius: 4 }}>{a.estado}</span>}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: '#666', lineHeight: 1.5, marginBottom: 6 }}>{a.descripcion}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 10, background: '#f0f0f0', color: '#666', padding: '1px 6px', borderRadius: 3 }}>
                    {TIPO_LABEL[a.tipo] || a.tipo}
                  </span>
                  {a.ordenes_facturacion?.codigo_of && (
                    <span style={{ fontFamily: 'monospace', fontSize: 10, background: '#f0f0f0', color: '#666', padding: '1px 6px', borderRadius: 3 }}>
                      {a.ordenes_facturacion.codigo_of}
                    </span>
                  )}
                  <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#bbb', padding: '1px 0' }}>
                    {new Date(a.created_at).toLocaleDateString('es-CO')}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal detalle */}
      {detalle && (
        <div onClick={() => setDetalle(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 60 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, padding: 28, width: 500 }}>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 16 }}>{detalle.titulo}</div>
            {[
              ['Nivel', <span style={{ fontWeight: 600, color: NIVEL_STYLE[detalle.nivel]?.color }}>{detalle.nivel.toUpperCase()}</span>],
              ['Tipo', TIPO_LABEL[detalle.tipo] || detalle.tipo],
              ['OF', detalle.ordenes_facturacion?.codigo_of || '—'],
              ['Proveedor', detalle.proveedores?.razon_social || '—'],
              ['Monto en riesgo', detalle.monto > 0 ? fmt(Number(detalle.monto)) : '—'],
              ['Estado', detalle.estado],
              ['Fecha', new Date(detalle.created_at).toLocaleDateString('es-CO')],
            ].map(([l, v]: any) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f8f8f8', fontSize: 13 }}>
                <span style={{ color: '#888' }}>{l}</span><span style={{ fontWeight: 500 }}>{v}</span>
              </div>
            ))}
            <div style={{ padding: '10px 12px', background: '#f8f8f8', borderRadius: 8, marginTop: 14, fontSize: 13, lineHeight: 1.6 }}>
              {detalle.descripcion}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button onClick={() => setDetalle(null)} style={{ padding: '7px 14px', border: '0.5px solid #ddd', borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer' }}>Cerrar</button>
              {detalle.estado === 'activo' && <>
                <button onClick={() => marcarEstado(detalle.id, 'falso_positivo')} style={{ padding: '7px 14px', border: '0.5px solid #ddd', borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer' }}>Falso positivo</button>
                <button onClick={() => marcarEstado(detalle.id, 'revisado')} style={{ padding: '7px 14px', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>✓ Marcar revisado</button>
              </>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
