const express = require('express');
const { pool } = require('../database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// GET /api/sales/stats — Estadísticas de ventas
router.get('/stats', async (req, res) => {
  const tenantId = req.user.tenantId;

  try {
    // Vehículos vendidos con datos financieros
    const soldResult = await pool.query(`
      SELECT v.*,
        COALESCE((SELECT SUM(monto) FROM vehicle_gastos WHERE vehicle_id = v.id), 0) as total_gastos
      FROM vehicles v
      WHERE v.tenant_id = $1 AND v.vendido = true
      ORDER BY v.fecha_venta DESC
    `, [tenantId]);

    const sold = soldResult.rows;

    // Marcas más vendidas
    const marcasResult = await pool.query(`
      SELECT marca, COUNT(*) as total
      FROM vehicles
      WHERE tenant_id = $1 AND vendido = true AND marca IS NOT NULL
      GROUP BY marca ORDER BY total DESC
    `, [tenantId]);

    // Modelos más vendidos
    const modelosResult = await pool.query(`
      SELECT marca || ' ' || modelo as nombre, COUNT(*) as total
      FROM vehicles
      WHERE tenant_id = $1 AND vendido = true AND marca IS NOT NULL
      GROUP BY marca, modelo ORDER BY total DESC
    `, [tenantId]);

    // Ventas por mes
    const monthlyResult = await pool.query(`
      SELECT TO_CHAR(fecha_venta, 'YYYY-MM') as mes, COUNT(*) as total,
        SUM(precio_venta) as ingresos
      FROM vehicles
      WHERE tenant_id = $1 AND vendido = true AND fecha_venta IS NOT NULL
      GROUP BY mes ORDER BY mes DESC LIMIT 12
    `, [tenantId]);

    // Calcular ganancia total
    let totalProfit = 0;
    for (const v of sold) {
      const compra = parseFloat(v.precio_compra) || 0;
      const venta = parseFloat(v.precio_venta) || 0;
      const gastos = parseFloat(v.total_gastos) || 0;
      totalProfit += venta - compra - gastos;
    }

    res.json({
      total_vendidos: sold.length,
      total_ganancia: totalProfit,
      ganancia_promedio: sold.length > 0 ? totalProfit / sold.length : 0,
      marcas: marcasResult.rows,
      modelos: modelosResult.rows,
      mensual: monthlyResult.rows,
      vehiculos: sold,
    });
  } catch (err) {
    console.error('Error en stats:', err);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

module.exports = router;
