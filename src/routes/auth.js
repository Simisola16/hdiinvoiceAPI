/**
 * Auth Routes
 * POST /api/auth/login   — username + password → JWT (httpOnly cookie)
 * POST /api/auth/logout  — clears cookie
 * GET  /api/auth/me      — returns current user info (requires auth)
 */

const router = require('express').Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authGuard } = require('../middleware/auth');

// ─── Login ────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find user by username (case-insensitive stored as lowercase)
    const user = await User.findOne({ username: username.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Compare password with stored hash
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Sign JWT — payload: id, name, role
    const token = jwt.sign(
      { id: user._id, name: user.name, role: user.role, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    // Set httpOnly cookie (secure in production)
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('token', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 8 * 60 * 60 * 1000, // 8 hours in ms
    });

    res.json({
      message: 'Login successful',
      user: { id: user._id, name: user.name, role: user.role, username: user.username },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/logout', (req, res) => {
  const isProd = process.env.NODE_ENV === 'production';
  res.clearCookie('token', {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
  });
  res.json({ message: 'Logged out successfully' });
});

// ─── Me (current user) ────────────────────────────────────────────────────────
router.get('/me', authGuard, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-passwordHash');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
