/**
 * User Routes (superadmin only)
 * GET  /api/users   — list all staff users
 * POST /api/users   — create new staff user
 */

const router = require('express').Router();
const bcrypt = require('bcrypt');
const User = require('../models/User');
const { authGuard, roleGuard } = require('../middleware/auth');

// All user management routes require auth + superadmin role
router.use(authGuard, roleGuard('superadmin'));

// ─── List all users ───────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const users = await User.find().select('-passwordHash').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Create new staff user ────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { name, email, username, password } = req.body;

    if (!name || !email || !username || !password) {
      return res.status(400).json({ error: 'Name, email, username, and password are required' });
    }

    // Check for duplicate username or email
    const existing = await User.findOne({
      $or: [
        { username: username.toLowerCase().trim() },
        { email: email.toLowerCase().trim() },
      ],
    });
    if (existing) {
      return res.status(409).json({ error: 'Username or email already in use' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      username: username.toLowerCase().trim(),
      passwordHash,
      role: 'staff',  // New users created by superadmin are always staff
    });

    res.status(201).json({
      message: 'User created successfully',
      user: { id: user._id, name: user.name, email: user.email, username: user.username, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
