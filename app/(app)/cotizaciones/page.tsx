'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth'

// ============================================================
// COTIZACIONES — 4 pasos del proceso real
//
// TAB 1 "Solicitar": solicitudes aprobadas sin proveedores contactados
//   Acción: seleccionar 2-3 proveedores candidatos
//
// TAB 2 "Esperando respuestas": proveedores contactados sin cotización
//   Acción: registrar la cotización cuando el proveedor responde
//
// TAB 3 "Comparar y adjudicar": solicitudes con 2+ cotizaciones
//   Acción: elegir el ganador, genera OF/OS automática
//
// TAB 4 "Adjudicadas": histórico cerrado
// ============================================================

export default function CotizacionesPage() {
  const { usuario } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [tab, setTab] = useState<'solicitar' | 'esperando' | 'comparar' | 'adjudicadas'>('solicitar')
  const [loading, setLoading] = useState(true)
  
  const [solicitudes, setSolicitudes] = useState<any[]>([])
  const [proveedores, setProveedores] = useState<any[]>([])
  const [cotizaciones, setCotizaciones] = useState<any[]>([])
  
  // Modales
  const [modalSolicitar, setModalSolicitar] = useState<any>(null)
  const [modalRegistrar, setModalRegistrar] = useState<any>(null)

  useEffect(() => {
    if (!usuario) {
      router.push('/login')
      return
    }
    if (!['encargado', 'admin_compras', 'gerencia'].includes(usuario.rol)) {
      router.push('/')
      return
    }
    cargar()
  }, [usuario])

  const cargar = async () => {
    try {
      // Solicitudes en estado apto para cotización
      const { data: sols } = await supabase
        .from('solicitudes')
        .select('*')
        .in('estado', ['aprobada', 'cotizando', 'ordenada', 'completada'])
        .order('created_at', { ascending: false })

      // Proveedores activos
      const { data: provs } = await supabase
        .from('proveedores')
        .select('id, codigo, razon_social, score')
        .eq('activo', true)
        .order('razon_social')

      // Cotizaciones existentes
      let cotz: any[] = []
      try {
        const { data } = await supabase
          .from('cotizaciones')
          .select('*')
          .order('created_at', { ascending: false })
        cotz = data || []
      } catch {}

      // Enriquecer
      if (sols && sols.length > 0) {
        const sIds = sols.map((s: any) => s.id)
        const solicitanteIds = [...new Set(sols.map((s: any) => s.solicitante_id))]
        const [items, users] = await Promise.all([
          supabase.from('items_solicitud').select('*').in('solicitud_id', sIds),
          supabase.from('usuarios').select('id, nombre').in('id', solicitanteIds)
        ])

        const enriquecidas = sols.map((s: any) => {
          const its = (items.data || []).filter((i: any) => i.solicitud_id === s.id)
          const monto = its.reduce((sum: number, i: any) => sum + (parseFloat(i.presupuesto_estimado) || 0), 0)
          const misCotz = cotz.filter((c: any) => c.solicitud_id === s.id)
          return {
            ...s,
            items: its,
            items_count: its.length,
            monto,
            solicitante: (users.data || []).find((u: any) => u.id === s.solicitante_id),
            cotizaciones: misCotz
          }
        })

        setSolicitudes(enriquecidas)
      }
      setProveedores(provs || [])
      setCotizaciones(cotz)
      setLoading(false)
    } catch (err) {
      console.error(err)
      setLoading(false)
    }
  }

  // Clasificar solicitudes por tab
  const porCotizacion = solicitudes.map((s: any) => {
    const pendientes = s.cotizaciones.filter((c: any) => c.estado === 'PENDIENTE' || c.estado === 'SOLICITADA')
    const recibidas = s.cotizaciones.filter((c: any) => c.estado === 'RECIBIDA' || c.estado === 'RESPONDIDA')
    const adjudicada = s.cotizaciones.find((c: any) => c.estado === 'ADJUDICADA' || c.estado === 'GANADORA')
    return { ...s, pendientes, recibidas, adjudicada }
  })

  const solicitar = porCotizacion.filter((s: any) =>
    s.estado === 'aprobada' && s.cotizaciones.length === 0
  )
  const esperando = porCotizacion.filter((s: any) =>
    s.cotizaciones.length > 0 && s.pendientes.length > 0 && !s.adjudicada
  )
  const comparar = porCotizacion.filter((s: any) =>
    s.recibidas.length >= 1 && !s.adjudicada && s.estado !== 'ordenada' && s.estado !== 'completada'
  )
  const adjudicadas = porCotizacion.filter((s: any) =>
    s.adjudicada || s.estado === 'ordenada' || s.estado === 'completada'
  )

  const tabData = { solicitar, esperando, comparar, adjudicadas }[tab]

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Cargando...</div>
  }

  return (
    <div style={{ padding: 32, maxWidth: 1300, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Etapa 2 del proceso
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111', margin: 0, marginBottom: 4 }}>
          Cotizaciones
        </h1>
        <div style={{ fontSize: 13, color: '#6b7280' }}>
          Seleccioná proveedores, registrá sus respuestas, compará y adjudicá
        </div>
      </div>

      {/* Explicación del proceso */}
      <div style={{
        background: '#EFF6FF', border: '1px solid #BFDBFE',
        borderRadius: 6, padding: 14, marginBottom: 20,
        fontSize: 12, color: '#1E40AF', lineHeight: 1.6
      }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>¿Cómo funciona este módulo?</div>
        Este es un <strong>registro + comparador</strong>. El sistema NO envía emails a proveedores —
        vos los contactás por email/WhatsApp/llamada como siempre. Acá <strong>registrás</strong>
        a quién contactaste, <strong>guardás</strong> sus respuestas, <strong>compará</strong> ofertas
        y <strong>adjudicás</strong> al ganador (que automáticamente genera la OF/OS).
      </div>

      {/* Tabs - 4 pasos */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, borderBottom: '1px solid #e5e7eb' }}>
        <Tab activo={tab === 'solicitar'} onClick={() => setTab('solicitar')} count={solicitar.length} color="#DC2626" paso="1">
          Solicitar
        </Tab>
        <Tab activo={tab === 'esperando'} onClick={() => setTab('esperando')} count={esperando.length} color="#F59E0B" paso="2">
          Esperando respuestas
        </Tab>
        <Tab activo={tab === 'comparar'} onClick={() => setTab('comparar')} count={comparar.length} color="#185FA5" paso="3">
          Comparar y adjudicar
        </Tab>
        <Tab activo={tab === 'adjudicadas'} onClick={() => setTab('adjudicadas')} count={adjudicadas.length} paso="4">
          Adjudicadas
        </Tab>
      </div>

      {/* Subtitulo según tab */}
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 14, fontStyle: 'italic' }}>
        {tab === 'solicitar' && 'Solicitudes aprobadas esperando que elijas proveedores candidatos para pedirles cotización.'}
        {tab === 'esperando' && 'Ya contactaste proveedores. Cuando recibas su respuesta, registrala acá.'}
        {tab === 'comparar' && 'Tenés cotizaciones recibidas. Compará ofertas y adjudicá al ganador.'}
        {tab === 'adjudicadas' && 'Ya se eligió proveedor. OF/OS emitida. Histórico para auditoría.'}
      </div>

      {/* EMPTY */}
      {tabData.length === 0 ? (
        <Empty
          titulo={
            tab === 'solicitar' ? 'No hay solicitudes esperando cotización' :
            tab === 'esperando' ? 'No hay cotizaciones pendientes de respuesta' :
            tab === 'comparar' ? 'No hay cotizaciones listas para comparar' :
            'Aún no has adjudicado ninguna cotización'
          }
        />
      ) : (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden' }}>
          {tabData.map((s: any) => (
            <ItemSolicitud
              key={s.id}
              s={s}
              tab={tab}
              router={router}
              onSolicitar={() => setModalSolicitar(s)}
              onRegistrar={(proveedorId: string) => setModalRegistrar({ solicitud: s, proveedor_id: proveedorId })}
              onComparar={() => setTab('comparar')}
            />
          ))}
        </div>
      )}

      {/* MODAL: Seleccionar proveedores */}
      {modalSolicitar && (
        <ModalSolicitar
          solicitud={modalSolicitar}
          proveedores={proveedores}
          onClose={() => setModalSolicitar(null)}
          onConfirm={async (proveedorIds: string[]) => {
            try {
              for (const pid of proveedorIds) {
                await supabase.from('cotizaciones').insert({
                  solicitud_id: modalSolicitar.id,
                  proveedor_id: pid,
                  estado: 'PENDIENTE',
                  registrado_por: usuario!.id
                })
              }
              // Marcar solicitud como "cotizando"
              await supabase.from('solicitudes')
                .update({ estado: 'cotizando', updated_at: new Date().toISOString() })
                .eq('id', modalSolicitar.id)
              setModalSolicitar(null)
              cargar()
            } catch (err: any) {
              alert('Error: ' + err.message)
            }
          }}
        />
      )}

      {/* MODAL: Registrar cotización recibida */}
      {modalRegistrar && (
        <ModalRegistrar
          info={modalRegistrar}
          proveedores={proveedores}
          onClose={() => setModalRegistrar(null)}
          onConfirm={async (datos: any) => {
            try {
              // Buscar cotización existente o crear una
              const existente = cotizaciones.find((c: any) =>
                c.solicitud_id === modalRegistrar.solicitud.id &&
                c.proveedor_id === modalRegistrar.proveedor_id
              )

              if (existente) {
                await supabase.from('cotizaciones').update({
                  estado: 'RECIBIDA',
                  valor: datos.valor,
                  tiempo_entrega: datos.tiempo_entrega,
                  condiciones: datos.condiciones,
                }).eq('id', existente.id)
              } else {
                await supabase.from('cotizaciones').insert({
                  solicitud_id: modalRegistrar.solicitud.id,
                  proveedor_id: modalRegistrar.proveedor_id,
                  estado: 'RECIBIDA',
                  valor: datos.valor,
                  tiempo_entrega: datos.tiempo_entrega,
                  condiciones: datos.condiciones,
                  registrado_por: usuario!.id
                })
              }
              setModalRegistrar(null)
              cargar()
            } catch (err: any) {
              alert('Error: ' + err.message)
            }
          }}
        />
      )}
    </div>
  )
}

// ============================================================
// ITEM DE LA LISTA
// ============================================================
function ItemSolicitud({ s, tab, router, onSolicitar, onRegistrar, onComparar }: any) {
  return (
    <div style={{ padding: 16, borderBottom: '1px solid #f3f4f6' }}>
      {/* Header del item */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#111', marginBottom: 3 }}>
            {s.descripcion}
          </div>
          <div style={{ fontSize: 11, color: '#6b7280' }}>
            Solicita: <strong>{s.solicitante?.nombre || '—'}</strong> · 
            {' '}Centro: <strong>{s.centro_costo || '—'}</strong> · 
            {' '}{s.items_count} ítem{s.items_count !== 1 ? 's' : ''} · 
            {' '}Presupuesto: <strong style={{ color: '#185FA5' }}>${s.monto.toLocaleString('es-CO')}</strong>
          </div>
        </div>
        {tab === 'solicitar' && (
          <button onClick={onSolicitar} style={btnPrimary}>
            Seleccionar proveedores →
          </button>
        )}
        {tab === 'comparar' && (
          <button onClick={() => router.push(`/cotizaciones/${s.id}/comparar`)} style={btnPrimary}>
            Comparar y adjudicar →
          </button>
        )}
      </div>

      {/* Lista de proveedores contactados (tab esperando y comparar) */}
      {['esperando', 'comparar', 'adjudicadas'].includes(tab) && s.cotizaciones.length > 0 && (
        <div style={{ background: '#F9FAFB', borderRadius: 4, padding: 10, marginTop: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            Proveedores contactados ({s.cotizaciones.length})
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            {s.cotizaciones.map((c: any) => {
              const esPendiente = c.estado === 'PENDIENTE' || c.estado === 'SOLICITADA'
              const esRecibida = c.estado === 'RECIBIDA' || c.estado === 'RESPONDIDA'
              const esAdjudicada = c.estado === 'ADJUDICADA' || c.estado === 'GANADORA'
              return (
                <div key={c.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 12px', background: '#fff',
                  borderLeft: `3px solid ${esAdjudicada ? '#10B981' : esRecibida ? '#185FA5' : '#F59E0B'}`,
                  borderRadius: 3, fontSize: 12
                }}>
                  <div>
                    <div style={{ fontWeight: 500, color: '#111' }}>
                      {c.proveedor?.razon_social || 'Proveedor'}
                    </div>
                    <div style={{ fontSize: 10, color: '#6b7280', marginTop: 1 }}>
                      {esPendiente && 'Esperando respuesta'}
                      {esRecibida && `Cotización recibida: $${Number(c.valor || 0).toLocaleString('es-CO')}`}
                      {esAdjudicada && 'Ganador ✓'}
                    </div>
                  </div>
                  {tab === 'esperando' && esPendiente && (
                    <button
                      onClick={() => onRegistrar(c.proveedor_id)}
                      style={btnMiniPrimary}
                    >
                      Registrar respuesta
                    </button>
                  )}
                  {esRecibida && c.valor && (
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#185FA5' }}>
                      ${Number(c.valor).toLocaleString('es-CO')}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// MODAL: Seleccionar proveedores candidatos
// ============================================================
function ModalSolicitar({ solicitud, proveedores, onClose, onConfirm }: any) {
  const [seleccionados, setSeleccionados] = useState<string[]>([])
  const [busqueda, setBusqueda] = useState('')

  const toggle = (id: string) => {
    setSeleccionados(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const provsFiltrados = proveedores.filter((p: any) =>
    !busqueda ||
    p.razon_social?.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.codigo?.toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={{ ...modalStyle, maxWidth: 600 }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: 20, borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#111', marginBottom: 4 }}>
            Solicitar cotizaciones
          </div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>
            Para: <strong>{solicitud.descripcion}</strong> · Presupuesto: ${solicitud.monto.toLocaleString('es-CO')}
          </div>
        </div>

        <div style={{ padding: 16 }}>
          <div style={{
            background: '#FFFBEB', borderLeft: '3px solid #F59E0B',
            padding: 10, borderRadius: 3, marginBottom: 14,
            fontSize: 11, color: '#78350F', lineHeight: 1.5
          }}>
            <strong>Recordatorio:</strong> El sistema NO envía emails. Elegí acá quién quedará registrado como contactado,
            y después comunicate con ellos por email/WhatsApp/teléfono como siempre.
          </div>

          <input
            type="text"
            placeholder="Buscar proveedor..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            style={{
              width: '100%', padding: '8px 12px',
              border: '1px solid #d1d5db', borderRadius: 4,
              fontSize: 13, marginBottom: 12, outline: 'none'
            }}
          />

          <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 4 }}>
            {provsFiltrados.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: '#9ca3af' }}>
                No hay proveedores
              </div>
            ) : (
              provsFiltrados.map((p: any) => (
                <label key={p.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: 10, borderBottom: '1px solid #f3f4f6',
                  cursor: 'pointer',
                  background: seleccionados.includes(p.id) ? '#EFF6FF' : '#fff'
                }}>
                  <input
                    type="checkbox"
                    checked={seleccionados.includes(p.id)}
                    onChange={() => toggle(p.id)}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>
                      {p.razon_social}
                    </div>
                    {p.codigo && (
                      <div style={{ fontSize: 10, color: '#6b7280' }}>Código: {p.codigo}</div>
                    )}
                  </div>
                </label>
              ))
            )}
          </div>

          <div style={{ marginTop: 10, fontSize: 11, color: '#6b7280' }}>
            {seleccionados.length} proveedor{seleccionados.length !== 1 ? 'es' : ''} seleccionado{seleccionados.length !== 1 ? 's' : ''}
            {seleccionados.length > 0 && seleccionados.length < 2 && (
              <span style={{ color: '#F59E0B' }}> · Recomendado: al menos 2-3 para comparar</span>
            )}
          </div>
        </div>

        <div style={{ padding: 16, borderTop: '1px solid #e5e7eb', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={btnSecondary}>Cancelar</button>
          <button
            onClick={() => onConfirm(seleccionados)}
            disabled={seleccionados.length === 0}
            style={{ ...btnPrimary, opacity: seleccionados.length === 0 ? 0.5 : 1 }}
          >
            Registrar como contactados
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// MODAL: Registrar cotización recibida
// ============================================================
function ModalRegistrar({ info, proveedores, onClose, onConfirm }: any) {
  const proveedor = proveedores.find((p: any) => p.id === info.proveedor_id)
  const [valor, setValor] = useState('')
  const [tiempoEntrega, setTiempoEntrega] = useState('')
  const [condiciones, setCondiciones] = useState('')

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={{ ...modalStyle, maxWidth: 550 }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: 20, borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#111', marginBottom: 4 }}>
            Registrar cotización recibida
          </div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>
            De: <strong>{proveedor?.razon_social || 'Proveedor'}</strong>
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
            Para: {info.solicitud.descripcion}
          </div>
        </div>

        <div style={{ padding: 16, display: 'grid', gap: 14 }}>
          <div>
            <label style={labelStyle}>Precio cotizado (COP) *</label>
            <input
              type="text"
              value={valor ? Number(valor.replace(/\D/g, '')).toLocaleString('es-CO') : ''}
              onChange={e => setValor(e.target.value.replace(/\D/g, ''))}
              placeholder="0"
              style={inputStyle}
            />
            {valor && Number(valor) > info.solicitud.monto * 1.1 && (
              <div style={{ fontSize: 11, color: '#F59E0B', marginTop: 4 }}>
                ⚠ Supera el presupuesto ({((Number(valor) - info.solicitud.monto) / info.solicitud.monto * 100).toFixed(0)}% arriba)
              </div>
            )}
          </div>

          <div>
            <label style={labelStyle}>Tiempo de entrega</label>
            <input
              type="text"
              value={tiempoEntrega}
              onChange={e => setTiempoEntrega(e.target.value)}
              placeholder="Ej: 5 días hábiles, Inmediato, Lunes próximo..."
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Condiciones / Notas</label>
            <textarea
              value={condiciones}
              onChange={e => setCondiciones(e.target.value)}
              rows={3}
              placeholder="Forma de pago, vigencia de la oferta, incluye IVA o no, garantías..."
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>
        </div>

        <div style={{ padding: 16, borderTop: '1px solid #e5e7eb', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={btnSecondary}>Cancelar</button>
          <button
            onClick={() => onConfirm({ valor: Number(valor), tiempo_entrega: tiempoEntrega, condiciones })}
            disabled={!valor || Number(valor) <= 0}
            style={{ ...btnPrimary, opacity: (!valor || Number(valor) <= 0) ? 0.5 : 1 }}
          >
            Registrar cotización
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// ESTILOS
// ============================================================
const btnPrimary: React.CSSProperties = {
  padding: '9px 18px', background: '#185FA5', color: '#fff',
  border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer',
  whiteSpace: 'nowrap'
}
const btnMiniPrimary: React.CSSProperties = {
  padding: '5px 12px', background: '#185FA5', color: '#fff',
  border: 'none', borderRadius: 3, fontSize: 11, fontWeight: 600, cursor: 'pointer'
}
const btnSecondary: React.CSSProperties = {
  padding: '9px 16px', background: '#fff', color: '#374151',
  border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12, fontWeight: 500, cursor: 'pointer'
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', border: '1px solid #d1d5db',
  borderRadius: 4, fontSize: 13, background: '#fff', outline: 'none',
  fontFamily: 'inherit'
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 600,
  color: '#6b7280', textTransform: 'uppercase',
  letterSpacing: '0.04em', marginBottom: 5
}
const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 100, padding: 20
}
const modalStyle: React.CSSProperties = {
  background: '#fff', borderRadius: 8, width: '100%',
  maxHeight: '90vh', overflowY: 'auto',
  boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
}

function Tab({ activo, onClick, count, color, paso, children }: any) {
  return (
    <button onClick={onClick} style={{
      padding: '10px 18px', background: 'none', border: 'none',
      borderBottom: `2px solid ${activo ? '#185FA5' : 'transparent'}`,
      color: activo ? '#185FA5' : '#6b7280',
      fontSize: 13, fontWeight: activo ? 600 : 500,
      cursor: 'pointer', marginBottom: -1,
      display: 'flex', alignItems: 'center', gap: 8
    }}>
      {paso && (
        <span style={{
          width: 18, height: 18, borderRadius: '50%',
          background: activo ? '#185FA5' : '#e5e7eb',
          color: activo ? '#fff' : '#6b7280',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 700
        }}>
          {paso}
        </span>
      )}
      {children}
      {count > 0 && (
        <span style={{
          padding: '1px 7px', background: color || '#9ca3af', color: '#fff',
          fontSize: 10, fontWeight: 700, borderRadius: 10
        }}>
          {count}
        </span>
      )}
    </button>
  )
}

function Empty({ titulo }: any) {
  return (
    <div style={{
      background: '#F9FAFB', border: '1px dashed #d1d5db',
      padding: 40, borderRadius: 6, textAlign: 'center',
      fontSize: 13, color: '#6b7280'
    }}>
      {titulo}
    </div>
  )
}
