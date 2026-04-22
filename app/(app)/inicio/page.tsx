'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth'

// ============================================================
// INICIO - Centro de comando operativo por rol
// 
// SOLICITANTE (comercial/productor):
//   - Botón para nueva solicitud
//   - Sus solicitudes activas
//
// ENCARGADO (jefe área):
//   - Aprobaciones pendientes de su equipo
//
// ADMIN COMPRAS (PROTAGONISTA - articula todo):
//   - BANDEJA DE ENTRADA: lo que le llegó hoy
//   - PROCESAR: qué tiene que hacer ahora
//   - EN GESTIÓN: lo que está en curso
//   - ATENCIÓN: vencidas, urgentes
//
// GERENCIA:
//   - KPIs ejecutivos
//   - Aprobaciones críticas
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
      const q: any = {}
      const esAprobador = ['encargado', 'admin_compras', 'gerencia'].includes(usuario.rol)
      const esLider = ['admin_compras', 'gerencia'].includes(usuario.rol)

      // Mis solicitudes (solicitante)
      if (usuario.rol === 'solicitante') {
        const { data: mias } = await supabase
          .from('solicitudes')
          .select('*')
          .eq('solicitante_id', usuario.id)
          .order('created_at', { ascending: false })
          .limit(10)
        q.misSolicitudes = mias || []
      }

      // Aprobaciones donde soy aprobador
      if (esAprobador) {
        const { data: aprs } = await supabase
          .from('aprobaciones')
          .select('*')
          .eq('aprobador_id', usuario.id)
          .eq('estado', 'pendiente')
        
        if (aprs && aprs.length > 0) {
          const sids = aprs.map(a => a.solicitud_id)
          const [
            { data: sols },
            { data: items }
          ] = await Promise.all([
            supabase.from('solicitudes').select('*').in('id', sids),
            supabase.from('items_solicitud').select('*').in('solicitud_id', sids),
          ])
          const solicitanteIds = [...new Set((sols || []).map(s => s.solicitante_id))]
          const { data: users } = await supabase
            .from('usuarios').select('id, nombre, rol').in('id', solicitanteIds)
          
          q.aprobaciones = aprs.map(apr => {
            const sol = (sols || []).find(s => s.id === apr.solicitud_id)
            const solicitante = (users || []).find(u => u.id === sol?.solicitante_id)
            const solItems = (items || []).filter(i => i.solicitud_id === apr.solicitud_id)
            const monto = solItems.reduce((s, i) => s + (parseFloat(i.presupuesto_estimado) || 0), 0)
            return { ...apr, solicitud: sol, solicitante, monto }
          })
        } else {
          q.aprobaciones = []
        }
      }

      // Datos del líder de compras (centro de comando)
      if (esLider) {
        // BANDEJA DE ENTRADA: solicitudes pendientes de aprobación (TODAS)
        const { data: pendientes } = await supabase
          .from('solicitudes')
          .select('*')
          .eq('estado', 'pendiente')
          .order('created_at', { ascending: false })

        // PROCESAR: aprobadas (hay que hacer algo con ellas)
        const { data: aprobadas } = await supabase
          .from('solicitudes')
          .select('*')
          .eq('estado', 'aprobada')
          .order('created_at', { ascending: false })

        // EN COTIZACIÓN: ya se les está buscando proveedor
        const { data: cotizando } = await supabase
          .from('solicitudes')
          .select('*')
          .eq('estado', 'cotizando')
          .order('created_at', { ascending: false })

        // Enriquecer con solicitantes e items
        const todasIds = [
          ...(pendientes || []),
          ...(aprobadas || []),
          ...(cotizando || [])
        ].map(s => s.id)

        let solicitudesEnriched: any[] = []
        if (todasIds.length > 0) {
          const solicitanteIds = [...new Set([
            ...(pendientes || []),
            ...(aprobadas || []),
            ...(cotizando || [])
          ].map(s => s.solicitante_id))]

          const [
            { data: users },
            { data: items }
          ] = await Promise.all([
            supabase.from('usuarios').select('id, nombre, rol, area').in('id', solicitanteIds),
            supabase.from('items_solicitud').select('*').in('solicitud_id', todasIds),
          ])

          const enriquecer = (arr: any[]) => (arr || []).map(s => {
            const its = (items || []).filter(i => i.solicitud_id === s.id)
            const monto = its.reduce((sum, i) => sum + (parseFloat(i.presupuesto_estimado) || 0), 0)
            return {
              ...s,
              solicitante: (users || []).find(u => u.id === s.solicitante_id),
              items_count: its.length,
              monto
            }
          })

          q.bandejaEntrada = enriquecer(pendientes || [])
          q.porProcesar = enriquecer(aprobadas || [])
          q.enCotizacion = enriquecer(cotizando || [])
        } else {
          q.bandejaEntrada = []
          q.porProcesar = []
          q.enCotizacion = []
        }

        // OFs en curso (del sistema legacy)
        try {
          const { data: ofs } = await supabase
            .from('ordenes_facturacion')
            .select('id, codigo_of, valor_total, descripcion, estado_verificacion, created_at, proveedor_id')
            .in('estado_verificacion', ['PENDIENTE', 'EN_PROCESO', 'EN_REVISION'])
            .order('created_at', { ascending: false })
            .limit(10)

          if (ofs && ofs.length > 0) {
            const provIds = [...new Set(ofs.map(o => o.proveedor_id).filter(Boolean))]
            const { data: provs } = await supabase
              .from('proveedores').select('id, razon_social').in('id', provIds)
            q.ofsEnCurso = ofs.map(o => ({
              ...o,
              proveedor: (provs || []).find(p => p.id === o.proveedor_id)
            }))
          } else {
            q.ofsEnCurso = []
          }
        } catch {
          q.ofsEnCurso = []
        }

        // OSs en curso
        try {
          const { data: oss } = await supabase
            .from('ordenes_servicio')
            .select('*')
            .in('estado', ['pendiente', 'aprobada', 'en_ejecucion'])
            .order('created_at', { ascending: false })
            .limit(10)
          q.ossEnCurso = oss || []
        } catch {
          q.ossEnCurso = []
        }

        // Resumen global
        const [
          { count: totalActivas },
          { count: totalCompletadas }
        ] = await Promise.all([
          supabase.from('solicitudes').select('*', { count: 'exact', head: true })
            .in('estado', ['pendiente', 'aprobada', 'cotizando']),
          supabase.from('solicitudes').select('*', { count: 'exact', head: true })
            .eq('estado', 'completada')
        ])
        q.resumen = { totalActivas, totalCompletadas }
      }

      setData(q)
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

  if (usuario?.rol === 'solicitante') {
    return <VistaSolicitante data={data} router={router} usuario={usuario} saludo={saludo} />
  }
  if (usuario?.rol === 'encargado') {
    return <VistaEncargado data={data} router={router} usuario={usuario} saludo={saludo} />
  }
  if (usuario?.rol === 'admin_compras') {
    return <VistaLiderCompras data={data} router={router} usuario={usuario} saludo={saludo} />
  }
  if (usuario?.rol === 'gerencia') {
    return <VistaGerencia data={data} router={router} usuario={usuario} saludo={saludo} />
  }
  return null
}

// ============================================================
// VISTA LÍDER DE COMPRAS — Centro de comando operativo
// ============================================================
function VistaLiderCompras({ data, router, usuario, saludo }: any) {
  const bandeja = data.bandejaEntrada || []
  const procesar = data.porProcesar || []
  const cotizando = data.enCotizacion || []
  const ofs = data.ofsEnCurso || []
  const oss = data.ossEnCurso || []
  const aprobaciones = data.aprobaciones || []
  const resumen = data.resumen || {}

  const totalTareas = bandeja.length + procesar.length + cotizando.length + ofs.length + oss.length + aprobaciones.length

  // Clasificar bandeja por origen del solicitante
  const porComerciales = bandeja.filter((s: any) => 
    s.solicitante?.area?.toLowerCase().includes('comercial') || s.solicitante?.rol === 'comercial'
  )
  const porProductores = bandeja.filter((s: any) => 
    s.solicitante?.area?.toLowerCase().includes('produc') || s.solicitante?.rol === 'productor'
  )
  const propias = bandeja.filter((s: any) => s.solicitante_id === usuario.id)
  const otras = bandeja.filter((s: any) => 
    !porComerciales.includes(s) && !porProductores.includes(s) && !propias.includes(s)
  )

  return (
    <div style={{ padding: 32, maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>{saludo},</div>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#111', margin: 0, marginBottom: 6 }}>
          {usuario.nombre}
        </h1>
        <div style={{ fontSize: 13, color: '#6b7280' }}>
          {totalTareas > 0 
            ? <>Tu tablero operativo · <strong style={{ color: '#DC2626' }}>{totalTareas} tareas activas</strong></>
            : 'Todo al día — el proceso de compras está fluyendo sin pendientes'}
        </div>
      </div>

      {/* Acciones rápidas */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
        <button onClick={() => router.push('/solicitudes/nueva')} style={btnPrimary}>
          + Nueva solicitud
        </button>
        <button onClick={() => router.push('/nueva-of')} style={btnSecondary}>
          + Crear OF / OS
        </button>
        <button onClick={() => router.push('/solicitudes')} style={btnSecondary}>
          Ver todas las solicitudes
        </button>
      </div>

      {/* KPIs globales */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 24 }}>
        <KPI label="Bandeja entrada" valor={bandeja.length} color="#DC2626" subtitulo="Por aprobar" />
        <KPI label="Por procesar" valor={procesar.length} color="#F59E0B" subtitulo="Aprobadas" />
        <KPI label="En cotización" valor={cotizando.length} color="#185FA5" subtitulo="Buscando proveedor" />
        <KPI label="OF/OS en curso" valor={ofs.length + oss.length} color="#3730A3" subtitulo="Ejecutando" />
        <KPI label="Total activas" valor={resumen.totalActivas || 0} color="#111" subtitulo="En el proceso" />
      </div>

      {/* LAYOUT 3 COLUMNAS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
        
        {/* COLUMNA 1: BANDEJA DE ENTRADA (llegaron nuevas) */}
        <Columna titulo="📥 Bandeja de entrada" color="#DC2626" total={bandeja.length}>
          {bandeja.length === 0 ? (
            <Empty texto="No hay solicitudes nuevas" />
          ) : (
            <>
              {/* Por origen */}
              {porComerciales.length > 0 && (
                <Subgroup titulo="De Comerciales" count={porComerciales.length}>
                  {porComerciales.slice(0, 3).map((s: any) => (
                    <Tarjeta key={s.id} solicitud={s} router={router} color="#DBEAFE" />
                  ))}
                </Subgroup>
              )}
              {porProductores.length > 0 && (
                <Subgroup titulo="De Productores" count={porProductores.length}>
                  {porProductores.slice(0, 3).map((s: any) => (
                    <Tarjeta key={s.id} solicitud={s} router={router} color="#E0E7FF" />
                  ))}
                </Subgroup>
              )}
              {propias.length > 0 && (
                <Subgroup titulo="Propias" count={propias.length}>
                  {propias.slice(0, 3).map((s: any) => (
                    <Tarjeta key={s.id} solicitud={s} router={router} color="#F3F4F6" />
                  ))}
                </Subgroup>
              )}
              {otras.length > 0 && (
                <Subgroup titulo="Otros" count={otras.length}>
                  {otras.slice(0, 3).map((s: any) => (
                    <Tarjeta key={s.id} solicitud={s} router={router} color="#F9FAFB" />
                  ))}
                </Subgroup>
              )}
            </>
          )}
          
          {aprobaciones.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <Subgroup titulo="Para que YO apruebe" count={aprobaciones.length} color="#F59E0B">
                {aprobaciones.slice(0, 3).map((a: any) => (
                  <div key={a.id}
                    onClick={() => router.push(`/solicitudes/${a.solicitud_id}`)}
                    style={{
                      padding: 10, background: '#FFFBEB',
                      borderLeft: '3px solid #F59E0B',
                      borderRadius: 3, marginBottom: 6,
                      cursor: 'pointer', fontSize: 12
                    }}>
                    <div style={{ fontWeight: 600, color: '#111', marginBottom: 2 }}>
                      {a.solicitud?.descripcion || '—'}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                      <span style={{ color: '#6b7280' }}>Nivel {a.nivel_aprobacion}</span>
                      <span style={{ fontWeight: 600, color: '#185FA5' }}>
                        ${a.monto.toLocaleString('es-CO')}
                      </span>
                    </div>
                  </div>
                ))}
              </Subgroup>
            </div>
          )}
        </Columna>

        {/* COLUMNA 2: POR PROCESAR (hay que hacer algo) */}
        <Columna titulo="🔨 Por procesar" color="#F59E0B" total={procesar.length + cotizando.length}>
          {procesar.length === 0 && cotizando.length === 0 ? (
            <Empty texto="No hay solicitudes listas para procesar" />
          ) : (
            <>
              {procesar.length > 0 && (
                <Subgroup titulo="Por cotizar" count={procesar.length} subtitulo="Solicitudes aprobadas, buscá proveedores">
                  {procesar.slice(0, 5).map((s: any) => (
                    <Tarjeta key={s.id} solicitud={s} router={router} color="#FEF3C7" mostrarSolicitante />
                  ))}
                  {procesar.length > 5 && (
                    <div style={{ fontSize: 11, color: '#6b7280', textAlign: 'center', padding: 6 }}>
                      + {procesar.length - 5} más →{' '}
                      <button onClick={() => router.push('/cotizaciones')} style={linkBtn}>
                        Ver todas
                      </button>
                    </div>
                  )}
                </Subgroup>
              )}
              {cotizando.length > 0 && (
                <Subgroup titulo="En cotización" count={cotizando.length} subtitulo="Con cotizaciones, decidí proveedor">
                  {cotizando.slice(0, 5).map((s: any) => (
                    <Tarjeta key={s.id} solicitud={s} router={router} color="#DBEAFE" mostrarSolicitante />
                  ))}
                </Subgroup>
              )}
            </>
          )}
        </Columna>

        {/* COLUMNA 3: EN GESTIÓN (mi trabajo en curso) */}
        <Columna titulo="📋 En gestión" color="#3730A3" total={ofs.length + oss.length}>
          {ofs.length === 0 && oss.length === 0 ? (
            <Empty texto="No hay OF/OS en curso" />
          ) : (
            <>
              {ofs.length > 0 && (
                <Subgroup titulo="Órdenes de Facturación" count={ofs.length}>
                  {ofs.slice(0, 4).map((of: any) => (
                    <div key={of.id}
                      onClick={() => router.push('/ordenes')}
                      style={{
                        padding: 10, background: '#F9FAFB',
                        borderRadius: 3, marginBottom: 6,
                        cursor: 'pointer', fontSize: 12,
                        border: '1px solid #e5e7eb'
                      }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ fontWeight: 600, color: '#111' }}>
                          {of.codigo_of || 'OF'}
                        </span>
                        <span style={{ fontWeight: 600, color: '#185FA5', fontSize: 11 }}>
                          ${(of.valor_total || 0).toLocaleString('es-CO')}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>
                        {of.proveedor?.razon_social || '—'}
                      </div>
                    </div>
                  ))}
                  {ofs.length > 4 && (
                    <div style={{ fontSize: 11, color: '#6b7280', textAlign: 'center', padding: 6 }}>
                      <button onClick={() => router.push('/ordenes')} style={linkBtn}>
                        Ver todas ({ofs.length})
                      </button>
                    </div>
                  )}
                </Subgroup>
              )}
              {oss.length > 0 && (
                <Subgroup titulo="Órdenes de Servicio" count={oss.length}>
                  {oss.slice(0, 4).map((os: any) => (
                    <div key={os.id}
                      onClick={() => router.push('/ordenes-servicio')}
                      style={{
                        padding: 10, background: '#F9FAFB',
                        borderRadius: 3, marginBottom: 6,
                        cursor: 'pointer', fontSize: 12,
                        border: '1px solid #e5e7eb'
                      }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ fontWeight: 600, color: '#111' }}>
                          {os.numero_os || 'OS'}
                        </span>
                        <span style={{ fontWeight: 600, color: '#185FA5', fontSize: 11 }}>
                          ${(os.valor_total || 0).toLocaleString('es-CO')}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>
                        {os.descripcion?.slice(0, 40) || '—'}
                      </div>
                    </div>
                  ))}
                </Subgroup>
              )}
            </>
          )}
        </Columna>
      </div>
    </div>
  )
}

// ============================================================
// VISTA SOLICITANTE
// ============================================================
function VistaSolicitante({ data, router, usuario, saludo }: any) {
  const mias = data.misSolicitudes || []
  const activas = mias.filter((s: any) => !['completada', 'rechazada'].includes(s.estado))

  return (
    <div style={{ padding: 32, maxWidth: 900, margin: '0 auto' }}>
      <Header saludo={saludo} nombre={usuario.nombre} subtitulo={
        activas.length > 0
          ? `Tenés ${activas.length} solicitud${activas.length !== 1 ? 'es' : ''} activa${activas.length !== 1 ? 's' : ''}`
          : '¿Necesitás pedir una compra?'
      } />
      <button onClick={() => router.push('/solicitudes/nueva')} style={btnPrimary}>
        + Nueva solicitud de compra
      </button>
      <div style={{ marginTop: 24 }}>
        <Card titulo="Mis solicitudes" accion="Ver todas" onAccion={() => router.push('/solicitudes')}>
          {mias.length === 0 ? (
            <Empty texto="No has creado solicitudes todavía" />
          ) : (
            mias.slice(0, 8).map((s: any) => (
              <Tarjeta key={s.id} solicitud={{ ...s, items_count: 0, monto: 0 }} router={router} color="#F9FAFB" />
            ))
          )}
        </Card>
      </div>
    </div>
  )
}

// ============================================================
// VISTA ENCARGADO
// ============================================================
function VistaEncargado({ data, router, usuario, saludo }: any) {
  const aprob = data.aprobaciones || []
  return (
    <div style={{ padding: 32, maxWidth: 1000, margin: '0 auto' }}>
      <Header saludo={saludo} nombre={usuario.nombre} subtitulo={
        aprob.length > 0
          ? `${aprob.length} solicitud${aprob.length !== 1 ? 'es' : ''} esperando tu aprobación`
          : 'No hay aprobaciones pendientes'
      } />
      <Card
        titulo="Solicitudes para aprobar"
        badge={aprob.length}
        badgeColor="#DC2626"
        accion="Ver todas"
        onAccion={() => router.push('/aprobaciones')}
      >
        {aprob.length === 0 ? (
          <Empty texto="Todo al día" />
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
                  {a.solicitud?.descripcion || '—'}
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
// VISTA GERENCIA
// ============================================================
function VistaGerencia({ data, router, usuario, saludo }: any) {
  const resumen = data.resumen || {}
  const aprob = data.aprobaciones || []

  return (
    <div style={{ padding: 32, maxWidth: 1300, margin: '0 auto' }}>
      <Header saludo={saludo} nombre={usuario.nombre} subtitulo="Vista ejecutiva del proceso de compras" />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        <KPI label="Total activas" valor={resumen.totalActivas || 0} color="#185FA5" />
        <KPI label="Completadas" valor={resumen.totalCompletadas || 0} color="#10B981" />
        <KPI label="Aprobaciones críticas" valor={aprob.length} color="#DC2626" />
      </div>

      {aprob.length > 0 && (
        <Card titulo="Aprobaciones críticas pendientes" badge={aprob.length} badgeColor="#DC2626"
          accion="Ver todas" onAccion={() => router.push('/aprobaciones')}>
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 20 }}>
        <BotonAccion label="Dashboard completo" onClick={() => router.push('/dashboard')} />
        <BotonAccion label="Contraloría" onClick={() => router.push('/contraloria')} />
        <BotonAccion label="Auditoría" onClick={() => router.push('/auditoria')} />
      </div>
    </div>
  )
}

// ============================================================
// COMPONENTES
// ============================================================

const btnPrimary: React.CSSProperties = {
  padding: '11px 22px', background: '#185FA5', color: '#fff',
  border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600,
  cursor: 'pointer'
}
const btnSecondary: React.CSSProperties = {
  padding: '11px 18px', background: '#fff', color: '#374151',
  border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, fontWeight: 500,
  cursor: 'pointer'
}
const linkBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: '#185FA5',
  fontSize: 11, cursor: 'pointer', textDecoration: 'underline', padding: 0
}

function Header({ saludo, nombre, subtitulo }: any) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>{saludo},</div>
      <h1 style={{ fontSize: 26, fontWeight: 700, color: '#111', margin: 0, marginBottom: 6 }}>{nombre}</h1>
      <div style={{ fontSize: 13, color: '#6b7280' }}>{subtitulo}</div>
    </div>
  )
}

function KPI({ label, valor, color, subtitulo }: any) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', padding: 14, borderRadius: 6 }}>
      <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{valor}</div>
      {subtitulo && (
        <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{subtitulo}</div>
      )}
    </div>
  )
}

function Columna({ titulo, color, total, children }: any) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e5e7eb',
      borderRadius: 8, padding: 14
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 14,
        paddingBottom: 10, borderBottom: `2px solid ${color}`
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>{titulo}</div>
        <div style={{
          padding: '2px 8px', background: color, color: '#fff',
          fontSize: 11, fontWeight: 700, borderRadius: 10, minWidth: 24, textAlign: 'center'
        }}>
          {total}
        </div>
      </div>
      {children}
    </div>
  )
}

function Subgroup({ titulo, count, subtitulo, color, children }: any) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontSize: 10, fontWeight: 700, color: color || '#6b7280',
        letterSpacing: '0.05em', textTransform: 'uppercase',
        marginBottom: 2,
        display: 'flex', justifyContent: 'space-between'
      }}>
        <span>{titulo}</span>
        {count !== undefined && <span>{count}</span>}
      </div>
      {subtitulo && (
        <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 6, fontStyle: 'italic' }}>
          {subtitulo}
        </div>
      )}
      <div style={{ marginTop: 6 }}>{children}</div>
    </div>
  )
}

function Tarjeta({ solicitud, router, color, mostrarSolicitante }: any) {
  return (
    <div onClick={() => router.push(`/solicitudes/${solicitud.id}`)}
      style={{
        padding: 9, background: color || '#F9FAFB',
        borderRadius: 3, marginBottom: 5,
        cursor: 'pointer', fontSize: 12,
        border: '1px solid rgba(0,0,0,0.05)'
      }}>
      <div style={{ fontWeight: 600, color: '#111', marginBottom: 3, lineHeight: 1.3 }}>
        {solicitud.descripcion || '—'}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
        <span style={{ color: '#6b7280' }}>
          {mostrarSolicitante && solicitud.solicitante?.nombre
            ? solicitud.solicitante.nombre
            : `${solicitud.items_count || 0} ítem${(solicitud.items_count || 0) !== 1 ? 's' : ''}`}
        </span>
        <span style={{ fontWeight: 600, color: '#185FA5' }}>
          ${(solicitud.monto || 0).toLocaleString('es-CO')}
        </span>
      </div>
    </div>
  )
}

function Card({ titulo, badge, badgeColor, accion, onAccion, children }: any) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e5e7eb',
      borderRadius: 6, padding: 16, marginBottom: 14
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{titulo}</span>
          {badge !== undefined && badge > 0 && (
            <span style={{ fontSize: 11, fontWeight: 600, color: badgeColor || '#6b7280' }}>({badge})</span>
          )}
        </div>
        {accion && (
          <button onClick={onAccion} style={linkBtn}>{accion}</button>
        )}
      </div>
      <div>{children}</div>
    </div>
  )
}

function Empty({ texto }: any) {
  return (
    <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>
      {texto}
    </div>
  )
}

function BotonAccion({ label, onClick }: any) {
  return (
    <button onClick={onClick} style={{
      padding: '14px 20px', background: '#fff', border: '1px solid #e5e7eb',
      borderRadius: 6, fontSize: 13, fontWeight: 500, color: '#111',
      cursor: 'pointer', textAlign: 'left'
    }}>
      {label} →
    </button>
  )
}
