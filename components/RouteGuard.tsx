'use client'
import { useAuth } from '@/lib/auth'
import { usePermissions, Modulo } from '@/lib/permissions'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

interface RouteGuardProps {
  modulo: Modulo
  children: React.ReactNode
}

export function RouteGuard({ modulo, children }: RouteGuardProps) {
  const { usuario } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!usuario) {
      router.push('/login')
      return
    }

    const permisos = usePermissions(usuario.rol, usuario.id)
    if (!permisos.puedeAcceder(modulo)) {
      // Redirect a dashboard si no tiene acceso
      router.push('/dashboard')
    }
  }, [usuario, modulo, router])

  if (!usuario) return null

  const permisos = usePermissions(usuario.rol, usuario.id)
  if (!permisos.puedeAcceder(modulo)) return null

  return <>{children}</>
}
