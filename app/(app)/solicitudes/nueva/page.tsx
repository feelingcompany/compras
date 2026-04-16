'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth'

// Categorías de Feeling Company
const CATEGORIAS = [
  { value: 'talento-artistas', label: '🎭 Talento y Artistas', emoji: '🎭' },
  { value: 'produccion-grafica', label: '🎨 Producción Gráfica y Audiovisual', emoji: '🎨' },
  { value: 'logistica-transporte', label: '🚚 Logística y Transporte', emoji: '🚚' },
  { value: 'alimentacion-catering', label: '🍽️ Alimentación y Catering', emoji: '🍽️' },
  { value: 'servicios-tecnicos', label: '🎵 Servicios Técnicos', emoji: '🎵' },
  { value: 'infraestructura-montaje', label: '🏗️ Infraestructura y Montaje', emoji: '🏗️' },
  { value: 'servicios-profesionales', label: '👔 Servicios Profesionales', emoji: '👔' },
  { value: 'materiales-insumos', label: '📦 Materiales e Insumos', emoji: '📦' },
  { value: 'alquileres', label: '🔧 Alquileres', emoji: '🔧' },
  { value: 'servicios-soporte', label: '🛡️ Servicios de Soporte', emoji: '🛡️' },
  { value: 'tecnologia-equipos', label: '💻 Tecnología y Equipos', emoji: '💻' },
  { value: 'hospedaje-viaticos', label: '✈️ Hospedaje y Viáticos', emoji: '✈️' },
  { value: 'publicidad-medios', label: '📢 Publicidad y Medios', emoji: '📢' },
  { value: 'permisos-tramites', label: '📋 Permisos y Trámites', emoji: '📋' },
]

const UNIDADES = [
  'Unidades',
  'Horas',
  'Días',
  'Metros',
  'Kilos',
  'Personas',
  'Servicios',
  'Global'
]

const CENTROS_COSTO = [
  'SOCSM - Metro Parques',
  'ROTV - Comfama',
  'DMCL - Tigo',
  'KOCA - Coca-Cola',
  'PAAP - Bancolombia',
  'SCIR - Interactuar',
  'LMDV - Argos',
  'FC - Feeling Company (Interno)'
]

const CIUDADES = [
  'Medellín', 'Bogotá', 'Cali', 'Barranquilla', 'Cartagena',
  'Bucaramanga', 'Pereira', 'Armenia', 'Manizales', 'Ibagué',
  'Neiva', 'Villavicencio', 'Pasto', 'Cúcuta', 'Montería',
  'Sincelejo', 'Valledupar', 'Popayán', 'Tunja', 'Santa Marta'
]

export default function NuevaSolicitudPage() {
  const { usuario } = useAuth()
  const router = useRouter()
  const supabase = createClient()
  
  // Estado general
  const [centroCosto, setCentroCosto] = useState('')
  const [otOs, setOtOs] = useState('')
  const [ciudad, setCiudad] = useState('')
  const [fechaRequerida, setFechaRequerida] = useState('')
  const [prioridad, setPrioridad] = useState('normal')
  const [justificacion, setJustificacion] = useState('')
  const [observaciones, setObservaciones] = useState('')
  
  // Estado de ítems
  const [items, setItems] = useState([{
    id: crypto.randomUUID(),
    categoria: '',
    descripcion: '',
    cantidad: 1,
    unidad: 'Unidades',
    especificaciones: '',
    presupuesto_estimado: ''
  }])
  
  const [loading, setLoading] = useState(false)
  
  // Agregar ítem
  const agregarItem = () => {
    setItems([...items, {
      id: crypto.randomUUID(),
      categoria: '',
      descripcion: '',
      cantidad: 1,
      unidad: 'Unidades',
      especificaciones: '',
      presupuesto_estimado: ''
    }])
  }
  
  // Eliminar ítem
  const eliminarItem = (id: string) => {
    if (items.length === 1) return // Mantener al menos un ítem
    setItems(items.filter(item => item.id !== id))
  }
  
  // Actualizar ítem
  const actualizarItem = (id: string, field: string, value: any) => {
    setItems(items.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ))
  }
  
  // Validar formulario
  const validar = () => {
    if (!centroCosto) {
      alert('Seleccioná un Centro de Costo')
      return false
    }
    if (!ciudad) {
      alert('Seleccioná una Ciudad')
      return false
    }
    if (!fechaRequerida) {
      alert('Seleccioná la Fecha Requerida')
      return false
    }
    if (!justificacion.trim()) {
      alert('Ingresá una Justificación')
      return false
    }
    
    // Validar ítems
    for (let item of items) {
      if (!item.categoria) {
        alert('Todos los ítems deben tener Categoría')
        return false
      }
      if (!item.descripcion.trim()) {
        alert('Todos los ítems deben tener Descripción')
        return false
      }
      if (item.cantidad <= 0) {
        alert('La Cantidad debe ser mayor a 0')
        return false
      }
    }
    
    return true
  }
  
  // Enviar solicitud
  const enviar = async () => {
    if (!validar()) return
    if (!usuario) return
    
    setLoading(true)
    
    try {
      // 1. Crear solicitud principal
      const { data: solicitud, error: errorSolicitud } = await supabase
        .from('solicitudes')
        .insert({
          solicitante_id: usuario.id,
          centro_costo: centroCosto,
          ot_os: otOs || null,
          ciudad,
          fecha_requerida: fechaRequerida,
          prioridad,
          descripcion: justificacion, // Mantenemos el campo por compatibilidad
          observaciones,
          estado: 'pendiente'
        })
        .select()
        .single()
      
      if (errorSolicitud) throw errorSolicitud
      
      // 2. Crear ítems de la solicitud
      const itemsData = items.map(item => ({
        solicitud_id: solicitud.id,
        categoria: item.categoria,
        descripcion: item.descripcion,
        cantidad: item.cantidad,
        unidad: item.unidad,
        especificaciones: item.especificaciones || null,
        presupuesto_estimado: item.presupuesto_estimado ? parseFloat(item.presupuesto_estimado) : null
      }))
      
      const { error: errorItems } = await supabase
        .from('items_solicitud')
        .insert(itemsData)
      
      if (errorItems) throw errorItems
      
      alert('✅ Solicitud creada exitosamente')
      router.push('/solicitudes')
      
    } catch (error: any) {
      console.error('Error:', error)
      alert('Error al crear solicitud: ' + error.message)
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Nueva Solicitud de Compra</h1>
        <p className="text-sm text-gray-500 mt-1">Completá todos los campos requeridos</p>
      </div>
      
      {/* 1. INFORMACIÓN GENERAL */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">1. Información General</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Centro de Costo <span className="text-red-500">*</span>
            </label>
            <select
              value={centroCosto}
              onChange={(e) => setCentroCosto(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Seleccioná...</option>
              {CENTROS_COSTO.map(cc => (
                <option key={cc} value={cc}>{cc}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              OT/OS <span className="text-gray-400">(Opcional)</span>
            </label>
            <input
              type="text"
              value={otOs}
              onChange={(e) => setOtOs(e.target.value)}
              placeholder="Ej: SOCSM00126"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ciudad <span className="text-red-500">*</span>
            </label>
            <select
              value={ciudad}
              onChange={(e) => setCiudad(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Seleccioná...</option>
              {CIUDADES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha Requerida <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={fechaRequerida}
              onChange={(e) => setFechaRequerida(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
        
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Prioridad <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-4">
            {[
              { value: 'normal', label: 'Normal', color: 'blue' },
              { value: 'urgente', label: 'Urgente', color: 'orange' },
              { value: 'critico', label: 'Crítico', color: 'red' }
            ].map(p => (
              <label key={p.value} className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="prioridad"
                  value={p.value}
                  checked={prioridad === p.value}
                  onChange={(e) => setPrioridad(e.target.value)}
                  className="mr-2"
                />
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  prioridad === p.value
                    ? `bg-${p.color}-100 text-${p.color}-800 border-2 border-${p.color}-500`
                    : 'bg-gray-100 text-gray-600 border-2 border-transparent'
                }`}>
                  {p.label}
                </span>
              </label>
            ))}
          </div>
        </div>
        
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Justificación <span className="text-red-500">*</span>
          </label>
          <textarea
            value={justificacion}
            onChange={(e) => setJustificacion(e.target.value)}
            placeholder="¿Para qué proyecto o evento es esta solicitud?"
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>
      
      {/* 2. ÍTEMS SOLICITADOS */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">2. Ítems Solicitados</h2>
          <button
            onClick={agregarItem}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
          >
            + Agregar Ítem
          </button>
        </div>
        
        <div className="space-y-6">
          {items.map((item, index) => (
            <div key={item.id} className="border border-gray-300 rounded-lg p-4 bg-gray-50">
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-semibold text-gray-900">Ítem #{index + 1}</h3>
                {items.length > 1 && (
                  <button
                    onClick={() => eliminarItem(item.id)}
                    className="text-red-600 hover:text-red-800 text-sm font-medium"
                  >
                    ❌ Eliminar
                  </button>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Categoría <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={item.categoria}
                    onChange={(e) => actualizarItem(item.id, 'categoria', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Seleccioná una categoría...</option>
                    {CATEGORIAS.map(cat => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descripción <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={item.descripcion}
                    onChange={(e) => actualizarItem(item.id, 'descripcion', e.target.value)}
                    placeholder="Ej: Grupo musical tropical 4 horas"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cantidad <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={item.cantidad}
                    onChange={(e) => actualizarItem(item.id, 'cantidad', parseFloat(e.target.value) || 1)}
                    min="0.01"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Unidad <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={item.unidad}
                    onChange={(e) => actualizarItem(item.id, 'unidad', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {UNIDADES.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Especificaciones <span className="text-gray-400">(Opcional)</span>
                  </label>
                  <textarea
                    value={item.especificaciones}
                    onChange={(e) => actualizarItem(item.id, 'especificaciones', e.target.value)}
                    placeholder="Marca, modelo, características técnicas, rider, etc."
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Presupuesto Estimado <span className="text-gray-400">(Opcional)</span>
                  </label>
                  <input
                    type="number"
                    value={item.presupuesto_estimado}
                    onChange={(e) => actualizarItem(item.id, 'presupuesto_estimado', e.target.value)}
                    placeholder="0"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* 3. OBSERVACIONES */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">3. Observaciones Adicionales</h2>
        <textarea
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          placeholder="Comentarios adicionales, requerimientos especiales, etc. (opcional)"
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      
      {/* BOTONES */}
      <div className="flex justify-end gap-3">
        <button
          onClick={() => router.push('/solicitudes')}
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          onClick={enviar}
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Enviando...' : 'Enviar Solicitud'}
        </button>
      </div>
    </div>
  )
}
