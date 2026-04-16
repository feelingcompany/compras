'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth'
import { useRouter } from 'next/navigation'

export default function SolicitudesPendientesPage() {
  const { usuario } = useAuth()
  const router = useRouter()
  const supabase = createClient()
  
  const [solicitudes, setSolicitudes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  
  useEffect(() => {
    if (!usuario) {
      router.push('/login')
      return
    }
    
    // Solo admins pueden ver esto
    if (usuario.rol !== 'admin_compras' && usuario.rol !== 'gerencia') {
      alert('No tenés permisos para acceder a esta página')
      router.push('/')
      return
    }
    
    cargarSolicitudes()
  }, [usuario])
  
  const cargarSolicitudes = async () => {
    setLoading(true)
    
    const { data, error } = await supabase
      .from('solicitudes_acceso')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Error:', error)
      alert('Error al cargar solicitudes')
    } else {
      setSolicitudes(data || [])
    }
    
    setLoading(false)
  }
  
  const aprobar = async (solicitud: any) => {
    if (!confirm(`¿Aprobar acceso para ${solicitud.nombre_completo}?`)) return
    
    setProcessing(solicitud.id)
    
    try {
      // 1. Crear usuario
      const { error: errorUsuario } = await supabase
        .from('usuarios')
        .insert({
          nombre: solicitud.nombre_completo,
          email: solicitud.email,
          pin: solicitud.pin,
          rol: 'solicitante',
          area: solicitud.area,
          activo: true
        })
      
      if (errorUsuario) throw errorUsuario
      
      // 2. Marcar solicitud como aprobada
      const { error: errorSolicitud } = await supabase
        .from('solicitudes_acceso')
        .update({
          estado: 'aprobado',
          aprobado_por: usuario?.id,
          aprobado_en: new Date().toISOString()
        })
        .eq('id', solicitud.id)
      
      if (errorSolicitud) throw errorSolicitud
      
      alert(`✅ Acceso aprobado para ${solicitud.nombre_completo}`)
      cargarSolicitudes()
      
    } catch (error: any) {
      console.error('Error:', error)
      alert('Error al aprobar: ' + error.message)
    } finally {
      setProcessing(null)
    }
  }
  
  const rechazar = async (solicitud: any) => {
    const motivo = prompt('¿Por qué se rechaza esta solicitud?')
    if (!motivo) return
    
    setProcessing(solicitud.id)
    
    try {
      const { error } = await supabase
        .from('solicitudes_acceso')
        .update({
          estado: 'rechazado',
          motivo_rechazo: motivo,
          aprobado_por: usuario?.id,
          aprobado_en: new Date().toISOString()
        })
        .eq('id', solicitud.id)
      
      if (error) throw error
      
      alert(`❌ Solicitud rechazada`)
      cargarSolicitudes()
      
    } catch (error: any) {
      console.error('Error:', error)
      alert('Error al rechazar: ' + error.message)
    } finally {
      setProcessing(null)
    }
  }
  
  const pendientes = solicitudes.filter(s => s.estado === 'pendiente')
  const aprobadas = solicitudes.filter(s => s.estado === 'aprobado')
  const rechazadas = solicitudes.filter(s => s.estado === 'rechazado')
  
  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="text-gray-400">Cargando solicitudes...</div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Solicitudes de Acceso</h1>
        <p className="text-sm text-gray-500 mt-1">Aprobá o rechazá solicitudes de nuevos empleados</p>
      </div>
      
      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="text-sm text-yellow-700 font-medium">Pendientes</div>
          <div className="text-3xl font-bold text-yellow-900 mt-1">{pendientes.length}</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-sm text-green-700 font-medium">Aprobadas</div>
          <div className="text-3xl font-bold text-green-900 mt-1">{aprobadas.length}</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-sm text-red-700 font-medium">Rechazadas</div>
          <div className="text-3xl font-bold text-red-900 mt-1">{rechazadas.length}</div>
        </div>
      </div>
      
      {/* PENDIENTES */}
      {pendientes.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">⏳ Pendientes de Aprobación</h2>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {pendientes.map(solicitud => (
              <div key={solicitud.id} className="p-6 border-b border-gray-200 last:border-b-0">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-medium">
                        {solicitud.area}
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(solicitud.created_at).toLocaleDateString('es-CO')}
                      </span>
                    </div>
                    <h3 className="font-semibold text-gray-900 text-lg">{solicitud.nombre_completo}</h3>
                    <p className="text-sm text-gray-600 mt-1">{solicitud.email}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => aprobar(solicitud)}
                      disabled={processing === solicitud.id}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ✅ Aprobar
                    </button>
                    <button
                      onClick={() => rechazar(solicitud)}
                      disabled={processing === solicitud.id}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ❌ Rechazar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* APROBADAS */}
      {aprobadas.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">✅ Aprobadas</h2>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Área</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {aprobadas.map(solicitud => (
                    <tr key={solicitud.id}>
                      <td className="px-6 py-4 text-sm text-gray-900">{solicitud.nombre_completo}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{solicitud.email}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                          {solicitud.area}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(solicitud.aprobado_en).toLocaleDateString('es-CO')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      
      {/* RECHAZADAS */}
      {rechazadas.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">❌ Rechazadas</h2>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Motivo</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {rechazadas.map(solicitud => (
                    <tr key={solicitud.id}>
                      <td className="px-6 py-4 text-sm text-gray-900">{solicitud.nombre_completo}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{solicitud.email}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{solicitud.motivo_rechazo}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(solicitud.aprobado_en).toLocaleDateString('es-CO')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      
      {solicitudes.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <div className="text-gray-400">No hay solicitudes todavía</div>
        </div>
      )}
    </div>
  )
}
