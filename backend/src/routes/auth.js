const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../database');
const { generateToken, authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

// ============================================================
// POST /api/auth/register — Registro de NUEVO CONCESIONARIO
// Crea el tenant + el primer usuario (admin)
// ============================================================
router.post('/register', async (req, res) => {
  const { concesionario, nombre, email, password } = req.body;

  if (!concesionario || !nombre || !email || !password) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verificar que el email no exista
    const existing = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Ya existe una cuenta con ese email' });
    }

    // Crear el tenant (concesionario)
    const tenantResult = await client.query(
      'INSERT INTO tenants (nombre) VALUES ($1) RETURNING id, nombre',
      [concesionario]
    );
    const tenant = tenantResult.rows[0];

    // Crear el usuario admin
    const passwordHash = await bcrypt.hash(password, 12);
    const userResult = await client.query(
      `INSERT INTO users (tenant_id, nombre, email, password_hash, rol)
       VALUES ($1, $2, $3, $4, 'admin') RETURNING id, tenant_id, nombre, email, rol`,
      [tenant.id, nombre, email, passwordHash]
    );
    const user = userResult.rows[0];

    // Log de actividad
    await client.query(
      `INSERT INTO activity_log (tenant_id, user_id, user_name, action, entity_type)
       VALUES ($1, $2, $3, $4, 'tenant')`,
      [tenant.id, user.id, nombre, `Creó el concesionario "${concesionario}"`]
    );

    await client.query('COMMIT');

    const token = generateToken(user);

    res.status(201).json({
      token,
      user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol },
      tenant: { id: tenant.id, nombre: tenant.nombre },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error en registro:', err);
    res.status(500).json({ error: 'Error al crear la cuenta' });
  } finally {
    client.release();
  }
});

// ============================================================
// POST /api/auth/login
// ============================================================
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son obligatorios' });
  }

  try {
    const result = await pool.query(
      `SELECT u.*, t.nombre as tenant_nombre
       FROM users u
       JOIN tenants t ON t.id = u.tenant_id
       WHERE u.email = $1 AND u.activo = true AND t.activo = true`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const token = generateToken(user);

    // Log
    await pool.query(
      `INSERT INTO activity_log (tenant_id, user_id, user_name, action, entity_type)
       VALUES ($1, $2, $3, 'Inició sesión', 'auth')`,
      [user.tenant_id, user.id, user.nombre]
    );

    res.json({
      token,
      user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol },
      tenant: { id: user.tenant_id, nombre: user.tenant_nombre },
    });
  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

// ============================================================
// GET /api/auth/me — Obtener datos del usuario actual
// ============================================================
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.nombre, u.email, u.rol, t.nombre as tenant_nombre, t.id as tenant_id
       FROM users u
       JOIN tenants t ON t.id = u.tenant_id
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const u = result.rows[0];
    res.json({
      user: { id: u.id, nombre: u.nombre, email: u.email, rol: u.rol },
      tenant: { id: u.tenant_id, nombre: u.tenant_nombre },
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener datos' });
  }
});

// ============================================================
// POST /api/auth/users — Crear usuario dentro del tenant (admin only)
// ============================================================
router.post('/users', authMiddleware, adminOnly, async (req, res) => {
  const { nombre, email, password, rol } = req.body;
  const tenantId = req.user.tenantId;

  if (!nombre || !email || !password) {
    return res.status(400).json({ error: 'Nombre, email y contraseña son obligatorios' });
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Ya existe un usuario con ese email' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO users (tenant_id, nombre, email, password_hash, rol)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, nombre, email, rol`,
      [tenantId, nombre, email, passwordHash, rol || 'vendedor']
    );

    // Log
    await pool.query(
      `INSERT INTO activity_log (tenant_id, user_id, user_name, action, entity_type, entity_id)
       VALUES ($1, $2, $3, $4, 'user', $5)`,
      [tenantId, req.user.id, req.user.nombre, `Creó usuario: ${nombre} (${rol || 'vendedor'})`, result.rows[0].id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creando usuario:', err);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

// GET /api/auth/users — Listar usuarios del tenant
router.get('/users', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, nombre, email, rol, activo, created_at
       FROM users WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [req.user.tenantId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al listar usuarios' });
  }
});

module.exports = router;
