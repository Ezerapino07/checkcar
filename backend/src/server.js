require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { initDB } = require('./database');

const authRoutes = require('./routes/auth');
const vehicleRoutes = require('./routes/vehicles');
const clientRoutes = require('./routes/clients');
const salesRoutes = require('./routes/sales');
const activityRoutes = require('./routes/activity');
const tenantRoutes = require('./routes/tenant');
const publicationRoutes = require('./routes/publications');

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================================
// MIDDLEWARE GLOBAL
// ============================================================
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '50mb' })); // Limit alto para fotos base64

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// ============================================================
// RUTAS
// ============================================================
app.use('/api/auth', authRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/tenant', tenantRoutes);
app.use('/api/publications', publicationRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Error global
app.use((err, req, res, next) => {
  console.error('Error no manejado:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// ============================================================
// START
// ============================================================
async function start() {
  try {
    await initDB();
    app.listen(PORT, () => {
      console.log(`
╔══════════════════════════════════════════════╗
║  🚗 CheckCar API v1.0                      ║
║  Puerto: ${PORT}                                ║
║  Entorno: ${process.env.NODE_ENV || 'development'}                    ║
╚══════════════════════════════════════════════╝
      `);
    });
  } catch (err) {
    console.error('❌ Error al iniciar:', err);
    process.exit(1);
  }
}

start();
