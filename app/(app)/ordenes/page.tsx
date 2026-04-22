'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth'

export default function OrdenesPage() {
  const { usuario } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [ofs, setOfs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('todas')
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
    try {
      const { data, error } = await supabase
        .from('ordenes_facturacion')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)

      if (error) {
        console.error(error)
        setLoading(false)
        return
      }

      if (!data || data.length === 0) {
        setOfs([])
        setLoading(false)
        return
      }

      // Enriquecer con proveedor y solicitud
      const proveedorIds = [...new Set(data.map((o: any) => o.proveedor_id).filter(Boolean))]
      const solicitudIds = [...new Set(data.map((o: any) => o.solicitud_id).filter(Boolean))]

      const [provs, sols] = await Promise.all([
        proveedorIds.length > 0
          ? supabase.from('proveedores').select('id, razon_social, codigo').in('id', proveedorIds)
          : Promise.resolve({ data: [] }),
        solicitudIds.length > 0
          ? supabase.from('solicitudes').select('id, descripcion, solicitante_id, centro_costo').in('id', solicitudIds)
          : Promise.resolve({ data: [] })
      ])

      const enriched = data.map((o: any) => ({
        ...o,
        proveedor: (provs.data || []).find((p: any) => p.id === o.proveedor_id),
        solicitud: (sols.data || []).find((s: any) => s.id === o.solicitud_id)
      }))

      setOfs(enriched)
      setLoading(false)
    } catch (err) {
      console.error(err)
      setLoading(false)
    }
  }

  const estadoConfig: Record<string, { bg: string; color: string; label: string }> = {
    PENDIENTE:    { bg: '#FEF3C7', color: '#92400E', label: 'Pendiente' },
    EN_PROCESO:   { bg: '#DBEAFE', color: '#1E40AF', label: 'En proceso' },
    EN_REVISION:  { bg: '#FEF3C7', color: '#92400E', label: 'En revisión' },
    APROBADA:     { bg: '#D1FAE5', color: '#065F46', label: 'Aprobada' },
    ENVIADA:      { bg: '#E0E7FF', color: '#3730A3', label: 'Enviada proveedor' },
    PAGADA:       { bg: '#D1FAE5', color: '#065F46', label: 'Pagada' },
    PAGADO:       { bg: '#D1FAE5', color: '#065F46', label: 'Pagada' },
    PARCIAL:      { bg: '#FED7AA', color: '#9A3412', label: 'Pago parcial' },
    ANULADA:      { bg: '#FEE2E2', color: '#991B1B', label: 'Anulada' },
  }

  const ofsFiltradas = ofs
    .filter(of => {
      if (filtro === 'todas') return true
      if (filtro === 'pendientes') return ['PENDIENTE', 'EN_PROCESO', 'EN_REVISION'].includes(of.estado_verificacion)
      if (filtro === 'aprobadas') return of.estado_verificacion === 'APROBADA'
      if (filtro === 'pagadas') return ['PAGADA', 'PAGADO'].includes(of.estado_pago)
      if (filtro === 'sin_pagar') return !['PAGADA', 'PAGADO'].includes(of.estado_pago) && of.estado_verificacion === 'APROBADA'
      return true
    })
    .filter(of => {
      if (!busqueda) return true
      const q = busqueda.toLowerCase()
      return (
        of.codigo_of?.toLowerCase().includes(q) ||
        of.descripcion?.toLowerCase().includes(q) ||
        of.proveedor?.razon_social?.toLowerCase().includes(q)
      )
    })

  const stats = {
    total: ofs.length,
    pendientes: ofs.filter(o => ['PENDIENTE', 'EN_PROCESO', 'EN_REVISION'].includes(o.estado_verificacion)).length,
    aprobadas: ofs.filter(o => o.estado_verificacion === 'APROBADA' && !['PAGADA', 'PAGADO'].includes(o.estado_pago)).length,
    pagadas: ofs.filter(o => ['PAGADA', 'PAGADO'].includes(o.estado_pago)).length,
    montoTotal: ofs.reduce((s, o) => s + (parseFloat(o.valor_total) || 0), 0),
    montoPendiente: ofs
      .filter(o => !['PAGADA', 'PAGADO'].includes(o.estado_pago))
      .reduce((s, o) => s + (parseFloat(o.valor_total) || 0), 0)
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Cargando...</div>
  }

  return (
    <div style={{ padding: 32, maxWidth: 1300, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111', margin: 0, marginBottom: 4 }}>
            Órdenes de Facturación
          </h1>
          <div style={{ fontSize: 13, color: '#6b7280' }}>
            Documentos oficiales emitidos a proveedores para autorizar facturación
          </div>
        </div>
      </div>

      {/* Info del proceso */}
      <div style={{
        background: '#EFF6FF', border: '1px solid #BFDBFE',
        borderRadius: 6, padding: 14, marginBottom: 20,
        fontSize: 12, color: '#1E40AF', lineHeight: 1.5
      }}>
        <strong>¿Qué es una OF?</strong> Es el documento oficial que Feeling Company emite al proveedor
        autorizándolo a facturar por el servicio/producto contratado. Se genera desde una solicitud
        aprobada y se envía al proveedor para que pueda facturarnos legalmente.
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', padding: 14, borderRadius: 6 }}>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Total OFs</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{stats.total}</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', padding: 14, borderRadius: 6 }}>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Por aprobar</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#F59E0B' }}>{stats.pendientes}</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', padding: 14, borderRadius: 6 }}>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Aprobadas (por pagar)</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#185FA5' }}>{stats.aprobadas}</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', padding: 14, borderRadius: 6 }}>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Pagadas</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#10B981' }}>{stats.pagadas}</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', padding: 14, borderRadius: 6 }}>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Por pagar</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#DC2626' }}>
            ${stats.montoPendiente.toLocaleString('es-CO')}
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Buscar código, proveedor, descripción..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          style={{
            flex: 1, minWidth: 250, padding: '8px 12px',
            border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13, outline: 'none'
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
          <option value="pendientes">Por aprobar</option>
          <option value="aprobadas">Aprobadas</option>
          <option value="sin_pagar">Por pagar</option>
          <option value="pagadas">Pagadas</option>
        </select>
      </div>

      {/* Lista */}
      {ofsFiltradas.length === 0 ? (
        <div style={{
          background: '#F9FAFB', border: '1px dashed #d1d5db',
          padding: 40, borderRadius: 6, textAlign: 'center'
        }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#6b7280', marginBottom: 6 }}>
            {ofs.length === 0 ? 'No hay órdenes de facturación' : 'No hay OFs con esos filtros'}
          </div>
          {ofs.length === 0 && (
            <div style={{ fontSize: 12, color: '#9ca3af' }}>
              Las OFs se crean desde el detalle de una solicitud aprobada.
              Andá a <button
                onClick={() => router.push('/cotizaciones')}
                style={{ background: 'none', border: 'none', color: '#185FA5', cursor: 'pointer', textDecoration: 'underline' }}
              >Cotizaciones</button> para ver las listas para emitir OF.
            </div>
          )}
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '130px 2fr 1.5fr 100px 140px 130px 120px',
            padding: '10px 16px', background: '#F9FAFB',
            borderBottom: '1px solid #e5e7eb',
            fontSize: 11, fontWeight: 600, color: '#6b7280',
            textTransform: 'uppercase', letterSpacing: '0.04em'
          }}>
            <div>Código OF</div>
            <div>Descripción</div>
            <div>Proveedor</div>
            <div>Fecha</div>
            <div>Verificación</div>
            <div>Pago</div>
            <div style={{ textAlign: 'right' }}>Valor</div>
          </div>

          {/* Rows */}
          {ofsFiltradas.map(of => {
            const verif = estadoConfig[of.estado_verificacion] || estadoConfig.PENDIENTE
            const pago = estadoConfig[of.estado_pago] || estadoConfig.PENDIENTE
            return (
              <div
                key={of.id}
                onClick={() => router.push(`/ordenes/${of.id}`)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '130px 2fr 1.5fr 100px 140px 130px 120px',
                  padding: '12px 16px', borderBottom: '1px solid #f3f4f6',
                  fontSize: 13, cursor: 'pointer', alignItems: 'center',
                  transition: 'background 0.1s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
                onMouseLeave={e => e.currentTarget.style.background = '#fff'}
              >
                <div style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600, color: '#185FA5' }}>
                  {of.codigo_of}
                </div>
                <div>
                  <div style={{ fontWeight: 500, color: '#111', marginBottom: 2 }}>
                    {of.descripcion || '(sin descripción)'}
                  </div>
                  {of.solicitud && (
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>
                      De solicitud: {of.solicitud.descripcion}
                    </div>
                  )}
                </div>
                <div style={{ color: '#374151', fontSize: 12 }}>
                  {of.proveedor?.razon_social || '—'}
                </div>
                <div style={{ color: '#6b7280', fontSize: 12 }}>
                  {of.created_at ? new Date(of.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
                </div>
                <div>
                  <span style={{
                    padding: '3px 8px', borderRadius: 3, fontSize: 10,
                    fontWeight: 600, background: verif.bg, color: verif.color
                  }}>
                    {verif.label}
                  </span>
                </div>
                <div>
                  <span style={{
                    padding: '3px 8px', borderRadius: 3, fontSize: 10,
                    fontWeight: 600, background: pago.bg, color: pago.color
                  }}>
                    {pago.label}
                  </span>
                </div>
                <div style={{ textAlign: 'right', fontWeight: 600, color: '#185FA5' }}>
                  ${(parseFloat(of.valor_total) || 0).toLocaleString('es-CO')}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
