'use client'
import { useEffect, useState } from 'react'
import { supabase, OrdenFacturacion } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { usePermissions } from '@/lib/permissions'
import { RouteGuard } from '@/components/RouteGuard'

const fmt = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

function Badge({ val }: { val: string }) {
  const map: Record<string, string> = {
    PENDIENTE: '#FAEEDA|#633806', PARCIAL: '#E6F1FB|#0C447C',
    PAGADO: '#EAF3DE|#27500A', OK: '#EAF3DE|#27500A',
    EN_REVISION: '#FAEEDA|#633806', ANULADA: '#FCEBEB|#791F1F',
  }
  const [bg, color] = (map[val] || '#f0f0f0|#666').split('|')
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: bg, color }}>
      {val}
    </span>
  )
}

export default function OrdenesPage() {
  const { usuario } = useAuth()
  const [ofs, setOfs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [busca, setBusca] = useState('')

  useEffect(() => { if (usuario) loadOfs() }, [usuario])

  async function loadOfs() {
    if (!usuario) return

    const permisos = usePermissions(usuario.rol, usuario.id)
    const filtros = permisos.getFiltrosSupabase()

    // Construir query con filtros según rol
    let query = supabase
      .from('ordenes_facturacion')
      .select(`*, proveedores(razon_social, codigo), encargado:usuarios!encargado_id(nombre)`)
      .order('created_at', { ascending: false })

    // Aplicar filtros según rol
    if (filtros.encargado_id) {
      query = query.eq('encargado_id', filtros.encargado_id)
    }
    if (filtros.solicitante_id) {
      query = query.eq('solicitante_id', filtros.solicitante_id)
    }

    const { data } = await query
    setOfs(data || [])
    setLoading(false)
  }

  const datos = ofs.filter(of => {
    const pv = of.proveedores?.razon_social?.toLowerCase() || ''
    return (!filtroEstado || of.estado_pago === filtroEstado) &&
      (!busca || pv.includes(busca.toLowerCase()) || of.codigo_of.toLowerCase().includes(busca.toLowerCase()))
  })

  return (
    <RouteGuard modulo="ordenes">
      <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 17, fontWeight: 500 }}>Órdenes de facturación</div>
        <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>Gestión y seguimiento de OFs</div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
          style={{ padding: '7px 10px', border: '0.5px solid #d3d1c7', borderRadius: 8, fontSize: 13, background: '#fff', width: 160 }}>
          <option value="">Todos los estados</option>
          {['PENDIENTE', 'PARCIAL', 'PAGADO'].map(e => <option key={e}>{e}</option>)}
        </select>
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar proveedor o código..."
          style={{ padding: '7px 10px', border: '0.5px solid #d3d1c7', borderRadius: 8, fontSize: 13, width: 240 }} />
      </div>

      <div style={{ background: '#fff', border: '0.5px solid #ebebeb', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 24, color: '#aaa', fontSize: 13 }}>Cargando órdenes...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Código OF', 'Proveedor', 'Encargado', 'Valor total', 'Estado pago', 'Verificación', 'Fecha requerida'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 600, color: '#999', borderBottom: '1px solid #f0f0f0', textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {datos.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 24, color: '#aaa', fontSize: 13, textAlign: 'center' }}>No hay órdenes registradas</td></tr>
              ) : datos.map(of => (
                <tr key={of.id} style={{ cursor: 'default' }}>
                  <td style={{ padding: '9px 12px', borderBottom: '1px solid #f8f8f8', fontFamily: 'monospace', fontSize: 11 }}>{of.codigo_of}</td>
                  <td style={{ padding: '9px 12px', borderBottom: '1px solid #f8f8f8', fontWeight: 500, fontSize: 13 }}>{of.proveedores?.razon_social || '—'}</td>
                  <td style={{ padding: '9px 12px', borderBottom: '1px solid #f8f8f8', fontSize: 13 }}>{of.encargado?.nombre || '—'}</td>
                  <td style={{ padding: '9px 12px', borderBottom: '1px solid #f8f8f8', fontSize: 13 }}>{fmt(Number(of.valor_total))}</td>
                  <td style={{ padding: '9px 12px', borderBottom: '1px solid #f8f8f8' }}><Badge val={of.estado_pago} /></td>
                  <td style={{ padding: '9px 12px', borderBottom: '1px solid #f8f8f8' }}><Badge val={of.estado_verificacion} /></td>
                  <td style={{ padding: '9px 12px', borderBottom: '1px solid #f8f8f8', fontSize: 12, color: '#888' }}>{of.fecha_requerida || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
    </RouteGuard>
  )
}
