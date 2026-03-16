import React, { useState, useEffect, createContext, useContext } from 'react';
import { auth as authApi, saveAuth, clearAuth, getStoredAuth } from './api';

// ============================================================
// AUTH CONTEXT — Maneja login/logout global
// ============================================================
const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Intentar recuperar sesión guardada
    const stored = getStoredAuth();
    if (stored) {
      setUser(stored.user);
      setTenant(stored.tenant);
      // Verificar token con el backend
      authApi.me().then(data => {
        setUser(data.user);
        setTenant(data.tenant);
      }).catch(() => {
        clearAuth();
        setUser(null);
        setTenant(null);
      }).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const data = await authApi.login(email, password);
    saveAuth(data);
    setUser(data.user);
    setTenant(data.tenant);
    return data;
  };

  const register = async (formData) => {
    const data = await authApi.register(formData);
    saveAuth(data);
    setUser(data.user);
    setTenant(data.tenant);
    return data;
  };

  const logout = () => {
    clearAuth();
    setUser(null);
    setTenant(null);
  };

  return (
    <AuthContext.Provider value={{ user, tenant, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

// ============================================================
// PAGES (importadas lazy para mantener este archivo limpio)
// En un proyecto real, cada una va en su propio archivo
// Acá van inline para que el ejemplo sea completo
// ============================================================

// Tu frontend existente (concesionario.jsx) se conecta via api.js
// Las pages importan las funciones de api.js en vez de usar state local

function LoginPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', nombre: '', concesionario: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
      } else {
        if (!form.concesionario || !form.nombre) {
          setError('Completá todos los campos');
          return;
        }
        await register(form);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 10,
    fontSize: 14, background: '#fafbfc', color: '#1f2937', outline: 'none',
    width: '100%', boxSizing: 'border-box',
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 50%, #bfdbfe 100%)',
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, padding: 44, width: 420,
        boxShadow: '0 20px 60px rgba(30,64,175,.12)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'linear-gradient(135deg, #1e40af, #3b82f6)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', marginBottom: 12, fontSize: 24,
          }}>🚗</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#111827', margin: '0 0 4px', letterSpacing: -0.5 }}>
            AutoGestión
          </h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
            {mode === 'login' ? 'Ingresá a tu cuenta' : 'Registrá tu concesionario'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {['login', 'register'].map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              flex: 1, padding: '8px 0', border: 'none', borderRadius: 8,
              background: mode === m ? '#1e40af' : '#f3f4f6',
              color: mode === m ? '#fff' : '#6b7280',
              fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
            }}>{m === 'login' ? 'Iniciar sesión' : 'Registrarme'}</button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {mode === 'register' && (
            <>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#4b5563', marginBottom: 4, display: 'block' }}>
                  Nombre del concesionario
                </label>
                <input style={inputStyle} placeholder="Ej: Automotores López"
                  value={form.concesionario} onChange={e => set('concesionario', e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#4b5563', marginBottom: 4, display: 'block' }}>
                  Tu nombre
                </label>
                <input style={inputStyle} placeholder="Tu nombre completo"
                  value={form.nombre} onChange={e => set('nombre', e.target.value)} />
              </div>
            </>
          )}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#4b5563', marginBottom: 4, display: 'block' }}>Email</label>
            <input style={inputStyle} type="email" placeholder="tu@email.com"
              value={form.email} onChange={e => set('email', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#4b5563', marginBottom: 4, display: 'block' }}>Contraseña</label>
            <input style={inputStyle} type="password" placeholder="Mínimo 6 caracteres"
              value={form.password} onChange={e => set('password', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
          </div>

          {error && (
            <div style={{
              fontSize: 12, color: '#dc2626', background: '#fef2f2',
              padding: '8px 12px', borderRadius: 8, border: '1px solid #fecaca',
            }}>{error}</div>
          )}

          <button onClick={handleSubmit} disabled={loading} style={{
            padding: '12px', background: '#1e40af', color: '#fff', border: 'none',
            borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'inherit', marginTop: 4, opacity: loading ? 0.7 : 1,
          }}>
            {loading ? 'Cargando...' : (mode === 'login' ? '🔐 Iniciar sesión' : '🚀 Crear cuenta')}
          </button>
        </div>
      </div>
    </div>
  );
}

function MainApp() {
  const { user, tenant, logout } = useAuth();
  const [page, setPage] = useState('dashboard');

  // Acá irían los imports de tus pages reales
  // que usan api.js para comunicarse con el backend

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', emoji: '📊' },
    { id: 'vehicles', label: 'Vehículos', emoji: '🚗' },
    { id: 'sales', label: 'Ventas', emoji: '📈' },
    { id: 'clients', label: 'Clientes', emoji: '👥' },
    { id: 'activity', label: 'Actividad', emoji: '📋' },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      {/* Sidebar */}
      <nav style={{
        width: 230, background: '#fff', borderRight: '1px solid #e5e7eb',
        padding: '20px 10px', display: 'flex', flexDirection: 'column',
        position: 'sticky', top: 0, height: '100vh', boxSizing: 'border-box',
      }}>
        <div style={{ padding: '0 10px', marginBottom: 28 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#111827', letterSpacing: -0.5 }}>
            {tenant?.nombre || 'AutoGestión'}
          </div>
          <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Sistema de gestión
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {navItems.map(item => (
            <button key={item.id} onClick={() => setPage(item.id)} style={{
              display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px',
              border: 'none', borderRadius: 9, cursor: 'pointer', fontSize: 13,
              fontWeight: 600, fontFamily: 'inherit', textAlign: 'left',
              background: page === item.id ? '#eff6ff' : 'transparent',
              color: page === item.id ? '#1e40af' : '#6b7280',
            }}>
              <span>{item.emoji}</span> {item.label}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 'auto', padding: 10, borderTop: '1px solid #f3f4f6' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{user?.nombre}</div>
          <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 8 }}>{user?.rol} · {user?.email}</div>
          <button onClick={logout} style={{
            width: '100%', padding: '7px 10px', border: '1px solid #e5e7eb',
            borderRadius: 7, background: 'none', cursor: 'pointer', fontSize: 11,
            color: '#6b7280', fontWeight: 600, fontFamily: 'inherit',
          }}>Cerrar sesión</button>
        </div>
      </nav>

      {/* Main — Acá se renderizan las pages que usan api.js */}
      <main style={{ flex: 1, padding: '28px 36px', maxWidth: 1200 }}>
        <div style={{
          background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb',
          padding: 32, textAlign: 'center', color: '#6b7280',
        }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
            ✅ Backend conectado correctamente
          </h2>
          <p style={{ fontSize: 14, marginBottom: 16 }}>
            Estás logueado como <strong>{user?.nombre}</strong> en <strong>{tenant?.nombre}</strong>
          </p>
          <p style={{ fontSize: 13 }}>
            Página actual: <strong>{page}</strong>
          </p>
          <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 16 }}>
            El frontend existente (concesionario.jsx) se migra reemplazando
            las llamadas a storage por las funciones de api.js.<br />
            Ejemplo: en vez de <code>saveToStorage(data)</code>, usás <code>vehicles.create(data)</code>
          </p>
        </div>
      </main>
    </div>
  );
}

// ============================================================
// APP ROOT
// ============================================================
export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        height: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', color: '#6b7280',
      }}>Cargando...</div>
    );
  }

  return user ? <MainApp /> : <LoginPage />;
}
