/**
 * User Model
 * Supports two roles: 'superadmin' (can manage users) and 'staff' (can generate invoices).
 */

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name:         { type: String, required: true, trim: true },
    email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
    username:     { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role:         { type: String, enum: ['superadmin', 'staff'], default: 'staff' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
