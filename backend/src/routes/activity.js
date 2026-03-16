const express = require('express');
const { pool } = require('../database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// GET /api/activity
router.get('/', async (req, res) => {
  const { search, limit } = req.query;
  let query = `
    SELECT * FROM activity_log
    WHERE tenant_id = $1
  `;
  const params = [req.user.tenantId];

  if (search) {
    query += ` AND (action ILIKE $2 OR user_name ILIKE $2)`;
    params.push(`%${search}%`);
  }

  query += ` ORDER BY created_at DESC LIMIT ${parseInt(limit) || 200}`;

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener actividad' });
  }
});

module.exports = router;
