'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const fmt = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
const fmtM = (n: number) => `$${new Intl.NumberFormat('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n / 1000000)}M`

const SCORE_COLOR = (s: number) => s >= 8 ? '#27500A' : s >= 6 ? '#185FA5' : s >= 4 ? '#BA7517' : '#E24B4A'
const SCORE_LABEL = (s: number) => s >= 8 ? 'Excelente' : s >= 6 ? 'Bueno' : s >= 4 ? 'Regular' : 'Necesita mejorar'

function ScoreCircle({ score, size = 80 }: { score: number; size?: number }) {
  const color = SCORE_COLOR(score)
  const pct = (score / 10) * 100
  const r = (size / 2) - 6
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f0f0f0" strokeWidth={5} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={5}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: size > 70 ? 20 : 14, fontWeight: 700, color }}>{score.toFixed(1)}</div>
      </div>
    </div>
  )
}

export default function ScorePage() {
  const [scores, setScores] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [calculando, setCalculando] = useState(false)
  const [selected, setSelected] = useState<any>(null)

  useEffect(() => { loadScores() }, [])

  async function loadScores() {
    const { data } = await supabase
      .from('score_compradores')
      .select('*, usuarios(nombre, email, rol, iniciales)')
      .order('score_final', { ascending: false })
    setScores(data || [])
    setLoading(false)
  }

  async function calcularScores() {
    setCalculando(true)

    const { data: usuarios } = await supabase
      .from('usuarios')
      .select('id, nombre, rol')
      .in('rol', ['admin_compras', 'encargado', 'gerencia'])

    const { data: ofs } = await supabase
      .from('ordenes_facturacion')
      .select('id, encargado_id, valor_total, estado_verificacion, created_at')

    const { data: cotz } = await supabase
      .from('cotizaciones')
      .select('of_id, valor, seleccionada, registrado_por')

    const { data: alertas } = await supabase
      .from('alertas_sistema')
      .select('usuario_id, tipo, nivel')
      .eq('estado', 'activo')

    const { data: evaluaciones } = await supabase
      .from('evaluaciones_proveedor')
      .select('evaluador_id, promedio')

    const periodo = new Date().toISOString().substring(0, 7)
    const cotzByOf: Record<string, any[]> = {}
    ;(cotz || []).forEach(c => {
      if (!cotzByOf[c.of_id]) cotzByOf[c.of_id] = []
      cotzByOf[c.of_id].push(c)
    })

    for (const user of (usuarios || [])) {
      const misOfs = (ofs || []).filter(o => o.encargado_id === user.id)
      const totalOfs = misOfs.length
      if (totalOfs === 0) continue

      // % OFs con cotizaciones
      const ofsConCotz = misOfs.filter(o => cotzByOf[o.id] && cotzByOf[o.id].length >= 1).length
      const pctCotz = totalOfs > 0 ? Math.round(ofsConCotz / totalOfs * 100) : 0

      // Ahorro generado
      let ahorro = 0
      misOfs.forEach(o => {
        const c = cotzByOf[o.id] || []
        if (c.length >= 2) {
          const sel = c.find((x: any) => x.seleccionada)
          if (sel) {
            const max = Math.max(...c.map((x: any) => Number(x.valor)))
            ahorro += max - Number(sel.valor)
          }
        }
      })

      // Alertas generadas
      const misAlertas = (alertas || []).filter(a => a.usuario_id === user.id)
      const alertasCriticas = misAlertas.filter(a => a.nivel === 'critico').length
      const alertasAltas = misAlertas.filter(a => a.nivel === 'alto').length

      // Calidad de proveedores seleccionados (score promedio)
      const misEvals = (evaluaciones || []).filter(e => e.evaluador_id === user.id)
      const promedioEval = misEvals.length > 0
        ? misEvals.reduce((s, e) => s + Number(e.promedio), 0) / misEvals.length : 0

      // SCORE FINAL (0-10)
      // Peso: cotizaciones 35%, ahorro 20%, alertas -25%, calidad eval 20%
      const scoreCotiz = Math.min(pctCotz / 10, 10) * 0.35
      const scoreAhorro = ahorro > 0 ? Math.min(ahorro / 5000000, 10) * 0.20 : 0
      const scoreAlertas = Math.max(0, 10 - (alertasCriticas * 2 + alertasAltas * 1)) * 0.25
      const scoreEval = promedioEval > 0 ? promedioEval * 2 * 0.20 : 5 * 0.20
      const scoreFinal = Math.min(10, Math.max(0, scoreCotiz + scoreAhorro + scoreAlertas + scoreEval))

      await supabase.from('score_compradores').upsert({
        usuario_id: user.id,
        periodo,
        total_ofs: totalOfs,
        ofs_con_cotizaciones: ofsConCotz,
        pct_cotizaciones: pctCotz,
        ahorro_generado: ahorro,
        alertas_generadas: misAlertas.length,
        score_final: Math.round(scoreFinal * 10) / 10,
      }, { onConflict: 'usuario_id,periodo' })
    }

    await loadScores()
    setCalculando(false)
  }

  const mejorScore = scores.length > 0 ? Math.max(...scores.map(s => Number(s.score_final))) : 0
  const promedioEquipo = scores.length > 0
    ? scores.reduce((s, x) => s + Number(x.score_final), 0) / scores.length : 0

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 500 }}>Score de comprador</div>
          <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>¿El equipo está comprando bien? — Medición objetiva por persona</div>
        </div>
        <button onClick={calcularScores} disabled={calculando} style={{
          padding: '8px 18px', background: calculando ? '#aaa' : '#1a1a1a',
          color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: calculando ? 'not-allowed' : 'pointer'
        }}>
          {calculando ? 'Calculando...' : '⚡ Calcular scores'}
        </button>
      </div>

      {/* Metodología */}
      <div style={{ background: '#f8f8f8', border: '0.5px solid #ebebeb', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[
          { l: '35%', desc: 'Compras con cotizaciones', c: '#185FA5' },
          { l: '25%', desc: 'Sin alertas activas', c: '#27500A' },
          { l: '20%', desc: 'Ahorro generado', c: '#639922' },
          { l: '20%', desc: 'Calidad de proveedores', c: '#BA7517' },
        ].map(m => (
          <div key={m.l} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: m.c }}>{m.l}</div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{m.desc}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ color: '#aaa', fontSize: 13 }}>Cargando scores...</div>
      ) : scores.length === 0 ? (
        <div style={{ background: '#fff', border: '0.5px solid #ebebeb', borderRadius: 12, padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>📊</div>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>Sin scores calculados</div>
          <div style={{ fontSize: 12, color: '#aaa', marginBottom: 16 }}>Presiona "Calcular scores" para analizar el desempeño del equipo</div>
          <button onClick={calcularScores} style={{ padding: '8px 20px', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
            ⚡ Calcular ahora
          </button>
        </div>
      ) : (
        <div>
          {/* Score promedio equipo */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
            <div style={{ background: '#fff', border: '0.5px solid #ebebeb', borderRadius: 12, padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
              <ScoreCircle score={promedioEquipo} size={72} />
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>Score promedio del equipo</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: SCORE_COLOR(promedioEquipo) }}>{SCORE_LABEL(promedioEquipo)}</div>
                <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{scores.length} compradores evaluados</div>
              </div>
            </div>
            <div style={{ background: '#fff', border: '0.5px solid #ebebeb', borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>Mejor comprador</div>
              {scores[0] && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#EAF3DE', color: '#27500A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>
                    {scores[0].usuarios?.iniciales || '?'}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{scores[0].usuarios?.nombre}</div>
                    <div style={{ fontSize: 12, color: '#27500A', fontWeight: 600 }}>Score {scores[0].score_final}/10</div>
                  </div>
                </div>
              )}
            </div>
            <div style={{ background: '#fff', border: '0.5px solid #ebebeb', borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>Necesita atención</div>
              {scores.filter(s => Number(s.score_final) < 5).length > 0 ? (
                scores.filter(s => Number(s.score_final) < 5).slice(0, 2).map(s => (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontSize: 13 }}>{s.usuarios?.nombre}</div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#E24B4A' }}>{s.score_final}/10</span>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: 13, color: '#27500A' }}>✓ Todo el equipo sobre 5.0</div>
              )}
            </div>
          </div>

          {/* Ranking completo */}
          <div style={{ background: '#fff', border: '0.5px solid #ebebeb', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 18px', borderBottom: '1px solid #f0f0f0', fontSize: 13, fontWeight: 500 }}>
              Ranking del equipo — {new Date().toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['#', 'Comprador', 'Score', 'OFs', '% con cotiz.', 'Ahorro', 'Alertas', 'Desempeño'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 600, color: '#999', borderBottom: '1px solid #f0f0f0', textTransform: 'uppercase', letterSpacing: '.04em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {scores.map((s, i) => {
                  const sc = Number(s.score_final)
                  return (
                    <tr key={s.id} onClick={() => setSelected(selected?.id === s.id ? null : s)} style={{ cursor: 'pointer', background: selected?.id === s.id ? '#f8fbff' : 'white' }}>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #f8f8f8' }}>
                        <div style={{ width: 26, height: 26, borderRadius: '50%', background: i === 0 ? '#185FA5' : i === 1 ? '#639922' : '#f0f0f0', color: i < 2 ? '#fff' : '#666', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
                          {i + 1}
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #f8f8f8' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#f5f5f3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#666' }}>
                            {s.usuarios?.iniciales || '?'}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 500 }}>{s.usuarios?.nombre}</div>
                            <div style={{ fontSize: 11, color: '#aaa' }}>{s.usuarios?.rol}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #f8f8f8' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <ScoreCircle score={sc} size={36} />
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #f8f8f8', fontSize: 14, fontWeight: 500 }}>{s.total_ofs}</td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #f8f8f8' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 5, background: '#f0f0f0', borderRadius: 3 }}>
                            <div style={{ height: '100%', width: `${s.pct_cotizaciones}%`, background: Number(s.pct_cotizaciones) >= 70 ? '#639922' : Number(s.pct_cotizaciones) >= 40 ? '#EF9F27' : '#E24B4A', borderRadius: 3 }} />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 600, color: Number(s.pct_cotizaciones) >= 70 ? '#27500A' : Number(s.pct_cotizaciones) >= 40 ? '#BA7517' : '#E24B4A', minWidth: 36 }}>
                            {s.pct_cotizaciones}%
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #f8f8f8', fontSize: 13, color: Number(s.ahorro_generado) > 0 ? '#27500A' : '#aaa', fontWeight: Number(s.ahorro_generado) > 0 ? 600 : 400 }}>
                        {Number(s.ahorro_generado) > 0 ? fmtM(Number(s.ahorro_generado)) : '—'}
                      </td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #f8f8f8', fontSize: 13, color: s.alertas_generadas > 0 ? '#E24B4A' : '#27500A', fontWeight: 600 }}>
                        {s.alertas_generadas > 0 ? `⚠ ${s.alertas_generadas}` : '✓ 0'}
                      </td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #f8f8f8' }}>
                        <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: sc >= 8 ? '#EAF3DE' : sc >= 6 ? '#E6F1FB' : sc >= 4 ? '#FAEEDA' : '#FCEBEB', color: SCORE_COLOR(sc) }}>
                          {SCORE_LABEL(sc)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Detalle expandido */}
          {selected && (
            <div style={{ background: '#fff', border: '0.5px solid #185FA5', borderRadius: 12, padding: 20, marginTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                <ScoreCircle score={Number(selected.score_final)} size={80} />
                <div>
                  <div style={{ fontSize: 16, fontWeight: 500 }}>{selected.usuarios?.nombre}</div>
                  <div style={{ fontSize: 12, color: '#aaa' }}>{selected.usuarios?.rol} · {selected.periodo}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: SCORE_COLOR(Number(selected.score_final)), marginTop: 4 }}>
                    {SCORE_LABEL(Number(selected.score_final))}
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
                {[
                  { l: 'OFs gestionadas', v: selected.total_ofs, c: '#1a1a1a' },
                  { l: '% con cotizaciones', v: `${selected.pct_cotizaciones}%`, c: Number(selected.pct_cotizaciones) >= 70 ? '#27500A' : '#BA7517' },
                  { l: 'Ahorro generado', v: Number(selected.ahorro_generado) > 0 ? fmtM(Number(selected.ahorro_generado)) : '$0', c: '#27500A' },
                  { l: 'Alertas activas', v: selected.alertas_generadas, c: selected.alertas_generadas > 0 ? '#E24B4A' : '#27500A' },
                ].map(m => (
                  <div key={m.l} style={{ background: '#f8f8f8', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ fontSize: 11, color: '#aaa', marginBottom: 4 }}>{m.l}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: m.c }}>{m.v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
