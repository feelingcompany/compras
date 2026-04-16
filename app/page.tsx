'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'

export default function Home() {
  const { usuario, loading } = useAuth()
  const router = useRouter()
  useEffect(() => {
    if (!loading) {
      if (usuario) router.push('/dashboard')
      else router.push('/login')
    }
  }, [usuario, loading, router])
  return null
}
