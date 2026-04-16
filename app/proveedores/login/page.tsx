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
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--space-6)'
    }}>
      <div style={{ maxWidth: '28rem', width: '100%' }}>
        {/* Card Principal */}
        <div className="card" style={{ padding: 'var(--space-8)' }}>
          {/* Logo y Header */}
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: 'var(--radius-xl)',
              background: 'linear-gradient(135deg, var(--success-600), var(--success-700))',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 'var(--space-4)',
              boxShadow: 'var(--shadow-lg)',
              fontSize: '2rem',
              fontWeight: 'var(--font-bold)',
              color: 'white',
              letterSpacing: '-0.05em'
            }}>
              PR
            </div>
            
            <h1 style={{
              fontSize: 'var(--text-3xl)',
              fontWeight: 'var(--font-bold)',
              color: 'var(--gray-900)',
              marginBottom: 'var(--space-2)'
            }}>
              Portal de Proveedores
            </h1>
            
            <p style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--gray-500)'
            }}>
              Feeling Company • Sistema de Compras
            </p>
          </div>
          
          {/* Error Alert */}
          {error && (
            <div className="alert alert-error" style={{ marginBottom: 'var(--space-6)' }}>
              <strong style={{ display: 'block', marginBottom: 'var(--space-1)' }}>Error</strong>
              {error}
            </div>
          )}
          
          {/* Form */}
          <form onSubmit={handleLogin} style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-5)'
          }}>
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="proveedor@empresa.com"
                className="input"
                required
              />
            </div>
            
            <div>
              <label className="label">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input"
                required
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="btn btn-success btn-lg"
              style={{ width: '100%', marginTop: 'var(--space-2)' }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <span className="loading" style={{ width: '1rem', height: '1rem' }}></span>
                  Ingresando...
                </span>
              ) : '→ Ingresar al Portal'}
            </button>
          </form>
          
          {/* Contacto */}
          <div style={{
            marginTop: 'var(--space-6)',
            paddingTop: 'var(--space-6)',
            borderTop: '1px solid var(--gray-200)',
            textAlign: 'center'
          }}>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-600)' }}>
              ¿Problemas para acceder?{' '}
              <a
                href="mailto:compras@feelingcompany.com"
                style={{
                  color: 'var(--success-600)',
                  fontWeight: 'var(--font-medium)',
                  textDecoration: 'none'
                }}
              >
                Contactá a Compras
              </a>
            </p>
          </div>
        </div>
        
        {/* Info Card */}
        <div className="card" style={{
          marginTop: 'var(--space-4)',
          backgroundColor: 'rgba(255, 255, 255, 0.95)'
        }}>
          <h3 style={{
            fontSize: 'var(--text-base)',
            fontWeight: 'var(--font-semibold)',
            color: 'var(--gray-900)',
            marginBottom: 'var(--space-3)'
          }}>
            Portal de Proveedores
          </h3>
          <ul style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--gray-600)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-2)',
            listStyle: 'disc',
            paddingLeft: 'var(--space-6)',
            margin: 0
          }}>
            <li>Ver tus Órdenes de Facturación</li>
            <li>Actualizar estados de entregas</li>
            <li>Subir facturas</li>
            <li>Ver tu calificación y estadísticas</li>
            <li>Comunicarte con el equipo de Compras</li>
          </ul>
        </div>
        
        {/* Volver */}
        <div style={{ marginTop: 'var(--space-6)', textAlign: 'center' }}>
          <button
            type="button"
            onClick={() => router.push('/login')}
            style={{
              fontSize: 'var(--text-sm)',
              color: 'rgba(255, 255, 255, 0.8)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              textDecoration: 'none'
            }}
          >
            ← Volver al login de empleados
          </button>
        </div>
      </div>
    </div>
  )
}
