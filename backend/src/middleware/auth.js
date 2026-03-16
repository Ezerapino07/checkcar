const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-cambiar-en-produccion';
const JWT_EXPIRES = '7d';

// Generar token
function generateToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      tenantId: user.tenant_id,
      email: user.email,
      rol: user.rol,
      nombre: user.nombre,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

// ============================================================
// MIDDLEWARE: Verifica JWT y extrae tenant_id
// Este es el CORAZÓN del multi-tenant security
// ============================================================
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Inyectar datos del usuario y tenant en el request
    // Esto es lo que garantiza que cada query sea del tenant correcto
    req.user = {
      id: decoded.userId,
      tenantId: decoded.tenantId,
      email: decoded.email,
      rol: decoded.rol,
      nombre: decoded.nombre,
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado, volvé a iniciar sesión' });
    }
    return res.status(401).json({ error: 'Token inválido' });
  }
}

// Middleware: solo admins
function adminOnly(req, res, next) {
  if (req.user.rol !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado: se requiere rol admin' });
  }
  next();
}

module.exports = { generateToken, authMiddleware, adminOnly, JWT_SECRET };
