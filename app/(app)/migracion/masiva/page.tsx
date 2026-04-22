'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth'

// ============================================================
// IMPORTACIÓN MASIVA - Pegar datos desde Google Sheets
// 
// Formato esperado (tab-separated, como al copiar de Sheets):
// Descripción | Solicitante | Centro | Ciudad | Monto | Estado | Proveedor | OT | Fecha
// ============================================================

type FilaImport = {
  descripcion: string
  solicitante: string
  centro_costo: string
  ciudad: string
  monto: string
  estado: string
  proveedor: string
  ot_os: string
  fecha: string
  // Resolución
  solicitante_id?: string
  proveedor_id?: string
  // Validación
  errores: string[]
  advertencias: string[]
  importar: boolean
}

const COLUMNAS_ESPERADAS = [
  'Descripción', 'Solicitante', 'Centro de costo', 'Ciudad',
  'Monto', 'Estado', 'Proveedor', 'OT/OS', 'Fecha'
]

const ESTADOS_VALIDOS = ['pendiente', 'aprobada', 'cotizando', 'ordenada', 'completada']

export default function ImportMasivaPage() {
  const { usuario } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [usuarios, setUsuarios] = useState<any[]>([])
  const [proveedores, setProveedores] = useState<any[]>([])
  const [textoPegado, setTextoPegado] = useState('')
  const [filas, setFilas] = useState<FilaImport[]>([])
  const [paso, setPaso] = useState<'pegar' | 'revisar' | 'importando' | 'completado'>('pegar')
  const [log, setLog] = useState<string[]>([])
  const [resumen, setResumen] = useState({ exitosos: 0, fallidos: 0 })

  useEffect(() => {
    if (!usuario) {
      router.push('/login')
      return
    }
    if (!['admin_compras', 'gerencia'].includes(usuario.rol)) {
      router.push('/')
      return
    }
    cargar()
  }, [usuario])

  const cargar = async () => {
    const [{ data: users }, { data: provs }] = await Promise.all([
      supabase.from('usuarios').select('id, nombre, email, rol, area').eq('activo', true),
      supabase.from('proveedores').select('id, codigo, razon_social, nit').eq('activo', true)
    ])
    setUsuarios(users || [])
    setProveedores(provs || [])
  }

  const parsear = () => {
    if (!textoPegado.trim()) {
      alert('Pegá algo de texto primero')
      return
    }

    const lineas = textoPegado.trim().split('\n').filter(l => l.trim())
    
    // Detectar si la primera línea es header (contiene palabras de columnas)
    const primeraLinea = lineas[0].toLowerCase()
    const esHeader = ['descripción', 'descripcion', 'solicitante', 'monto', 'estado'].some(p => primeraLinea.includes(p))
    const datosLineas = esHeader ? lineas.slice(1) : lineas

    const nuevasFilas: FilaImport[] = datosLineas.map(linea => {
      // Separar por tab, o por | si no hay tabs
      const campos = linea.includes('\t') ? linea.split('\t') : linea.split('|').map(c => c.trim())

      const fila: FilaImport = {
        descripcion: campos[0]?.trim() || '',
        solicitante: campos[1]?.trim() || '',
        centro_costo: campos[2]?.trim() || '',
        ciudad: campos[3]?.trim() || '',
        monto: campos[4]?.trim() || '',
        estado: (campos[5]?.trim() || 'pendiente').toLowerCase(),
        proveedor: campos[6]?.trim() || '',
        ot_os: campos[7]?.trim() || '',
        fecha: campos[8]?.trim() || '',
        errores: [],
        advertencias: [],
        importar: true
      }

      // Validar
      if (!fila.descripcion) fila.errores.push('Falta descripción')
      if (!fila.solicitante) fila.errores.push('Falta solicitante')
      if (!fila.monto) fila.errores.push('Falta monto')
      if (!fila.centro_costo) fila.advertencias.push('Sin centro de costo')

      // Normalizar estado
      const estadoNormalizado = fila.estado.toLowerCase().replace(/[^a-z]/g, '')
      if (estadoNormalizado.includes('pend')) fila.estado = 'pendiente'
      else if (estadoNormalizado.includes('aprob')) fila.estado = 'aprobada'
      else if (estadoNormalizado.includes('cotiz')) fila.estado = 'cotizando'
      else if (estadoNormalizado.includes('orden') || estadoNormalizado.includes('emit')) fila.estado = 'ordenada'
      else if (estadoNormalizado.includes('pag') || estadoNormalizado.includes('complet') || estadoNormalizado.includes('cerr')) fila.estado = 'completada'
      else if (!ESTADOS_VALIDOS.includes(fila.estado)) {
        fila.advertencias.push(`Estado "${fila.estado}" no reconocido, se usará "pendiente"`)
        fila.estado = 'pendiente'
      }

      // Resolver solicitante por nombre aproximado
      if (fila.solicitante) {
        const match = usuarios.find(u =>
          u.nombre?.toLowerCase().includes(fila.solicitante.toLowerCase()) ||
          fila.solicitante.toLowerCase().includes(u.nombre?.toLowerCase())
        )
        if (match) fila.solicitante_id = match.id
        else fila.errores.push(`No encuentro usuario "${fila.solicitante}"`)
      }

      // Resolver proveedor
      if (fila.proveedor && ['ordenada', 'completada'].includes(fila.estado)) {
        const match = proveedores.find(p =>
          p.razon_social?.toLowerCase().includes(fila.proveedor.toLowerCase()) ||
          fila.proveedor.toLowerCase().includes(p.razon_social?.toLowerCase())
        )
        if (match) fila.proveedor_id = match.id
        else fila.advertencias.push(`Proveedor "${fila.proveedor}" no encontrado`)
      }

      // No importar si tiene errores
      if (fila.errores.length > 0) fila.importar = false

      return fila
    })

    setFilas(nuevasFilas)
    setPaso('revisar')
  }

  const toggleImportar = (idx: number) => {
    setFilas(prev => prev.map((f, i) => i === idx ? { ...f, importar: !f.importar } : f))
  }

  const importar = async () => {
    const aImportar = filas.filter(f => f.importar && f.errores.length === 0)
    if (aImportar.length === 0) {
      alert('No hay filas válidas para importar')
      return
    }

    if (!confirm(`¿Importar ${aImportar.length} solicitudes?`)) return

    setPaso('importando')
    setLog([`→ Importando ${aImportar.length} solicitudes...`])

    let exitosos = 0
    let fallidos = 0

    for (let i = 0; i < aImportar.length; i++) {
      const f = aImportar[i]
      try {
        const monto = Number(String(f.monto).replace(/\D/g, ''))

        // 1. Crear solicitud
        const { data: sol, error: errSol } = await supabase
          .from('solicitudes')
          .insert({
            solicitante_id: f.solicitante_id,
            descripcion: f.descripcion,
            centro_costo: f.centro_costo || null,
            ciudad: f.ciudad || 'Bogotá',
            ot_os: f.ot_os || null,
            observaciones: '[MIGRADA desde Google Sheets - carga masiva]',
            prioridad: 'normal',
            estado: f.estado,
            created_at: f.fecha ? new Date(f.fecha).toISOString() : new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single()

        if (errSol) throw errSol

        // 2. Ítem consolidado
        await supabase.from('items_solicitud').insert({
          solicitud_id: sol.id,
          categoria: 'servicios-profesionales',
          descripcion: f.descripcion,
          cantidad: 1,
          unidad: 'Global',
          presupuesto_estimado: monto,
          especificaciones: '[Importado desde Google Sheets]'
        })

        // 3. Aprobación histórica si corresponde
        if (['aprobada', 'cotizando', 'ordenada', 'completada'].includes(f.estado)) {
          await supabase.from('aprobaciones').insert({
            solicitud_id: sol.id,
            aprobador_id: usuario!.id,
            nivel_aprobacion: 1,
            orden_aprobacion: 1,
            estado: 'aprobada',
            fecha_aprobacion: f.fecha ? new Date(f.fecha).toISOString() : new Date().toISOString(),
            comentarios: '[APROBACIÓN HISTÓRICA - Carga masiva]'
          })
        }

        // 4. OF si corresponde
        if (['ordenada', 'completada'].includes(f.estado) && f.proveedor_id) {
          const meses = ['EN', 'FE', 'MA', 'AB', 'MY', 'JN', 'JL', 'AG', 'SE', 'OC', 'NO', 'DI']
          const mes = meses[new Date().getMonth()]
          const year = String(new Date().getFullYear()).slice(2)
          const rand = String(Math.floor(Math.random() * 900) + 100)
          const codigo = `02${rand}${mes}${year}M${i}`

          await supabase.from('ordenes_facturacion').insert({
            codigo_of: codigo,
            proveedor_id: f.proveedor_id,
            solicitante_id: f.solicitante_id,
            encargado_id: usuario!.id,
            valor_total: monto,
            descripcion: f.descripcion,
            ciudad: f.ciudad || 'Bogotá',
            medio_pago: 'TRANSFERENCIA',
            estado_verificacion: f.estado === 'completada' ? 'APROBADA' : 'EN_PROCESO',
            estado_pago: f.estado === 'completada' ? 'PAGADO' : 'PENDIENTE',
            solicitud_id: sol.id
          })
        }

        exitosos++
        setLog(prev => [`  ✓ [${i + 1}/${aImportar.length}] ${f.descripcion.slice(0, 50)}`, ...prev])
      } catch (err: any) {
        fallidos++
        setLog(prev => [`  ✗ [${i + 1}/${aImportar.length}] Error en "${f.descripcion.slice(0, 40)}": ${err.message}`, ...prev])
      }
    }

    setResumen({ exitosos, fallidos })
    setLog(prev => [``, `=== COMPLETADO ===`, `✓ ${exitosos} exitosos`, `✗ ${fallidos} fallidos`, ...prev])
    setPaso('completado')
  }

  const ejemplo = `Transporte equipo Medellín	Juan Pérez	ROTV - Comfama	Medellín	1500000	aprobada		OT-234	2026-04-10
Refrigerios evento Bogotá	María Gómez	DMCL - Tigo	Bogotá	800000	ordenada	Catering ABC	OT-235	2026-04-12
DJ para evento Feb	Carlos López	KOCA - Coca-Cola	Cali	2000000	completada	Eventos XYZ		2026-03-15`

  return (
    <div style={{ padding: 32, maxWidth: 1300, margin: '0 auto' }}>
      <button
        onClick={() => router.push('/migracion')}
        style={{ background: 'none', border: 'none', color: '#185FA5', fontSize: 13, cursor: 'pointer', marginBottom: 16, textDecoration: 'underline', padding: 0 }}
      >
        ← Volver a Centro de migración
      </button>

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111', margin: 0, marginBottom: 4 }}>
          Importación masiva
        </h1>
        <div style={{ fontSize: 13, color: '#6b7280' }}>
          Pegá datos desde Google Sheets / Excel
        </div>
      </div>

      {/* Paso a paso */}
      <div style={{
        display: 'flex', gap: 0, marginBottom: 24,
        borderBottom: '1px solid #e5e7eb'
      }}>
        <PasoTab activo={paso === 'pegar'} completado={paso !== 'pegar'} num={1}>Pegar datos</PasoTab>
        <PasoTab activo={paso === 'revisar'} completado={['importando', 'completado'].includes(paso)} num={2}>Revisar y corregir</PasoTab>
        <PasoTab activo={paso === 'importando'} completado={paso === 'completado'} num={3}>Importar</PasoTab>
      </div>

      {/* PASO 1: PEGAR */}
      {paso === 'pegar' && (
        <>
          <div style={{
            background: '#EFF6FF', border: '1px solid #BFDBFE',
            borderRadius: 6, padding: 16, marginBottom: 20
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1E40AF', marginBottom: 8 }}>
              Formato esperado (columnas en este orden, separadas por TAB):
            </div>
            <div style={{ fontSize: 12, color: '#1E40AF', marginBottom: 10 }}>
              {COLUMNAS_ESPERADAS.map((c, i) => (
                <span key={c}>
                  <strong>{c}</strong>
                  {i < COLUMNAS_ESPERADAS.length - 1 && ' · '}
                </span>
              ))}
            </div>
            <div style={{ fontSize: 11, color: '#1E3A8A', fontStyle: 'italic' }}>
              Tip: en Google Sheets, seleccioná las celdas, copiá (Ctrl+C), y pegá acá. El formato TAB es automático.
            </div>
          </div>

          <textarea
            value={textoPegado}
            onChange={e => setTextoPegado(e.target.value)}
            placeholder={`Pegá acá tus datos...\n\nEjemplo:\n${ejemplo}`}
            style={{
              width: '100%', minHeight: 300, padding: 14,
              border: '1px solid #d1d5db', borderRadius: 6,
              fontSize: 12, fontFamily: 'monospace',
              outline: 'none', resize: 'vertical'
            }}
          />

          <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              onClick={() => setTextoPegado(ejemplo)}
              style={{
                background: 'none', border: 'none', color: '#185FA5',
                fontSize: 12, cursor: 'pointer', textDecoration: 'underline'
              }}
            >
              Cargar ejemplo
            </button>
            <button
              onClick={parsear}
              disabled={!textoPegado.trim()}
              style={{
                padding: '10px 24px', background: '#185FA5', color: '#fff',
                border: 'none', borderRadius: 4, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', opacity: !textoPegado.trim() ? 0.5 : 1
              }}
            >
              Procesar datos →
            </button>
          </div>
        </>
      )}

      {/* PASO 2: REVISAR */}
      {paso === 'revisar' && (
        <>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 13, color: '#374151' }}>
              Detecté <strong>{filas.length} filas</strong>. Revisá los errores en rojo antes de importar.
              <br/>
              <span style={{ fontSize: 11, color: '#6b7280' }}>
                {filas.filter(f => f.importar).length} listas · {filas.filter(f => f.errores.length > 0).length} con errores
              </span>
            </div>
            <button onClick={() => setPaso('pegar')} style={{
              background: 'none', border: 'none', color: '#185FA5',
              fontSize: 12, cursor: 'pointer', textDecoration: 'underline'
            }}>
              Volver y editar
            </button>
          </div>

          <div style={{
            background: '#fff', border: '1px solid #e5e7eb',
            borderRadius: 6, overflow: 'auto', marginBottom: 20
          }}>
            <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse', minWidth: 1100 }}>
              <thead>
                <tr style={{ background: '#F9FAFB', fontSize: 10, color: '#6b7280', textTransform: 'uppercase' }}>
                  <th style={{ padding: '8px 10px', textAlign: 'center', width: 40 }}></th>
                  <th style={{ padding: '8px 10px', textAlign: 'left' }}>Descripción</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left' }}>Solicitante</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left' }}>Centro</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Monto</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center' }}>Estado</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left' }}>Proveedor</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left' }}>Problemas</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f, idx) => (
                  <tr key={idx} style={{
                    borderTop: '1px solid #f3f4f6',
                    background: f.errores.length > 0 ? '#FEF2F2' : f.advertencias.length > 0 ? '#FFFBEB' : '#fff'
                  }}>
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={f.importar}
                        onChange={() => toggleImportar(idx)}
                        disabled={f.errores.length > 0}
                      />
                    </td>
                    <td style={{ padding: '8px 10px', maxWidth: 200 }}>{f.descripcion.slice(0, 60)}</td>
                    <td style={{ padding: '8px 10px' }}>
                      {f.solicitante_id ? (
                        <span>{f.solicitante} <span style={{ color: '#10B981' }}>✓</span></span>
                      ) : (
                        <span style={{ color: '#DC2626' }}>{f.solicitante}</span>
                      )}
                    </td>
                    <td style={{ padding: '8px 10px', fontSize: 10 }}>{f.centro_costo || '—'}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>
                      ${Number(String(f.monto).replace(/\D/g, '')).toLocaleString('es-CO')}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                      <span style={{
                        padding: '2px 7px', fontSize: 10,
                        background: '#EFF6FF', color: '#1E40AF',
                        borderRadius: 3, fontWeight: 600
                      }}>
                        {f.estado}
                      </span>
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      {f.proveedor_id ? (
                        <span style={{ fontSize: 10 }}>{f.proveedor} <span style={{ color: '#10B981' }}>✓</span></span>
                      ) : f.proveedor ? (
                        <span style={{ fontSize: 10, color: '#F59E0B' }}>{f.proveedor}</span>
                      ) : '—'}
                    </td>
                    <td style={{ padding: '8px 10px', fontSize: 10 }}>
                      {f.errores.map((e, i) => (
                        <div key={i} style={{ color: '#DC2626' }}>• {e}</div>
                      ))}
                      {f.advertencias.map((a, i) => (
                        <div key={i} style={{ color: '#F59E0B' }}>⚠ {a}</div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button onClick={() => setPaso('pegar')} style={btnSecondary}>
              Cancelar
            </button>
            <button onClick={importar} style={btnPrimary}>
              Importar {filas.filter(f => f.importar && f.errores.length === 0).length} solicitudes
            </button>
          </div>
        </>
      )}

      {/* PASO 3: IMPORTANDO / COMPLETADO */}
      {['importando', 'completado'].includes(paso) && (
        <div>
          {paso === 'completado' && (
            <div style={{
              background: resumen.fallidos === 0 ? '#D1FAE5' : '#FEF3C7',
              border: `1px solid ${resumen.fallidos === 0 ? '#10B981' : '#F59E0B'}`,
              borderRadius: 6, padding: 20, marginBottom: 16, textAlign: 'center'
            }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#065F46', marginBottom: 6 }}>
                {resumen.fallidos === 0 ? '🎉 ¡Importación completada!' : '⚠️ Importación con errores'}
              </div>
              <div style={{ fontSize: 13, color: '#047857' }}>
                {resumen.exitosos} solicitudes importadas · {resumen.fallidos} fallidas
              </div>
              <div style={{ marginTop: 14, display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button onClick={() => router.push('/solicitudes')} style={btnPrimary}>
                  Ver todas las solicitudes
                </button>
                <button onClick={() => { setPaso('pegar'); setTextoPegado(''); setFilas([]); setLog([]); }} style={btnSecondary}>
                  Importar más
                </button>
              </div>
            </div>
          )}

          <div style={{
            background: '#1F2937', color: '#F9FAFB',
            borderRadius: 6, padding: 16, fontSize: 11,
            fontFamily: 'monospace', maxHeight: 400, overflowY: 'auto'
          }}>
            <div style={{ color: '#9CA3AF', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: 10 }}>
              Log de importación
            </div>
            {log.map((line, idx) => (
              <div key={idx} style={{ marginBottom: 3, lineHeight: 1.4 }}>{line}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const btnPrimary: React.CSSProperties = {
  padding: '10px 20px', background: '#185FA5', color: '#fff',
  border: 'none', borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: 'pointer'
}
const btnSecondary: React.CSSProperties = {
  padding: '10px 16px', background: '#fff', color: '#374151',
  border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13, fontWeight: 500, cursor: 'pointer'
}

function PasoTab({ activo, completado, num, children }: any) {
  return (
    <div style={{
      padding: '12px 20px',
      borderBottom: `2px solid ${activo ? '#185FA5' : 'transparent'}`,
      color: activo ? '#185FA5' : completado ? '#065F46' : '#9ca3af',
      fontSize: 13, fontWeight: activo ? 600 : 500,
      display: 'flex', alignItems: 'center', gap: 8,
      marginBottom: -1
    }}>
      <span style={{
        width: 22, height: 22, borderRadius: '50%',
        background: completado ? '#10B981' : activo ? '#185FA5' : '#e5e7eb',
        color: '#fff', display: 'inline-flex',
        alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700
      }}>
        {completado ? '✓' : num}
      </span>
      {children}
    </div>
  )
}
