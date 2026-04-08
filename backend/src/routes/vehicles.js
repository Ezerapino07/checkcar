const express = require('express');
const { pool } = require('../database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// Helper: log de actividad
async function logActivity(tenantId, userId, userName, action, entityType, entityId) {
  await pool.query(
    `INSERT INTO activity_log (tenant_id, user_id, user_name, action, entity_type, entity_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [tenantId, userId, userName, action, entityType, entityId]
  );
}

// ============================================================
// GET /api/vehicles — Listar vehículos del tenant
// Soporta filtros via query params
// ============================================================
router.get('/', async (req, res) => {
  const tenantId = req.user.tenantId;
  const {
    search, marca, estado, condicion, ubicacion, transmision,
    precio_min, precio_max, km_min, km_max, anio_min, anio_max,
    sort, vendido,
  } = req.query;

  let query = `
    SELECT v.*,
      COALESCE(json_agg(DISTINCT jsonb_build_object('id', vp.id, 'url', vp.url, 'orden', vp.orden))
        FILTER (WHERE vp.id IS NOT NULL), '[]') as fotos,
      COALESCE(json_agg(DISTINCT jsonb_build_object('id', vg.id, 'descripcion', vg.descripcion, 'monto', vg.monto))
        FILTER (WHERE vg.id IS NOT NULL), '[]') as gastos,
      COALESCE(json_agg(DISTINCT jsonb_build_object('id', vh.id, 'fecha', vh.fecha, 'detalle', vh.detalle))
        FILTER (WHERE vh.id IS NOT NULL), '[]') as historial
    FROM vehicles v
    LEFT JOIN vehicle_photos vp ON vp.vehicle_id = v.id
    LEFT JOIN vehicle_gastos vg ON vg.vehicle_id = v.id
    LEFT JOIN vehicle_historial vh ON vh.vehicle_id = v.id
    WHERE v.tenant_id = $1
  `;
  const params = [tenantId];
  let paramIdx = 2;

  if (search) {
    query += ` AND (v.titulo ILIKE $${paramIdx} OR v.marca ILIKE $${paramIdx} OR v.modelo ILIKE $${paramIdx} OR v.patente ILIKE $${paramIdx})`;
    params.push(`%${search}%`);
    paramIdx++;
  }
  if (marca) { query += ` AND v.marca = $${paramIdx}`; params.push(marca); paramIdx++; }
  if (estado) { query += ` AND v.estado = $${paramIdx}`; params.push(estado); paramIdx++; }
  if (condicion) { query += ` AND v.condicion = $${paramIdx}`; params.push(condicion); paramIdx++; }
  if (ubicacion) { query += ` AND v.ubicacion = $${paramIdx}`; params.push(ubicacion); paramIdx++; }
  if (transmision) { query += ` AND v.transmision = $${paramIdx}`; params.push(transmision); paramIdx++; }
  if (vendido === 'true') query += ` AND v.vendido = true`;
  if (vendido === 'false') query += ` AND v.vendido = false`;
  if (precio_min) { query += ` AND v.precio_venta >= $${paramIdx}`; params.push(precio_min); paramIdx++; }
  if (precio_max) { query += ` AND v.precio_venta <= $${paramIdx}`; params.push(precio_max); paramIdx++; }
  if (km_min) { query += ` AND v.kilometros >= $${paramIdx}`; params.push(km_min); paramIdx++; }
  if (km_max) { query += ` AND v.kilometros <= $${paramIdx}`; params.push(km_max); paramIdx++; }
  if (anio_min) { query += ` AND v.anio >= $${paramIdx}`; params.push(anio_min); paramIdx++; }
  if (anio_max) { query += ` AND v.anio <= $${paramIdx}`; params.push(anio_max); paramIdx++; }

  query += ` GROUP BY v.id`;

  // Sorting
  const sortMap = {
    recent: 'v.created_at DESC',
    price_asc: 'v.precio_venta ASC NULLS LAST',
    price_desc: 'v.precio_venta DESC NULLS LAST',
    km_asc: 'v.kilometros ASC NULLS LAST',
    km_desc: 'v.kilometros DESC NULLS LAST',
    year_desc: 'v.anio DESC NULLS LAST',
    year_asc: 'v.anio ASC NULLS LAST',
  };
  query += ` ORDER BY ${sortMap[sort] || 'v.created_at DESC'}`;

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error listando vehículos:', err);
    res.status(500).json({ error: 'Error al obtener vehículos' });
  }
});

// ============================================================
// GET /api/vehicles/:id — Detalle de un vehículo
// ============================================================
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT v.*,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', vp.id, 'url', vp.url)) FILTER (WHERE vp.id IS NOT NULL), '[]') as fotos,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', vg.id, 'descripcion', vg.descripcion, 'monto', vg.monto)) FILTER (WHERE vg.id IS NOT NULL), '[]') as gastos,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', vh.id, 'fecha', vh.fecha, 'detalle', vh.detalle)) FILTER (WHERE vh.id IS NOT NULL), '[]') as historial
       FROM vehicles v
       LEFT JOIN vehicle_photos vp ON vp.vehicle_id = v.id
       LEFT JOIN vehicle_gastos vg ON vg.vehicle_id = v.id
       LEFT JOIN vehicle_historial vh ON vh.vehicle_id = v.id
       WHERE v.id = $1 AND v.tenant_id = $2
       GROUP BY v.id`,
      [req.params.id, req.user.tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener vehículo' });
  }
});

// ============================================================
// POST /api/vehicles — Crear vehículo
// ============================================================
router.post('/', async (req, res) => {
  const tenantId = req.user.tenantId;
  const v = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO vehicles (
        tenant_id, titulo, marca, modelo, anio, motor, version, transmision,
        condicion, kilometros, fecha_ingreso, fecha_venta, patente, chasis,
        nro_motor, precio_compra, precio_venta, precio_minimo, descripcion,
        anotaciones, estado, procedencia, ubicacion, estado_cubiertas,
        estado_pintura, estado_motor, estado_interior, vendido, vendedor, cliente_venta_id
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30
      ) RETURNING *`,
      [
        tenantId, v.titulo, v.marca, v.modelo, v.anio || null, v.motor, v.version,
        v.transmision, v.condicion, v.kilometros || null, v.fecha_ingreso || null,
        v.fecha_venta || null, v.patente, v.chasis, v.nro_motor,
        v.precio_compra || null, v.precio_venta || null, v.precio_minimo || null,
        v.descripcion, v.anotaciones, v.estado || 'Disponible', v.procedencia,
        v.ubicacion, v.estado_cubiertas, v.estado_pintura, v.estado_motor,
        v.estado_interior, v.vendido || false, v.vendedor || null, v.cliente_venta_id || null,
      ]
    );
    const vehicle = result.rows[0];

    // Fotos (URLs — las imágenes se suben por separado)
    if (v.fotos?.length) {
      for (let i = 0; i < v.fotos.length; i++) {
        await client.query(
          'INSERT INTO vehicle_photos (vehicle_id, url, orden) VALUES ($1, $2, $3)',
          [vehicle.id, v.fotos[i], i]
        );
      }
    }

    // Gastos
    if (v.gastos?.length) {
      for (const g of v.gastos) {
        if (g.descripcion || g.monto) {
          await client.query(
            'INSERT INTO vehicle_gastos (vehicle_id, descripcion, monto) VALUES ($1, $2, $3)',
            [vehicle.id, g.descripcion, g.monto || 0]
          );
        }
      }
    }

    // Historial
    if (v.historial?.length) {
      for (const h of v.historial) {
        if (h.detalle) {
          await client.query(
            'INSERT INTO vehicle_historial (vehicle_id, fecha, detalle) VALUES ($1, $2, $3)',
            [vehicle.id, h.fecha || null, h.detalle]
          );
        }
      }
    }

    await logActivity(tenantId, req.user.id, req.user.nombre,
      `Agregó vehículo: ${v.titulo || v.marca + ' ' + v.modelo}`, 'vehicle', vehicle.id);

    await client.query('COMMIT');
    res.status(201).json(vehicle);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creando vehículo:', err);
    res.status(500).json({ error: 'Error al crear vehículo' });
  } finally {
    client.release();
  }
});

// ============================================================
// PUT /api/vehicles/:id — Actualizar vehículo
// ============================================================
router.put('/:id', async (req, res) => {
  const tenantId = req.user.tenantId;
  const vehicleId = req.params.id;
  const v = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Verificar que pertenece al tenant
    const check = await client.query(
      'SELECT id FROM vehicles WHERE id = $1 AND tenant_id = $2',
      [vehicleId, tenantId]
    );
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }

    await client.query(
      `UPDATE vehicles SET
        titulo=$1, marca=$2, modelo=$3, anio=$4, motor=$5, version=$6,
        transmision=$7, condicion=$8, kilometros=$9, fecha_ingreso=$10,
        fecha_venta=$11, patente=$12, chasis=$13, nro_motor=$14,
        precio_compra=$15, precio_venta=$16, precio_minimo=$17,
        descripcion=$18, anotaciones=$19, estado=$20, procedencia=$21,
        ubicacion=$22, estado_cubiertas=$23, estado_pintura=$24,
        estado_motor=$25, estado_interior=$26, vendido=$27,
        vendedor=$28, cliente_venta_id=$29, updated_at=NOW()
       WHERE id=$30 AND tenant_id=$31`,
      [
        v.titulo, v.marca, v.modelo, v.anio || null, v.motor, v.version,
        v.transmision, v.condicion, v.kilometros || null, v.fecha_ingreso || null,
        v.fecha_venta || null, v.patente, v.chasis, v.nro_motor,
        v.precio_compra || null, v.precio_venta || null, v.precio_minimo || null,
        v.descripcion, v.anotaciones, v.estado, v.procedencia, v.ubicacion,
        v.estado_cubiertas, v.estado_pintura, v.estado_motor, v.estado_interior,
        v.vendido || false, v.vendedor || null, v.cliente_venta_id || null,
        vehicleId, tenantId,
      ]
    );

    // Reemplazar fotos, gastos, historial
    await client.query('DELETE FROM vehicle_photos WHERE vehicle_id = $1', [vehicleId]);
    await client.query('DELETE FROM vehicle_gastos WHERE vehicle_id = $1', [vehicleId]);
    await client.query('DELETE FROM vehicle_historial WHERE vehicle_id = $1', [vehicleId]);

    if (v.fotos?.length) {
      for (let i = 0; i < v.fotos.length; i++) {
        await client.query(
          'INSERT INTO vehicle_photos (vehicle_id, url, orden) VALUES ($1, $2, $3)',
          [vehicleId, v.fotos[i], i]
        );
      }
    }
    if (v.gastos?.length) {
      for (const g of v.gastos) {
        if (g.descripcion || g.monto) {
          await client.query(
            'INSERT INTO vehicle_gastos (vehicle_id, descripcion, monto) VALUES ($1, $2, $3)',
            [vehicleId, g.descripcion, g.monto || 0]
          );
        }
      }
    }
    if (v.historial?.length) {
      for (const h of v.historial) {
        if (h.detalle) {
          await client.query(
            'INSERT INTO vehicle_historial (vehicle_id, fecha, detalle) VALUES ($1, $2, $3)',
            [vehicleId, h.fecha || null, h.detalle]
          );
        }
      }
    }

    await logActivity(tenantId, req.user.id, req.user.nombre,
      `Editó vehículo: ${v.titulo || v.marca + ' ' + v.modelo}`, 'vehicle', parseInt(vehicleId));

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error actualizando vehículo:', err);
    res.status(500).json({ error: 'Error al actualizar vehículo' });
  } finally {
    client.release();
  }
});

// ============================================================
// DELETE /api/vehicles/:id
// ============================================================
router.delete('/:id', async (req, res) => {
  const tenantId = req.user.tenantId;
  try {
    const check = await pool.query(
      'SELECT titulo, marca, modelo FROM vehicles WHERE id = $1 AND tenant_id = $2',
      [req.params.id, tenantId]
    );
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }
    const v = check.rows[0];

    await pool.query('DELETE FROM vehicles WHERE id = $1 AND tenant_id = $2',
      [req.params.id, tenantId]);

    await logActivity(tenantId, req.user.id, req.user.nombre,
      `Eliminó vehículo: ${v.titulo || v.marca + ' ' + v.modelo}`, 'vehicle', parseInt(req.params.id));

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar vehículo' });
  }
});

// ============================================================
// GET /api/vehicles/stats/marcas — Marcas disponibles
// ============================================================
router.get('/stats/marcas', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT marca FROM vehicles WHERE tenant_id = $1 AND marca IS NOT NULL ORDER BY marca`,
      [req.user.tenantId]
    );
    const custom = await pool.query(
      'SELECT nombre FROM custom_marcas WHERE tenant_id = $1 ORDER BY nombre',
      [req.user.tenantId]
    );
    res.json({
      usadas: result.rows.map(r => r.marca),
      custom: custom.rows.map(r => r.nombre),
    });
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

// POST /api/vehicles/stats/marcas — Agregar marca custom
router.post('/stats/marcas', async (req, res) => {
  try {
    await pool.query(
      'INSERT INTO custom_marcas (tenant_id, nombre) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.user.tenantId, req.body.nombre]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

module.exports = router;
