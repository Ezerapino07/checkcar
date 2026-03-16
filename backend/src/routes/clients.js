const express = require('express');
const { pool } = require('../database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

async function logActivity(tenantId, userId, userName, action, entityType, entityId) {
  await pool.query(
    `INSERT INTO activity_log (tenant_id, user_id, user_name, action, entity_type, entity_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [tenantId, userId, userName, action, entityType, entityId]
  );
}

// GET /api/clients
router.get('/', async (req, res) => {
  const { search } = req.query;
  let query = `
    SELECT c.*,
      s.vehicle_id,
      v.titulo as vehiculo_titulo, v.marca as vehiculo_marca, v.modelo as vehiculo_modelo, v.patente as vehiculo_patente
    FROM clients c
    LEFT JOIN sales s ON s.client_id = c.id
    LEFT JOIN vehicles v ON v.id = s.vehicle_id
    WHERE c.tenant_id = $1
  `;
  const params = [req.user.tenantId];

  if (search) {
    query += ` AND (c.nombre ILIKE $2 OR c.telefono ILIKE $2 OR c.email ILIKE $2 OR c.dni ILIKE $2)`;
    params.push(`%${search}%`);
  }

  query += ` ORDER BY c.created_at DESC`;

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error listando clientes:', err);
    res.status(500).json({ error: 'Error al obtener clientes' });
  }
});

// POST /api/clients
router.post('/', async (req, res) => {
  const tenantId = req.user.tenantId;
  const { nombre, telefono, email, dni, direccion, notas, vehiculo_id } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO clients (tenant_id, nombre, telefono, email, dni, direccion, notas)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [tenantId, nombre, telefono, email, dni, direccion, notas]
    );
    const newClient = result.rows[0];

    // Si tiene vehículo asociado, crear venta
    if (vehiculo_id) {
      await client.query(
        `INSERT INTO sales (tenant_id, vehicle_id, client_id, fecha)
         VALUES ($1, $2, $3, NOW())`,
        [tenantId, vehiculo_id, newClient.id]
      );
    }

    await logActivity(tenantId, req.user.id, req.user.nombre,
      `Agregó cliente: ${nombre}`, 'client', newClient.id);

    await client.query('COMMIT');
    res.status(201).json(newClient);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creando cliente:', err);
    res.status(500).json({ error: 'Error al crear cliente' });
  } finally {
    client.release();
  }
});

// PUT /api/clients/:id
router.put('/:id', async (req, res) => {
  const tenantId = req.user.tenantId;
  const { nombre, telefono, email, dni, direccion, notas } = req.body;

  try {
    const check = await pool.query(
      'SELECT id FROM clients WHERE id = $1 AND tenant_id = $2', [req.params.id, tenantId]
    );
    if (check.rows.length === 0) return res.status(404).json({ error: 'Cliente no encontrado' });

    await pool.query(
      `UPDATE clients SET nombre=$1, telefono=$2, email=$3, dni=$4, direccion=$5, notas=$6, updated_at=NOW()
       WHERE id=$7 AND tenant_id=$8`,
      [nombre, telefono, email, dni, direccion, notas, req.params.id, tenantId]
    );

    await logActivity(tenantId, req.user.id, req.user.nombre,
      `Editó cliente: ${nombre}`, 'client', parseInt(req.params.id));

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar cliente' });
  }
});

// DELETE /api/clients/:id
router.delete('/:id', async (req, res) => {
  const tenantId = req.user.tenantId;
  try {
    const check = await pool.query(
      'SELECT nombre FROM clients WHERE id = $1 AND tenant_id = $2', [req.params.id, tenantId]
    );
    if (check.rows.length === 0) return res.status(404).json({ error: 'Cliente no encontrado' });

    await pool.query('DELETE FROM clients WHERE id = $1 AND tenant_id = $2', [req.params.id, tenantId]);

    await logActivity(tenantId, req.user.id, req.user.nombre,
      `Eliminó cliente: ${check.rows[0].nombre}`, 'client', parseInt(req.params.id));

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar cliente' });
  }
});

module.exports = router;
