'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import Sidebar from '@/components/Sidebar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { usuario, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !usuario) router.push('/login')
  }, [usuario, loading, router])

  if (loading || !usuario) return null

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <main style={{ flex: 1, marginLeft: 210, overflowY: 'auto', background: '#f5f5f3' }}>
        {children}
      </main>
    </div>
  )
}
