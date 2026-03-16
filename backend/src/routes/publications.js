const express = require('express');
const { pool } = require('../database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// ============================================================
// TABLA DE PUBLICACIONES (agregar en database.js initDB)
// CREATE TABLE IF NOT EXISTS publications (
//   id            SERIAL PRIMARY KEY,
//   tenant_id     INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
//   vehicle_id    INT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
//   plataforma    VARCHAR(50) NOT NULL,
//   external_id   VARCHAR(255),
//   estado        VARCHAR(50) DEFAULT 'activa',
//   fecha         DATE DEFAULT NOW(),
//   created_at    TIMESTAMP DEFAULT NOW()
// );
// ============================================================

// GET /api/publications — Listar publicaciones del tenant
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, v.titulo, v.marca, v.modelo, v.patente, v.precio_venta
       FROM publications p
       JOIN vehicles v ON v.id = p.vehicle_id
       WHERE p.tenant_id = $1
       ORDER BY p.created_at DESC`,
      [req.user.tenantId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener publicaciones' });
  }
});

// ============================================================
// POST /api/publications — Publicar vehículo en un portal
// Este endpoint es el "publicador universal"
// En producción, acá se llama a la API de cada plataforma
// ============================================================
router.post('/', async (req, res) => {
  const tenantId = req.user.tenantId;
  const { vehicle_id, plataforma } = req.body;

  try {
    // Verificar que el vehículo existe y es del tenant
    const vCheck = await pool.query(
      'SELECT * FROM vehicles WHERE id = $1 AND tenant_id = $2',
      [vehicle_id, tenantId]
    );
    if (vCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }

    const vehicle = vCheck.rows[0];

    // Verificar que no esté ya publicado en esa plataforma
    const existing = await pool.query(
      `SELECT id FROM publications
       WHERE vehicle_id = $1 AND plataforma = $2 AND estado = 'activa' AND tenant_id = $3`,
      [vehicle_id, plataforma, tenantId]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Ya está publicado en esta plataforma' });
    }

    // ═══════════════════════════════════════════
    // AQUÍ VA LA INTEGRACIÓN CON CADA API
    // ═══════════════════════════════════════════
    let externalId = null;

    switch (plataforma) {
      case 'mercadolibre': {
        // En producción:
        // const mlToken = await getMLToken(tenantId);
        // const response = await fetch('https://api.mercadolibre.com/items', {
        //   method: 'POST',
        //   headers: { Authorization: `Bearer ${mlToken}`, 'Content-Type': 'application/json' },
        //   body: JSON.stringify({
        //     title: vehicle.titulo || `${vehicle.marca} ${vehicle.modelo} ${vehicle.anio}`,
        //     category_id: 'MLA1744',
        //     price: parseFloat(vehicle.precio_venta),
        //     currency_id: 'ARS',
        //     available_quantity: 1,
        //     buying_mode: 'classified',
        //     listing_type_id: 'gold_pro',
        //     condition: vehicle.condicion === '0km' ? 'new' : 'used',
        //     description: { plain_text: vehicle.descripcion || '' },
        //     pictures: vehicle.fotos.map(url => ({ source: url })),
        //   }),
        // });
        // const mlData = await response.json();
        // externalId = mlData.id; // MLA1392920392
        externalId = 'MLA' + Math.random().toString().slice(2, 12);
        break;
      }

      case 'facebook': {
        // Facebook Commerce API
        // POST /commerce/catalog/{catalog_id}/items
        externalId = 'FB-' + Math.random().toString(36).slice(2, 10).toUpperCase();
        break;
      }

      case 'v6': {
        // V6 Autos — XML feed o API
        externalId = 'V6-' + Math.random().toString(36).slice(2, 10).toUpperCase();
        break;
      }

      case 'motordil': {
        // Motordil — CSV/XML feed
        externalId = 'MD-' + Math.random().toString(36).slice(2, 10).toUpperCase();
        break;
      }

      default:
        return res.status(400).json({ error: 'Plataforma no soportada' });
    }

    // Guardar publicación
    const result = await pool.query(
      `INSERT INTO publications (tenant_id, vehicle_id, plataforma, external_id, estado, fecha)
       VALUES ($1, $2, $3, $4, 'activa', NOW()) RETURNING *`,
      [tenantId, vehicle_id, plataforma, externalId]
    );

    // Log
    await pool.query(
      `INSERT INTO activity_log (tenant_id, user_id, user_name, action, entity_type, entity_id)
       VALUES ($1, $2, $3, $4, 'publication', $5)`,
      [tenantId, req.user.id, req.user.nombre,
       `Publicó "${vehicle.titulo || vehicle.marca + ' ' + vehicle.modelo}" en ${plataforma} (${externalId})`,
       result.rows[0].id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error publicando:', err);
    res.status(500).json({ error: 'Error al publicar' });
  }
});

// ============================================================
// DELETE /api/publications/:id — Despublicar
// ============================================================
router.delete('/:id', async (req, res) => {
  const tenantId = req.user.tenantId;

  try {
    const pub = await pool.query(
      `SELECT p.*, v.titulo, v.marca, v.modelo
       FROM publications p
       JOIN vehicles v ON v.id = p.vehicle_id
       WHERE p.id = $1 AND p.tenant_id = $2`,
      [req.params.id, tenantId]
    );

    if (pub.rows.length === 0) {
      return res.status(404).json({ error: 'Publicación no encontrada' });
    }

    const p = pub.rows[0];

    // En producción: llamar API para eliminar
    // if (p.plataforma === 'mercadolibre' && p.external_id) {
    //   await fetch(`https://api.mercadolibre.com/items/${p.external_id}`, {
    //     method: 'PUT',
    //     headers: { Authorization: `Bearer ${mlToken}` },
    //     body: JSON.stringify({ status: 'closed' }),
    //   });
    // }

    await pool.query('DELETE FROM publications WHERE id = $1 AND tenant_id = $2',
      [req.params.id, tenantId]);

    // Log
    await pool.query(
      `INSERT INTO activity_log (tenant_id, user_id, user_name, action, entity_type)
       VALUES ($1, $2, $3, $4, 'publication')`,
      [tenantId, req.user.id, req.user.nombre,
       `Despublicó "${p.titulo || p.marca + ' ' + p.modelo}" de ${p.plataforma}`]
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al despublicar' });
  }
});

// ============================================================
// POST /api/publications/sync — Sincronizar stock con portales
// Se ejecuta cuando cambia precio, estado o se vende un auto
// ============================================================
router.post('/sync/:vehicleId', async (req, res) => {
  const tenantId = req.user.tenantId;
  const vehicleId = req.params.vehicleId;

  try {
    const vehicle = await pool.query(
      'SELECT * FROM vehicles WHERE id = $1 AND tenant_id = $2',
      [vehicleId, tenantId]
    );
    if (vehicle.rows.length === 0) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }

    const v = vehicle.rows[0];
    const pubs = await pool.query(
      `SELECT * FROM publications WHERE vehicle_id = $1 AND estado = 'activa' AND tenant_id = $2`,
      [vehicleId, tenantId]
    );

    const results = [];

    for (const pub of pubs.rows) {
      // Si el auto se vendió, cerrar publicaciones
      if (v.vendido) {
        // En producción: llamar API de cada portal para cerrar
        await pool.query(
          "UPDATE publications SET estado = 'cerrada' WHERE id = $1",
          [pub.id]
        );
        results.push({ plataforma: pub.plataforma, action: 'cerrada' });
      } else {
        // Actualizar precio en cada portal
        // En producción:
        // if (pub.plataforma === 'mercadolibre') {
        //   await fetch(`https://api.mercadolibre.com/items/${pub.external_id}`, {
        //     method: 'PUT',
        //     headers: { Authorization: `Bearer ${mlToken}` },
        //     body: JSON.stringify({ price: parseFloat(v.precio_venta) }),
        //   });
        // }
        results.push({ plataforma: pub.plataforma, action: 'actualizada' });
      }
    }

    res.json({ synced: results.length, results });
  } catch (err) {
    res.status(500).json({ error: 'Error sincronizando' });
  }
});

module.exports = router;
