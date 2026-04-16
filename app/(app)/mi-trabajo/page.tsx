'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'

export default function MiTrabajoPage() {
  const { usuario } = useAuth()
  const [loading, setLoading] = useState(true)
  const [tareas, setTareas] = useState({
    aprobaciones: [],
    alertasCriticas: [],
    solicitudesPendientes: [],
    ofsSinCotizaciones: [],
    cotizacionesPorRevisar: [],
    proveedoresPorEvaluar: []
  })
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (usuario) loadTareas()
  }, [usuario])

  const loadTareas = async () => {
    if (!usuario) return
    setLoading(true)

    // 1. Aprobaciones pendientes
    const { data: aprobaciones } = await supabase
      .from('aprobaciones')
      .select(`
        *,
        of:ordenes_facturacion(codigo_of, valor_total, descripcion)
      `)
      .eq('aprobador_id', usuario.id)
      .eq('estado', 'pendiente')
      .order('created_at', { ascending: false })
      .limit(10)

    // 2. Alertas críticas asignadas a este usuario
    const { data: alertas } = await supabase
      .from('alertas_sistema')
      .select('*, of:ordenes_facturacion(codigo_of, valor_total)')
      .eq('usuario_id', usuario.id)
      .eq('estado', 'activo')
      .eq('nivel', 'critico')
      .order('created_at', { ascending: false })
      .limit(10)

    // 3. Solicitudes sin respuesta (si es admin o gerencia)
    let solicitudes = []
    if (['admin_compras', 'gerencia'].includes(usuario.rol)) {
      const { data: solic } = await supabase
        .from('solicitudes')
        .select('*')
        .eq('estado', 'pendiente')
        .order('created_at', { ascending: true })
        .limit(10)
      solicitudes = solic || []
    }

    // 4. OFs sin cotizaciones (valor >$5M)
    const { data: ofsSin } = await supabase
      .from('ordenes_facturacion')
      .select(`
        *,
        cotizaciones(count)
      `)
      .gte('valor_total', 5000000)
      .eq('encargado_id', usuario.id)
      .order('valor_total', { ascending: false })
      .limit(10)

    const sinCotizaciones = (ofsSin || []).filter(of => 
      !of.cotizaciones || of.cotizaciones.length === 0
    )

    // 5. Cotizaciones por revisar
    const { data: cotizaciones } = await supabase
      .from('cotizaciones')
      .select(`
        *,
        of:ordenes_facturacion(codigo_of, valor_total),
        proveedor:proveedores(razon_social)
      `)
      .eq('registrado_por', usuario.id)
      .is('seleccionada', null)
      .order('created_at', { ascending: false })
      .limit(10)

    // 6. Proveedores por evaluar (placeholder - ajustar según lógica real)
    const { data: proveedores } = await supabase
      .from('proveedores')
      .select('*')
      .eq('activo', true)
      .order('created_at', { ascending: false })
      .limit(5)

    setTareas({
      aprobaciones: aprobaciones || [],
      alertasCriticas: alertas || [],
      solicitudesPendientes: solicitudes,
      ofsSinCotizaciones: sinCotizaciones,
      cotizacionesPorRevisar: cotizaciones || [],
      proveedoresPorEvaluar: proveedores || []
    })

    setLoading(false)
  }

  const urgentes = 
    tareas.aprobaciones.length + 
    tareas.alertasCriticas.length

  const importantes = 
    tareas.solicitudesPendientes.length + 
    tareas.ofsSinCotizaciones.length

  const paraRevisar = 
    tareas.cotizacionesPorRevisar.length + 
    tareas.proveedoresPorEvaluar.length

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)'
      }}>
        <div style={{
          textAlign: 'center',
          color: '#fff'
        }}>
          <div style={{
            width: 48,
            height: 48,
            border: '3px solid rgba(255,255,255,0.2)',
            borderTopColor: '#fff',
            borderRadius: '50%',
            margin: '0 auto 16px',
            animation: 'spin 1s linear infinite'
          }} />
          <p style={{ fontSize: 14, opacity: 0.7 }}>Cargando tu trabajo...</p>
        </div>
        <style jsx>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      padding: '32px 24px',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap');
        
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .task-card {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .task-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        }
      `}</style>

      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        {/* Header */}
        <div style={{
          marginBottom: 40,
          animation: 'slideIn 0.5s ease-out'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{
              width: 8,
              height: 8,
              background: urgentes > 0 ? '#ef4444' : '#10b981',
              borderRadius: '50%',
              animation: urgentes > 0 ? 'pulse 2s infinite' : 'none'
            }} />
            <h1 style={{
              fontSize: 32,
              fontWeight: 700,
              color: '#fff',
              margin: 0,
              letterSpacing: '-0.02em'
            }}>
              Mi Trabajo
            </h1>
          </div>
          <p style={{
            fontSize: 15,
            color: 'rgba(255,255,255,0.6)',
            margin: 0,
            fontFamily: 'JetBrains Mono, monospace'
          }}>
            {usuario?.nombre} • {new Date().toLocaleDateString('es-CO', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
        </div>

        {/* Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16,
          marginBottom: 32,
          animation: 'slideIn 0.6s ease-out'
        }}>
          <StatCard
            title="URGENTE"
            count={urgentes}
            color="#ef4444"
            subtitle="Requiere atención inmediata"
          />
          <StatCard
            title="IMPORTANTE"
            count={importantes}
            color="#f59e0b"
            subtitle="Esta semana"
          />
          <StatCard
            title="PARA REVISAR"
            count={paraRevisar}
            color="#10b981"
            subtitle="Cuando tengas tiempo"
          />
        </div>

        {/* Sección Urgente */}
        {urgentes > 0 && (
          <Section
            title="🔴 Requiere Tu Atención Ahora"
            count={urgentes}
            delay="0.7s"
          >
            {tareas.aprobaciones.length > 0 && (
              <TaskGroup
                title="Aprobaciones Pendientes"
                icon="✓"
                items={tareas.aprobaciones.map(a => ({
                  id: a.id,
                  title: a.of?.codigo_of || 'OF',
                  subtitle: `Nivel ${a.nivel} • $${(a.of?.valor_total || 0).toLocaleString()}`,
                  onClick: () => router.push('/aprobaciones')
                }))}
              />
            )}

            {tareas.alertasCriticas.length > 0 && (
              <TaskGroup
                title="Alertas Críticas"
                icon="⚡"
                items={tareas.alertasCriticas.map(a => ({
                  id: a.id,
                  title: a.titulo,
                  subtitle: a.descripcion?.substring(0, 60) + '...',
                  onClick: () => router.push('/alertas')
                }))}
              />
            )}
          </Section>
        )}

        {/* Sección Importante */}
        {importantes > 0 && (
          <Section
            title="🟡 Importante Esta Semana"
            count={importantes}
            delay="0.8s"
          >
            {tareas.solicitudesPendientes.length > 0 && (
              <TaskGroup
                title="Solicitudes Sin Responder"
                icon="📋"
                items={tareas.solicitudesPendientes.map(s => ({
                  id: s.id,
                  title: s.titulo,
                  subtitle: `$${(s.monto_estimado || 0).toLocaleString()} • ${new Date(s.created_at).toLocaleDateString()}`,
                  onClick: () => router.push('/solicitudes')
                }))}
              />
            )}

            {tareas.ofsSinCotizaciones.length > 0 && (
              <TaskGroup
                title="OFs Sin Cotizaciones"
                icon="💰"
                items={tareas.ofsSinCotizaciones.map(of => ({
                  id: of.id,
                  title: of.codigo_of,
                  subtitle: `$${of.valor_total.toLocaleString()} • Sin cotizaciones`,
                  onClick: () => router.push('/cotizaciones')
                }))}
              />
            )}
          </Section>
        )}

        {/* Sección Para Revisar */}
        {paraRevisar > 0 && (
          <Section
            title="🟢 Para Revisar"
            count={paraRevisar}
            delay="0.9s"
          >
            {tareas.cotizacionesPorRevisar.length > 0 && (
              <TaskGroup
                title="Cotizaciones Por Comparar"
                icon="📊"
                items={tareas.cotizacionesPorRevisar.map(c => ({
                  id: c.id,
                  title: c.of?.codigo_of || 'OF',
                  subtitle: `${c.proveedor?.razon_social} • $${c.valor.toLocaleString()}`,
                  onClick: () => router.push('/cotizaciones')
                }))}
              />
            )}
          </Section>
        )}

        {/* Empty State */}
        {urgentes === 0 && importantes === 0 && paraRevisar === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '80px 24px',
            animation: 'slideIn 1s ease-out'
          }}>
            <div style={{
              fontSize: 64,
              marginBottom: 16,
              filter: 'grayscale(1)',
              opacity: 0.3
            }}>
              ✅
            </div>
            <h2 style={{
              fontSize: 24,
              fontWeight: 600,
              color: '#fff',
              marginBottom: 8
            }}>
              Todo al Día
            </h2>
            <p style={{
              fontSize: 15,
              color: 'rgba(255,255,255,0.5)',
              maxWidth: 400,
              margin: '0 auto'
            }}>
              No tienes tareas pendientes en este momento.
              ¡Excelente trabajo! 🎉
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ title, count, color, subtitle }: any) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.05)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 12,
      padding: 24,
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: 4,
        height: '100%',
        background: color
      }} />
      <div style={{
        fontSize: 11,
        fontWeight: 600,
        color: 'rgba(255,255,255,0.5)',
        letterSpacing: '0.1em',
        marginBottom: 8
      }}>
        {title}
      </div>
      <div style={{
        fontSize: 48,
        fontWeight: 700,
        color: color,
        lineHeight: 1,
        marginBottom: 8,
        fontFamily: 'JetBrains Mono, monospace'
      }}>
        {count}
      </div>
      <div style={{
        fontSize: 13,
        color: 'rgba(255,255,255,0.4)'
      }}>
        {subtitle}
      </div>
    </div>
  )
}

function Section({ title, count, delay, children }: any) {
  return (
    <div style={{
      marginBottom: 32,
      animation: `slideIn 0.5s ease-out ${delay}`
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16
      }}>
        <h2 style={{
          fontSize: 18,
          fontWeight: 600,
          color: '#fff',
          margin: 0
        }}>
          {title}
        </h2>
        <div style={{
          background: 'rgba(255,255,255,0.1)',
          color: '#fff',
          padding: '4px 12px',
          borderRadius: 12,
          fontSize: 12,
          fontWeight: 600,
          fontFamily: 'JetBrains Mono, monospace'
        }}>
          {count}
        </div>
      </div>
      {children}
    </div>
  )
}

function TaskGroup({ title, icon, items }: any) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{
        fontSize: 14,
        fontWeight: 500,
        color: 'rgba(255,255,255,0.6)',
        marginBottom: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }}>
        <span>{icon}</span>
        <span>{title}</span>
        <span style={{
          background: 'rgba(255,255,255,0.1)',
          padding: '2px 8px',
          borderRadius: 8,
          fontSize: 11,
          fontWeight: 600,
          fontFamily: 'JetBrains Mono, monospace'
        }}>
          {items.length}
        </span>
      </div>
      <div style={{
        display: 'grid',
        gap: 8
      }}>
        {items.map((item: any, idx: number) => (
          <div
            key={item.id}
            className="task-card"
            onClick={item.onClick}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              padding: '12px 16px',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              animation: `slideIn 0.3s ease-out ${idx * 0.05}s backwards`
            }}
          >
            <div>
              <div style={{
                fontSize: 14,
                fontWeight: 500,
                color: '#fff',
                marginBottom: 4
              }}>
                {item.title}
              </div>
              <div style={{
                fontSize: 12,
                color: 'rgba(255,255,255,0.5)'
              }}>
                {item.subtitle}
              </div>
            </div>
            <div style={{
              color: 'rgba(255,255,255,0.3)',
              fontSize: 20
            }}>
              →
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
