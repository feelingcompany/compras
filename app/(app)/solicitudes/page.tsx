'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth'

export default function SolicitudesPage() {
  const { usuario } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [solicitudes, setSolicitudes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState<string>('todos')
  const [busqueda, setBusqueda] = useState('')

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
      // 1. Cargar solicitudes (filtradas por rol)
      let query = supabase
        .from('solicitudes')
        .select('*')
        .order('created_at', { ascending: false })

      // Solicitante solo ve las suyas
      if (usuario.rol === 'solicitante') {
        query = query.eq('solicitante_id', usuario.id)
      }

      const { data: solicitudesData, error } = await query

      if (error) {
        console.error('Error:', error)
        setLoading(false)
        return
      }

      if (!solicitudesData || solicitudesData.length === 0) {
        setSolicitudes([])
        setLoading(false)
        return
      }

      // 2. Cargar datos relacionados en paralelo
      const solicitudIds = solicitudesData.map(s => s.id)
      const solicitanteIds = [...new Set(solicitudesData.map(s => s.solicitante_id))]

      const [
        { data: solicitantes },
        { data: items },
        { data: aprobaciones }
      ] = await Promise.all([
        supabase.from('usuarios').select('id, nombre, email').in('id', solicitanteIds),
        supabase.from('items_solicitud').select('*').in('solicitud_id', solicitudIds),
        supabase.from('aprobaciones').select('*').in('solicitud_id', solicitudIds)
      ])

      // 3. Armar estructura
      const enriched = solicitudesData.map(s => {
        const solicitante = (solicitantes || []).find(u => u.id === s.solicitante_id)
        const solItems = (items || []).filter(i => i.solicitud_id === s.id)
        const solAprobaciones = (aprobaciones || []).filter(a => a.solicitud_id === s.id)
        const monto = solItems.reduce((sum, i) => sum + (parseFloat(i.presupuesto_estimado) || 0), 0)

        return {
          ...s,
          solicitante,
          items: solItems,
          aprobaciones: solAprobaciones,
          monto_total: monto
        }
      })

      setSolicitudes(enriched)
      setLoading(false)
    } catch (error) {
      console.error('Error:', error)
      setLoading(false)
    }
  }

  const getEstadoBadge = (estado: string) => {
    const config: Record<string, { bg: string; color: string; label: string }> = {
      pendiente:  { bg: '#FEF3C7', color: '#92400E', label: 'Pendiente de aprobación' },
      aprobada:   { bg: '#D1FAE5', color: '#065F46', label: 'Aprobada' },
      rechazada:  { bg: '#FEE2E2', color: '#991B1B', label: 'Rechazada' },
      cotizando:  { bg: '#DBEAFE', color: '#1E40AF', label: 'En cotización' },
      ordenada:   { bg: '#E0E7FF', color: '#3730A3', label: 'Orden emitida' },
      completada: { bg: '#F3F4F6', color: '#374151', label: 'Completada' },
    }
    const c = config[estado?.toLowerCase()] || config.pendiente
    return (
      <span style={{
        padding: '3px 9px', borderRadius: 3, fontSize: 10,
        fontWeight: 600, background: c.bg, color: c.color,
        whiteSpace: 'nowrap'
      }}>
        {c.label}
      </span>
    )
  }

  const getPrioridadBadge = (prioridad: string) => {
    if (!prioridad || prioridad === 'normal') return null
    const config: Record<string, { color: string; label: string }> = {
      urgente:  { color: '#F59E0B', label: 'Urgente' },
      critico:  { color: '#EF4444', label: 'Crítica' },
    }
    const c = config[prioridad?.toLowerCase()]
    if (!c) return null
    return (
      <span style={{
        padding: '2px 7px', borderRadius: 3, fontSize: 10,
        fontWeight: 600, background: c.color + '20', color: c.color,
        textTransform: 'uppercase'
      }}>
        {c.label}
      </span>
    )
  }

  const solicitudesFiltradas = solicitudes.filter(s => {
    if (filtroEstado !== 'todos' && s.estado?.toLowerCase() !== filtroEstado) return false
    if (busqueda) {
      const q = busqueda.toLowerCase()
      return (
        s.descripcion?.toLowerCase().includes(q) ||
        s.centro_costo?.toLowerCase().includes(q) ||
        s.solicitante?.nombre?.toLowerCase().includes(q) ||
        s.ot_os?.toLowerCase().includes(q)
      )
    }
    return true
  })

  const stats = {
    total: solicitudes.length,
    pendientes: solicitudes.filter(s => s.estado === 'pendiente').length,
    aprobadas: solicitudes.filter(s => s.estado === 'aprobada').length,
    montoTotal: solicitudes.reduce((sum, s) => sum + s.monto_total, 0)
  }

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
        Cargando solicitudes...
      </div>
    )
  }

  return (
    <div style={{ padding: 32, maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-start', marginBottom: 20
      }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111', margin: 0, marginBottom: 4 }}>
            Solicitudes de compra
          </h1>
          <div style={{ fontSize: 13, color: '#6b7280' }}>
            {usuario?.rol === 'solicitante'
              ? 'Tus solicitudes'
              : 'Todas las solicitudes del sistema'}
          </div>
        </div>
        <button
          onClick={() => router.push('/solicitudes/nueva')}
          style={{
            padding: '10px 20px', background: '#185FA5', color: '#fff',
            border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          + Nueva solicitud
        </button>
      </div>

      {/* Toggle de vista: Lista / Pipeline */}
      {['encargado', 'admin_compras', 'gerencia'].includes(usuario?.rol || '') && (
        <div style={{
          display: 'flex', gap: 4, marginBottom: 20,
          borderBottom: '1px solid #e5e7eb'
        }}>
          <button
            style={{
              padding: '10px 20px', background: 'none',
              border: 'none', borderBottom: '2px solid #185FA5',
              color: '#185FA5', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', marginBottom: -1
            }}
          >
            Lista
          </button>
          <button
            onClick={() => router.push('/pipeline')}
            style={{
              padding: '10px 20px', background: 'none',
              border: 'none', borderBottom: '2px solid transparent',
              color: '#6b7280', fontSize: 13, fontWeight: 500,
              cursor: 'pointer', marginBottom: -1
            }}
          >
            Pipeline (Kanban)
          </button>
        </div>
      )}

      {/* Stats */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 12, marginBottom: 24
      }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', padding: 14, borderRadius: 6 }}>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Total</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#111' }}>{stats.total}</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', padding: 14, borderRadius: 6 }}>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Pendientes</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#F59E0B' }}>{stats.pendientes}</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', padding: 14, borderRadius: 6 }}>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Aprobadas</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#10B981' }}>{stats.aprobadas}</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', padding: 14, borderRadius: 6 }}>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Monto total</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#185FA5' }}>
            ${stats.montoTotal.toLocaleString('es-CO')}
          </div>
        </div>
      </div>

      {/* Filtros y búsqueda */}
      <div style={{
        display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center',
        flexWrap: 'wrap'
      }}>
        <input
          type="text"
          placeholder="Buscar por descripción, centro de costo, solicitante..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          style={{
            flex: 1, minWidth: 250, padding: '8px 12px',
            border: '1px solid #d1d5db', borderRadius: 4,
            fontSize: 13, outline: 'none'
          }}
        />
        <select
          value={filtroEstado}
          onChange={e => setFiltroEstado(e.target.value)}
          style={{
            padding: '8px 12px', border: '1px solid #d1d5db',
            borderRadius: 4, fontSize: 13, background: '#fff',
            cursor: 'pointer'
          }}
        >
          <option value="todos">Todos los estados</option>
          <option value="pendiente">Pendientes</option>
          <option value="aprobada">Aprobadas</option>
          <option value="rechazada">Rechazadas</option>
          <option value="cotizando">En cotización</option>
          <option value="completada">Completadas</option>
        </select>
      </div>

      {/* Lista de solicitudes */}
      {solicitudesFiltradas.length === 0 ? (
        <div style={{
          background: '#F9FAFB', border: '1px dashed #d1d5db',
          padding: 48, borderRadius: 6, textAlign: 'center'
        }}>
          <div style={{ fontSize: 15, fontWeight: 500, color: '#6b7280', marginBottom: 6 }}>
            {solicitudes.length === 0
              ? 'No hay solicitudes todavía'
              : 'No hay solicitudes con estos filtros'}
          </div>
          {solicitudes.length === 0 && (
            <button
              onClick={() => router.push('/solicitudes/nueva')}
              style={{
                marginTop: 12, padding: '8px 16px',
                background: '#185FA5', color: '#fff',
                border: 'none', borderRadius: 4, fontSize: 13,
                cursor: 'pointer', fontWeight: 500
              }}
            >
              Crear primera solicitud
            </button>
          )}
        </div>
      ) : (
        <div style={{
          background: '#fff', border: '1px solid #e5e7eb',
          borderRadius: 6, overflow: 'hidden'
        }}>
          {/* Table header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr 1fr 140px 100px',
            padding: '10px 16px', background: '#F9FAFB',
            borderBottom: '1px solid #e5e7eb',
            fontSize: 11, fontWeight: 600, color: '#6b7280',
            textTransform: 'uppercase', letterSpacing: '0.04em'
          }}>
            <div>Solicitud</div>
            <div>Solicitante</div>
            <div>Centro de costo</div>
            <div>Fecha</div>
            <div>Estado</div>
            <div style={{ textAlign: 'right' }}>Monto</div>
          </div>

          {/* Rows */}
          {solicitudesFiltradas.map(s => (
            <div
              key={s.id}
              onClick={() => router.push(`/solicitudes/${s.id}`)}
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr 1fr 140px 100px',
                padding: '14px 16px',
                borderBottom: '1px solid #f3f4f6',
                fontSize: 13, cursor: 'pointer',
                alignItems: 'center',
                transition: 'background 0.1s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
              onMouseLeave={e => e.currentTarget.style.background = '#fff'}
            >
              <div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 3 }}>
                  {getPrioridadBadge(s.prioridad)}
                  <span style={{ fontWeight: 500, color: '#111' }}>
                    {s.descripcion || '(Sin descripción)'}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>
                  {s.items.length} ítem{s.items.length !== 1 ? 's' : ''}
                  {s.ot_os && ` · ${s.ot_os}`}
                  {s.ciudad && ` · ${s.ciudad}`}
                </div>
              </div>
              <div style={{ color: '#374151' }}>
                {s.solicitante?.nombre || '—'}
              </div>
              <div style={{ color: '#374151', fontSize: 12 }}>
                {s.centro_costo || '—'}
              </div>
              <div style={{ color: '#6b7280', fontSize: 12 }}>
                {new Date(s.created_at).toLocaleDateString('es-CO', {
                  day: '2-digit', month: 'short', year: '2-digit'
                })}
              </div>
              <div>
                {getEstadoBadge(s.estado)}
              </div>
              <div style={{ textAlign: 'right', fontWeight: 600, color: '#185FA5' }}>
                ${s.monto_total.toLocaleString('es-CO')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
