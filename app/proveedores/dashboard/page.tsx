'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ProveedoresDashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [proveedor, setProveedor] = useState<any>(null)
  const [ofs, setOfs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('todas') // todas, pendientes, entregadas
  
  useEffect(() => {
    // Verificar sesión
    const sessionData = localStorage.getItem('proveedor_portal')
    if (!sessionData) {
      router.push('/proveedores/login')
      return
    }
    
    const proveedorData = JSON.parse(sessionData)
    setProveedor(proveedorData)
    cargarOfs(proveedorData.proveedor.id)
  }, [])
  
  const cargarOfs = async (proveedorId: string) => {
    setLoading(true)
    
    const { data, error } = await supabase
      .from('ofs')
      .select(`
        *,
        solicitud:solicitudes(
          descripcion,
          solicitante:usuarios(nombre)
        )
      `)
      .eq('proveedor_id', proveedorId)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Error:', error)
      alert('Error al cargar OFs')
    } else {
      setOfs(data || [])
    }
    
    setLoading(false)
  }
  
  const logout = () => {
    localStorage.removeItem('proveedor_portal')
    router.push('/proveedores/login')
  }
  
  const actualizarEstado = async (ofId: string, nuevoEstado: string) => {
    if (!confirm(`¿Cambiar estado a "${nuevoEstado}"?`)) return
    
    try {
      // 1. Actualizar OF
      const { error: errorOf } = await supabase
        .from('ofs')
        .update({ estado: nuevoEstado })
        .eq('id', ofId)
      
      if (errorOf) throw errorOf
      
      // 2. Registrar actualización
      const { error: errorUpdate } = await supabase
        .from('actualizaciones_proveedor')
        .insert({
          of_id: ofId,
          proveedor_id: proveedor.proveedor.id,
          tipo: 'estado',
          estado_nuevo: nuevoEstado,
          contenido: `Estado actualizado a ${nuevoEstado}`
        })
      
      if (errorUpdate) throw errorUpdate
      
      alert('✅ Estado actualizado')
      cargarOfs(proveedor.proveedor.id)
      
    } catch (error: any) {
      console.error('Error:', error)
      alert('Error al actualizar: ' + error.message)
    }
  }
  
  const ofsFiltradas = ofs.filter(of => {
    if (filtro === 'pendientes') {
      return of.estado === 'aprobada' || of.estado === 'radicada'
    }
    if (filtro === 'entregadas') {
      return of.estado === 'recibida' || of.estado === 'pagada'
    }
    return true
  })
  
  const estadisticas = {
    pendientes: ofs.filter(of => of.estado === 'aprobada' || of.estado === 'radicada').length,
    entregadas: ofs.filter(of => of.estado === 'recibida').length,
    pagadas: ofs.filter(of => of.estado === 'pagada').length,
    totalFacturado: ofs
      .filter(of => of.estado === 'pagada')
      .reduce((sum, of) => sum + (of.valor_total || 0), 0),
    pendientePago: ofs
      .filter(of => of.estado === 'recibida')
      .reduce((sum, of) => sum + (of.valor_total || 0), 0)
  }
  
  if (!proveedor) {
    return null
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Portal de Proveedores</h1>
              <p className="text-sm text-gray-500">{proveedor.proveedor.nombre}</p>
            </div>
            <button
              onClick={logout}
              className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-600">Pendientes de Entregar</div>
            <div className="text-2xl font-bold text-orange-600 mt-1">{estadisticas.pendientes}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-600">Entregadas</div>
            <div className="text-2xl font-bold text-green-600 mt-1">{estadisticas.entregadas}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-600">Pagadas</div>
            <div className="text-2xl font-bold text-blue-600 mt-1">{estadisticas.pagadas}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-600">Total Facturado</div>
            <div className="text-xl font-bold text-gray-900 mt-1">
              ${(estadisticas.totalFacturado / 1000000).toFixed(1)}M
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-600">Pendiente de Pago</div>
            <div className="text-xl font-bold text-purple-600 mt-1">
              ${(estadisticas.pendientePago / 1000000).toFixed(1)}M
            </div>
          </div>
        </div>
        
        {/* Filtros */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="flex gap-2">
            {[
              { value: 'todas', label: 'Todas las OFs' },
              { value: 'pendientes', label: 'Pendientes de Entregar' },
              { value: 'entregadas', label: 'Entregadas' }
            ].map(f => (
              <button
                key={f.value}
                onClick={() => setFiltro(f.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  filtro === f.value
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        
        {/* Lista de OFs */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-400">Cargando...</div>
          ) : ofsFiltradas.length === 0 ? (
            <div className="p-12 text-center text-gray-400">No hay OFs con este filtro</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Código</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descripción</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valor</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {ofsFiltradas.map(of => (
                    <tr key={of.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{of.codigo}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 max-w-md truncate">
                        {of.solicitud?.descripcion || of.descripcion || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                        ${(of.valor_total / 1000000).toFixed(2)}M
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          of.estado === 'aprobada' ? 'bg-yellow-100 text-yellow-800' :
                          of.estado === 'radicada' ? 'bg-orange-100 text-orange-800' :
                          of.estado === 'recibida' ? 'bg-green-100 text-green-800' :
                          of.estado === 'pagada' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {of.estado}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(of.created_at).toLocaleDateString('es-CO')}
                      </td>
                      <td className="px-6 py-4">
                        {(of.estado === 'aprobada' || of.estado === 'radicada') && (
                          <button
                            onClick={() => actualizarEstado(of.id, 'recibida')}
                            className="px-3 py-1 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700"
                          >
                            ✓ Marcar Entregada
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
