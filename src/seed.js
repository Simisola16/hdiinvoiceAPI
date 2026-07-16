/**
 * Seed Script
 * Creates the superadmin user (halal / abc123) if it doesn't already exist.
 * Run: node src/seed.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('./models/User');

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('[Seed] MongoDB connected');

    const existing = await User.findOne({ username: 'halal' });
    if (existing) {
      console.log('[Seed] Superadmin already exists — skipping.');
      return;
    }

    const passwordHash = await bcrypt.hash('abc123', 12);
    await User.create({
      name:         'HDIAdmin',

      email:        'admin@halalcert.com.ng',
      username:     'halal',
      passwordHash,
      role:         'superadmin',
    });

    console.log('[Seed] Superadmin created: username=halal, password=abc123');
  } catch (err) {
    console.error('[Seed] Error:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('[Seed] Done.');
  }
};

seed();
