'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth'

export default function OrdenesServicioPage() {
  const { usuario } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [ordenes, setOrdenes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<string>('todas')
  const [busqueda, setBusqueda] = useState('')

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
    setLoading(true)
    setError(null)

    try {
      // Cargar OS (sin join forzado, por si la relación no existe)
      const { data: osData, error: osError } = await supabase
        .from('ordenes_servicio')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)

      if (osError) {
        console.error('Error:', osError)
        setError(osError.message)
        setLoading(false)
        return
      }

      if (!osData || osData.length === 0) {
        setOrdenes([])
        setLoading(false)
        return
      }

      // Enriquecer con proveedores si existen
      const proveedorIds = [...new Set(osData.map((o: any) => o.proveedor_id).filter(Boolean))]
      let proveedores: any[] = []
      if (proveedorIds.length > 0) {
        const { data: provs } = await supabase
          .from('proveedores')
          .select('id, razon_social, codigo')
          .in('id', proveedorIds)
        proveedores = provs || []
      }

      // Enriquecer con solicitudes si están linkeadas
      const solicitudIds = [...new Set(osData.map((o: any) => o.solicitud_id).filter(Boolean))]
      let solicitudes: any[] = []
      if (solicitudIds.length > 0) {
        const { data: sols } = await supabase
          .from('solicitudes')
          .select('id, descripcion, centro_costo')
          .in('id', solicitudIds)
        solicitudes = sols || []
      }

      const enriched = osData.map((o: any) => ({
        ...o,
        proveedor: proveedores.find(p => p.id === o.proveedor_id),
        solicitud: solicitudes.find(s => s.id === o.solicitud_id)
      }))

      setOrdenes(enriched)
      setLoading(false)
    } catch (err: any) {
      console.error('Error:', err)
      setError(err.message || 'Error al cargar')
      setLoading(false)
    }
  }

  const estadoConfig: Record<string, { bg: string; color: string; label: string }> = {
    pendiente:    { bg: '#FEF3C7', color: '#92400E', label: 'Pendiente' },
    aprobada:     { bg: '#DBEAFE', color: '#1E40AF', label: 'Aprobada' },
    en_ejecucion: { bg: '#E0E7FF', color: '#3730A3', label: 'En ejecución' },
    ejecutada:    { bg: '#D1FAE5', color: '#065F46', label: 'Ejecutada' },
    validada:     { bg: '#D1FAE5', color: '#065F46', label: 'Validada' },
    rechazada:    { bg: '#FEE2E2', color: '#991B1B', label: 'Rechazada' },
    cancelada:    { bg: '#F3F4F6', color: '#374151', label: 'Cancelada' },
  }

  const ordenesFiltradas = ordenes
    .filter(o => filtro === 'todas' || o.estado === filtro)
    .filter(o => {
      if (!busqueda) return true
      const q = busqueda.toLowerCase()
      return (
        o.numero_os?.toLowerCase().includes(q) ||
        o.descripcion?.toLowerCase().includes(q) ||
        o.proveedor?.razon_social?.toLowerCase().includes(q)
      )
    })

  const stats = {
    total: ordenes.length,
    pendientes: ordenes.filter(o => o.estado === 'pendiente').length,
    enEjecucion: ordenes.filter(o => o.estado === 'en_ejecucion' || o.estado === 'aprobada').length,
    ejecutadas: ordenes.filter(o => o.estado === 'ejecutada' || o.estado === 'validada').length,
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Cargando...</div>
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
            Órdenes de Servicio
          </h1>
          <div style={{ fontSize: 13, color: '#6b7280' }}>
            OS emitidas a proveedores
          </div>
        </div>
        <button
          onClick={() => router.push('/nueva-of')}
          style={{
            padding: '10px 20px', background: '#185FA5', color: '#fff',
            border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          + Nueva OS
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{
          background: '#FEE2E2', border: '1px solid #FCA5A5',
          borderRadius: 6, padding: 14, marginBottom: 16
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#991B1B', marginBottom: 4 }}>
            Problema al cargar
          </div>
          <div style={{ fontSize: 12, color: '#7F1D1D', fontFamily: 'monospace' }}>
            {error}
          </div>
          <div style={{ fontSize: 11, color: '#7F1D1D', marginTop: 6 }}>
            Esto sucede si la tabla <code>ordenes_servicio</code> no existe o no tiene columnas esperadas.
            Contactá al administrador del sistema.
          </div>
        </div>
      )}

      {/* Stats */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 12, marginBottom: 20
      }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', padding: 14, borderRadius: 6 }}>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Total</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{stats.total}</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', padding: 14, borderRadius: 6 }}>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Pendientes</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#F59E0B' }}>{stats.pendientes}</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', padding: 14, borderRadius: 6 }}>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>En ejecución</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#185FA5' }}>{stats.enEjecucion}</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', padding: 14, borderRadius: 6 }}>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Ejecutadas</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#10B981' }}>{stats.ejecutadas}</div>
        </div>
      </div>

      {/* Filtros */}
      <div style={{
        display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap'
      }}>
        <input
          type="text"
          placeholder="Buscar por número, descripción, proveedor..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          style={{
            flex: 1, minWidth: 250, padding: '8px 12px',
            border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13,
            outline: 'none'
          }}
        />
        <select
          value={filtro}
          onChange={e => setFiltro(e.target.value)}
          style={{
            padding: '8px 12px', border: '1px solid #d1d5db',
            borderRadius: 4, fontSize: 13, background: '#fff', cursor: 'pointer'
          }}
        >
          <option value="todas">Todas</option>
          <option value="pendiente">Pendientes</option>
          <option value="aprobada">Aprobadas</option>
          <option value="en_ejecucion">En ejecución</option>
          <option value="ejecutada">Ejecutadas</option>
          <option value="validada">Validadas</option>
        </select>
      </div>

      {/* Lista */}
      {ordenesFiltradas.length === 0 ? (
        <div style={{
          background: '#F9FAFB', border: '1px dashed #d1d5db',
          padding: 40, borderRadius: 6, textAlign: 'center'
        }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#6b7280' }}>
            {ordenes.length === 0 ? 'No hay órdenes de servicio' : 'No hay OS con esos filtros'}
          </div>
        </div>
      ) : (
        <div style={{
          background: '#fff', border: '1px solid #e5e7eb',
          borderRadius: 6, overflow: 'hidden'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '130px 2fr 1.5fr 1fr 120px 110px',
            padding: '10px 16px', background: '#F9FAFB',
            borderBottom: '1px solid #e5e7eb',
            fontSize: 11, fontWeight: 600, color: '#6b7280',
            textTransform: 'uppercase', letterSpacing: '0.04em'
          }}>
            <div>N° OS</div>
            <div>Descripción</div>
            <div>Proveedor</div>
            <div>Fecha emisión</div>
            <div>Estado</div>
            <div style={{ textAlign: 'right' }}>Valor</div>
          </div>

          {ordenesFiltradas.map(o => {
            const c = estadoConfig[o.estado] || estadoConfig.pendiente
            return (
              <div
                key={o.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '130px 2fr 1.5fr 1fr 120px 110px',
                  padding: '12px 16px',
                  borderBottom: '1px solid #f3f4f6',
                  fontSize: 13, alignItems: 'center'
                }}
              >
                <div style={{ fontWeight: 600, color: '#185FA5', fontSize: 12 }}>
                  {o.numero_os || `OS-${o.id?.slice(0, 6)}`}
                </div>
                <div>
                  <div style={{ fontWeight: 500, color: '#111', marginBottom: 2 }}>
                    {o.descripcion || '(sin descripción)'}
                  </div>
                  {o.solicitud && (
                    <div style={{ fontSize: 11, color: '#6b7280' }}>
                      De: {o.solicitud.descripcion}
                    </div>
                  )}
                </div>
                <div style={{ color: '#374151', fontSize: 12 }}>
                  {o.proveedor?.razon_social || '—'}
                </div>
                <div style={{ color: '#6b7280', fontSize: 12 }}>
                  {o.fecha_emision
                    ? new Date(o.fecha_emision).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: '2-digit' })
                    : '—'}
                </div>
                <div>
                  <span style={{
                    padding: '3px 8px', borderRadius: 3, fontSize: 10,
                    fontWeight: 600, background: c.bg, color: c.color
                  }}>
                    {c.label}
                  </span>
                </div>
                <div style={{ textAlign: 'right', fontWeight: 600, color: '#185FA5' }}>
                  ${(o.valor_total || 0).toLocaleString('es-CO')}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
