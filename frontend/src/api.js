// ============================================================
// API CLIENT — Todas las llamadas al backend pasan por acá
// Inyecta automáticamente el JWT token en cada request
// ============================================================

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

function getToken() {
  return localStorage.getItem('autogestion_token');
}

export function setToken(token) {
  if (token) localStorage.setItem('autogestion_token', token);
  else localStorage.removeItem('autogestion_token');
}

export function getStoredAuth() {
  const token = getToken();
  const user = localStorage.getItem('autogestion_user');
  const tenant = localStorage.getItem('autogestion_tenant');
  if (token && user && tenant) {
    return {
      token,
      user: JSON.parse(user),
      tenant: JSON.parse(tenant),
    };
  }
  return null;
}

export function saveAuth(data) {
  setToken(data.token);
  localStorage.setItem('autogestion_user', JSON.stringify(data.user));
  localStorage.setItem('autogestion_tenant', JSON.stringify(data.tenant));
}

export function clearAuth() {
  localStorage.removeItem('autogestion_token');
  localStorage.removeItem('autogestion_user');
  localStorage.removeItem('autogestion_tenant');
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    clearAuth();
    window.location.reload();
    throw new Error('Sesión expirada');
  }

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'Error en la solicitud');
  }

  return data;
}

// ============================================================
// AUTH
// ============================================================
export const auth = {
  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  register: (data) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

  me: () => request('/auth/me'),

  getUsers: () => request('/auth/users'),

  createUser: (data) =>
    request('/auth/users', { method: 'POST', body: JSON.stringify(data) }),
};

// ============================================================
// VEHICLES
// ============================================================
export const vehicles = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/vehicles${qs ? '?' + qs : ''}`);
  },

  get: (id) => request(`/vehicles/${id}`),

  create: (data) =>
    request('/vehicles', { method: 'POST', body: JSON.stringify(data) }),

  update: (id, data) =>
    request(`/vehicles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  delete: (id) =>
    request(`/vehicles/${id}`, { method: 'DELETE' }),

  getMarcas: () => request('/vehicles/stats/marcas'),

  addMarca: (nombre) =>
    request('/vehicles/stats/marcas', { method: 'POST', body: JSON.stringify({ nombre }) }),
};

// ============================================================
// CLIENTS
// ============================================================
export const clients = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/clients${qs ? '?' + qs : ''}`);
  },

  create: (data) =>
    request('/clients', { method: 'POST', body: JSON.stringify(data) }),

  update: (id, data) =>
    request(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  delete: (id) =>
    request(`/clients/${id}`, { method: 'DELETE' }),
};

// ============================================================
// SALES
// ============================================================
export const sales = {
  stats: () => request('/sales/stats'),
};

// ============================================================
// ACTIVITY
// ============================================================
export const activity = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/activity${qs ? '?' + qs : ''}`);
  },
};

// ============================================================
// TENANT
// ============================================================
export const tenant = {
  get: () => request('/tenant'),
  update: (data) => request('/tenant', { method: 'PUT', body: JSON.stringify(data) }),
};
