'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

const fmt = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

export default function AdminPage() {
  const { usuario } = useAuth()
  const [loading, setLoading] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const [stats, setStats] = useState<any>({})

  useEffect(() => { loadStats() }, [])

  async function loadStats() {
    const [
      { count: ofsCount },
      { count: provsCount },
      { count: cotzCount },
      { count: alertasCount },
      { count: scoresCount },
      { count: solicitudesCount },
    ] = await Promise.all([
      supabase.from('ordenes_facturacion').select('*', { count: 'exact', head: true }),
      supabase.from('proveedores').select('*', { count: 'exact', head: true }),
      supabase.from('cotizaciones').select('*', { count: 'exact', head: true }),
      supabase.from('alertas_sistema').select('*', { count: 'exact', head: true }),
      supabase.from('score_compradores').select('*', { count: 'exact', head: true }),
      supabase.from('solicitudes').select('*', { count: 'exact', head: true }),
    ])
    setStats({ ofsCount, provsCount, cotzCount, alertasCount, scoresCount, solicitudesCount })
  }

  function addLog(msg: string) {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()} - ${msg}`])
  }

  async function inicializarSistema() {
    if (!confirm('¿Inicializar todos los datos del sistema? Esto generará alertas, scores y cotizaciones de ejemplo.')) return
    setLoading(true)
    setLogs([])

    try {
      addLog('🚀 Iniciando proceso de inicialización...')

      // 1. GENERAR ALERTAS
      addLog('📊 Generando alertas automáticas...')
      const alertasCreadas = await generarAlertas()
      addLog(`✅ ${alertasCreadas} alertas generadas`)

      // 2. CALCULAR SCORES
      addLog('⭐ Calculando scores de compradores...')
      const scoresCreados = await calcularScores()
      addLog(`✅ ${scoresCreados} scores calculados`)

      // 3. SEED COTIZACIONES
      addLog('💰 Generando cotizaciones de ejemplo...')
      const cotzCreadas = await seedCotizaciones()
      addLog(`✅ ${cotzCreadas} cotizaciones creadas`)

      // 4. SEED SOLICITUDES
      addLog('📝 Generando solicitudes de ejemplo...')
      const solsCreadas = await seedSolicitudes()
      addLog(`✅ ${solsCreadas} solicitudes creadas`)

      addLog('🎉 Inicialización completada con éxito')
      await loadStats()
    } catch (error: any) {
      addLog(`❌ Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  async function generarAlertas() {
    const { data: ofs } = await supabase
      .from('ordenes_facturacion')
      .select('id, codigo_of, valor_total, proveedor_id, encargado_id, solicitante_id, estado_verificacion, created_at, proveedores(razon_social, created_at, total_ordenes)')

    const { data: cotz } = await supabase.from('cotizaciones').select('of_id')
    const { data: existentes } = await supabase.from('alertas_sistema').select('of_id, tipo')

    const existenteSet = new Set((existentes || []).map(e => `${e.of_id}-${e.tipo}`))
    const cotzSet = new Set((cotz || []).map(c => c.of_id))
    const nuevasAlertas: any[] = []
    const ofList = ofs || []

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
            descripcion: `OF ${of_.codigo_of} por ${fmt(Number(of_.valor_total))} no tiene cotizaciones registradas.`,
            of_id: of_.id,
            proveedor_id: of_.proveedor_id,
            monto: Number(of_.valor_total),
            usuario_id: of_.encargado_id,
            estado: 'activo',
          })
        }
      }

      // ALERTA: Proveedor nuevo con alto valor
      const totalOrdenesProveedor = (of_.proveedores as any)?.total_ordenes || 0
      if (Number(of_.valor_total) >= 10000000 && totalOrdenesProveedor <= 2) {
        if (!existenteSet.has(`${of_.id}-proveedor_nuevo`)) {
          nuevasAlertas.push({
            tipo: 'proveedor_nuevo',
            nivel: 'critico',
            titulo: `Proveedor nuevo con OF de alto valor`,
            descripcion: `${(of_.proveedores as any)?.razon_social} tiene ${totalOrdenesProveedor} orden(es) previa(s) y ya tiene OF por ${fmt(Number(of_.valor_total))}.`,
            of_id: of_.id,
            proveedor_id: of_.proveedor_id,
            monto: Number(of_.valor_total),
            usuario_id: of_.encargado_id,
            estado: 'activo',
          })
        }
      }

      // ALERTA: Dependencia excesiva (>30% del gasto en 1 proveedor)
      if (of_.proveedor_id && totalGasto > 0) {
        const pctProveedor = (gastoPorProv[of_.proveedor_id] / totalGasto) * 100
        if (pctProveedor > 30 && !existenteSet.has(`${of_.id}-dependencia`)) {
          nuevasAlertas.push({
            tipo: 'dependencia',
            nivel: 'alto',
            titulo: `Dependencia excesiva — ${(of_.proveedores as any)?.razon_social}`,
            descripcion: `Este proveedor concentra ${pctProveedor.toFixed(1)}% del gasto total (${fmt(gastoPorProv[of_.proveedor_id])}).`,
            of_id: of_.id,
            proveedor_id: of_.proveedor_id,
            monto: gastoPorProv[of_.proveedor_id],
            usuario_id: of_.encargado_id,
            estado: 'activo',
          })
        }
      }

      // ALERTA: Autoaprobación
      if (of_.encargado_id === of_.solicitante_id && Number(of_.valor_total) >= 3000000) {
        if (!existenteSet.has(`${of_.id}-autoaprobacion`)) {
          nuevasAlertas.push({
            tipo: 'autoaprobacion',
            nivel: 'medio',
            titulo: `Autoaprobación — ${of_.codigo_of}`,
            descripcion: `El mismo usuario es encargado y solicitante en OF por ${fmt(Number(of_.valor_total))}.`,
            of_id: of_.id,
            proveedor_id: of_.proveedor_id,
            monto: Number(of_.valor_total),
            usuario_id: of_.encargado_id,
            estado: 'activo',
          })
        }
      }
    }

    if (nuevasAlertas.length > 0) {
      await supabase.from('alertas_sistema').insert(nuevasAlertas)
    }

    return nuevasAlertas.length
  }

  async function calcularScores() {
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

    const periodo = new Date().toISOString().substring(0, 7)
    const cotzByOf: Record<string, any[]> = {}
    ;(cotz || []).forEach(c => {
      if (!cotzByOf[c.of_id]) cotzByOf[c.of_id] = []
      cotzByOf[c.of_id].push(c)
    })

    let scoresCreados = 0

    for (const user of (usuarios || [])) {
      const misOfs = (ofs || []).filter(o => o.encargado_id === user.id)
      const totalOfs = misOfs.length
      if (totalOfs === 0) continue

      const ofsConCotz = misOfs.filter(o => cotzByOf[o.id] && cotzByOf[o.id].length >= 1).length
      const pctCotz = totalOfs > 0 ? Math.round(ofsConCotz / totalOfs * 100) : 0

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

      const misAlertas = (alertas || []).filter(a => a.usuario_id === user.id)
      const alertasCriticas = misAlertas.filter(a => a.nivel === 'critico').length
      const alertasAltas = misAlertas.filter(a => a.nivel === 'alto').length

      const scoreCotiz = Math.min(pctCotz / 10, 10) * 0.35
      const scoreAhorro = ahorro > 0 ? Math.min(ahorro / 5000000, 10) * 0.20 : 0
      const scoreAlertas = Math.max(0, 10 - (alertasCriticas * 2 + alertasAltas * 1)) * 0.25
      const scoreEval = 5 * 0.20 // Default cuando no hay evaluaciones
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

      scoresCreados++
    }

    return scoresCreados
  }

  async function seedCotizaciones() {
    // Generar cotizaciones de ejemplo para OFs >$5M que no tengan
    const { data: ofs } = await supabase
      .from('ordenes_facturacion')
      .select('id, codigo_of, valor_total, proveedor_id, encargado_id')
      .gte('valor_total', 5000000)

    const { data: cotzExistentes } = await supabase.from('cotizaciones').select('of_id')
    const cotzSet = new Set((cotzExistentes || []).map(c => c.of_id))

    const { data: proveedores } = await supabase.from('proveedores').select('id, razon_social').eq('activo', true).limit(50)
    const provsList = proveedores || []

    const nuevasCotz: any[] = []
    
    for (const of_ of (ofs || []).slice(0, 100)) { // Limitar a 100 OFs para no sobrecargar
      if (cotzSet.has(of_.id)) continue

      const numCotiz = Number(of_.valor_total) >= 15000000 ? 3 : 2
      const valorBase = Number(of_.valor_total)

      for (let i = 0; i < numCotiz; i++) {
        const prov = provsList[Math.floor(Math.random() * provsList.length)]
        const variacion = 1 + (Math.random() * 0.2 - 0.1) // ±10%
        const valor = Math.round(valorBase * variacion)

        nuevasCotz.push({
          of_id: of_.id,
          proveedor_id: prov.id,
          valor,
          condiciones: i === 0 ? '30 días' : i === 1 ? '45 días' : '60 días',
          tiempo_entrega: `${5 + i * 2} días hábiles`,
          seleccionada: i === 0, // Primera cotización seleccionada por default
          registrado_por: of_.encargado_id,
          observaciones: `Cotización ${i + 1} de ${numCotiz}`,
        })
      }
    }

    if (nuevasCotz.length > 0) {
      await supabase.from('cotizaciones').insert(nuevasCotz)
    }

    return nuevasCotz.length
  }

  async function seedSolicitudes() {
    // Generar solicitudes de ejemplo
    const { data: usuarios } = await supabase.from('usuarios').select('id')
    const { data: ots } = await supabase.from('ordenes_trabajo').select('id').limit(20)

    if (!usuarios || !ots || usuarios.length === 0 || ots.length === 0) return 0

    const solicitudes = [
      { titulo: 'Material eléctrico para OT-2024-001', descripcion: 'Cables, tomas, breakers', monto_estimado: 3500000, prioridad: 'alta' },
      { titulo: 'Servicio de catering evento corporativo', descripcion: 'Catering para 50 personas', monto_estimado: 2800000, prioridad: 'media' },
      { titulo: 'Reparación equipos audiovisuales', descripcion: 'Mantenimiento proyectores sala 3', monto_estimado: 1500000, prioridad: 'baja' },
      { titulo: 'Compra laptops equipo marketing', descripcion: '3 laptops HP ProBook', monto_estimado: 12000000, prioridad: 'alta' },
      { titulo: 'Material de construcción obra', descripcion: 'Cemento, arena, ladrillos', monto_estimado: 8500000, prioridad: 'media' },
    ]

    const nuevasSols: any[] = []
    solicitudes.forEach((sol, i) => {
      nuevasSols.push({
        ...sol,
        solicitante_id: usuarios[i % usuarios.length].id,
        ot_id: ots[i % ots.length].id,
        estado: i < 2 ? 'aprobada' : i < 4 ? 'en_revision' : 'pendiente',
        fecha_requerida: new Date(Date.now() + (7 + i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      })
    })

    if (nuevasSols.length > 0) {
      await supabase.from('solicitudes').insert(nuevasSols)
    }

    return nuevasSols.length
  }

  if (usuario?.rol !== 'gerencia') {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ background: '#FCEBEB', border: '1px solid #E24B4A', borderRadius: 12, padding: 20, color: '#791F1F' }}>
          ⛔ Solo usuarios con rol <strong>Gerencia</strong> pueden acceder a esta sección.
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 6 }}>Panel de Administración</div>
        <div style={{ fontSize: 14, color: '#666' }}>Inicializar datos del sistema y gestionar configuraciones</div>
      </div>

      {/* Módulos de administración */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 24 }}>
        <a href="/admin/usuarios" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div style={{ background: '#fff', border: '1px solid #ebebeb', borderRadius: 12, padding: 20, cursor: 'pointer', transition: 'all 0.2s' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>👥</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Gestión de Usuarios</div>
            <div style={{ fontSize: 13, color: '#666' }}>Agregar, editar y administrar usuarios del equipo</div>
          </div>
        </a>
        <a href="/admin/catalogo" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div style={{ background: '#fff', border: '1px solid #ebebeb', borderRadius: 12, padding: 20, cursor: 'pointer', transition: 'all 0.2s' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📦</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Catálogo de Servicios</div>
            <div style={{ fontSize: 13, color: '#666' }}>Precios de referencia y control de sobrecostos</div>
          </div>
        </a>
      </div>

      {/* Stats actuales */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Órdenes de Facturación', value: stats.ofsCount || 0, icon: '📋' },
          { label: 'Proveedores', value: stats.provsCount || 0, icon: '🏢' },
          { label: 'Cotizaciones', value: stats.cotzCount || 0, icon: '💰', alert: (stats.cotzCount || 0) === 0 },
          { label: 'Alertas', value: stats.alertasCount || 0, icon: '⚠️', alert: (stats.alertasCount || 0) === 0 },
          { label: 'Scores', value: stats.scoresCount || 0, icon: '⭐', alert: (stats.scoresCount || 0) === 0 },
          { label: 'Solicitudes', value: stats.solicitudesCount || 0, icon: '📝', alert: (stats.solicitudesCount || 0) === 0 },
        ].map(stat => (
          <div key={stat.label} style={{ background: '#fff', border: stat.alert ? '2px solid #E24B4A' : '1px solid #ebebeb', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>{stat.icon}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: stat.alert ? '#E24B4A' : '#1a1a1a', marginBottom: 4 }}>{stat.value}</div>
            <div style={{ fontSize: 12, color: '#666' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Botón principal */}
      <div style={{ background: '#fff', border: '1px solid #ebebeb', borderRadius: 12, padding: 24, marginBottom: 24 }}>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>🚀 Inicialización del Sistema</div>
        <div style={{ fontSize: 14, color: '#666', marginBottom: 20, lineHeight: 1.6 }}>
          Este proceso generará automáticamente:
          <ul style={{ margin: '12px 0', paddingLeft: 24 }}>
            <li>Alertas inteligentes para todas las OFs</li>
            <li>Scores de compradores calculados</li>
            <li>Cotizaciones de ejemplo para OFs que lo requieren</li>
            <li>Solicitudes de ejemplo para demostración</li>
          </ul>
        </div>
        <button
          onClick={inicializarSistema}
          disabled={loading}
          style={{
            background: loading ? '#ccc' : '#185FA5',
            color: '#fff',
            padding: '12px 24px',
            borderRadius: 8,
            border: 'none',
            fontSize: 14,
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? '⏳ Procesando...' : '▶️ Inicializar Sistema Completo'}
        </button>
      </div>

      {/* Logs */}
      {logs.length > 0 && (
        <div style={{ background: '#1a1a1a', color: '#00ff00', borderRadius: 12, padding: 16, fontFamily: 'monospace', fontSize: 12, maxHeight: 400, overflow: 'auto' }}>
          {logs.map((log, i) => (
            <div key={i}>{log}</div>
          ))}
        </div>
      )}
    </div>
  )
}
