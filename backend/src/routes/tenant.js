const express = require('express');
const { pool } = require('../database');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// GET /api/tenant — Info del concesionario actual
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM tenants WHERE id = $1',
      [req.user.tenantId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Concesionario no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

// PUT /api/tenant — Actualizar info del concesionario (admin only)
router.put('/', adminOnly, async (req, res) => {
  const { nombre, direccion, telefono, email } = req.body;
  try {
    await pool.query(
      `UPDATE tenants SET nombre=$1, direccion=$2, telefono=$3, email=$4, updated_at=NOW()
       WHERE id=$5`,
      [nombre, direccion, telefono, email, req.user.tenantId]
    );

    await pool.query(
      `INSERT INTO activity_log (tenant_id, user_id, user_name, action, entity_type)
       VALUES ($1, $2, $3, 'Actualizó datos del concesionario', 'tenant')`,
      [req.user.tenantId, req.user.id, req.user.nombre]
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar' });
  }
});

module.exports = router;
