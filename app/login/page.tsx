'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'

export default function LoginPage() {
  const { login } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const ok = await login(email, pin)
    if (ok) {
      router.push('/dashboard')
    } else {
      setError('Email o PIN incorrecto')
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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
              background: 'linear-gradient(135deg, var(--primary-600), var(--primary-700))',
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
              FC
            </div>
            
            <h1 style={{
              fontSize: 'var(--text-3xl)',
              fontWeight: 'var(--font-bold)',
              color: 'var(--gray-900)',
              marginBottom: 'var(--space-2)'
            }}>
              Compras FC
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
          <form onSubmit={handleSubmit} style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-5)'
          }}>
            <div>
              <label className="label label-required">Email Corporativo</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@feelingcompany.com"
                className="input"
                required
              />
            </div>
            
            <div>
              <label className="label label-required">PIN (4 dígitos)</label>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••"
                maxLength={4}
                className="input"
                required
                style={{ letterSpacing: '0.2em' }}
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary btn-lg"
              style={{ width: '100%', marginTop: 'var(--space-2)' }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <span className="loading" style={{ width: '1rem', height: '1rem' }}></span>
                  Ingresando...
                </span>
              ) : 'Ingresar'}
            </button>
          </form>
          
          {/* Links */}
          <div style={{
            marginTop: 'var(--space-6)',
            paddingTop: 'var(--space-6)',
            borderTop: '1px solid var(--gray-200)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-3)',
            alignItems: 'center'
          }}>
            <button
              type="button"
              onClick={() => router.push('/registro')}
              style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--primary-600)',
                fontWeight: 'var(--font-medium)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'none'
              }}
            >
              ¿No tenés cuenta? Solicitá acceso
            </button>
            
            <button
              type="button"
              onClick={() => router.push('/proveedores/login')}
              style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--gray-500)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'none'
              }}
            >
              Acceso para proveedores →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
