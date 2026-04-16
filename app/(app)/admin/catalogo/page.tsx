'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

const fmt = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

interface Servicio {
  id?: string
  codigo: string
  nombre: string
  descripcion: string
  categoria: string
  unidad_medida: string
  precio_referencia: number
  precio_min?: number
  precio_max?: number
  total_compras?: number
  ultima_compra?: string
  activo: boolean
}

const CATEGORIAS = ['Materiales', 'Servicios', 'Tecnología', 'Construcción', 'Transporte', 'Otros']
const UNIDADES = ['unidad', 'hora', 'día', 'mes', 'kg', 'm2', 'm3', 'persona', 'licencia', 'kit']

export default function CatalogoPage() {
  const { usuario } = useAuth()
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState<Servicio | null>(null)
  const [creando, setCreando] = useState(false)
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [busca, setBusca] = useState('')
  const [formData, setFormData] = useState<Servicio>({
    codigo: '',
    nombre: '',
    descripcion: '',
    categoria: 'Servicios',
    unidad_medida: 'unidad',
    precio_referencia: 0,
    activo: true,
  })
  const [guardando, setGuardando] = useState(false)

  useEffect(() => { loadServicios() }, [])

  async function loadServicios() {
    const { data } = await supabase
      .from('catalogo_servicios')
      .select('*')
      .order('nombre')
    setServicios(data || [])
    setLoading(false)
  }

  function iniciarCrear() {
    setFormData({
      codigo: '',
      nombre: '',
      descripcion: '',
      categoria: 'Servicios',
      unidad_medida: 'unidad',
      precio_referencia: 0,
      activo: true,
    })
    setCreando(true)
    setEditando(null)
  }

  function iniciarEditar(servicio: Servicio) {
    setFormData({ ...servicio })
    setEditando(servicio)
    setCreando(false)
  }

  function cancelar() {
    setCreando(false)
    setEditando(null)
    setFormData({
      codigo: '',
      nombre: '',
      descripcion: '',
      categoria: 'Servicios',
      unidad_medida: 'unidad',
      precio_referencia: 0,
      activo: true,
    })
  }

  async function guardar() {
    if (!formData.codigo || !formData.nombre || !formData.precio_referencia) {
      alert('Por favor completa todos los campos obligatorios')
      return
    }

    setGuardando(true)

    try {
      if (editando) {
        const { error } = await supabase
          .from('catalogo_servicios')
          .update({
            codigo: formData.codigo,
            nombre: formData.nombre,
            descripcion: formData.descripcion,
            categoria: formData.categoria,
            unidad_medida: formData.unidad_medida,
            precio_referencia: formData.precio_referencia,
            activo: formData.activo,
          })
          .eq('id', editando.id!)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('catalogo_servicios')
          .insert({
            codigo: formData.codigo,
            nombre: formData.nombre,
            descripcion: formData.descripcion,
            categoria: formData.categoria,
            unidad_medida: formData.unidad_medida,
            precio_referencia: formData.precio_referencia,
            activo: formData.activo,
          })

        if (error) throw error
      }

      await loadServicios()
      cancelar()
    } catch (error: any) {
      alert(`Error al guardar: ${error.message}`)
    } finally {
      setGuardando(false)
    }
  }

  async function toggleActivo(servicio: Servicio) {
    if (!confirm(`¿${servicio.activo ? 'Desactivar' : 'Activar'} ${servicio.nombre}?`)) return

    const { error } = await supabase
      .from('catalogo_servicios')
      .update({ activo: !servicio.activo })
      .eq('id', servicio.id!)

    if (error) {
      alert(`Error: ${error.message}`)
    } else {
      await loadServicios()
    }
  }

  const datos = servicios.filter(s => {
    const nombre = s.nombre.toLowerCase()
    const codigo = s.codigo.toLowerCase()
    const desc = s.descripcion?.toLowerCase() || ''
    const search = busca.toLowerCase()
    
    return (!filtroCategoria || s.categoria === filtroCategoria) &&
      (!busca || nombre.includes(search) || codigo.includes(search) || desc.includes(search))
  })

  if (usuario?.rol !== 'gerencia' && usuario?.rol !== 'admin_compras') {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ background: '#FCEBEB', border: '1px solid #E24B4A', borderRadius: 12, padding: 20, color: '#791F1F' }}>
          ⛔ Solo usuarios con rol <strong>Gerencia</strong> o <strong>Admin Compras</strong> pueden acceder a esta sección.
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 6 }}>Catálogo de Servicios</div>
          <div style={{ fontSize: 14, color: '#666' }}>Precios de referencia y control de sobrecostos</div>
        </div>
        <button
          onClick={iniciarCrear}
          disabled={creando || editando !== null}
          style={{
            background: creando || editando ? '#ccc' : '#185FA5',
            color: '#fff',
            padding: '10px 20px',
            borderRadius: 8,
            border: 'none',
            fontSize: 14,
            fontWeight: 600,
            cursor: creando || editando ? 'not-allowed' : 'pointer',
          }}
        >
          ➕ Nuevo Servicio
        </button>
      </div>

      {/* Formulario de creación/edición */}
      {(creando || editando) && (
        <div style={{ background: '#f8fbff', border: '2px solid #185FA5', borderRadius: 12, padding: 24, marginBottom: 24 }}>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
            {editando ? `✏️ Editar: ${editando.nombre}` : '➕ Nuevo Servicio'}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 6 }}>
                Código *
              </label>
              <input
                type="text"
                value={formData.codigo}
                onChange={e => setFormData({ ...formData, codigo: e.target.value.toUpperCase() })}
                placeholder="MAT-ELEC-001"
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, textTransform: 'uppercase' }}
              />
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 6 }}>
                Nombre *
              </label>
              <input
                type="text"
                value={formData.nombre}
                onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                placeholder="Material eléctrico estándar"
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14 }}
              />
            </div>

            <div style={{ gridColumn: 'span 3' }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 6 }}>
                Descripción
              </label>
              <textarea
                value={formData.descripcion}
                onChange={e => setFormData({ ...formData, descripcion: e.target.value })}
                placeholder="Cables, tomas, breakers..."
                rows={2}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, fontFamily: 'inherit' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 6 }}>
                Categoría *
              </label>
              <select
                value={formData.categoria}
                onChange={e => setFormData({ ...formData, categoria: e.target.value })}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, background: '#fff' }}
              >
                {CATEGORIAS.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 6 }}>
                Unidad de medida *
              </label>
              <select
                value={formData.unidad_medida}
                onChange={e => setFormData({ ...formData, unidad_medida: e.target.value })}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, background: '#fff' }}
              >
                {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 6 }}>
                Precio referencia * (COP)
              </label>
              <input
                type="number"
                value={formData.precio_referencia}
                onChange={e => setFormData({ ...formData, precio_referencia: Number(e.target.value) })}
                placeholder="500000"
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14 }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#666' }}>
                <input
                  type="checkbox"
                  checked={formData.activo}
                  onChange={e => setFormData({ ...formData, activo: e.target.checked })}
                  style={{ marginRight: 8 }}
                />
                Servicio activo
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={guardar}
              disabled={guardando}
              style={{
                background: guardando ? '#ccc' : '#27500A',
                color: '#fff',
                padding: '10px 24px',
                borderRadius: 8,
                border: 'none',
                fontSize: 14,
                fontWeight: 600,
                cursor: guardando ? 'not-allowed' : 'pointer',
              }}
            >
              {guardando ? '⏳ Guardando...' : editando ? '💾 Guardar cambios' : '➕ Crear servicio'}
            </button>
            <button
              onClick={cancelar}
              disabled={guardando}
              style={{
                background: '#fff',
                color: '#666',
                padding: '10px 24px',
                borderRadius: 8,
                border: '1px solid #ddd',
                fontSize: 14,
                fontWeight: 600,
                cursor: guardando ? 'not-allowed' : 'pointer',
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <select
          value={filtroCategoria}
          onChange={e => setFiltroCategoria(e.target.value)}
          style={{ padding: '8px 12px', border: '0.5px solid #d3d1c7', borderRadius: 8, fontSize: 13, background: '#fff', width: 160 }}
        >
          <option value="">Todas las categorías</option>
          {CATEGORIAS.map(cat => <option key={cat} value={cat}>{cat}</option>)}
        </select>
        <input
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar servicio..."
          style={{ padding: '8px 12px', border: '0.5px solid #d3d1c7', borderRadius: 8, fontSize: 13, width: 280 }}
        />
      </div>

      {/* Tabla de servicios */}
      <div style={{ background: '#fff', border: '0.5px solid #ebebeb', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #f0f0f0', fontSize: 13, fontWeight: 500 }}>
          {datos.length} servicio{datos.length !== 1 ? 's' : ''} en catálogo
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Código', 'Nombre', 'Categoría', 'Unidad', 'Precio Ref.', 'Rango', 'Compras', 'Estado', 'Acciones'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 20px', fontSize: 11, fontWeight: 600, color: '#999', borderBottom: '1px solid #f0f0f0', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} style={{ padding: 40, textAlign: 'center', color: '#aaa' }}>
                  Cargando catálogo...
                </td>
              </tr>
            ) : datos.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: 40, textAlign: 'center', color: '#aaa' }}>
                  No hay servicios registrados
                </td>
              </tr>
            ) : (
              datos.map(servicio => (
                <tr key={servicio.id} style={{ background: editando?.id === servicio.id ? '#f8fbff' : servicio.activo ? '#fff' : '#fafafa' }}>
                  <td style={{ padding: '12px 20px', borderBottom: '1px solid #f8f8f8', fontSize: 12, fontFamily: 'monospace', fontWeight: 600, color: servicio.activo ? '#185FA5' : '#999' }}>
                    {servicio.codigo}
                  </td>
                  <td style={{ padding: '12px 20px', borderBottom: '1px solid #f8f8f8' }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: servicio.activo ? '#1a1a1a' : '#999' }}>{servicio.nombre}</div>
                    {servicio.descripcion && (
                      <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{servicio.descripcion}</div>
                    )}
                  </td>
                  <td style={{ padding: '12px 20px', borderBottom: '1px solid #f8f8f8' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '3px 8px',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 600,
                      background: servicio.activo ? '#E6F1FB' : '#f0f0f0',
                      color: servicio.activo ? '#0C447C' : '#999',
                    }}>
                      {servicio.categoria}
                    </span>
                  </td>
                  <td style={{ padding: '12px 20px', borderBottom: '1px solid #f8f8f8', fontSize: 12, color: servicio.activo ? '#666' : '#999' }}>
                    {servicio.unidad_medida}
                  </td>
                  <td style={{ padding: '12px 20px', borderBottom: '1px solid #f8f8f8', fontSize: 13, fontWeight: 600, color: servicio.activo ? '#27500A' : '#999' }}>
                    {fmt(servicio.precio_referencia)}
                  </td>
                  <td style={{ padding: '12px 20px', borderBottom: '1px solid #f8f8f8', fontSize: 11, color: '#666' }}>
                    {servicio.precio_min && servicio.precio_max ? (
                      <>
                        {fmt(servicio.precio_min)}<br/>- {fmt(servicio.precio_max)}
                      </>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '12px 20px', borderBottom: '1px solid #f8f8f8', fontSize: 12, color: servicio.activo ? '#666' : '#999' }}>
                    {servicio.total_compras || 0}
                  </td>
                  <td style={{ padding: '12px 20px', borderBottom: '1px solid #f8f8f8' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '3px 8px',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 600,
                      background: servicio.activo ? '#EAF3DE' : '#f0f0f0',
                      color: servicio.activo ? '#27500A' : '#999',
                    }}>
                      {servicio.activo ? '✓ Activo' : '✗ Inactivo'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 20px', borderBottom: '1px solid #f8f8f8' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => iniciarEditar(servicio)}
                        style={{
                          background: 'none',
                          border: '1px solid #185FA5',
                          color: '#185FA5',
                          padding: '4px 10px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        ✏️ Editar
                      </button>
                      <button
                        onClick={() => toggleActivo(servicio)}
                        style={{
                          background: 'none',
                          border: `1px solid ${servicio.activo ? '#E24B4A' : '#27500A'}`,
                          color: servicio.activo ? '#E24B4A' : '#27500A',
                          padding: '4px 10px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {servicio.activo ? '⏸' : '▶'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Info */}
      <div style={{ marginTop: 24, background: '#f8f8f8', border: '1px solid #e0e0e0', borderRadius: 12, padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>ℹ️ Cómo funciona el catálogo</div>
        <div style={{ fontSize: 12, color: '#666', lineHeight: 1.6 }}>
          • Los <strong>precios de referencia</strong> se actualizan automáticamente con el promedio de los últimos 6 meses<br/>
          • El <strong>rango</strong> muestra el precio mínimo y máximo histórico pagado<br/>
          • Las <strong>alertas</strong> se generan cuando una OF supera el precio de referencia en más del 20%<br/>
          • Los servicios inactivos no aparecen en el autocomplete al crear OFs
        </div>
      </div>
    </div>
  )
}
