# AutoGestión SaaS — Sistema Multi-Tenant para Concesionarios

## Arquitectura

```
autogestion-saas/
├── backend/                 # API REST (Node.js + Express + PostgreSQL)
│   ├── package.json
│   ├── .env.example
│   ├── src/
│   │   ├── server.js        # Entry point
│   │   ├── database.js      # Pool de conexión + inicialización de tablas
│   │   ├── middleware/
│   │   │   └── auth.js      # JWT auth + tenant isolation
│   │   └── routes/
│   │       ├── auth.js       # Login, registro, manejo de usuarios
│   │       ├── vehicles.js   # CRUD vehículos (filtrado por tenant)
│   │       ├── clients.js    # CRUD clientes (filtrado por tenant)
│   │       ├── sales.js      # Ventas + analytics
│   │       ├── activity.js   # Registro de actividad
│   │       └── tenant.js     # Info del concesionario
│   └── Dockerfile
├── frontend/                # React (Vite)
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx          # Router principal
│   │   ├── api.js           # Fetch wrapper con JWT
│   │   ├── AuthContext.jsx   # Context de autenticación
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Vehicles.jsx
│   │   │   ├── Sales.jsx
│   │   │   ├── Clients.jsx
│   │   │   └── Activity.jsx
│   │   └── components/
│   │       ├── Layout.jsx
│   │       ├── VehicleForm.jsx
│   │       ├── VehicleCard.jsx
│   │       ├── ClientForm.jsx
│   │       └── UI.jsx
│   └── Dockerfile
├── docker-compose.yml       # Orquestación completa
└── README.md
```

## Setup rápido (desarrollo local)

### 1. Requisitos
- Node.js 18+
- PostgreSQL 15+ (o Docker)

### 2. Con Docker (recomendado)
```bash
docker-compose up --build
```
Esto levanta: PostgreSQL + Backend (puerto 3001) + Frontend (puerto 5173)

### 3. Sin Docker (manual)
```bash
# Terminal 1: Backend
cd backend
cp .env.example .env   # Editar con tus credenciales de DB
npm install
npm run dev

# Terminal 2: Frontend
cd frontend
npm install
npm run dev
```

### 4. Acceder
- Frontend: http://localhost:5173
- API: http://localhost:3001

## Deploy en la nube

### Opción A: Railway (más fácil, ~$5/mes)
1. Crear cuenta en railway.app
2. New Project → Deploy from GitHub
3. Agregar servicio PostgreSQL
4. Variables de entorno se configuran automáticamente

### Opción B: Render
1. Crear cuenta en render.com
2. Web Service (backend) + Static Site (frontend) + PostgreSQL

### Opción C: VPS (DigitalOcean, $6/mes)
1. Crear Droplet Ubuntu
2. Instalar Docker
3. `docker-compose up -d`

## Cómo funciona el Multi-Tenant

Cada concesionario tiene su propio `tenant_id`. Cuando un usuario se loguea:

1. El backend genera un JWT con `{ userId, tenantId, role }`
2. Cada request va con `Authorization: Bearer <token>`
3. El middleware `auth.js` extrae el `tenantId`
4. TODAS las queries incluyen `WHERE tenant_id = $tenantId`
5. Un concesionario NUNCA puede ver datos de otro
