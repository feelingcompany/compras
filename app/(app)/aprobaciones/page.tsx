'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'

export default function AprobacionesPage() {
  const { usuario } = useAuth()
  const [loading, setLoading] = useState(true)
  const [pendientes, setPendientes] = useState<any[]>([])
  const [filter, setFilter] = useState('todos') // todos, nivel1, nivel2, nivel3, nivel4
  const [showModal, setShowModal] = useState(false)
  const [selectedAprobacion, setSelectedAprobacion] = useState<any>(null)
  const [accion, setAccion] = useState<'aprobar' | 'rechazar'>('aprobar')
  const [comentarios, setComentarios] = useState('')
  const [processing, setProcessing] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (usuario) loadPendientes()
  }, [usuario, filter])

  const loadPendientes = async () => {
    if (!usuario) return
    
    setLoading(true)
    
    // Query de aprobaciones pendientes asignadas a este usuario
    let query = supabase
      .from('aprobaciones')
      .select(`
        *,
        of:ordenes_facturacion(
          codigo_of,
          valor_total,
          descripcion,
          created_at,
          proveedor:proveedores(razon_social)
        )
      `)
      .eq('aprobador_id', usuario.id)
      .eq('estado', 'pendiente')
      .order('created_at', { ascending: false })

    // Filtro por nivel si no es "todos"
    if (filter !== 'todos') {
      const nivel = parseInt(filter.replace('nivel', ''))
      query = query.eq('nivel', nivel)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error loading pendientes:', error)
    } else {
      setPendientes(data || [])
    }

    setLoading(false)
  }

  const handleAprobar = (aprobacion: any) => {
    setSelectedAprobacion(aprobacion)
    setAccion('aprobar')
    setComentarios('')
    setShowModal(true)
  }

  const handleRechazar = (aprobacion: any) => {
    setSelectedAprobacion(aprobacion)
    setAccion('rechazar')
    setComentarios('')
    setShowModal(true)
  }

  const confirmarAccion = async () => {
    if (!selectedAprobacion) return
    
    setProcessing(true)

    const { error } = await supabase
      .from('aprobaciones')
      .update({
        estado: accion === 'aprobar' ? 'aprobado' : 'rechazado',
        comentarios: comentarios || null,
        fecha_aprobacion: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', selectedAprobacion.id)

    if (error) {
      console.error('Error al procesar aprobación:', error)
      alert('Error al procesar la aprobación')
    } else {
      setShowModal(false)
      setSelectedAprobacion(null)
      setComentarios('')
      await loadPendientes()
    }

    setProcessing(false)
  }

  const getNivelBadge = (nivel: number) => {
    const configs = {
      1: { text: 'Nivel 1', bg: '#e3f2fd', color: '#1976d2' },
      2: { text: 'Nivel 2', bg: '#fff3e0', color: '#f57c00' },
      3: { text: 'Nivel 3', bg: '#fce4ec', color: '#c2185b' },
      4: { text: 'Nivel 4', bg: '#f3e5f5', color: '#7b1fa2' }
    }
    const config = configs[nivel as keyof typeof configs] || configs[1]
    return (
      <span style={{
        padding: '4px 8px',
        borderRadius: 4,
        fontSize: 12,
        fontWeight: 500,
        backgroundColor: config.bg,
        color: config.color
      }}>
        {config.text}
      </span>
    )
  }

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <p style={{ color: '#666' }}>Cargando aprobaciones...</p>
      </div>
    )
  }

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 8 }}>
          Aprobaciones Pendientes
        </h1>
        <p style={{ color: '#666', fontSize: 14 }}>
          Órdenes de facturación que requieren tu aprobación
        </p>
      </div>

      {/* Filtros */}
      <div style={{ 
        display: 'flex', 
        gap: 8, 
        marginBottom: 24,
        flexWrap: 'wrap'
      }}>
        {[
          { value: 'todos', label: 'Todos los niveles' },
          { value: 'nivel1', label: 'Nivel 1' },
          { value: 'nivel2', label: 'Nivel 2' },
          { value: 'nivel3', label: 'Nivel 3' },
          { value: 'nivel4', label: 'Nivel 4' }
        ].map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: filter === f.value ? '2px solid #2563eb' : '1px solid #e5e7eb',
              backgroundColor: filter === f.value ? '#eff6ff' : 'white',
              color: filter === f.value ? '#2563eb' : '#666',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16,
        marginBottom: 24
      }}>
        <div style={{
          padding: 16,
          backgroundColor: '#fff7ed',
          borderRadius: 8,
          border: '1px solid #fed7aa'
        }}>
          <div style={{ fontSize: 12, color: '#9a3412', marginBottom: 4 }}>
            Total Pendientes
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#ea580c' }}>
            {pendientes.length}
          </div>
        </div>
      </div>

      {/* Lista de aprobaciones */}
      {pendientes.length === 0 ? (
        <div style={{
          padding: 48,
          textAlign: 'center',
          backgroundColor: '#f9fafb',
          borderRadius: 8,
          border: '1px dashed #d1d5db'
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <p style={{ fontSize: 18, fontWeight: 500, marginBottom: 8 }}>
            No hay aprobaciones pendientes
          </p>
          <p style={{ color: '#666', fontSize: 14 }}>
            Todas las OFs asignadas han sido procesadas
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {pendientes.map(aprobacion => (
            <div
              key={aprobacion.id}
              style={{
                padding: 20,
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}
            >
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 12
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 600 }}>
                      {aprobacion.of?.codigo_of || 'OF sin código'}
                    </h3>
                    {getNivelBadge(aprobacion.nivel)}
                  </div>
                  <p style={{ color: '#666', fontSize: 14, marginBottom: 4 }}>
                    {aprobacion.of?.descripcion || 'Sin descripción'}
                  </p>
                  <p style={{ color: '#999', fontSize: 13 }}>
                    Proveedor: {aprobacion.of?.proveedor?.razon_social || 'N/A'}
                  </p>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ 
                    fontSize: 24, 
                    fontWeight: 700, 
                    color: '#2563eb',
                    marginBottom: 4
                  }}>
                    ${(aprobacion.of?.valor_total || 0).toLocaleString()}
                  </div>
                  <div style={{ fontSize: 12, color: '#999' }}>
                    {new Date(aprobacion.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>

              <div style={{ 
                display: 'flex', 
                gap: 8,
                justifyContent: 'flex-end'
              }}>
                <button
                  onClick={() => handleRechazar(aprobacion)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 6,
                    border: '1px solid #fca5a5',
                    backgroundColor: 'white',
                    color: '#dc2626',
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  ❌ Rechazar
                </button>
                <button
                  onClick={() => handleAprobar(aprobacion)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 6,
                    border: 'none',
                    backgroundColor: '#22c55e',
                    color: 'white',
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  ✅ Aprobar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de confirmación */}
      {showModal && selectedAprobacion && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: 12,
            padding: 24,
            maxWidth: 500,
            width: '90%',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>
              {accion === 'aprobar' ? '✅ Aprobar OF' : '❌ Rechazar OF'}
            </h3>

            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>
                OF: <strong>{selectedAprobacion.of?.codigo_of}</strong>
              </p>
              <p style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>
                Monto: <strong>${(selectedAprobacion.of?.valor_total || 0).toLocaleString()}</strong>
              </p>
              <p style={{ fontSize: 14, color: '#666' }}>
                Nivel: <strong>Nivel {selectedAprobacion.nivel}</strong>
              </p>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ 
                display: 'block', 
                fontSize: 14, 
                fontWeight: 500,
                marginBottom: 8 
              }}>
                Comentarios {accion === 'rechazar' && <span style={{ color: 'red' }}>*</span>}
              </label>
              <textarea
                value={comentarios}
                onChange={(e) => setComentarios(e.target.value)}
                placeholder={accion === 'aprobar' 
                  ? 'Comentarios adicionales (opcional)'
                  : 'Explica por qué se rechaza esta OF'
                }
                rows={4}
                style={{
                  width: '100%',
                  padding: 12,
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  fontSize: 14,
                  resize: 'vertical'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowModal(false)
                  setSelectedAprobacion(null)
                  setComentarios('')
                }}
                disabled={processing}
                style={{
                  padding: '10px 20px',
                  borderRadius: 6,
                  border: '1px solid #d1d5db',
                  backgroundColor: 'white',
                  color: '#666',
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: processing ? 'not-allowed' : 'pointer',
                  opacity: processing ? 0.5 : 1
                }}
              >
                Cancelar
              </button>
              <button
                onClick={confirmarAccion}
                disabled={processing || (accion === 'rechazar' && !comentarios.trim())}
                style={{
                  padding: '10px 20px',
                  borderRadius: 6,
                  border: 'none',
                  backgroundColor: accion === 'aprobar' ? '#22c55e' : '#dc2626',
                  color: 'white',
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: (processing || (accion === 'rechazar' && !comentarios.trim())) 
                    ? 'not-allowed' 
                    : 'pointer',
                  opacity: (processing || (accion === 'rechazar' && !comentarios.trim())) 
                    ? 0.5 
                    : 1
                }}
              >
                {processing ? 'Procesando...' : (accion === 'aprobar' ? 'Aprobar' : 'Rechazar')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
