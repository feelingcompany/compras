'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ScoreRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/inicio')
  }, [router])
  return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Redirigiendo a Inicio...</div>
}
