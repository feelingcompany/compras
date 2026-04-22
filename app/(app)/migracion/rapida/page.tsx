'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth'

// ============================================================
// ENTRADA RÁPIDA - Cargar UNA solicitud con su estado actual
// 
// Clave: permite marcar el estado para que el sistema
// no obligue a pasar por pasos que ya se completaron fuera.
// ============================================================

const CENTROS_COSTO = [
  'SOCSM - Metro Parques', 'ROTV - Comfama', 'DMCL - Tigo',
  'KOCA - Coca-Cola', 'PAAP - Bancolombia', 'SCIR - Interactuar',
  'LMDV - Argos', 'FC - Feeling Company (Interno)'
]

const CIUDADES = [
  'Medellín', 'Bogotá', 'Cali', 'Barranquilla', 'Cartagena',
  'Bucaramanga', 'Pereira', 'Armenia', 'Manizales'
]

const ESTADOS = [
  { value: 'pendiente', label: 'Pendiente — esperando aprobación', color: '#FEF3C7' },
  { value: 'aprobada', label: 'Aprobada — lista para cotizar', color: '#D1FAE5' },
  { value: 'cotizando', label: 'En cotización — buscando proveedor', color: '#DBEAFE' },
  { value: 'ordenada', label: 'Ordenada — OF/OS ya emitida', color: '#E0E7FF' },
  { value: 'completada', label: 'Completada — pagada y cerrada', color: '#F3F4F6' },
]

export default function EntradaRapidaPage() {
  const { usuario } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [usuarios, setUsuarios] = useState<any[]>([])
  const [proveedores, setProveedores] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [log, setLog] = useState<string[]>([])

  const [form, setForm] = useState({
    // Solicitud
    solicitante_id: '',
    descripcion: '',
    centro_costo: '',
    ciudad: '',
    ot_os: '',
    fecha_requerida: '',
    observaciones: '',
    monto_total: '',
    estado_actual: 'pendiente',
    fecha_creacion: new Date().toISOString().split('T')[0],

    // Si ya está ordenada o completada
    proveedor_id: '',
    codigo_of: '',
    fecha_of: '',
    fecha_pago: '',
    tipo_orden: 'OF' as 'OF' | 'OS'
  })

  useEffect(() => {
    if (!usuario) {
      router.push('/login')
      return
    }
    if (!['admin_compras', 'gerencia'].includes(usuario.rol)) {
      router.push('/')
      return
    }
    cargar()
  }, [usuario])

  const cargar = async () => {
    const [{ data: users }, { data: provs }] = await Promise.all([
      supabase.from('usuarios').select('id, nombre, rol, area').eq('activo', true).order('nombre'),
      supabase.from('proveedores').select('id, codigo, razon_social').eq('activo', true).order('razon_social')
    ])
    setUsuarios(users || [])
    setProveedores(provs || [])
  }

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))
  const agregarLog = (msg: string) => setLog(prev => [msg, ...prev])

  const importar = async () => {
    // Validaciones
    if (!form.solicitante_id) return alert('Seleccioná el solicitante')
    if (!form.descripcion) return alert('Ingresá la descripción')
    if (!form.monto_total) return alert('Ingresá el monto')
    if (!form.centro_costo) return alert('Seleccioná centro de costo')
    
    const necesitaProv = ['ordenada', 'completada'].includes(form.estado_actual)
    if (necesitaProv && !form.proveedor_id) {
      return alert('Si está ordenada/completada, seleccioná el proveedor')
    }

    setLoading(true)
    setLog([])
    agregarLog('→ Iniciando importación...')

    try {
      const monto = Number(String(form.monto_total).replace(/\D/g, ''))

      // 1. Crear solicitud con el estado indicado
      agregarLog('  Creando solicitud...')
      const { data: sol, error: errSol } = await supabase
        .from('solicitudes')
        .insert({
          solicitante_id: form.solicitante_id,
          descripcion: form.descripcion,
          centro_costo: form.centro_costo,
          ciudad: form.ciudad || 'Bogotá',
          ot_os: form.ot_os || null,
          fecha_requerida: form.fecha_requerida || null,
          observaciones: form.observaciones ? `[MIGRADA] ${form.observaciones}` : '[MIGRADA desde Google Sheets]',
          prioridad: 'normal',
          estado: form.estado_actual,
          created_at: form.fecha_creacion ? new Date(form.fecha_creacion).toISOString() : new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (errSol) throw errSol
      agregarLog(`  ✓ Solicitud creada (${sol.id.slice(0, 8)})`)

      // 2. Crear ítem consolidado (monto total)
      agregarLog('  Creando ítem consolidado...')
      await supabase.from('items_solicitud').insert({
        solicitud_id: sol.id,
        categoria: 'servicios-profesionales',
        descripcion: form.descripcion,
        cantidad: 1,
        unidad: 'Global',
        presupuesto_estimado: monto,
        especificaciones: '[Importado desde sistema anterior]'
      })
      agregarLog('  ✓ Ítem agregado')

      // 3. Si estado >= aprobada, crear aprobaciones como YA aprobadas (para registro histórico)
      if (['aprobada', 'cotizando', 'ordenada', 'completada'].includes(form.estado_actual)) {
        agregarLog('  Marcando aprobaciones como históricas...')
        await supabase.from('aprobaciones').insert({
          solicitud_id: sol.id,
          aprobador_id: usuario!.id,
          nivel_aprobacion: 1,
          orden_aprobacion: 1,
          estado: 'aprobada',
          fecha_aprobacion: form.fecha_creacion ? new Date(form.fecha_creacion).toISOString() : new Date().toISOString(),
          comentarios: '[APROBACIÓN HISTÓRICA - Solicitud migrada ya aprobada]'
        })
        agregarLog('  ✓ Aprobación histórica registrada')
      }

      // 4. Si estado >= ordenada, crear OF/OS
      if (['ordenada', 'completada'].includes(form.estado_actual)) {
        agregarLog(`  Creando ${form.tipo_orden}...`)
        
        // Generar código si no se dio
        let codigo = form.codigo_of
        if (!codigo) {
          const meses = ['EN', 'FE', 'MA', 'AB', 'MY', 'JN', 'JL', 'AG', 'SE', 'OC', 'NO', 'DI']
          const mes = meses[new Date().getMonth()]
          const year = String(new Date().getFullYear()).slice(2)
          const rand = String(Math.floor(Math.random() * 900) + 100)
          codigo = `02${rand}${mes}${year}`
        }

        if (form.tipo_orden === 'OF') {
          const { error: errOf } = await supabase.from('ordenes_facturacion').insert({
            codigo_of: codigo,
            proveedor_id: form.proveedor_id,
            solicitante_id: form.solicitante_id,
            encargado_id: usuario!.id,
            valor_total: monto,
            descripcion: form.descripcion,
            ciudad: form.ciudad || 'Bogotá',
            medio_pago: 'TRANSFERENCIA',
            estado_verificacion: form.estado_actual === 'completada' ? 'APROBADA' : 'EN_PROCESO',
            estado_pago: form.estado_actual === 'completada' ? 'PAGADO' : 'PENDIENTE',
            solicitud_id: sol.id,
            created_at: form.fecha_of ? new Date(form.fecha_of).toISOString() : new Date().toISOString()
          })
          if (errOf) throw errOf
          agregarLog(`  ✓ OF ${codigo} creada`)
        } else {
          // OS
          const { error: errOs } = await supabase.from('ordenes_servicio').insert({
            numero_os: codigo,
            solicitud_id: sol.id,
            proveedor_id: form.proveedor_id,
            descripcion: form.descripcion,
            valor_total: monto,
            fecha_emision: form.fecha_of ? new Date(form.fecha_of).toISOString() : new Date().toISOString(),
            estado: form.estado_actual === 'completada' ? 'validada' : 'aprobada'
          })
          if (errOs) throw errOs
          agregarLog(`  ✓ OS ${codigo} creada`)
        }
      }

      // 5. Si completada, log de pago
      if (form.estado_actual === 'completada') {
        agregarLog(`  ✓ Marcada como pagada${form.fecha_pago ? ` el ${form.fecha_pago}` : ''}`)
      }

      agregarLog('')
      agregarLog('🎉 IMPORTACIÓN EXITOSA')

      // Reset
      setTimeout(() => {
        if (confirm('Solicitud importada correctamente.\n\n¿Querés importar otra?')) {
          setForm({
            solicitante_id: '',
            descripcion: '',
            centro_costo: '',
            ciudad: '',
            ot_os: '',
            fecha_requerida: '',
            observaciones: '',
            monto_total: '',
            estado_actual: 'pendiente',
            fecha_creacion: new Date().toISOString().split('T')[0],
            proveedor_id: '',
            codigo_of: '',
            fecha_of: '',
            fecha_pago: '',
            tipo_orden: 'OF'
          })
          setLog([])
        } else {
          router.push(`/solicitudes/${sol.id}`)
        }
      }, 500)

    } catch (err: any) {
      console.error(err)
      agregarLog(`✗ ERROR: ${err.message}`)
      alert('Error al importar: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const necesitaOF = ['ordenada', 'completada'].includes(form.estado_actual)

  return (
    <div style={{ padding: 32, maxWidth: 1100, margin: '0 auto' }}>
      {/* Breadcrumb */}
      <button
        onClick={() => router.push('/migracion')}
        style={{
          background: 'none', border: 'none', color: '#185FA5',
          fontSize: 13, cursor: 'pointer', marginBottom: 16,
          textDecoration: 'underline', padding: 0
        }}
      >
        ← Volver a Centro de migración
      </button>

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111', margin: 0, marginBottom: 4 }}>
          Entrada rápida
        </h1>
        <div style={{ fontSize: 13, color: '#6b7280' }}>
          Cargá una solicitud que ya está en curso con su estado actual
        </div>
      </div>

      {/* Info banner */}
      <div style={{
        background: '#FFFBEB', border: '1px solid #FDE68A',
        borderRadius: 6, padding: 14, marginBottom: 24,
        fontSize: 12, color: '#92400E', lineHeight: 1.5
      }}>
        <strong>¿Cómo funciona?</strong> Completá los datos básicos, elegí en qué fase está la solicitud
        actualmente, y el sistema creará los registros necesarios (solicitud, aprobaciones históricas, OF/OS)
        para que puedas continuar el proceso desde ese punto sin volver a hacerlo todo.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
        {/* FORMULARIO */}
        <div style={{
          background: '#fff', border: '1px solid #e5e7eb',
          borderRadius: 8, padding: 24
        }}>
          {/* Estado actual - LO MÁS IMPORTANTE */}
          <Section titulo="¿En qué fase está actualmente?" destacado>
            <div style={{ display: 'grid', gap: 8 }}>
              {ESTADOS.map(e => (
                <label key={e.value} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: 10, border: `1px solid ${form.estado_actual === e.value ? '#185FA5' : '#e5e7eb'}`,
                  borderRadius: 6, cursor: 'pointer',
                  background: form.estado_actual === e.value ? '#EFF6FF' : '#fff'
                }}>
                  <input
                    type="radio"
                    checked={form.estado_actual === e.value}
                    onChange={() => set('estado_actual', e.value)}
                  />
                  <span style={{ padding: '2px 8px', background: e.color, fontSize: 11, fontWeight: 600, borderRadius: 3 }}>
                    {e.value}
                  </span>
                  <span style={{ fontSize: 13, color: '#111' }}>{e.label}</span>
                </label>
              ))}
            </div>
          </Section>

          {/* Datos básicos */}
          <Section titulo="Datos básicos">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Campo label="Solicitante" requerido>
                <select value={form.solicitante_id} onChange={e => set('solicitante_id', e.target.value)} style={inputStyle}>
                  <option value="">Seleccionar...</option>
                  {usuarios.map(u => (
                    <option key={u.id} value={u.id}>{u.nombre} {u.area && `(${u.area})`}</option>
                  ))}
                </select>
              </Campo>

              <Campo label="Fecha original de creación">
                <input type="date" value={form.fecha_creacion} onChange={e => set('fecha_creacion', e.target.value)} style={inputStyle} />
              </Campo>

              <div style={{ gridColumn: 'span 2' }}>
                <Campo label="Descripción" requerido>
                  <input
                    type="text"
                    value={form.descripcion}
                    onChange={e => set('descripcion', e.target.value)}
                    placeholder="¿Qué se está comprando?"
                    style={inputStyle}
                  />
                </Campo>
              </div>

              <Campo label="Centro de costo" requerido>
                <select value={form.centro_costo} onChange={e => set('centro_costo', e.target.value)} style={inputStyle}>
                  <option value="">Seleccionar...</option>
                  {CENTROS_COSTO.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Campo>

              <Campo label="Ciudad">
                <select value={form.ciudad} onChange={e => set('ciudad', e.target.value)} style={inputStyle}>
                  <option value="">Seleccionar...</option>
                  {CIUDADES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Campo>

              <Campo label="Monto total (COP)" requerido>
                <input
                  type="text"
                  value={form.monto_total ? Number(String(form.monto_total).replace(/\D/g, '')).toLocaleString('es-CO') : ''}
                  onChange={e => set('monto_total', e.target.value.replace(/\D/g, ''))}
                  placeholder="0"
                  style={inputStyle}
                />
              </Campo>

              <Campo label="OT / OS del evento">
                <input type="text" value={form.ot_os} onChange={e => set('ot_os', e.target.value)} placeholder="Opcional" style={inputStyle} />
              </Campo>

              <Campo label="Fecha requerida">
                <input type="date" value={form.fecha_requerida} onChange={e => set('fecha_requerida', e.target.value)} style={inputStyle} />
              </Campo>

              <div style={{ gridColumn: 'span 2' }}>
                <Campo label="Observaciones / Notas de la hoja original">
                  <textarea
                    value={form.observaciones}
                    onChange={e => set('observaciones', e.target.value)}
                    rows={2}
                    style={{ ...inputStyle, resize: 'vertical' }}
                    placeholder="Contexto adicional, notas del Google Sheets..."
                  />
                </Campo>
              </div>
            </div>
          </Section>

          {/* Datos de OF/OS si ya está ordenada */}
          {necesitaOF && (
            <Section titulo="Datos de la OF/OS ya emitida">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Campo label="Tipo de orden" requerido>
                  <select value={form.tipo_orden} onChange={e => set('tipo_orden', e.target.value)} style={inputStyle}>
                    <option value="OF">OF - Orden de Facturación</option>
                    <option value="OS">OS - Orden de Servicio</option>
                  </select>
                </Campo>

                <Campo label="Proveedor" requerido>
                  <select value={form.proveedor_id} onChange={e => set('proveedor_id', e.target.value)} style={inputStyle}>
                    <option value="">Seleccionar...</option>
                    {proveedores.map(p => (
                      <option key={p.id} value={p.id}>{p.razon_social}</option>
                    ))}
                  </select>
                </Campo>

                <Campo label={`Código ${form.tipo_orden} (opcional)`}>
                  <input
                    type="text"
                    value={form.codigo_of}
                    onChange={e => set('codigo_of', e.target.value.toUpperCase())}
                    placeholder="Si está en Sheets, pegalo. Si no, se genera."
                    style={inputStyle}
                  />
                </Campo>

                <Campo label={`Fecha de emisión ${form.tipo_orden}`}>
                  <input type="date" value={form.fecha_of} onChange={e => set('fecha_of', e.target.value)} style={inputStyle} />
                </Campo>

                {form.estado_actual === 'completada' && (
                  <Campo label="Fecha de pago">
                    <input type="date" value={form.fecha_pago} onChange={e => set('fecha_pago', e.target.value)} style={inputStyle} />
                  </Campo>
                )}
              </div>
            </Section>
          )}

          {/* Acciones */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 16, borderTop: '1px solid #e5e7eb', marginTop: 20 }}>
            <button onClick={() => router.push('/migracion')} style={btnSecondary}>
              Cancelar
            </button>
            <button onClick={importar} disabled={loading} style={{ ...btnPrimary, opacity: loading ? 0.6 : 1 }}>
              {loading ? 'Importando...' : 'Importar solicitud'}
            </button>
          </div>
        </div>

        {/* PANEL LATERAL: Log y tips */}
        <div>
          {/* Resumen de lo que va a pasar */}
          <div style={{
            background: '#fff', border: '1px solid #e5e7eb',
            borderRadius: 6, padding: 14, marginBottom: 14
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#111', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Qué va a crear
            </div>
            <div style={{ fontSize: 11, color: '#4b5563', lineHeight: 1.7 }}>
              <Paso ok={true} texto="Solicitud con datos básicos" />
              <Paso ok={true} texto="Ítem consolidado (monto total)" />
              <Paso ok={['aprobada', 'cotizando', 'ordenada', 'completada'].includes(form.estado_actual)} texto="Aprobación histórica" />
              <Paso ok={necesitaOF} texto={`${form.tipo_orden} emitida al proveedor`} />
              <Paso ok={form.estado_actual === 'completada'} texto="Marcada como pagada" />
            </div>
          </div>

          {/* Log */}
          {log.length > 0 && (
            <div style={{
              background: '#1F2937', color: '#F9FAFB',
              borderRadius: 6, padding: 14, fontSize: 11,
              fontFamily: 'monospace', maxHeight: 300, overflowY: 'auto'
            }}>
              <div style={{ color: '#9CA3AF', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: 10 }}>
                Log
              </div>
              {log.map((line, idx) => (
                <div key={idx} style={{ marginBottom: 3, lineHeight: 1.4 }}>{line}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', border: '1px solid #d1d5db',
  borderRadius: 4, fontSize: 13, background: '#fff', outline: 'none',
  fontFamily: 'inherit'
}
const btnPrimary: React.CSSProperties = {
  padding: '10px 20px', background: '#185FA5', color: '#fff',
  border: 'none', borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: 'pointer'
}
const btnSecondary: React.CSSProperties = {
  padding: '10px 16px', background: '#fff', color: '#374151',
  border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13, fontWeight: 500, cursor: 'pointer'
}

function Section({ titulo, destacado, children }: any) {
  return (
    <div style={{
      marginBottom: 20, paddingBottom: 16,
      borderBottom: '1px solid #f3f4f6'
    }}>
      <div style={{
        fontSize: 12, fontWeight: 700,
        color: destacado ? '#185FA5' : '#111',
        textTransform: 'uppercase', letterSpacing: '0.05em',
        marginBottom: 12
      }}>
        {titulo}
      </div>
      {children}
    </div>
  )
}

function Campo({ label, requerido, children }: any) {
  return (
    <div>
      <label style={{
        display: 'block', fontSize: 11, fontWeight: 600,
        color: '#6b7280', textTransform: 'uppercase',
        letterSpacing: '0.04em', marginBottom: 5
      }}>
        {label} {requerido && <span style={{ color: '#DC2626' }}>*</span>}
      </label>
      {children}
    </div>
  )
}

function Paso({ ok, texto }: any) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
      <span style={{
        width: 14, height: 14, borderRadius: '50%',
        background: ok ? '#10B981' : '#e5e7eb',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 9, color: '#fff', fontWeight: 700, flexShrink: 0
      }}>
        {ok ? '✓' : ''}
      </span>
      <span style={{ color: ok ? '#111' : '#9ca3af' }}>{texto}</span>
    </div>
  )
}
