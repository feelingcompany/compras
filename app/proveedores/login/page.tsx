'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ProveedoresLoginPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    
    try {
      // Verificar credenciales de proveedor
      const { data: proveedor, error: errorLogin } = await supabase
        .from('proveedores_portal')
        .select(`
          *,
          proveedor:proveedores(*)
        `)
        .eq('email', email.toLowerCase())
        .eq('activo', true)
        .single()
      
      if (errorLogin || !proveedor) {
        setError('Email o contraseña incorrectos')
        setLoading(false)
        return
      }
      
      // TODO: Validar password_hash con bcrypt
      // Por ahora validación simple (CAMBIAR EN PRODUCCIÓN)
      if (password !== proveedor.password_hash) {
        setError('Email o contraseña incorrectos')
        setLoading(false)
        return
      }
      
      // Actualizar última conexión
      await supabase
        .from('proveedores_portal')
        .update({ ultima_conexion: new Date().toISOString() })
        .eq('id', proveedor.id)
      
      // Guardar sesión
      localStorage.setItem('proveedor_portal', JSON.stringify(proveedor))
      
      // Redirigir a dashboard
      router.push('/proveedores/dashboard')
      
    } catch (error: any) {
      console.error('Error:', error)
      setError('Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-block bg-purple-600 text-white rounded-full w-16 h-16 flex items-center justify-center text-2xl font-bold mb-4">
            🏪
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Portal de Proveedores</h1>
          <p className="text-sm text-gray-500 mt-2">Feeling Company - Sistema de Compras</p>
        </div>
        
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="proveedor@empresa.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              required
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
        
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            ¿Problemas para acceder?{' '}
            <a href="mailto:compras@feelingcompany.com" className="text-purple-600 hover:text-purple-700 font-medium">
              Contactá a Compras
            </a>
          </p>
        </div>
        
        <div className="mt-8 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Portal de Proveedores</h3>
          <ul className="text-xs text-gray-600 space-y-1">
            <li>• Ver tus Órdenes de Facturación</li>
            <li>• Actualizar estados de entregas</li>
            <li>• Subir facturas</li>
            <li>• Ver tu calificación y estadísticas</li>
            <li>• Comunicarte con el equipo de Compras</li>
          </ul>
        </div>
        
        <div className="mt-6 text-center">
          <button
            onClick={() => router.push('/login')}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← Volver al login de empleados
          </button>
        </div>
      </div>
    </div>
  )
}
