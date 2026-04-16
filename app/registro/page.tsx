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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-block bg-blue-600 text-white rounded-full w-16 h-16 flex items-center justify-center text-2xl font-bold mb-4">
            FC
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Registro de Empleados</h1>
          <p className="text-sm text-gray-500 mt-2">Sistema de Compras - Feeling Company</p>
        </div>
        
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre Completo <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.nombre_completo}
              onChange={(e) => setForm({ ...form, nombre_completo: e.target.value })}
              placeholder="Juan Pérez"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Corporativo <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="juan.perez@feelingone.co"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Usá tu email @feelingone.co o @feelingcompany.com
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Área <span className="text-red-500">*</span>
            </label>
            <select
              value={form.area}
              onChange={(e) => setForm({ ...form, area: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="">Seleccioná tu área...</option>
              {AREAS.map(area => (
                <option key={area} value={area}>{area}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Teléfono <span className="text-gray-400">(Opcional)</span>
            </label>
            <input
              type="tel"
              value={form.telefono}
              onChange={(e) => setForm({ ...form, telefono: e.target.value })}
              placeholder="3001234567"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              PIN de Acceso <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={form.pin}
              onChange={(e) => setForm({ ...form, pin: e.target.value })}
              placeholder="4 dígitos"
              maxLength={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Creá un PIN de 4 dígitos que usarás para ingresar
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirmar PIN <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={form.pin_confirmacion}
              onChange={(e) => setForm({ ...form, pin_confirmacion: e.target.value })}
              placeholder="4 dígitos"
              maxLength={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Enviando...' : 'Solicitar Acceso'}
          </button>
        </form>
        
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            ¿Ya tenés acceso?{' '}
            <button
              onClick={() => router.push('/login')}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Iniciá sesión
            </button>
          </p>
        </div>
        
        <div className="mt-8 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">¿Qué sigue?</h3>
          <ul className="text-xs text-gray-600 space-y-1">
            <li>• Tu solicitud será revisada por un administrador</li>
            <li>• Recibirás un email cuando sea aprobada</li>
            <li>• Podrás ingresar usando tu email y PIN</li>
            <li>• Crear solicitudes de compra para tus proyectos</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
