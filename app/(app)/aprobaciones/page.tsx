'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth'

type Aprobacion = {
  aprobacion_id: string
  solicitud_id: string
  nivel_aprobacion: number
  monto_total: number
  prioridad: string
  solicitud_descripcion: string
  solicitante_nombre: string
  vencida: boolean
  fecha_limite: string
}

export default function AprobacionesPage() {
  const { usuario } = useAuth()
  const router = useRouter()
  const supabase = createClient()
  
  const [aprobaciones, setAprobaciones] = useState<Aprobacion[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!usuario || usuario.rol === 'solicitante') {
      router.push('/')
      return
    }
    cargarAprobaciones()
  }, [usuario])

  const cargarAprobaciones = async () => {
    if (!usuario) return
    const { data } = await supabase
      .from('vista_aprobaciones_pendientes')
      .select('*')
      .eq('aprobador_id', usuario.id)
    setAprobaciones(data || [])
    setLoading(false)
  }

  if (loading) return <div className="loading"></div>

  return (
    <div style={{ padding: 'var(--space-6)' }}>
      <h1>Aprobaciones Pendientes ({aprobaciones.length})</h1>
      {aprobaciones.map(a => (
        <div key={a.aprobacion_id} className="card">
          <h3>{a.solicitud_descripcion}</h3>
          <p>Monto: ${a.monto_total.toLocaleString()}</p>
        </div>
      ))}
    </div>
  )
}
