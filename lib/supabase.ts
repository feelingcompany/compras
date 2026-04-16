import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Rol = 'admin_compras' | 'encargado' | 'solicitante' | 'gerencia'

export interface Usuario {
  id: string
  nombre: string
  email: string
  rol: Rol
  iniciales: string
  activo: boolean
}

export interface CentroCosto {
  id: string
  codigo: string
  nombre: string
}

export interface Proveedor {
  id: string
  codigo: string
  razon_social: string
  nit: string
  ciudad: string
  condicion_pago: string
  score: number
  total_ordenes: number
  activo: boolean
}

export interface OrdenTrabajo {
  id: string
  codigo: string
  proyecto: string
  cliente: string
}

export interface OrdenServicio {
  id: string
  codigo: string
  ot_id: string
  descripcion: string
  ordenes_trabajo?: OrdenTrabajo
}

export interface OrdenFacturacion {
  id: string
  codigo_of: string
  os_id: string
  proveedor_id: string
  solicitante_id: string
  encargado_id: string
  centro_costo_id: string
  valor_total: number
  descripcion: string
  estado_verificacion: 'OK' | 'EN_REVISION' | 'ANULADA' | 'DESESTIMADA'
  estado_pago: 'PENDIENTE' | 'PARCIAL' | 'PAGADO'
  ciudad: string
  medio_pago: 'TRANSFERENCIA' | 'CHEQUE' | 'EFECTIVO'
  fecha_requerida: string
  created_at: string
  proveedores?: Proveedor
  encargado?: Usuario
  solicitante?: Usuario
  ordenes_servicio?: OrdenServicio
}

export interface Pago {
  id: string
  of_id: string
  monto: number
  comprobante: string
  fecha: string
  observaciones: string
  registrado_por: string
}
