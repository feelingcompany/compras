'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { Rol } from '@/lib/supabase'

interface Usuario {
  id?: string
  nombre: string
  email: string
  rol: Rol
  iniciales: string
  pin: string
  activo: boolean
}

const ROL_LABELS: Record<Rol, string> = {
  gerencia: 'Gerencia',
  admin_compras: 'Admin Compras',
  encargado: 'Encargado',
  solicitante: 'Solicitante',
}

const ROL_COLORS: Record<Rol, string> = {
  gerencia: '#185FA5',
  admin_compras: '#639922',
  encargado: '#EF9F27',
  solicitante: '#888',
}

export default function UsuariosPage() {
  const { usuario } = useAuth()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState<Usuario | null>(null)
  const [creando, setCreando] = useState(false)
  const [formData, setFormData] = useState<Usuario>({
    nombre: '',
    email: '',
    rol: 'solicitante',
    iniciales: '',
    pin: '1234',
    activo: true,
  })
  const [guardando, setGuardando] = useState(false)

  useEffect(() => { loadUsuarios() }, [])

  async function loadUsuarios() {
    const { data } = await supabase
      .from('usuarios')
      .select('*')
      .order('nombre')
    setUsuarios(data || [])
    setLoading(false)
  }

  function iniciarCrear() {
    setFormData({
      nombre: '',
      email: '',
      rol: 'solicitante',
      iniciales: '',
      pin: '1234',
      activo: true,
    })
    setCreando(true)
    setEditando(null)
  }

  function iniciarEditar(user: Usuario) {
    setFormData({ ...user })
    setEditando(user)
    setCreando(false)
  }

  function cancelar() {
    setCreando(false)
    setEditando(null)
    setFormData({
      nombre: '',
      email: '',
      rol: 'solicitante',
      iniciales: '',
      pin: '1234',
      activo: true,
    })
  }

  async function guardar() {
    if (!formData.nombre || !formData.email || !formData.iniciales) {
      alert('Por favor completa todos los campos obligatorios')
      return
    }

    setGuardando(true)

    try {
      if (editando) {
        // Actualizar usuario existente
        const { error } = await supabase
          .from('usuarios')
          .update({
            nombre: formData.nombre,
            email: formData.email,
            rol: formData.rol,
            iniciales: formData.iniciales,
            pin: formData.pin,
            activo: formData.activo,
          })
          .eq('id', editando.id!)

        if (error) throw error
      } else {
        // Crear nuevo usuario
        const { error } = await supabase
          .from('usuarios')
          .insert({
            nombre: formData.nombre,
            email: formData.email,
            rol: formData.rol,
            iniciales: formData.iniciales,
            pin: formData.pin,
            activo: formData.activo,
          })

        if (error) throw error
      }

      await loadUsuarios()
      cancelar()
    } catch (error: any) {
      alert(`Error al guardar: ${error.message}`)
    } finally {
      setGuardando(false)
    }
  }

  async function toggleActivo(user: Usuario) {
    if (!confirm(`¿${user.activo ? 'Desactivar' : 'Activar'} a ${user.nombre}?`)) return

    const { error } = await supabase
      .from('usuarios')
      .update({ activo: !user.activo })
      .eq('id', user.id!)

    if (error) {
      alert(`Error: ${error.message}`)
    } else {
      await loadUsuarios()
    }
  }

  async function resetearPin(user: Usuario) {
    if (!confirm(`¿Resetear PIN de ${user.nombre} a 1234?`)) return

    const { error } = await supabase
      .from('usuarios')
      .update({ pin: '1234' })
      .eq('id', user.id!)

    if (error) {
      alert(`Error: ${error.message}`)
    } else {
      alert('PIN reseteado a 1234')
      await loadUsuarios()
    }
  }

  function generarIniciales(nombre: string) {
    return nombre
      .split(' ')
      .map(p => p[0])
      .join('')
      .toUpperCase()
      .substring(0, 3)
  }

  if (usuario?.rol !== 'gerencia') {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ background: '#FCEBEB', border: '1px solid #E24B4A', borderRadius: 12, padding: 20, color: '#791F1F' }}>
          ⛔ Solo usuarios con rol <strong>Gerencia</strong> pueden acceder a esta sección.
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 6 }}>Gestión de Usuarios</div>
          <div style={{ fontSize: 14, color: '#666' }}>Administra el equipo de Compras FC</div>
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
          ➕ Nuevo Usuario
        </button>
      </div>

      {/* Formulario de creación/edición */}
      {(creando || editando) && (
        <div style={{ background: '#f8fbff', border: '2px solid #185FA5', borderRadius: 12, padding: 24, marginBottom: 24 }}>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
            {editando ? `✏️ Editar: ${editando.nombre}` : '➕ Nuevo Usuario'}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 6 }}>
                Nombre completo *
              </label>
              <input
                type="text"
                value={formData.nombre}
                onChange={e => {
                  const nombre = e.target.value
                  setFormData({ ...formData, nombre, iniciales: generarIniciales(nombre) })
                }}
                placeholder="Ej: Juan Pérez García"
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14 }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 6 }}>
                Email *
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                placeholder="juan.perez@feelingcompany.com"
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14 }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 6 }}>
                Rol *
              </label>
              <select
                value={formData.rol}
                onChange={e => setFormData({ ...formData, rol: e.target.value as Rol })}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, background: '#fff' }}
              >
                <option value="solicitante">Solicitante (solo consulta)</option>
                <option value="encargado">Encargado (gestiona OFs propias)</option>
                <option value="admin_compras">Admin Compras (acceso total compras)</option>
                <option value="gerencia">Gerencia (acceso total)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 6 }}>
                Iniciales * (auto-generadas)
              </label>
              <input
                type="text"
                value={formData.iniciales}
                onChange={e => setFormData({ ...formData, iniciales: e.target.value.toUpperCase().substring(0, 3) })}
                maxLength={3}
                placeholder="JPG"
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, textTransform: 'uppercase' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 6 }}>
                PIN (4 dígitos)
              </label>
              <input
                type="text"
                value={formData.pin}
                onChange={e => setFormData({ ...formData, pin: e.target.value.replace(/\D/g, '').substring(0, 4) })}
                maxLength={4}
                placeholder="1234"
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
                Usuario activo
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
              {guardando ? '⏳ Guardando...' : editando ? '💾 Guardar cambios' : '➕ Crear usuario'}
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

      {/* Tabla de usuarios */}
      <div style={{ background: '#fff', border: '0.5px solid #ebebeb', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #f0f0f0', fontSize: 13, fontWeight: 500 }}>
          {usuarios.length} usuario{usuarios.length !== 1 ? 's' : ''} registrado{usuarios.length !== 1 ? 's' : ''}
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Usuario', 'Email', 'Rol', 'Iniciales', 'PIN', 'Estado', 'Acciones'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 20px', fontSize: 11, fontWeight: 600, color: '#999', borderBottom: '1px solid #f0f0f0', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#aaa' }}>
                  Cargando usuarios...
                </td>
              </tr>
            ) : usuarios.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#aaa' }}>
                  No hay usuarios registrados
                </td>
              </tr>
            ) : (
              usuarios.map(user => (
                <tr key={user.id} style={{ background: editando?.id === user.id ? '#f8fbff' : user.activo ? '#fff' : '#fafafa' }}>
                  <td style={{ padding: '14px 20px', borderBottom: '1px solid #f8f8f8' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        background: user.activo ? ROL_COLORS[user.rol] + '20' : '#e0e0e0',
                        color: user.activo ? ROL_COLORS[user.rol] : '#999',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        fontWeight: 700,
                      }}>
                        {user.iniciales}
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 500, color: user.activo ? '#1a1a1a' : '#999' }}>
                          {user.nombre}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '14px 20px', borderBottom: '1px solid #f8f8f8', fontSize: 13, color: user.activo ? '#666' : '#999' }}>
                    {user.email}
                  </td>
                  <td style={{ padding: '14px 20px', borderBottom: '1px solid #f8f8f8' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '4px 10px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 600,
                      background: user.activo ? ROL_COLORS[user.rol] + '15' : '#f0f0f0',
                      color: user.activo ? ROL_COLORS[user.rol] : '#999',
                    }}>
                      {ROL_LABELS[user.rol]}
                    </span>
                  </td>
                  <td style={{ padding: '14px 20px', borderBottom: '1px solid #f8f8f8', fontSize: 13, fontWeight: 600, color: user.activo ? '#1a1a1a' : '#999' }}>
                    {user.iniciales}
                  </td>
                  <td style={{ padding: '14px 20px', borderBottom: '1px solid #f8f8f8', fontSize: 13, fontFamily: 'monospace', color: user.activo ? '#666' : '#999' }}>
                    {user.pin || '1234'}
                  </td>
                  <td style={{ padding: '14px 20px', borderBottom: '1px solid #f8f8f8' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '3px 8px',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 600,
                      background: user.activo ? '#EAF3DE' : '#f0f0f0',
                      color: user.activo ? '#27500A' : '#999',
                    }}>
                      {user.activo ? '✓ Activo' : '✗ Inactivo'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 20px', borderBottom: '1px solid #f8f8f8' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => iniciarEditar(user)}
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
                        onClick={() => toggleActivo(user)}
                        style={{
                          background: 'none',
                          border: `1px solid ${user.activo ? '#E24B4A' : '#27500A'}`,
                          color: user.activo ? '#E24B4A' : '#27500A',
                          padding: '4px 10px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {user.activo ? '⏸ Desactivar' : '▶ Activar'}
                      </button>
                      <button
                        onClick={() => resetearPin(user)}
                        style={{
                          background: 'none',
                          border: '1px solid #EF9F27',
                          color: '#EF9F27',
                          padding: '4px 10px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        🔄 Reset PIN
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Info sobre roles */}
      <div style={{ marginTop: 24, background: '#f8f8f8', border: '1px solid #e0e0e0', borderRadius: 12, padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>ℹ️ Permisos por rol</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, fontSize: 12, color: '#666', lineHeight: 1.6 }}>
          <div>
            <strong style={{ color: ROL_COLORS.gerencia }}>Gerencia:</strong> Acceso total a todos los módulos (Dashboard, Alertas, Score, Compras, Auditoría, Radicación, Pagos, Contraloría, Admin)
          </div>
          <div>
            <strong style={{ color: ROL_COLORS.admin_compras }}>Admin Compras:</strong> Gestión completa de compras (Dashboard, Alertas, Score, Solicitudes, OFs, Cotizaciones, Auditoría, Proveedores, Evaluaciones)
          </div>
          <div>
            <strong style={{ color: ROL_COLORS.encargado }}>Encargado:</strong> Solo ve y edita sus OFs asignadas (Dashboard, Alertas, Solicitudes, Nueva OF, Cotizaciones, Órdenes, Proveedores)
          </div>
          <div>
            <strong style={{ color: ROL_COLORS.solicitante }}>Solicitante:</strong> Solo consulta OFs que solicitó y crea solicitudes (Dashboard, Solicitudes, Órdenes en modo consulta)
          </div>
        </div>
      </div>
    </div>
  )
}
