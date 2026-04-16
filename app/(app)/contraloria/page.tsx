'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const HALLAZGOS_SEED = [
  { id: 'H001', nivel: 'critico', tipo: 'fraccionamiento', titulo: 'Fraccionamiento detectado — VLAM GROUP', desc: '3 OFs del mismo encargado al mismo proveedor en 48h. Suma $21.3M supera umbral gerencial ($15M).', encargado: 'Laura Gómez', proveedor: 'VLAM GROUP', monto: '$21.3M', fecha: '2026-04-07', accion: 'Requiere aprobación gerencia retroactiva', estado: 'activo' },
  { id: 'H002', nivel: 'critico', tipo: 'autoaprobacion', titulo: 'Autoaprobación — OF 02004FE26', desc: 'Andrés Mora figura como solicitante Y encargado en la misma OF por $6.8M. Viola segregación de funciones.', encargado: 'Andrés Mora', proveedor: 'TRIPTICA SAS', monto: '$6.8M', fecha: '2026-03-15', accion: 'Anular OF o reasignar encargado', estado: 'activo' },
  { id: 'H003', nivel: 'critico', tipo: 'fantasma', titulo: 'Proveedor sin historial — OF de $18.5M', desc: 'DISTRIBUCIONES XT creado hace 3 días. Primera OF por $18.5M. NIT no verificado en DIAN.', encargado: 'Laura Gómez', proveedor: 'DISTRIBUCIONES XT', monto: '$18.5M', fecha: '2026-04-08', accion: 'Verificar NIT en DIAN antes de aprobar', estado: 'activo' },
  { id: 'H004', nivel: 'alto', tipo: 'duplicada', titulo: 'Posible factura duplicada — SERVITAC LTDA', desc: 'Dos OFs mismo proveedor, mismo monto $4.1M, diferencia 6 días. Descripción idéntica.', encargado: 'Andrés Mora', proveedor: 'SERVITAC LTDA', monto: '$4.1M', fecha: '2026-03-28', accion: 'Cruzar facturas físicas', estado: 'activo' },
  { id: 'H005', nivel: 'alto', tipo: 'precio', titulo: 'Precio inflado +38% — Audiovisual', desc: 'VLAM GROUP cobró $8.7M. Precio histórico: $6.3M. Desviación +38%, supera umbral +25%.', encargado: 'Laura Gómez', proveedor: 'VLAM GROUP', monto: '$8.7M', fecha: '2026-03-20', accion: 'Solicitar cotizaciones comparativas', estado: 'activo' },
  { id: 'H006', nivel: 'alto', tipo: 'horario', titulo: 'Pago fuera de horario laboral', desc: 'Pago $12.3M registrado domingo a las 23:47. IP diferente a la habitual.', encargado: 'Diego Restrepo', proveedor: 'ALLY MEDIA', monto: '$12.3M', fecha: '2026-04-06', accion: 'Confirmar con Diego Restrepo', estado: 'activo' },
]

const nivelColor: Record<string, { bg: string; text: string; border: string }> = {
  critico: { bg: '#FCEBEB', text: '#791F1F', border: '#E24B4A' },
  alto: { bg: '#FAEEDA', text: '#633806', border: '#EF9F27' },
  medio: { bg: '#E6F1FB', text: '#0C447C', border: '#185FA5' },
}

const tipoLabel: Record<string, string> = {
  fraccionamiento: 'Fraccionamiento', autoaprobacion: 'Autoaprobación',
  fantasma: 'Proveedor fantasma', duplicada: 'Factura duplicada',
  precio: 'Precio inflado', horario: 'Horario inusual',
}

export default function ContraloriaPage() {
  const [filtro, setFiltro] = useState('todos')
  const [detalle, setDetalle] = useState<any>(null)
  const [hallazgos, setHallazgos] = useState(HALLAZGOS_SEED)

  const datos = hallazgos.filter(h => filtro === 'todos' || h.nivel === filtro)

  const criticos = hallazgos.filter(h => h.nivel === 'critico').length
  const altos = hallazgos.filter(h => h.nivel === 'alto').length

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 17, fontWeight: 500 }}>Contraloría</div>
        <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>Detección automática de riesgos y hallazgos</div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        {[
          { label: 'Hallazgos críticos', value: criticos, color: '#E24B4A' },
          { label: 'Hallazgos altos', value: altos, color: '#EF9F27' },
          { label: 'Score de riesgo', value: '6.2/10', color: '#BA7517' },
          { label: 'Monto en riesgo', value: '$71.6M', color: '#E24B4A' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '0.5px solid #ebebeb', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 24, fontWeight: 500, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['todos', 'critico', 'alto', 'medio'].map(f => (
          <button key={f} onClick={() => setFiltro(f)} style={{
            padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
            border: '0.5px solid', cursor: 'pointer',
            background: filtro === f ? '#1a1a1a' : '#fff',
            color: filtro === f ? '#fff' : '#666',
            borderColor: filtro === f ? '#1a1a1a' : '#ddd',
          }}>
            {f === 'todos' ? 'Todos' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Lista hallazgos */}
      <div style={{ marginBottom: 20 }}>
        {datos.map(h => {
          const nc = nivelColor[h.nivel] || nivelColor.medio
          return (
            <div key={h.id} onClick={() => setDetalle(h)} style={{
              borderRadius: 10, borderLeft: `3px solid ${nc.border}`,
              padding: '12px 16px', marginBottom: 8, background: '#fff',
              border: `0.5px solid #ebebeb`, borderLeftColor: nc.border,
              cursor: 'pointer', transition: 'background .1s'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{h.titulo}</div>
                <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: nc.bg, color: nc.text, whiteSpace: 'nowrap' }}>
                  {h.nivel.toUpperCase()}
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#666', lineHeight: 1.5, marginBottom: 8 }}>{h.desc}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[h.id, h.encargado, h.monto, h.fecha, tipoLabel[h.tipo]].map((v, i) => (
                  <span key={i} style={{ display: 'inline-block', padding: '1px 6px', borderRadius: 3, fontSize: 11, background: '#f0f0f0', color: '#666', fontFamily: 'monospace' }}>{v}</span>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Riesgo por encargado */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ background: '#fff', border: '0.5px solid #ebebeb', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Riesgo por encargado</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Nivel', 'Encargado', 'OFs', 'Hallazgos', 'Monto'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '6px 8px', fontSize: 11, fontWeight: 600, color: '#999', borderBottom: '1px solid #f0f0f0', textTransform: 'uppercase', letterSpacing: '.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { n: 'Laura Gómez', r: 'C', rc: '#FCEBEB', tc: '#791F1F', ofs: 38, h: 4, m: '$47.2M' },
                { n: 'Andrés Mora', r: 'A', rc: '#FAEEDA', tc: '#633806', ofs: 29, h: 2, m: '$28.1M' },
                { n: 'Diego Restrepo', r: 'M', rc: '#E6F1FB', tc: '#0C447C', ofs: 9, h: 1, m: '$8.7M' },
                { n: 'Valentina Cruz', r: 'L', rc: '#EAF3DE', tc: '#27500A', ofs: 14, h: 0, m: '$12.3M' },
              ].map(u => (
                <tr key={u.n}>
                  <td style={{ padding: '7px 8px', borderBottom: '1px solid #f8f8f8' }}>
                    <div style={{ width: 26, height: 26, borderRadius: '50%', background: u.rc, color: u.tc, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{u.r}</div>
                  </td>
                  <td style={{ padding: '7px 8px', borderBottom: '1px solid #f8f8f8', fontSize: 13, fontWeight: 500 }}>{u.n}</td>
                  <td style={{ padding: '7px 8px', borderBottom: '1px solid #f8f8f8', fontSize: 13 }}>{u.ofs}</td>
                  <td style={{ padding: '7px 8px', borderBottom: '1px solid #f8f8f8', fontSize: 13, color: u.h > 0 ? '#E24B4A' : '#27500A', fontWeight: 600 }}>{u.h}</td>
                  <td style={{ padding: '7px 8px', borderBottom: '1px solid #f8f8f8', fontSize: 13 }}>{u.m}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ background: '#fff', border: '0.5px solid #ebebeb', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Score de riesgo global</div>
          <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
            <div style={{ fontSize: 44, fontWeight: 500, color: '#BA7517' }}>6.2</div>
            <div style={{ fontSize: 12, color: '#888' }}>de 10 · Riesgo moderado-alto</div>
          </div>
          {[
            { l: 'Segregación de funciones', v: 8.5, c: '#E24B4A' },
            { l: 'Control de proveedores', v: 6.0, c: '#EF9F27' },
            { l: 'Trazabilidad de pagos', v: 5.5, c: '#EF9F27' },
            { l: 'Control de precios', v: 4.0, c: '#185FA5' },
            { l: 'Horarios y ciclos', v: 2.0, c: '#639922' },
          ].map(({ l, v, c }) => (
            <div key={l} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#888', marginBottom: 3 }}>
                <span>{l}</span><span style={{ fontWeight: 600, color: c }}>{v}</span>
              </div>
              <div style={{ height: 5, background: '#f0f0f0', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${v * 10}%`, background: c, borderRadius: 3 }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal detalle */}
      {detalle && (
        <div onClick={() => setDetalle(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 60 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #eee', padding: 24, width: 480, maxHeight: '78vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 16 }}>{detalle.titulo}</div>
            {[
              ['ID', detalle.id], ['Nivel', detalle.nivel.toUpperCase()], ['Tipo', tipoLabel[detalle.tipo]],
              ['Encargado', detalle.encargado], ['Proveedor', detalle.proveedor],
              ['Monto en riesgo', detalle.monto], ['Fecha', detalle.fecha],
            ].map(([l, v]) => (
              <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f8f8f8', fontSize: 13 }}>
                <span style={{ color: '#888' }}>{l}</span>
                <span style={{ fontWeight: 500 }}>{v}</span>
              </div>
            ))}
            <div style={{ marginTop: 14, padding: 12, background: '#f8f8f8', borderRadius: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#aaa', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.04em' }}>Acción recomendada</div>
              <div style={{ fontSize: 13 }}>{detalle.accion}</div>
            </div>
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setDetalle(null)} style={{ padding: '7px 16px', border: '0.5px solid #ddd', borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer' }}>Cerrar</button>
              <button onClick={() => setDetalle(null)} style={{ padding: '7px 16px', border: '0.5px solid #F09595', borderRadius: 8, background: '#FCEBEB', color: '#791F1F', fontSize: 13, cursor: 'pointer' }}>Escalar a gerencia</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
