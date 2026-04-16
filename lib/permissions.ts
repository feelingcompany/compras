import { Rol } from './supabase'

export type Modulo =
  | 'mi-trabajo'
  | 'dashboard'
  | 'alertas'
  | 'score'
  | 'solicitudes'
  | 'nueva-of'
  | 'cotizaciones'
  | 'aprobaciones'
  | 'auditoria'
  | 'radicacion'
  | 'pagos'
  | 'ordenes'
  | 'proveedores'
  | 'evaluacion'
  | 'contraloria'
  | 'admin'

export type Accion = 'ver' | 'crear' | 'editar' | 'eliminar' | 'aprobar'

interface PermisoConfig {
  modulos: Modulo[]
  acciones: Record<string, Accion[]>
  filtrarPorUsuario: boolean // Si debe ver solo sus OFs
}

const PERMISOS: Record<Rol, PermisoConfig> = {
  gerencia: {
    modulos: [
      'mi-trabajo',
      'dashboard',
      'alertas',
      'score',
      'solicitudes',
      'nueva-of',
      'cotizaciones',
      'aprobaciones',
      'auditoria',
      'radicacion',
      'pagos',
      'ordenes',
      'proveedores',
      'evaluacion',
      'contraloria',
      'admin',
    ],
    acciones: {
      ordenes: ['ver', 'crear', 'editar', 'eliminar', 'aprobar'],
      solicitudes: ['ver', 'crear', 'editar', 'aprobar'],
      cotizaciones: ['ver', 'crear', 'editar'],
      pagos: ['ver', 'crear', 'editar'],
      proveedores: ['ver', 'crear', 'editar'],
      evaluacion: ['ver', 'crear', 'editar'],
    },
    filtrarPorUsuario: false, // Ve todo
  },

  admin_compras: {
    modulos: [
      'mi-trabajo',
      'dashboard',
      'alertas',
      'score',
      'solicitudes',
      'nueva-of',
      'cotizaciones',
      'aprobaciones',
      'auditoria',
      'ordenes',
      'proveedores',
      'evaluacion',
    ],
    acciones: {
      ordenes: ['ver', 'crear', 'editar', 'aprobar'],
      solicitudes: ['ver', 'crear', 'editar', 'aprobar'],
      cotizaciones: ['ver', 'crear', 'editar'],
      proveedores: ['ver', 'crear', 'editar'],
      evaluacion: ['ver', 'crear', 'editar'],
    },
    filtrarPorUsuario: false, // Ve todas las OFs
  },

  encargado: {
    modulos: [
      'mi-trabajo',
      'dashboard',
      'alertas',
      'solicitudes',
      'nueva-of',
      'cotizaciones',
      'aprobaciones',
      'ordenes',
      'proveedores',
    ],
    acciones: {
      ordenes: ['ver', 'editar'], // Solo sus OFs
      solicitudes: ['ver', 'crear'],
      cotizaciones: ['ver', 'crear', 'editar'],
      proveedores: ['ver'],
    },
    filtrarPorUsuario: true, // Solo sus OFs (donde es encargado)
  },

  solicitante: {
    modulos: ['mi-trabajo', 'dashboard', 'solicitudes', 'ordenes'],
    acciones: {
      ordenes: ['ver'], // Solo las que solicitó
      solicitudes: ['ver', 'crear'],
    },
    filtrarPorUsuario: true, // Solo OFs que solicitó
  },
}

export function usePermissions(rol: Rol, usuarioId: string) {
  const config = PERMISOS[rol]

  return {
    // Verifica si puede acceder a un módulo
    puedeAcceder(modulo: Modulo): boolean {
      return config.modulos.includes(modulo)
    },

    // Verifica si puede realizar una acción en un módulo
    puedeHacer(modulo: string, accion: Accion): boolean {
      const acciones = config.acciones[modulo] || []
      return acciones.includes(accion)
    },

    // Lista de módulos accesibles
    modulosPermitidos(): Modulo[] {
      return config.modulos
    },

    // Si debe filtrar por usuario
    debeVer(tipo: 'todo' | 'propio'): boolean {
      if (tipo === 'todo') return !config.filtrarPorUsuario
      return config.filtrarPorUsuario
    },

    // Genera filtros para Supabase según el rol
    getFiltrosSupabase() {
      if (!config.filtrarPorUsuario) {
        return {} // Sin filtros, ve todo
      }

      // Filtros según rol
      switch (rol) {
        case 'encargado':
          return { encargado_id: usuarioId }
        case 'solicitante':
          return { solicitante_id: usuarioId }
        default:
          return {}
      }
    },

    // Helper para verificar si es gerencia/admin (roles con acceso total)
    esRolSuperior(): boolean {
      return rol === 'gerencia' || rol === 'admin_compras'
    },

    // Helper para verificar si puede editar una OF específica
    puedeEditarOF(of: { encargado_id: string; estado_verificacion: string }): boolean {
      // Gerencia y admin pueden editar todo
      if (this.esRolSuperior()) return true

      // Encargado solo puede editar sus OFs que NO estén aprobadas
      if (rol === 'encargado') {
        return of.encargado_id === usuarioId && of.estado_verificacion !== 'OK'
      }

      return false
    },

    // Helper para verificar si puede aprobar una OF
    puedeAprobarOF(): boolean {
      return this.puedeHacer('ordenes', 'aprobar')
    },
  }
}
