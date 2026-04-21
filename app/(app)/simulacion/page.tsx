'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth'

// ============================================================
// SIMULACIÓN DEL PROCESO COMPLETO DE COMPRAS
// 
// Permite al admin correr un "ensayo" end-to-end paso a paso:
// 1. Crear solicitud de prueba
// 2. Aprobarla
// 3. Iniciar cotización
// 4. Adjudicar proveedor
// 5. Emitir OF/OS
// 6. Marcar ejecutada
// 7. Radicar
// 8. Pagar
// 9. Ver resultado final
// ============================================================

type Paso = {
  numero: number
  fase: string
  titulo: string
  descripcion: string
  accion: string
  estado_resultante: string
  rol_responsable: string
}

const PASOS: Paso[] = [
  {
    numero: 1,
    fase: 'Fase 1 — Activación y Convocatoria',
    titulo: 'Crear solicitud',
    descripcion: 'Un solicitante identifica una necesidad y crea la solicitud con sus ítems, cantidades y centro de costo.',
    accion: 'Crear solicitud de prueba',
    estado_resultante: 'pendiente',
    rol_responsable: 'Solicitante'
  },
  {
    numero: 2,
    fase: 'Fase 1 — Activación y Convocatoria',
    titulo: 'Aprobar solicitud',
    descripcion: 'El encargado (o admin/gerencia según el monto) revisa y aprueba la solicitud.',
    accion: 'Aprobar solicitud',
    estado_resultante: 'aprobada',
    rol_responsable: 'Encargado / Admin Compras'
  },
  {
    numero: 3,
    fase: 'Fase 1 — Activación y Convocatoria',
    titulo: 'Iniciar cotización',
    descripcion: 'El líder de compras empieza a buscar proveedores y les pide cotizaciones.',
    accion: 'Marcar como "en cotización"',
    estado_resultante: 'cotizando',
    rol_responsable: 'Admin Compras'
  },
  {
    numero: 4,
    fase: 'Fase 2 — Formalización',
    titulo: 'Adjudicar y emitir OF/OS',
    descripcion: 'Se elige el proveedor ganador y se emite la Orden de Facturación o Servicio.',
    accion: 'Emitir OF al proveedor',
    estado_resultante: 'ordenada',
    rol_responsable: 'Admin Compras'
  },
  {
    numero: 5,
    fase: 'Fase 3 — Ejecución y Liquidación',
    titulo: 'Ejecución',
    descripcion: 'El proveedor entrega el producto o servicio.',
    accion: 'Marcar como ejecutada',
    estado_resultante: 'ejecucion',
    rol_responsable: 'Proveedor / Admin'
  },
  {
    numero: 6,
    fase: 'Fase 3 — Ejecución y Liquidación',
    titulo: 'Radicación de factura',
    descripcion: 'El proveedor radica la factura para cobro.',
    accion: 'Radicar factura',
    estado_resultante: 'liquidacion',
    rol_responsable: 'Admin Compras'
  },
  {
    numero: 7,
    fase: 'Fase 4 — Auditoría de Compras y Pago',
    titulo: 'Auditoría y pago',
    descripcion: 'Contraloría audita. Se realiza el pago al proveedor.',
    accion: 'Marcar como pagada',
    estado_resultante: 'completada',
    rol_responsable: 'Gerencia / Financiero'
  },
]

export default function SimulacionPage() {
  const { usuario } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [solicitudSimulada, setSolicitudSimulada] = useState<any>(null)
  const [pasoActual, setPasoActual] = useState(0)
  const [loading, setLoading] = useState(false)
  const [log, setLog] = useState<string[]>([])

  useEffect(() => {
    if (!usuario) {
      router.push('/login')
      return
    }
    if (!['admin_compras', 'gerencia'].includes(usuario.rol)) {
      router.push('/')
      return
    }
  }, [usuario])

  const agregarLog = (msg: string) => {
    setLog(prev => [`${new Date().toLocaleTimeString('es-CO')} — ${msg}`, ...prev])
  }

  const ejecutarPaso = async (paso: Paso) => {
    setLoading(true)
    try {
      if (paso.numero === 1) {
        // Crear solicitud de prueba
        agregarLog('Creando solicitud de prueba...')
        
        const { data: sol } = await supabase
          .from('solicitudes')
          .insert({
            solicitante_id: usuario?.id,
            centro_costo: 'FC - Feeling Company (Interno)',
            ciudad: 'Medellín',
            fecha_requerida: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            prioridad: 'normal',
            descripcion: 'SIMULACIÓN - Compra de prueba del proceso completo',
            observaciones: 'Esta solicitud es parte de un ensayo del sistema',
            estado: 'pendiente'
          })
          .select()
          .single()

        if (!sol) throw new Error('No se pudo crear la solicitud')
        agregarLog(`✓ Solicitud creada (ID: ${sol.id.slice(0, 8)})`)

        // Crear ítems de prueba
        const items = [
          { categoria: 'logistica-transporte', descripcion: 'Transporte equipo ida y vuelta', cantidad: 1, unidad: 'Servicios', presupuesto_estimado: 1200000 },
          { categoria: 'alimentacion-catering', descripcion: 'Refrigerios para 20 personas', cantidad: 20, unidad: 'Personas', presupuesto_estimado: 600000 },
          { categoria: 'talento-artistas', descripcion: 'DJ profesional 4 horas', cantidad: 4, unidad: 'Horas', presupuesto_estimado: 800000 },
        ]

        for (const item of items) {
          await supabase.from('items_solicitud').insert({
            solicitud_id: sol.id,
            ...item
          })
        }
        agregarLog('✓ 3 ítems agregados (Total: $2,600,000)')

        // Crear aprobaciones según las reglas
        try {
          const monto = 2600000
          const { data: reglas } = await supabase
            .from('reglas_aprobacion')
            .select('*')
            .eq('activo', true)
            .order('nivel_aprobacion')

          if (reglas) {
            const aplicables = reglas.filter(r =>
              monto >= r.monto_minimo && (r.monto_maximo === null || monto <= r.monto_maximo)
            )

            let orden = 1
            for (const regla of aplicables) {
              const { data: aprobador } = await supabase
                .from('usuarios')
                .select('id')
                .eq('rol', regla.rol_aprobador)
                .eq('activo', true)
                .limit(1)
                .maybeSingle()

              if (aprobador) {
                await supabase.from('aprobaciones').insert({
                  solicitud_id: sol.id,
                  aprobador_id: aprobador.id,
                  nivel_aprobacion: regla.nivel_aprobacion,
                  orden_aprobacion: orden,
                  estado: 'pendiente',
                  fecha_limite: new Date(Date.now() + 3*24*60*60*1000).toISOString(),
                  comentarios: regla.descripcion
                })
                orden++
              }
            }
            agregarLog(`✓ ${orden - 1} aprobaciones asignadas`)
          }
        } catch (e) {
          agregarLog('⚠ No se pudieron crear aprobaciones automáticas')
        }

        setSolicitudSimulada(sol)
        setPasoActual(1)
        agregarLog('→ Solicitud en estado "pendiente" — esperando aprobación')
      } else if (!solicitudSimulada) {
        throw new Error('Primero creá la solicitud')
      } else {
        // Pasos 2-7: cambiar estado
        agregarLog(`Ejecutando: ${paso.titulo}...`)

        // Si es el paso 2 (aprobar), también actualizar aprobaciones
        if (paso.numero === 2) {
          await supabase
            .from('aprobaciones')
            .update({ estado: 'aprobada', fecha_aprobacion: new Date().toISOString() })
            .eq('solicitud_id', solicitudSimulada.id)
          agregarLog('✓ Todas las aprobaciones confirmadas')
        }

        await supabase
          .from('solicitudes')
          .update({ estado: paso.estado_resultante, updated_at: new Date().toISOString() })
          .eq('id', solicitudSimulada.id)

        agregarLog(`✓ Solicitud ahora en estado "${paso.estado_resultante}"`)
        setPasoActual(paso.numero)

        if (paso.numero === 7) {
          agregarLog('🎉 ¡Proceso completado! Solicitud cerrada exitosamente')
        }
      }
    } catch (error: any) {
      agregarLog(`✗ Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const reiniciar = async () => {
    if (!confirm('¿Eliminar la solicitud de simulación y empezar de nuevo?')) return
    if (solicitudSimulada) {
      await supabase.from('aprobaciones').delete().eq('solicitud_id', solicitudSimulada.id)
      await supabase.from('items_solicitud').delete().eq('solicitud_id', solicitudSimulada.id)
      await supabase.from('solicitudes').delete().eq('id', solicitudSimulada.id)
    }
    setSolicitudSimulada(null)
    setPasoActual(0)
    setLog([])
  }

  return (
    <div style={{ padding: 32, maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Ensayo del proceso
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111', margin: 0, marginBottom: 4 }}>
          Simulación end-to-end del proceso de compras
        </h1>
        <div style={{ fontSize: 13, color: '#6b7280' }}>
          Ejecutá cada etapa paso a paso para ver cómo el sistema articula todo el flujo
        </div>
      </div>

      {/* Banner informativo */}
      <div style={{
        background: '#EFF6FF', border: '1px solid #BFDBFE',
        borderRadius: 6, padding: 14, marginBottom: 20,
        fontSize: 12, color: '#1E40AF', lineHeight: 1.5
      }}>
        <strong>¿Qué hace esto?</strong> Creamos una solicitud de prueba con 3 ítems (transporte, refrigerios, DJ) 
        por un total de $2.6M y la vamos haciendo pasar por cada etapa del proceso oficial de Feeling.
        Vas a ver cómo cambia el estado en cada paso y cómo se articula el proceso completo.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
        {/* Columna izquierda: Pasos */}
        <div>
          {PASOS.map(paso => {
            const completado = paso.numero <= pasoActual
            const activo = paso.numero === pasoActual + 1
            const bloqueado = paso.numero > pasoActual + 1

            return (
              <div key={paso.numero} style={{
                background: '#fff',
                border: `1px solid ${completado ? '#A7F3D0' : activo ? '#185FA5' : '#e5e7eb'}`,
                borderRadius: 6, padding: 16, marginBottom: 10,
                opacity: bloqueado ? 0.5 : 1,
                borderLeft: `3px solid ${
                  completado ? '#10B981' : activo ? '#185FA5' : '#e5e7eb'
                }`
              }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                    background: completado ? '#10B981' : activo ? '#185FA5' : '#e5e7eb',
                    color: '#fff', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 700
                  }}>
                    {completado ? '✓' : paso.numero}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: 10, fontWeight: 700, color: '#185FA5',
                      letterSpacing: '0.05em', marginBottom: 3
                    }}>
                      {paso.fase.toUpperCase()}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#111', marginBottom: 4 }}>
                      {paso.titulo}
                    </div>
                    <div style={{ fontSize: 12, color: '#4b5563', marginBottom: 8, lineHeight: 1.5 }}>
                      {paso.descripcion}
                    </div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 10 }}>
                      Responsable: <strong>{paso.rol_responsable}</strong> · 
                      Resultado: estado <strong>"{paso.estado_resultante}"</strong>
                    </div>
                    {activo && (
                      <button
                        onClick={() => ejecutarPaso(paso)}
                        disabled={loading}
                        style={{
                          padding: '8px 16px', background: '#185FA5', color: '#fff',
                          border: 'none', borderRadius: 4, fontSize: 12,
                          fontWeight: 600, cursor: loading ? 'wait' : 'pointer'
                        }}
                      >
                        {loading ? 'Ejecutando...' : paso.accion}
                      </button>
                    )}
                    {completado && (
                      <div style={{ fontSize: 11, color: '#065F46', fontWeight: 600 }}>
                        ✓ Completado
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {pasoActual === 7 && (
            <div style={{
              background: '#D1FAE5', border: '1px solid #10B981',
              padding: 20, borderRadius: 6, textAlign: 'center'
            }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#065F46', marginBottom: 6 }}>
                🎉 Proceso completado con éxito
              </div>
              <div style={{ fontSize: 12, color: '#047857', marginBottom: 12 }}>
                La solicitud atravesó las 4 fases del proceso oficial de Feeling
              </div>
              <button
                onClick={reiniciar}
                style={{
                  padding: '8px 16px', background: '#fff', color: '#065F46',
                  border: '1px solid #10B981', borderRadius: 4,
                  fontSize: 12, fontWeight: 600, cursor: 'pointer'
                }}
              >
                Reiniciar simulación
              </button>
            </div>
          )}

          {solicitudSimulada && pasoActual < 7 && (
            <div style={{ marginTop: 16 }}>
              <button
                onClick={reiniciar}
                style={{
                  padding: '6px 12px', background: '#fff', color: '#DC2626',
                  border: '1px solid #DC2626', borderRadius: 4,
                  fontSize: 11, cursor: 'pointer'
                }}
              >
                Cancelar y eliminar solicitud de prueba
              </button>
            </div>
          )}
        </div>

        {/* Columna derecha: Info y log */}
        <div>
          {/* Info de la solicitud actual */}
          <div style={{
            background: '#fff', border: '1px solid #e5e7eb',
            borderRadius: 6, padding: 14, marginBottom: 14
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#111', marginBottom: 10 }}>
              Estado de la simulación
            </div>
            {solicitudSimulada ? (
              <>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>
                  ID: {solicitudSimulada.id.slice(0, 8)}
                </div>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>
                  Pasos completados: <strong>{pasoActual} de {PASOS.length}</strong>
                </div>
                <div style={{
                  width: '100%', height: 6, background: '#e5e7eb',
                  borderRadius: 3, overflow: 'hidden', marginTop: 8
                }}>
                  <div style={{
                    height: '100%', background: '#10B981',
                    width: `${(pasoActual / PASOS.length) * 100}%`,
                    transition: 'width 0.3s'
                  }} />
                </div>
                <button
                  onClick={() => router.push(`/solicitudes/${solicitudSimulada.id}`)}
                  style={{
                    marginTop: 12, width: '100%',
                    padding: '8px 12px', background: '#fff',
                    color: '#185FA5', border: '1px solid #185FA5',
                    borderRadius: 4, fontSize: 12, cursor: 'pointer',
                    fontWeight: 500
                  }}
                >
                  Ver solicitud en detalle
                </button>
              </>
            ) : (
              <div style={{ fontSize: 11, color: '#9ca3af' }}>
                Empezá con el paso 1 para crear una solicitud de prueba
              </div>
            )}
          </div>

          {/* Log de actividad */}
          <div style={{
            background: '#1F2937', color: '#F9FAFB',
            borderRadius: 6, padding: 14, fontSize: 11,
            fontFamily: 'monospace', maxHeight: 400, overflowY: 'auto'
          }}>
            <div style={{ color: '#9CA3AF', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: 10 }}>
              Log de actividad
            </div>
            {log.length === 0 ? (
              <div style={{ color: '#6B7280', fontStyle: 'italic' }}>
                Esperando inicio...
              </div>
            ) : (
              log.map((line, idx) => (
                <div key={idx} style={{ marginBottom: 4, lineHeight: 1.4 }}>
                  {line}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
