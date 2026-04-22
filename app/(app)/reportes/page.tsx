'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth'

// ============================================================
// REPORTES EJECUTIVOS
// Análisis de datos para decisiones estratégicas.
// ============================================================

export default function ReportesPage() {
  const { usuario } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>({})
  const [rangoFecha, setRangoFecha] = useState<'mes' | 'trimestre' | 'año' | 'todo'>('mes')

  useEffect(() => {
    if (!usuario) {
      router.push('/login')
      return
    }
    if (!['admin_compras', 'gerencia'].includes(usuario.rol)) {
      router.push('/')
      return
    }
    cargar()
  }, [usuario, rangoFecha])

  const cargar = async () => {
    setLoading(true)
    try {
      // Calcular fecha de corte
      const ahora = new Date()
      let desde: Date | null = null
      if (rangoFecha === 'mes') desde = new Date(ahora.getFullYear(), ahora.getMonth(), 1)
      else if (rangoFecha === 'trimestre') desde = new Date(ahora.getFullYear(), ahora.getMonth() - 3, 1)
      else if (rangoFecha === 'año') desde = new Date(ahora.getFullYear(), 0, 1)

      // === TRAER DATOS ===
      let qSol = supabase.from('solicitudes').select('*')
      let qOf = supabase.from('ordenes_facturacion').select('*')
      if (desde) {
        qSol = qSol.gte('created_at', desde.toISOString())
        qOf = qOf.gte('created_at', desde.toISOString())
      }

      const [{ data: sols }, { data: ofs }] = await Promise.all([qSol, qOf])

      if (!sols) {
        setLoading(false)
        return
      }

      // Enriquecer con items y users
      const sIds = sols.map(s => s.id)
      const userIds = [...new Set(sols.map(s => s.solicitante_id))]
      const [{ data: items }, { data: users }] = await Promise.all([
        sIds.length > 0 ? supabase.from('items_solicitud').select('*').in('solicitud_id', sIds) : Promise.resolve({ data: [] }),
        userIds.length > 0 ? supabase.from('usuarios').select('id, nombre, rol, area').in('id', userIds) : Promise.resolve({ data: [] })
      ])

      const solsEnriched = sols.map(s => {
        const its = (items || []).filter((i: any) => i.solicitud_id === s.id)
        const monto = its.reduce((sum: number, i: any) => sum + (parseFloat(i.presupuesto_estimado) || 0), 0)
        return {
          ...s,
          monto,
          solicitante: (users || []).find((u: any) => u.id === s.solicitante_id)
        }
      })

      // === ANÁLISIS ===

      // 1. Totales
      const totalGastoSolicitudes = solsEnriched.reduce((s, sol) => s + sol.monto, 0)
      const totalGastoOFs = (ofs || []).reduce((s: number, of: any) => s + (parseFloat(of.valor_total) || 0), 0)
      const totalPagado = (ofs || [])
        .filter((of: any) => ['PAGADO', 'PAGADA'].includes(of.estado_pago))
        .reduce((s: number, of: any) => s + (parseFloat(of.valor_total) || 0), 0)

      // 2. Por estado
      const porEstado: Record<string, number> = {}
      solsEnriched.forEach(s => {
        porEstado[s.estado] = (porEstado[s.estado] || 0) + 1
      })

      // 3. Top solicitantes
      const porSolicitante: Record<string, { nombre: string; cantidad: number; monto: number }> = {}
      solsEnriched.forEach(s => {
        const key = s.solicitante?.nombre || 'Desconocido'
        if (!porSolicitante[key]) porSolicitante[key] = { nombre: key, cantidad: 0, monto: 0 }
        porSolicitante[key].cantidad++
        porSolicitante[key].monto += s.monto
      })
      const topSolicitantes = Object.values(porSolicitante).sort((a, b) => b.monto - a.monto).slice(0, 10)

      // 4. Por centro de costo
      const porCentro: Record<string, { nombre: string; cantidad: number; monto: number }> = {}
      solsEnriched.forEach(s => {
        const key = s.centro_costo || 'Sin centro'
        if (!porCentro[key]) porCentro[key] = { nombre: key, cantidad: 0, monto: 0 }
        porCentro[key].cantidad++
        porCentro[key].monto += s.monto
      })
      const topCentros = Object.values(porCentro).sort((a, b) => b.monto - a.monto).slice(0, 10)

      // 5. Tiempos promedio de aprobación (solo si hay updated_at)
      const aprobadas = solsEnriched.filter(s => ['aprobada', 'cotizando', 'ordenada', 'completada'].includes(s.estado) && s.updated_at)
      const tiempos = aprobadas.map(s => {
        const creada = new Date(s.created_at).getTime()
        const actualizada = new Date(s.updated_at).getTime()
        return (actualizada - creada) / (1000 * 60 * 60) // horas
      }).filter(t => t > 0)
      const tiempoPromedioHoras = tiempos.length > 0
        ? Math.round(tiempos.reduce((a, b) => a + b, 0) / tiempos.length)
        : 0

      setData({
        totales: { totalGastoSolicitudes, totalGastoOFs, totalPagado, cantidad: solsEnriched.length, ofs: (ofs || []).length },
        porEstado,
        topSolicitantes,
        topCentros,
        tiempoPromedioHoras
      })
      setLoading(false)
    } catch (err) {
      console.error(err)
      setLoading(false)
    }
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Calculando...</div>
  }

  const { totales = {}, porEstado = {}, topSolicitantes = [], topCentros = [] } = data

  return (
    <div style={{ padding: 32, maxWidth: 1300, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111', margin: 0, marginBottom: 4 }}>
            Reportes ejecutivos
          </h1>
          <div style={{ fontSize: 13, color: '#6b7280' }}>
            Análisis del proceso de compras para decisiones estratégicas
          </div>
        </div>
        <select
          value={rangoFecha}
          onChange={e => setRangoFecha(e.target.value as any)}
          style={{
            padding: '9px 14px', border: '1px solid #d1d5db',
            borderRadius: 4, fontSize: 13, background: '#fff', cursor: 'pointer'
          }}
        >
          <option value="mes">Este mes</option>
          <option value="trimestre">Últimos 3 meses</option>
          <option value="año">Este año</option>
          <option value="todo">Todo el histórico</option>
        </select>
      </div>

      {/* KPIs principales */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        <KPI label="Total solicitudes" valor={totales.cantidad || 0} color="#111" />
        <KPI label="Presupuesto solicitado" valor={`$${((totales.totalGastoSolicitudes || 0) / 1000000).toFixed(1)}M`} color="#185FA5" />
        <KPI label="OFs emitidas" valor={totales.ofs || 0} color="#3730A3" />
        <KPI label="Total pagado" valor={`$${((totales.totalPagado || 0) / 1000000).toFixed(1)}M`} color="#10B981" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Por estado */}
        <Card titulo="Distribución por estado">
          {Object.keys(porEstado).length === 0 ? (
            <EmptyInside texto="Sin datos" />
          ) : (
            Object.entries(porEstado).sort(([, a]: any, [, b]: any) => b - a).map(([estado, cantidad]: any) => {
              const porcentaje = Math.round((cantidad / (totales.cantidad || 1)) * 100)
              return (
                <div key={estado} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                    <span style={{ textTransform: 'capitalize', color: '#374151', fontWeight: 500 }}>
                      {estado}
                    </span>
                    <span style={{ color: '#6b7280' }}>
                      {cantidad} · {porcentaje}%
                    </span>
                  </div>
                  <div style={{ width: '100%', height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', background: '#185FA5',
                      width: `${porcentaje}%`, transition: 'width 0.3s'
                    }} />
                  </div>
                </div>
              )
            })
          )}
        </Card>

        {/* Tiempo promedio */}
        <Card titulo="Eficiencia del proceso">
          <div style={{ padding: '20px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 8 }}>
              TIEMPO PROMEDIO DE APROBACIÓN
            </div>
            <div style={{ fontSize: 36, fontWeight: 700, color: '#185FA5', marginBottom: 4 }}>
              {data.tiempoPromedioHoras < 48
                ? `${data.tiempoPromedioHoras}h`
                : `${Math.round(data.tiempoPromedioHoras / 24)}d`}
            </div>
            <div style={{ fontSize: 12, color: '#9ca3af' }}>
              desde creación hasta aprobación
            </div>
          </div>
        </Card>

        {/* Top solicitantes */}
        <Card titulo="Top solicitantes (por monto)">
          {topSolicitantes.length === 0 ? (
            <EmptyInside texto="Sin datos" />
          ) : (
            topSolicitantes.map((s: any) => (
              <div key={s.nombre} style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '8px 0', borderBottom: '1px solid #f3f4f6',
                fontSize: 12
              }}>
                <span style={{ color: '#111', fontWeight: 500 }}>{s.nombre}</span>
                <span>
                  <span style={{ color: '#6b7280', marginRight: 10 }}>{s.cantidad}</span>
                  <span style={{ fontWeight: 600, color: '#185FA5' }}>
                    ${s.monto.toLocaleString('es-CO')}
                  </span>
                </span>
              </div>
            ))
          )}
        </Card>

        {/* Top centros de costo */}
        <Card titulo="Top centros de costo">
          {topCentros.length === 0 ? (
            <EmptyInside texto="Sin datos" />
          ) : (
            topCentros.map((c: any) => (
              <div key={c.nombre} style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '8px 0', borderBottom: '1px solid #f3f4f6',
                fontSize: 12
              }}>
                <span style={{ color: '#111', fontWeight: 500 }}>{c.nombre}</span>
                <span>
                  <span style={{ color: '#6b7280', marginRight: 10 }}>{c.cantidad}</span>
                  <span style={{ fontWeight: 600, color: '#185FA5' }}>
                    ${c.monto.toLocaleString('es-CO')}
                  </span>
                </span>
              </div>
            ))
          )}
        </Card>
      </div>
    </div>
  )
}

function KPI({ label, valor, color }: any) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', padding: 14, borderRadius: 6 }}>
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{valor}</div>
    </div>
  )
}

function Card({ titulo, children }: any) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: 18 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#111', marginBottom: 14 }}>
        {titulo}
      </div>
      {children}
    </div>
  )
}

function EmptyInside({ texto }: any) {
  return <div style={{ color: '#9ca3af', fontSize: 12, fontStyle: 'italic', padding: 12, textAlign: 'center' }}>{texto}</div>
}
