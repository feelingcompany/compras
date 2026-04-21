'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth'

// Categorías de Feeling Company
const CATEGORIAS = [
  { value: 'talento-artistas', label: 'Talento y Artistas' },
  { value: 'produccion-grafica', label: 'Producción Gráfica y Audiovisual' },
  { value: 'logistica-transporte', label: 'Logística y Transporte' },
  { value: 'alimentacion-catering', label: 'Alimentación y Catering' },
  { value: 'servicios-tecnicos', label: 'Servicios Técnicos' },
  { value: 'infraestructura-montaje', label: 'Infraestructura y Montaje' },
  { value: 'servicios-profesionales', label: 'Servicios Profesionales' },
  { value: 'materiales-insumos', label: 'Materiales e Insumos' },
  { value: 'alquileres', label: 'Alquileres' },
  { value: 'servicios-soporte', label: 'Servicios de Soporte' },
  { value: 'tecnologia-equipos', label: 'Tecnología y Equipos' },
  { value: 'hospedaje-viaticos', label: 'Hospedaje y Viáticos' },
  { value: 'publicidad-medios', label: 'Publicidad y Medios' },
  { value: 'permisos-tramites', label: 'Permisos y Trámites' },
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
    if (items.length === 1) return
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
    if (!centroCosto || !ciudad || !fechaRequerida || !justificacion) {
      alert('Por favor completá todos los campos requeridos en Información General')
      return false
    }
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (!item.categoria || !item.descripcion || !item.cantidad || !item.unidad) {
        alert(`Por favor completá todos los campos requeridos en el Ítem #${i + 1}`)
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
          // centro_costo: centroCosto, // Temporalmente deshabilitado
          ot_os: otOs || null,
          ciudad,
          fecha_requerida: fechaRequerida,
          prioridad,
          descripcion: justificacion,
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
      
      alert('Solicitud creada exitosamente')
      router.push('/solicitudes')
      
    } catch (error: any) {
      console.error('Error:', error)
      alert('Error al crear solicitud: ' + error.message)
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div style={{ padding: 'var(--space-6)', maxWidth: '80rem', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h1 style={{
          fontSize: 'var(--text-3xl)',
          fontWeight: 'var(--font-bold)',
          color: 'var(--gray-900)',
          marginBottom: 'var(--space-2)'
        }}>
          Nueva Solicitud de Compra
        </h1>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-500)' }}>
          Completá todos los campos requeridos
        </p>
      </div>
      
      {/* 1. INFORMACIÓN GENERAL */}
      <div className="card" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
        <h2 style={{
          fontSize: 'var(--text-lg)',
          fontWeight: 'var(--font-semibold)',
          color: 'var(--gray-900)',
          marginBottom: 'var(--space-4)'
        }}>
          1. Información General
        </h2>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 'var(--space-4)'
        }}>
          <div>
            <label className="label label-required">Centro de Costo</label>
            <select
              value={centroCosto}
              onChange={(e) => setCentroCosto(e.target.value)}
              className="input"
            >
              <option value="">Seleccioná...</option>
              {CENTROS_COSTO.map(cc => (
                <option key={cc} value={cc}>{cc}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="label">OT/OS (Opcional)</label>
            <input
              type="text"
              value={otOs}
              onChange={(e) => setOtOs(e.target.value)}
              placeholder="Ej: SOCSM00126"
              className="input"
            />
          </div>
          
          <div>
            <label className="label label-required">Ciudad</label>
            <select
              value={ciudad}
              onChange={(e) => setCiudad(e.target.value)}
              className="input"
            >
              <option value="">Seleccioná...</option>
              {CIUDADES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="label label-required">Fecha Requerida</label>
            <input
              type="date"
              value={fechaRequerida}
              onChange={(e) => setFechaRequerida(e.target.value)}
              className="input"
            />
          </div>
        </div>
        
        <div style={{ marginTop: 'var(--space-4)' }}>
          <label className="label label-required">Prioridad</label>
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            {[
              { value: 'normal', label: 'Normal', className: 'badge-primary' },
              { value: 'urgente', label: 'Urgente', className: 'badge-warning' },
              { value: 'critico', label: 'Crítico', className: 'badge-error' }
            ].map(p => (
              <label key={p.value} style={{
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                gap: 'var(--space-2)'
              }}>
                <input
                  type="radio"
                  name="prioridad"
                  value={p.value}
                  checked={prioridad === p.value}
                  onChange={(e) => setPrioridad(e.target.value)}
                  style={{ cursor: 'pointer' }}
                />
                <span className={`badge ${p.className}`}>
                  {p.label}
                </span>
              </label>
            ))}
          </div>
        </div>
        
        <div style={{ marginTop: 'var(--space-4)' }}>
          <label className="label label-required">Justificación</label>
          <textarea
            value={justificacion}
            onChange={(e) => setJustificacion(e.target.value)}
            placeholder="¿Para qué proyecto o evento es esta solicitud?"
            rows={3}
            className="input"
            style={{ resize: 'vertical' }}
          />
        </div>
      </div>
      
      {/* 2. ÍTEMS SOLICITADOS */}
      <div className="card" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 'var(--space-4)',
          flexWrap: 'wrap',
          gap: 'var(--space-3)'
        }}>
          <h2 style={{
            fontSize: 'var(--text-lg)',
            fontWeight: 'var(--font-semibold)',
            color: 'var(--gray-900)'
          }}>
            2. Ítems Solicitados
          </h2>
          <button
            onClick={agregarItem}
            className="btn btn-success"
          >
            + Agregar Ítem
          </button>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {items.map((item, index) => (
            <div
              key={item.id}
              style={{
                border: '1px solid var(--gray-300)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-4)',
                background: 'var(--gray-50)'
              }}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'start',
                marginBottom: 'var(--space-4)'
              }}>
                <h3 style={{
                  fontSize: 'var(--text-base)',
                  fontWeight: 'var(--font-semibold)',
                  color: 'var(--gray-900)'
                }}>
                  Ítem #{index + 1}
                </h3>
                {items.length > 1 && (
                  <button
                    onClick={() => eliminarItem(item.id)}
                    className="btn btn-error btn-sm"
                  >
                    Eliminar
                  </button>
                )}
              </div>
              
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: 'var(--space-4)'
              }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="label label-required">Categoría</label>
                  <select
                    value={item.categoria}
                    onChange={(e) => actualizarItem(item.id, 'categoria', e.target.value)}
                    className="input"
                  >
                    <option value="">Seleccioná una categoría...</option>
                    {CATEGORIAS.map(cat => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="label label-required">Descripción</label>
                  <input
                    type="text"
                    value={item.descripcion}
                    onChange={(e) => actualizarItem(item.id, 'descripcion', e.target.value)}
                    placeholder="Ej: Grupo musical tropical 4 horas"
                    className="input"
                  />
                </div>
                
                <div>
                  <label className="label label-required">Cantidad</label>
                  <input
                    type="number"
                    value={item.cantidad}
                    onChange={(e) => actualizarItem(item.id, 'cantidad', parseFloat(e.target.value) || 1)}
                    min="0.01"
                    step="0.01"
                    className="input"
                  />
                </div>
                
                <div>
                  <label className="label label-required">Unidad</label>
                  <select
                    value={item.unidad}
                    onChange={(e) => actualizarItem(item.id, 'unidad', e.target.value)}
                    className="input"
                  >
                    {UNIDADES.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
                
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="label">Especificaciones (Opcional)</label>
                  <textarea
                    value={item.especificaciones}
                    onChange={(e) => actualizarItem(item.id, 'especificaciones', e.target.value)}
                    placeholder="Marca, modelo, características técnicas, rider, etc."
                    rows={2}
                    className="input"
                    style={{ resize: 'vertical' }}
                  />
                </div>
                
                <div>
                  <label className="label">Presupuesto Estimado (Opcional)</label>
                  <input
                    type="number"
                    value={item.presupuesto_estimado}
                    onChange={(e) => actualizarItem(item.id, 'presupuesto_estimado', e.target.value)}
                    placeholder="0"
                    min="0"
                    className="input"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* 3. OBSERVACIONES */}
      <div className="card" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
        <h2 style={{
          fontSize: 'var(--text-lg)',
          fontWeight: 'var(--font-semibold)',
          color: 'var(--gray-900)',
          marginBottom: 'var(--space-4)'
        }}>
          3. Observaciones Adicionales
        </h2>
        <textarea
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          placeholder="Comentarios adicionales, requerimientos especiales, etc. (opcional)"
          rows={4}
          className="input"
          style={{ resize: 'vertical' }}
        />
      </div>
      
      {/* BOTONES */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        gap: 'var(--space-3)',
        flexWrap: 'wrap'
      }}>
        <button
          onClick={() => router.push('/solicitudes')}
          className="btn btn-secondary"
        >
          Cancelar
        </button>
        <button
          onClick={enviar}
          disabled={loading}
          className="btn btn-primary"
        >
          {loading ? 'Enviando...' : 'Enviar Solicitud'}
        </button>
      </div>
    </div>
  )
}
