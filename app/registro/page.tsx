'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const AREAS = [
  'Producción',
  'Logística',
  'Creatividad',
  'Administración',
  'Compras',
  'Finanzas',
  'Recursos Humanos',
  'Tecnología',
  'Comercial',
  'Operaciones',
  'Otra'
]

export default function RegistroPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [form, setForm] = useState({
    nombre_completo: '',
    email: '',
    pin: '',
    pin_confirmacion: '',
    area: '',
    telefono: ''
  })
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const validarEmail = (email: string) => {
    return email.endsWith('@feelingone.co') || email.endsWith('@feelingcompany.com')
  }
  
  const validarPIN = (pin: string) => {
    return /^\d{4}$/.test(pin)
  }
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    // Validaciones
    if (!form.nombre_completo.trim()) {
      setError('Ingresá tu nombre completo')
      return
    }
    
    if (!validarEmail(form.email)) {
      setError('Usá tu email corporativo (@feelingone.co o @feelingcompany.com)')
      return
    }
    
    if (!validarPIN(form.pin)) {
      setError('El PIN debe ser de 4 dígitos numéricos')
      return
    }
    
    if (form.pin !== form.pin_confirmacion) {
      setError('Los PINs no coinciden')
      return
    }
    
    if (!form.area) {
      setError('Seleccioná tu área')
      return
    }
    
    setLoading(true)
    
    try {
      // Verificar si el email ya existe
      const { data: existente } = await supabase
        .from('usuarios')
        .select('id')
        .eq('email', form.email.toLowerCase())
        .single()
      
      if (existente) {
        setError('Este email ya tiene acceso al sistema. Usá la página de login.')
        setLoading(false)
        return
      }
      
      // Verificar si ya hay una solicitud pendiente
      const { data: solicitudPendiente } = await supabase
        .from('solicitudes_acceso')
        .select('id, estado')
        .eq('email', form.email.toLowerCase())
        .eq('estado', 'pendiente')
        .single()
      
      if (solicitudPendiente) {
        setError('Ya tenés una solicitud pendiente de aprobación.')
        setLoading(false)
        return
      }
      
      // Crear solicitud de acceso
      const { error: insertError } = await supabase
        .from('solicitudes_acceso')
        .insert({
          nombre_completo: form.nombre_completo,
          email: form.email.toLowerCase(),
          pin: form.pin,
          area: form.area,
          estado: 'pendiente'
        })
      
      if (insertError) throw insertError
      
      alert('✅ Solicitud enviada exitosamente. Recibirás un email cuando sea aprobada.')
      router.push('/login')
      
    } catch (error: any) {
      console.error('Error:', error)
      setError('Error al enviar solicitud: ' + error.message)
    } finally {
      setLoading(false)
    }
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
      <div style={{
        maxWidth: '28rem',
        width: '100%'
      }}>
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
              boxShadow: 'var(--shadow-lg)'
            }}>
              <span style={{
                fontSize: '2rem',
                fontWeight: 'var(--font-bold)',
                color: 'white',
                letterSpacing: '-0.05em'
              }}>FC</span>
            </div>
            
            <h1 style={{
              fontSize: 'var(--text-3xl)',
              fontWeight: 'var(--font-bold)',
              color: 'var(--gray-900)',
              marginBottom: 'var(--space-2)'
            }}>
              Registro de Empleados
            </h1>
            
            <p style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--gray-500)'
            }}>
              Sistema de Compras • Feeling Company
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
            {/* Nombre Completo */}
            <div>
              <label className="label label-required">Nombre Completo</label>
              <input
                type="text"
                value={form.nombre_completo}
                onChange={(e) => setForm({ ...form, nombre_completo: e.target.value })}
                placeholder="Juan Pérez"
                className="input"
                required
              />
            </div>
            
            {/* Email */}
            <div>
              <label className="label label-required">Email Corporativo</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="juan.perez@feelingone.co"
                className="input"
                required
              />
              <p style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--gray-500)',
                marginTop: 'var(--space-2)'
              }}>
                Usá tu email @feelingone.co o @feelingcompany.com
              </p>
            </div>
            
            {/* Área */}
            <div>
              <label className="label label-required">Área</label>
              <select
                value={form.area}
                onChange={(e) => setForm({ ...form, area: e.target.value })}
                className="input"
                required
              >
                <option value="">Seleccioná tu área...</option>
                {AREAS.map(area => (
                  <option key={area} value={area}>{area}</option>
                ))}
              </select>
            </div>
            
            {/* Teléfono */}
            <div>
              <label className="label">Teléfono <span style={{ color: 'var(--gray-400)' }}>(Opcional)</span></label>
              <input
                type="tel"
                value={form.telefono}
                onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                placeholder="3001234567"
                className="input"
              />
            </div>
            
            {/* PIN */}
            <div>
              <label className="label label-required">PIN de Acceso</label>
              <input
                type="password"
                value={form.pin}
                onChange={(e) => setForm({ ...form, pin: e.target.value })}
                placeholder="4 dígitos"
                maxLength={4}
                className="input"
                required
              />
              <p style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--gray-500)',
                marginTop: 'var(--space-2)'
              }}>
                Creá un PIN de 4 dígitos que usarás para ingresar
              </p>
            </div>
            
            {/* Confirmar PIN */}
            <div>
              <label className="label label-required">Confirmar PIN</label>
              <input
                type="password"
                value={form.pin_confirmacion}
                onChange={(e) => setForm({ ...form, pin_confirmacion: e.target.value })}
                placeholder="4 dígitos"
                maxLength={4}
                className="input"
                required
              />
            </div>
            
            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary btn-lg"
              style={{ width: '100%', marginTop: 'var(--space-2)' }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <span className="loading" style={{ width: '1rem', height: '1rem' }}></span>
                  Enviando...
                </span>
              ) : 'Solicitar Acceso'}
            </button>
          </form>
          
          {/* Ya tengo acceso */}
          <div style={{ 
            marginTop: 'var(--space-6)',
            paddingTop: 'var(--space-6)',
            borderTop: '1px solid var(--gray-200)',
            textAlign: 'center'
          }}>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-600)' }}>
              ¿Ya tenés acceso?{' '}
              <button
                type="button"
                onClick={() => router.push('/login')}
                style={{
                  color: 'var(--primary-600)',
                  fontWeight: 'var(--font-medium)',
                  textDecoration: 'none',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Iniciá sesión →
              </button>
            </p>
          </div>
        </div>
        
        {/* Info Card */}
        <div className="card" style={{ marginTop: 'var(--space-4)', backgroundColor: 'rgba(255, 255, 255, 0.95)' }}>
          <h3 style={{
            fontSize: 'var(--text-base)',
            fontWeight: 'var(--font-semibold)',
            color: 'var(--gray-900)',
            marginBottom: 'var(--space-3)'
          }}>
            ¿Qué sigue?
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
            <li>Tu solicitud será revisada por un administrador</li>
            <li>Recibirás un email cuando sea aprobada</li>
            <li>Podrás ingresar usando tu email y PIN</li>
            <li>Crear solicitudes de compra para tus proyectos</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
