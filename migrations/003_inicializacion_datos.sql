-- ============================================
-- SCRIPT DE INICIALIZACIÓN DE DATOS
-- ============================================
-- Ejecutar en Supabase SQL Editor
-- Genera alertas, scores y cotizaciones automáticamente

-- ============================================
-- 1. GENERAR ALERTAS AUTOMÁTICAS
-- ============================================

-- Alertas: Sin cotizaciones en OFs >$5M
INSERT INTO alertas_sistema (tipo, nivel, titulo, descripcion, of_id, proveedor_id, monto, usuario_id, estado)
SELECT 
  'sin_cotizacion',
  CASE WHEN of.valor_total >= 15000000 THEN 'critico' ELSE 'alto' END,
  'Sin cotizaciones — ' || COALESCE(p.razon_social, of.codigo_of),
  'OF ' || of.codigo_of || ' por $' || TO_CHAR(of.valor_total, 'FM999,999,999') || ' no tiene cotizaciones registradas.',
  of.id,
  of.proveedor_id,
  of.valor_total,
  of.encargado_id,
  'activo'
FROM ordenes_facturacion of
LEFT JOIN proveedores p ON of.proveedor_id = p.id
LEFT JOIN cotizaciones c ON c.of_id = of.id
WHERE of.valor_total >= 5000000
  AND c.id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM alertas_sistema a 
    WHERE a.of_id = of.id AND a.tipo = 'sin_cotizacion'
  )
LIMIT 100;

-- Alertas: Proveedor nuevo con alto valor
INSERT INTO alertas_sistema (tipo, nivel, titulo, descripcion, of_id, proveedor_id, monto, usuario_id, estado)
SELECT 
  'proveedor_nuevo',
  'critico',
  'Proveedor nuevo con OF de alto valor',
  p.razon_social || ' tiene ' || COALESCE(p.total_ordenes, 0) || ' orden(es) previa(s) y ya tiene OF por $' || TO_CHAR(of.valor_total, 'FM999,999,999'),
  of.id,
  of.proveedor_id,
  of.valor_total,
  of.encargado_id,
  'activo'
FROM ordenes_facturacion of
JOIN proveedores p ON of.proveedor_id = p.id
WHERE of.valor_total >= 10000000
  AND COALESCE(p.total_ordenes, 0) <= 2
  AND NOT EXISTS (
    SELECT 1 FROM alertas_sistema a 
    WHERE a.of_id = of.id AND a.tipo = 'proveedor_nuevo'
  )
LIMIT 50;

-- Alertas: Autoaprobación
INSERT INTO alertas_sistema (tipo, nivel, titulo, descripcion, of_id, proveedor_id, monto, usuario_id, estado)
SELECT 
  'autoaprobacion',
  'medio',
  'Autoaprobación — ' || of.codigo_of,
  'El mismo usuario es encargado y solicitante en OF por $' || TO_CHAR(of.valor_total, 'FM999,999,999'),
  of.id,
  of.proveedor_id,
  of.valor_total,
  of.encargado_id,
  'activo'
FROM ordenes_facturacion of
WHERE of.encargado_id = of.solicitante_id
  AND of.valor_total >= 3000000
  AND NOT EXISTS (
    SELECT 1 FROM alertas_sistema a 
    WHERE a.of_id = of.id AND a.tipo = 'autoaprobacion'
  )
LIMIT 50;

-- ============================================
-- 2. CALCULAR SCORES DE COMPRADORES
-- ============================================

-- Limpiar scores existentes del periodo actual
DELETE FROM score_compradores 
WHERE periodo = TO_CHAR(NOW(), 'YYYY-MM');

-- Calcular y insertar scores
INSERT INTO score_compradores (usuario_id, periodo, total_ofs, ofs_con_cotizaciones, pct_cotizaciones, ahorro_generado, alertas_generadas, score_final)
SELECT 
  u.id,
  TO_CHAR(NOW(), 'YYYY-MM'),
  COUNT(DISTINCT of.id),
  COUNT(DISTINCT CASE WHEN c.of_id IS NOT NULL THEN of.id END),
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN c.of_id IS NOT NULL THEN of.id END) / NULLIF(COUNT(DISTINCT of.id), 0)),
  0, -- ahorro (simplificado por ahora)
  COUNT(DISTINCT a.id),
  ROUND(
    (LEAST(100.0 * COUNT(DISTINCT CASE WHEN c.of_id IS NOT NULL THEN of.id END) / NULLIF(COUNT(DISTINCT of.id), 0) / 10, 10) * 0.35) +
    (GREATEST(0, 10 - (COUNT(DISTINCT CASE WHEN a.nivel = 'critico' THEN a.id END) * 2 + COUNT(DISTINCT CASE WHEN a.nivel = 'alto' THEN a.id END))) * 0.25) +
    (5 * 0.40) -- Default para ahorro y evaluaciones
  , 1)
FROM usuarios u
LEFT JOIN ordenes_facturacion of ON of.encargado_id = u.id
LEFT JOIN cotizaciones c ON c.of_id = of.id
LEFT JOIN alertas_sistema a ON a.usuario_id = u.id AND a.estado = 'activo'
WHERE u.rol IN ('admin_compras', 'encargado', 'gerencia')
  AND u.activo = true
GROUP BY u.id
HAVING COUNT(DISTINCT of.id) > 0;

-- ============================================
-- 3. GENERAR COTIZACIONES DE EJEMPLO
-- ============================================

-- Generar 2-3 cotizaciones para OFs >$5M que no tengan
INSERT INTO cotizaciones (of_id, proveedor_id, valor, condiciones, tiempo_entrega, seleccionada, registrado_por, observaciones)
SELECT 
  of.id,
  (SELECT id FROM proveedores WHERE activo = true ORDER BY RANDOM() LIMIT 1),
  of.valor_total * (1 + (RANDOM() * 0.2 - 0.1)), -- ±10% variación
  CASE 
    WHEN n = 1 THEN '30 días'
    WHEN n = 2 THEN '45 días'
    ELSE '60 días'
  END,
  (5 + n * 2) || ' días hábiles',
  n = 1, -- Primera cotización seleccionada
  of.encargado_id,
  'Cotización ' || n || ' de ' || CASE WHEN of.valor_total >= 15000000 THEN 3 ELSE 2 END
FROM ordenes_facturacion of
CROSS JOIN generate_series(1, CASE WHEN of.valor_total >= 15000000 THEN 3 ELSE 2 END) n
WHERE of.valor_total >= 5000000
  AND NOT EXISTS (SELECT 1 FROM cotizaciones c WHERE c.of_id = of.id)
LIMIT 300;

-- ============================================
-- 4. GENERAR SOLICITUDES DE EJEMPLO
-- ============================================

INSERT INTO solicitudes (titulo, descripcion, monto_estimado, prioridad, solicitante_id, ot_id, estado, fecha_requerida)
SELECT 
  CASE s.n
    WHEN 1 THEN 'Material eléctrico para OT-2024-001'
    WHEN 2 THEN 'Servicio de catering evento corporativo'
    WHEN 3 THEN 'Reparación equipos audiovisuales'
    WHEN 4 THEN 'Compra laptops equipo marketing'
    WHEN 5 THEN 'Material de construcción obra'
  END,
  CASE s.n
    WHEN 1 THEN 'Cables, tomas, breakers'
    WHEN 2 THEN 'Catering para 50 personas'
    WHEN 3 THEN 'Mantenimiento proyectores sala 3'
    WHEN 4 THEN '3 laptops HP ProBook'
    WHEN 5 THEN 'Cemento, arena, ladrillos'
  END,
  CASE s.n
    WHEN 1 THEN 3500000
    WHEN 2 THEN 2800000
    WHEN 3 THEN 1500000
    WHEN 4 THEN 12000000
    WHEN 5 THEN 8500000
  END,
  CASE 
    WHEN s.n IN (1, 4) THEN 'alta'
    WHEN s.n IN (2, 5) THEN 'media'
    ELSE 'baja'
  END,
  (SELECT id FROM usuarios WHERE activo = true ORDER BY RANDOM() LIMIT 1),
  (SELECT id FROM ordenes_trabajo ORDER BY RANDOM() LIMIT 1),
  CASE 
    WHEN s.n <= 2 THEN 'aprobada'
    WHEN s.n <= 4 THEN 'en_revision'
    ELSE 'pendiente'
  END,
  NOW() + (s.n * INTERVAL '7 days')
FROM generate_series(1, 5) s(n)
WHERE NOT EXISTS (SELECT 1 FROM solicitudes LIMIT 1);

-- ============================================
-- RESUMEN DE EJECUCIÓN
-- ============================================

SELECT 
  'Alertas generadas' as operacion,
  COUNT(*) as total
FROM alertas_sistema
WHERE created_at > NOW() - INTERVAL '5 minutes'
UNION ALL
SELECT 
  'Scores calculados',
  COUNT(*)
FROM score_compradores
WHERE periodo = TO_CHAR(NOW(), 'YYYY-MM')
UNION ALL
SELECT 
  'Cotizaciones creadas',
  COUNT(*)
FROM cotizaciones
WHERE created_at > NOW() - INTERVAL '5 minutes'
UNION ALL
SELECT 
  'Solicitudes creadas',
  COUNT(*)
FROM solicitudes
WHERE created_at > NOW() - INTERVAL '5 minutes';
