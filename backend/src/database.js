const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
});

// ============================================================
// SCHEMA: Todas las tablas con tenant_id para multi-tenancy
// ============================================================
const initDB = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Concesionarios (tenants)
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id            SERIAL PRIMARY KEY,
        nombre        VARCHAR(255) NOT NULL,
        direccion     TEXT,
        telefono      VARCHAR(50),
        email         VARCHAR(255),
        plan          VARCHAR(50) DEFAULT 'free',
        activo        BOOLEAN DEFAULT true,
        created_at    TIMESTAMP DEFAULT NOW(),
        updated_at    TIMESTAMP DEFAULT NOW()
      );
    `);

    // 2. Usuarios (pertenecen a un tenant)
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id            SERIAL PRIMARY KEY,
        tenant_id     INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        nombre        VARCHAR(255) NOT NULL,
        email         VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        rol           VARCHAR(50) DEFAULT 'vendedor',
        activo        BOOLEAN DEFAULT true,
        created_at    TIMESTAMP DEFAULT NOW(),
        updated_at    TIMESTAMP DEFAULT NOW(),
        UNIQUE(email)
      );
    `);

    // 3. Marcas personalizadas por tenant
    await client.query(`
      CREATE TABLE IF NOT EXISTS custom_marcas (
        id            SERIAL PRIMARY KEY,
        tenant_id     INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        nombre        VARCHAR(100) NOT NULL,
        UNIQUE(tenant_id, nombre)
      );
    `);

    // 4. Vehículos
    await client.query(`
      CREATE TABLE IF NOT EXISTS vehicles (
        id              SERIAL PRIMARY KEY,
        tenant_id       INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        titulo          VARCHAR(255),
        marca           VARCHAR(100),
        modelo          VARCHAR(100),
        anio            INT,
        motor           VARCHAR(100),
        version         VARCHAR(100),
        transmision     VARCHAR(50) DEFAULT 'Manual',
        condicion       VARCHAR(20) DEFAULT 'Usado',
        kilometros      INT,
        fecha_ingreso   DATE,
        fecha_venta     DATE,
        patente         VARCHAR(20),
        chasis          VARCHAR(100),
        nro_motor       VARCHAR(100),
        precio_compra   DECIMAL(15,2),
        precio_venta    DECIMAL(15,2),
        precio_minimo   DECIMAL(15,2),
        descripcion     TEXT,
        anotaciones     TEXT,
        estado          VARCHAR(50) DEFAULT 'Disponible',
        procedencia     VARCHAR(100) DEFAULT 'Compra directa',
        ubicacion       VARCHAR(100) DEFAULT 'Salón principal',
        estado_cubiertas VARCHAR(50) DEFAULT 'Bueno',
        estado_pintura   VARCHAR(50) DEFAULT 'Bueno',
        estado_motor     VARCHAR(50) DEFAULT 'Bueno',
        estado_interior  VARCHAR(50) DEFAULT 'Bueno',
        vendido         BOOLEAN DEFAULT false,
        vendedor        VARCHAR(255),
        cliente_venta_id INT,
        created_at      TIMESTAMP DEFAULT NOW(),
        updated_at      TIMESTAMP DEFAULT NOW()
      );
    `);

    // Migraciones para columnas nuevas en instalaciones existentes
    await client.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS vendedor VARCHAR(255)`);
    await client.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS cliente_venta_id INT`);

    // 5. Fotos de vehículos
    await client.query(`
      CREATE TABLE IF NOT EXISTS vehicle_photos (
        id          SERIAL PRIMARY KEY,
        vehicle_id  INT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
        url         TEXT NOT NULL,
        orden       INT DEFAULT 0,
        created_at  TIMESTAMP DEFAULT NOW()
      );
    `);

    // 6. Gastos de vehículos
    await client.query(`
      CREATE TABLE IF NOT EXISTS vehicle_gastos (
        id          SERIAL PRIMARY KEY,
        vehicle_id  INT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
        descripcion VARCHAR(255),
        monto       DECIMAL(15,2) NOT NULL DEFAULT 0,
        created_at  TIMESTAMP DEFAULT NOW()
      );
    `);

    // 7. Historial de vehículos
    await client.query(`
      CREATE TABLE IF NOT EXISTS vehicle_historial (
        id          SERIAL PRIMARY KEY,
        vehicle_id  INT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
        fecha       DATE,
        detalle     TEXT,
        created_at  TIMESTAMP DEFAULT NOW()
      );
    `);

    // 8. Clientes
    await client.query(`
      CREATE TABLE IF NOT EXISTS clients (
        id          SERIAL PRIMARY KEY,
        tenant_id   INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        nombre      VARCHAR(255) NOT NULL,
        telefono    VARCHAR(50),
        email       VARCHAR(255),
        dni         VARCHAR(20),
        direccion   TEXT,
        notas       TEXT,
        created_at  TIMESTAMP DEFAULT NOW(),
        updated_at  TIMESTAMP DEFAULT NOW()
      );
    `);

    // 9. Ventas (relación vehículo-cliente)
    await client.query(`
      CREATE TABLE IF NOT EXISTS sales (
        id            SERIAL PRIMARY KEY,
        tenant_id     INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        vehicle_id    INT NOT NULL REFERENCES vehicles(id),
        client_id     INT REFERENCES clients(id),
        precio_final  DECIMAL(15,2),
        fecha         DATE,
        notas         TEXT,
        created_at    TIMESTAMP DEFAULT NOW()
      );
    `);

    // 10. Registro de actividad
    await client.query(`
      CREATE TABLE IF NOT EXISTS activity_log (
        id          SERIAL PRIMARY KEY,
        tenant_id   INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        user_id     INT REFERENCES users(id),
        user_name   VARCHAR(255),
        action      TEXT NOT NULL,
        entity_type VARCHAR(50),
        entity_id   INT,
        created_at  TIMESTAMP DEFAULT NOW()
      );
    `);

    // 11. Publicaciones en portales
    await client.query(`
      CREATE TABLE IF NOT EXISTS publications (
        id            SERIAL PRIMARY KEY,
        tenant_id     INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        vehicle_id    INT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
        plataforma    VARCHAR(50) NOT NULL,
        external_id   VARCHAR(255),
        estado        VARCHAR(50) DEFAULT 'activa',
        fecha         DATE DEFAULT NOW(),
        created_at    TIMESTAMP DEFAULT NOW()
      );
    `);

    // Índices para performance en multi-tenant
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_vehicles_tenant ON vehicles(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_vehicles_estado ON vehicles(tenant_id, estado);
      CREATE INDEX IF NOT EXISTS idx_vehicles_vendido ON vehicles(tenant_id, vendido);
      CREATE INDEX IF NOT EXISTS idx_clients_tenant ON clients(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_sales_tenant ON sales(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_activity_tenant ON activity_log(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `);

    await client.query('COMMIT');
    console.log('✅ Base de datos inicializada correctamente');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error inicializando DB:', err);
    throw err;
  } finally {
    client.release();
  }
};

// Helper: ejecutar query con tenant_id automático
const tenantQuery = async (text, params = []) => {
  return pool.query(text, params);
};

module.exports = { pool, initDB, tenantQuery };
