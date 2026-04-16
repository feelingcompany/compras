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
      minHeight: '100vh', background: '#f5f5f3', display: 'flex',
      alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        background: '#fff', border: '0.5px solid #ebebeb', borderRadius: 16,
        padding: '40px 36px', width: 380
      }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#1a1a1a' }}>Compras FC</div>
          <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>Feeling Company · Sistema de compras</div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 5 }}>
              Email corporativo
            </div>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tu@feelingcompany.com"
              required
              style={{
                width: '100%', padding: '9px 12px', border: '0.5px solid #d3d1c7',
                borderRadius: 8, fontSize: 13, outline: 'none', background: '#fafafa'
              }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 5 }}>
              PIN (4 dígitos)
            </div>
            <input
              type="password"
              value={pin}
              onChange={e => setPin(e.target.value)}
              placeholder="••••"
              maxLength={4}
              required
              style={{
                width: '100%', padding: '9px 12px', border: '0.5px solid #d3d1c7',
                borderRadius: 8, fontSize: 13, outline: 'none', background: '#fafafa',
                letterSpacing: '0.2em'
              }}
            />
          </div>

          {error && (
            <div style={{
              padding: '8px 12px', background: '#FCEBEB', border: '0.5px solid #F09595',
              borderRadius: 8, fontSize: 12, color: '#791F1F', marginBottom: 14
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '10px', background: loading ? '#aaa' : '#185FA5',
              color: '#fff', border: 'none', borderRadius: 8, fontSize: 13,
              fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <div style={{ marginTop: 24, fontSize: 11, color: '#ccc', textAlign: 'center' }}>
          PIN por defecto: 1234 · Cámbialo en Configuración
        </div>
      </div>
    </div>
  )
}
