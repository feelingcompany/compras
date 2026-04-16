'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase, Usuario } from './supabase'

interface AuthCtx {
  usuario: Usuario | null
  login: (email: string, pin: string) => Promise<boolean>
  logout: () => void
  loading: boolean
}

const AuthContext = createContext<AuthCtx>({} as AuthCtx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('fc_usuario')
    if (stored) setUsuario(JSON.parse(stored))
    setLoading(false)
  }, [])

  const login = async (email: string, pin: string) => {
    // Simple PIN auth - PIN is last 4 digits of NIT or default 1234
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('email', email)
      .eq('activo', true)
      .single()
    if (error || !data) return false
    // Check PIN - stored in users table or default 1234
    const validPin = data.pin || '1234'
    if (pin !== validPin) return false
    localStorage.setItem('fc_usuario', JSON.stringify(data))
    setUsuario(data)
    return true
  }

  const logout = () => {
    localStorage.removeItem('fc_usuario')
    setUsuario(null)
  }

  return <AuthContext.Provider value={{ usuario, login, logout, loading }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
