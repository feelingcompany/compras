'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth'

// ============================================================
// INICIO PERSONALIZADO POR ROL
// 
// - Solicitante: pedir compras, ver estado de las suyas
// - Encargado: aprobar solicitudes de su área
// - Admin Compras: operar el proceso completo (rol protagonista)
// - Gerencia: KPIs ejecutivos
// ============================================================

export default function InicioPage() {
  const { usuario } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>({})

  useEffect(() => {
    if (!usuario) {
      router.push('/login')
      return
    }
    cargar()
  }, [usuario])

  const cargar = async () => {
    if (!usuario) return

    try {
      // ========== DATOS COMUNES ==========
      const queries: any = {}

      // Solicitudes del usuario (si es solicitante)
      if (usuario.rol === 'solicitante') {
        const { data: mias } = await supabase
          .from('solicitudes')
          .select('*')
          .eq('solicitante_id', usuario.id)
          .order('created_at', { ascending: false })
          .limit(10)
        queries.misSolicitudes = mias || []
      }

      // Aprobaciones pendientes (encargado/admin/gerencia)
      if (['encargado', 'admin_compras', 'gerencia'].includes(usuario.rol)) {
        const { data: aprs } = await supabase
          .from('aprobaciones')
          .select('*')
          .eq('aprobador_id', usuario.id)
          .eq('estado', 'pendiente')
        
        if (aprs && aprs.length > 0) {
          const solicitudIds = aprs.map(a => a.solicitud_id)
          const { data: sols } = await supabase
            .from('solicitudes').select('*').in('id', solicitudIds)
          const { data: items } = await supabase
            .from('items_solicitud').select('*').in('solicitud_id', solicitudIds)
          const solicitanteIds = [...new Set((sols || []).map(s => s.solicitante_id))]
          const { data: users } = await supabase
            .from('usuarios').select('id, nombre').in('id', solicitanteIds)
          
          queries.aprobaciones = aprs.map(apr => {
            const sol = (sols || []).find(s => s.id === apr.solicitud_id)
            const solicitante = (users || []).find(u => u.id === sol?.solicitante_id)
            const solItems = (items || []).filter(i => i.solicitud_id === apr.solicitud_id)
            const monto = solItems.reduce((s, i) => s + (parseFloat(i.presupuesto_estimado) || 0), 0)
            return { ...apr, solicitud: sol, solicitante, monto }
          })
        } else {
          queries.aprobaciones = []
        }
      }

      // ========== DATOS ESPECÍFICOS DEL LÍDER DE COMPRAS ==========
      if (['admin_compras', 'gerencia'].includes(usuario.rol)) {
        
        // 1. Solicitudes APROBADAS que esperan cotización (SU BANDEJA)
        const { data: paraCotizar } = await supabase
          .from('solicitudes')
          .select('*')
          .eq('estado', 'aprobada')
          .order('created_at', { ascending: false })
          .limit(8)

        if (paraCotizar && paraCotizar.length > 0) {
          const ids = paraCotizar.map(s => s.id)
          const { data: items } = await supabase
            .from('items_solicitud').select('*').in('solicitud_id', ids)
          const solicitanteIds = [...new Set(paraCotizar.map(s => s.solicitante_id))]
          const { data: users } = await supabase
            .from('usuarios').select('id, nombre').in('id', solicitanteIds)

          queries.paraCotizar = paraCotizar.map(s => {
            const solItems = (items || []).filter(i => i.solicitud_id === s.id)
            const monto = solItems.reduce((sum, i) => sum + (parseFloat(i.presupuesto_estimado) || 0), 0)
            return {
              ...s,
              monto,
              items_count: solItems.length,
              solicitante: (users || []).find(u => u.id === s.solicitante_id)
            }
          })
        } else {
          queries.paraCotizar = []
        }

        // 2. Cotizaciones abiertas
        try {
          const { data: cotz } = await supabase
            .from('cotizaciones')
            .select('*, proveedores(razon_social)')
            .eq('estado', 'PENDIENTE')
            .order('created_at', { ascending: false })
            .limit(5)
          queries.cotizaciones = cotz || []
        } catch (e) {
          queries.cotizaciones = []
        }

        // 3. OFs en curso
        try {
          const { data: ofs } = await supabase
            .from('ordenes_facturacion')
            .select('*, proveedores(razon_social)')
            .in('estado_verificacion', ['PENDIENTE', 'EN_PROCESO'])
            .order('created_at', { ascending: false })
            .limit(5)
          queries.ofs = ofs || []
        } catch (e) {
          queries.ofs = []
        }

        // 4. Resumen global del proceso
        const [
          { count: totalSolicitudes },
          { count: pendientesAprob },
          { count: aprobadas },
          { count: rechazadas }
        ] = await Promise.all([
          supabase.from('solicitudes').select('*', { count: 'exact', head: true }),
          supabase.from('solicitudes').select('*', { count: 'exact', head: true }).eq('estado', 'pendiente'),
          supabase.from('solicitudes').select('*', { count: 'exact', head: true }).eq('estado', 'aprobada'),
          supabase.from('solicitudes').select('*', { count: 'exact', head: true }).eq('estado', 'rechazada')
        ])
        queries.resumen = { totalSolicitudes, pendientesAprob, aprobadas, rechazadas }
      }

      setData(queries)
      setLoading(false)
    } catch (error) {
      console.error('Error:', error)
      setLoading(false)
    }
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Cargando...</div>
  }

  const saludo = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Buenos días'
    if (h < 19) return 'Buenas tardes'
    return 'Buenas noches'
  })()

  // ============================================================
  // RENDERS POR ROL
  // ============================================================

  if (usuario?.rol === 'solicitante') {
    return <InicioSolicitante usuario={usuario} data={data} router={router} saludo={saludo} />
  }

  if (usuario?.rol === 'encargado') {
    return <InicioEncargado usuario={usuario} data={data} router={router} saludo={saludo} />
  }

  if (usuario?.rol === 'admin_compras') {
    return <InicioLiderCompras usuario={usuario} data={data} router={router} saludo={saludo} />
  }

  if (usuario?.rol === 'gerencia') {
    return <InicioGerencia usuario={usuario} data={data} router={router} saludo={saludo} />
  }

  return null
}

// ============================================================
// INICIO SOLICITANTE
// ============================================================
function InicioSolicitante({ usuario, data, router, saludo }: any) {
  const misSol = data.misSolicitudes || []
  const activas = misSol.filter((s: any) => !['completada', 'rechazada'].includes(s.estado))

  return (
    <div style={{ padding: 32, maxWidth: 900, margin: '0 auto' }}>
      <Header saludo={saludo} nombre={usuario.nombre} subtitulo={
        activas.length > 0
          ? `Tenés ${activas.length} solicitud${activas.length !== 1 ? 'es' : ''} activa${activas.length !== 1 ? 's' : ''}`
          : '¿Necesitás pedir una compra?'
      } />

      <button
        onClick={() => router.push('/solicitudes/nueva')}
        style={{
          padding: '14px 24px', background: '#185FA5', color: '#fff',
          border: 'none', borderRadius: 6, fontSize: 15, fontWeight: 600,
          cursor: 'pointer', marginBottom: 28
        }}
      >
        + Nueva solicitud de compra
      </button>

      <Card titulo="Mis solicitudes" accion="Ver todas" onAccion={() => router.push('/solicitudes')}>
        {misSol.length === 0 ? (
          <EmptyMsg texto="No has creado solicitudes todavía. Empezá con el botón de arriba." />
        ) : (
          misSol.slice(0, 6).map((s: any) => (
            <ItemSolicitud key={s.id} s={s} router={router} />
          ))
        )}
      </Card>
    </div>
  )
}

// ============================================================
// INICIO ENCARGADO (jefe de área que aprueba)
// ============================================================
function InicioEncargado({ usuario, data, router, saludo }: any) {
  const aprob = data.aprobaciones || []

  return (
    <div style={{ padding: 32, maxWidth: 1000, margin: '0 auto' }}>
      <Header saludo={saludo} nombre={usuario.nombre} subtitulo={
        aprob.length > 0
          ? `Tenés ${aprob.length} solicitud${aprob.length !== 1 ? 'es' : ''} esperando tu aprobación`
          : 'No tenés aprobaciones pendientes'
      } />

      <Card
        titulo="Solicitudes para aprobar"
        badge={aprob.length}
        badgeColor="#DC2626"
        accion="Ver todas"
        onAccion={() => router.push('/aprobaciones')}
      >
        {aprob.length === 0 ? (
          <EmptyMsg texto="Todo al día. Las solicitudes de tu equipo aparecerán acá cuando necesiten tu aprobación." />
        ) : (
          aprob.slice(0, 5).map((a: any) => (
            <div key={a.id}
              onClick={() => router.push(`/solicitudes/${a.solicitud_id}`)}
              style={{
                padding: 12, borderLeft: '3px solid #F59E0B',
                background: '#FFFBEB', borderRadius: 4,
                marginBottom: 8, cursor: 'pointer'
              }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontWeight: 600, color: '#111', fontSize: 13 }}>
                  {a.solicitud?.descripcion || 'Sin descripción'}
                </span>
                <span style={{ fontWeight: 700, color: '#185FA5', fontSize: 14 }}>
                  ${a.monto.toLocaleString('es-CO')}
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>
                Por {a.solicitante?.nombre || '—'} · {a.solicitud?.centro_costo || 'Sin centro'}
              </div>
            </div>
          ))
        )}
      </Card>
    </div>
  )
}

// ============================================================
// INICIO LÍDER DE COMPRAS (protagonista del proceso)
// ============================================================
function InicioLiderCompras({ usuario, data, router, saludo }: any) {
  const aprob = data.aprobaciones || []
  const paraCotizar = data.paraCotizar || []
  const cotizaciones = data.cotizaciones || []
  const ofs = data.ofs || []
  const resumen = data.resumen || {}

  const tareasTotales = aprob.length + paraCotizar.length + cotizaciones.length + ofs.length

  return (
    <div style={{ padding: 32, maxWidth: 1300, margin: '0 auto' }}>
      <Header
        saludo={saludo}
        nombre={usuario.nombre}
        subtitulo={tareasTotales > 0
          ? `${tareasTotales} tareas activas en el proceso de compras`
          : 'Todo el proceso está al día'}
      />

      {/* KPIs del proceso */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
        <KPI label="Total solicitudes" valor={resumen.totalSolicitudes || 0} color="#111" />
        <KPI label="Esperando aprobación" valor={resumen.pendientesAprob || 0} color="#F59E0B" />
        <KPI label="Aprobadas (tu bandeja)" valor={resumen.aprobadas || 0} color="#185FA5" />
        <KPI label="Rechazadas" valor={resumen.rechazadas || 0} color="#9ca3af" />
      </div>

      {/* Tu trabajo como líder de compras */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#111', marginBottom: 4 }}>
          Tu bandeja operativa
        </div>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 14 }}>
          El proceso de compras que tenés que articular hoy
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Columna izquierda - Entrada del proceso */}
        <div>
          {/* Paso 1: Aprobar (si te tocan) */}
          {aprob.length > 0 && (
            <Card
              titulo="1. Para aprobar"
              badge={aprob.length}
              badgeColor="#DC2626"
              accion="Ver todas"
              onAccion={() => router.push('/aprobaciones')}
              subtitulo="Solicitudes esperando tu firma"
            >
              {aprob.slice(0, 3).map((a: any) => (
                <div key={a.id}
                  onClick={() => router.push(`/solicitudes/${a.solicitud_id}`)}
                  style={{
                    padding: 10, borderLeft: '3px solid #F59E0B',
                    background: '#FFFBEB', borderRadius: 3,
                    marginBottom: 6, cursor: 'pointer', fontSize: 12
                  }}>
                  <div style={{ fontWeight: 600, color: '#111', marginBottom: 2 }}>
                    {a.solicitud?.descripcion}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                    <span style={{ color: '#6b7280' }}>Por {a.solicitante?.nombre}</span>
                    <span style={{ fontWeight: 600, color: '#185FA5' }}>
                      ${a.monto.toLocaleString('es-CO')}
                    </span>
                  </div>
                </div>
              ))}
            </Card>
          )}

          {/* Paso 2: Cotizar */}
          <Card
            titulo="2. Para cotizar"
            badge={paraCotizar.length}
            badgeColor="#185FA5"
            accion={paraCotizar.length > 0 ? 'Ver todas' : undefined}
            onAccion={() => router.push('/cotizaciones')}
            subtitulo="Solicitudes aprobadas — buscá proveedores"
          >
            {paraCotizar.length === 0 ? (
              <EmptyMsg texto="No hay solicitudes aprobadas esperando cotización" />
            ) : (
              paraCotizar.slice(0, 3).map((s: any) => (
                <div key={s.id}
                  onClick={() => router.push(`/solicitudes/${s.id}`)}
                  style={{
                    padding: 10, borderLeft: '3px solid #185FA5',
                    background: '#EFF6FF', borderRadius: 3,
                    marginBottom: 6, cursor: 'pointer', fontSize: 12
                  }}>
                  <div style={{ fontWeight: 600, color: '#111', marginBottom: 2 }}>
                    {s.descripcion}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                    <span style={{ color: '#6b7280' }}>
                      {s.items_count} ítem{s.items_count !== 1 ? 's' : ''} · {s.centro_costo || '—'}
                    </span>
                    <span style={{ fontWeight: 600, color: '#185FA5' }}>
                      ${s.monto.toLocaleString('es-CO')}
                    </span>
                  </div>
                </div>
              ))
            )}
          </Card>
        </div>

        {/* Columna derecha - Formalización */}
        <div>
          {/* Paso 3: Cotizaciones recibidas */}
          <Card
            titulo="3. Cotizaciones abiertas"
            badge={cotizaciones.length}
            accion={cotizaciones.length > 0 ? 'Ver todas' : undefined}
            onAccion={() => router.push('/cotizaciones')}
            subtitulo="Decidí proveedor"
          >
            {cotizaciones.length === 0 ? (
              <EmptyMsg texto="No hay cotizaciones abiertas" />
            ) : (
              cotizaciones.slice(0, 3).map((c: any) => (
                <div key={c.id} style={{
                  padding: 10, background: '#F9FAFB',
                  borderRadius: 3, marginBottom: 6, fontSize: 12,
                  border: '1px solid #e5e7eb'
                }}>
                  <div style={{ fontWeight: 600, color: '#111' }}>
                    {c.proveedores?.razon_social || 'Sin proveedor'}
                  </div>
                  <div style={{ color: '#185FA5', fontWeight: 600, fontSize: 11, marginTop: 2 }}>
                    ${(c.valor_total || 0).toLocaleString('es-CO')}
                  </div>
                </div>
              ))
            )}
          </Card>

          {/* Paso 4: OFs en curso */}
          <Card
            titulo="4. OFs en curso"
            badge={ofs.length}
            accion={ofs.length > 0 ? 'Ver todas' : undefined}
            onAccion={() => router.push('/ordenes')}
            subtitulo="Órdenes emitidas en ejecución"
          >
            {ofs.length === 0 ? (
              <EmptyMsg texto="No hay OFs en curso" />
            ) : (
              ofs.slice(0, 3).map((of: any) => (
                <div key={of.id}
                  onClick={() => router.push('/ordenes')}
                  style={{
                    padding: 10, background: '#F9FAFB',
                    borderRadius: 3, marginBottom: 6,
                    cursor: 'pointer', fontSize: 12,
                    border: '1px solid #e5e7eb'
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600, color: '#111' }}>
                      {of.codigo_of || 'OF'}
                    </span>
                    <span style={{ fontWeight: 600, color: '#185FA5', fontSize: 11 }}>
                      ${(of.valor_total || 0).toLocaleString('es-CO')}
                    </span>
                  </div>
                  <div style={{ color: '#6b7280', fontSize: 11, marginTop: 2 }}>
                    {of.proveedores?.razon_social || '—'}
                  </div>
                </div>
              ))
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// INICIO GERENCIA (vista ejecutiva)
// ============================================================
function InicioGerencia({ usuario, data, router, saludo }: any) {
  const resumen = data.resumen || {}
  const aprob = data.aprobaciones || []

  return (
    <div style={{ padding: 32, maxWidth: 1300, margin: '0 auto' }}>
      <Header saludo={saludo} nombre={usuario.nombre} subtitulo="Vista ejecutiva del proceso de compras" />

      {/* KPIs ejecutivos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
        <KPI label="Total solicitudes" valor={resumen.totalSolicitudes || 0} color="#111" />
        <KPI label="Pendientes" valor={resumen.pendientesAprob || 0} color="#F59E0B" />
        <KPI label="En ejecución" valor={resumen.aprobadas || 0} color="#185FA5" />
        <KPI label="Rechazadas" valor={resumen.rechazadas || 0} color="#9ca3af" />
      </div>

      {/* Aprobaciones críticas */}
      {aprob.length > 0 && (
        <Card
          titulo="Aprobaciones críticas pendientes"
          badge={aprob.length}
          badgeColor="#DC2626"
          accion="Ver todas"
          onAccion={() => router.push('/aprobaciones')}
        >
          {aprob.slice(0, 5).map((a: any) => (
            <div key={a.id}
              onClick={() => router.push(`/solicitudes/${a.solicitud_id}`)}
              style={{
                padding: 12, borderLeft: '3px solid #DC2626',
                background: '#FEF2F2', borderRadius: 4,
                marginBottom: 8, cursor: 'pointer'
              }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 600, color: '#111', fontSize: 13 }}>
                    {a.solicitud?.descripcion}
                  </div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                    Nivel {a.nivel_aprobacion} · Por {a.solicitante?.nombre}
                  </div>
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#185FA5' }}>
                  ${a.monto.toLocaleString('es-CO')}
                </div>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Acceso rápido a análisis */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 20 }}>
        <BotonAccion label="Dashboard completo" onClick={() => router.push('/dashboard')} />
        <BotonAccion label="Contraloría" onClick={() => router.push('/contraloria')} />
        <BotonAccion label="Auditoría" onClick={() => router.push('/auditoria')} />
      </div>
    </div>
  )
}

// ============================================================
// COMPONENTES AUXILIARES
// ============================================================

function Header({ saludo, nombre, subtitulo }: any) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>{saludo},</div>
      <h1 style={{ fontSize: 26, fontWeight: 700, color: '#111', margin: 0, marginBottom: 6 }}>
        {nombre}
      </h1>
      <div style={{ fontSize: 13, color: '#6b7280' }}>{subtitulo}</div>
    </div>
  )
}

function KPI({ label, valor, color }: any) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', padding: 14, borderRadius: 6 }}>
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{valor}</div>
    </div>
  )
}

function Card({ titulo, subtitulo, badge, badgeColor, accion, onAccion, children }: any) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e5e7eb',
      borderRadius: 6, padding: 16, marginBottom: 14
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-start', marginBottom: subtitulo ? 4 : 10
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{titulo}</span>
          {badge !== undefined && badge > 0 && (
            <span style={{ fontSize: 11, fontWeight: 600, color: badgeColor || '#6b7280' }}>
              ({badge})
            </span>
          )}
        </div>
        {accion && (
          <button onClick={onAccion} style={{
            background: 'none', border: 'none',
            color: '#185FA5', fontSize: 11, cursor: 'pointer',
            textDecoration: 'underline', padding: 0
          }}>
            {accion}
          </button>
        )}
      </div>
      {subtitulo && (
        <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 10 }}>{subtitulo}</div>
      )}
      <div>{children}</div>
    </div>
  )
}

function EmptyMsg({ texto }: any) {
  return (
    <div style={{
      padding: 16, textAlign: 'center',
      fontSize: 12, color: '#9ca3af'
    }}>
      {texto}
    </div>
  )
}

function BotonAccion({ label, onClick }: any) {
  return (
    <button onClick={onClick} style={{
      padding: '14px 20px', background: '#fff',
      border: '1px solid #e5e7eb', borderRadius: 6,
      fontSize: 13, fontWeight: 500, color: '#111',
      cursor: 'pointer', textAlign: 'left'
    }}>
      {label} →
    </button>
  )
}

function ItemSolicitud({ s, router }: any) {
  const estadoConfig: Record<string, { bg: string; color: string; label: string }> = {
    pendiente:  { bg: '#FEF3C7', color: '#92400E', label: 'Pendiente' },
    aprobada:   { bg: '#D1FAE5', color: '#065F46', label: 'Aprobada' },
    rechazada:  { bg: '#FEE2E2', color: '#991B1B', label: 'Rechazada' },
    cotizando:  { bg: '#DBEAFE', color: '#1E40AF', label: 'Cotizando' },
    completada: { bg: '#F3F4F6', color: '#374151', label: 'Completada' },
  }
  const c = estadoConfig[s.estado?.toLowerCase()] || estadoConfig.pendiente
  
  return (
    <div onClick={() => router.push(`/solicitudes/${s.id}`)}
      style={{
        padding: 10, background: '#F9FAFB',
        borderRadius: 3, marginBottom: 6,
        cursor: 'pointer', fontSize: 12,
        border: '1px solid #e5e7eb'
      }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 3 }}>
        <span style={{
          padding: '2px 7px', borderRadius: 3, fontSize: 10,
          fontWeight: 600, background: c.bg, color: c.color
        }}>
          {c.label}
        </span>
        <span style={{ fontWeight: 600, color: '#111' }}>{s.descripcion}</span>
      </div>
      <div style={{ color: '#6b7280', fontSize: 11 }}>
        {new Date(s.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
      </div>
    </div>
  )
}
