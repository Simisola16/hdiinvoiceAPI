/**
 * Auth Middleware
 * JWT verification + role-based access guard.
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * authGuard — verifies JWT from httpOnly cookie or Authorization header.
 * Attaches decoded user payload to req.user.
 */
const authGuard = async (req, res, next) => {
  try {
    // Support both cookie and Authorization Bearer header
    let token = req.cookies?.token;
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Attach user info (id + role) to request for downstream use
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

/**
 * roleGuard — factory that returns middleware restricting access to given roles.
 * Usage: router.post('/users', authGuard, roleGuard('superadmin'), handler)
 */
const roleGuard = (...allowedRoles) => (req, res, next) => {
  if (!req.user || !allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
};

module.exports = { authGuard, roleGuard };
