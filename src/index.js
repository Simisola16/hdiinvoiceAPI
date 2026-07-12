/**
 * HCA Invoice Generator — Express Entry Point
 * Connects to MongoDB, mounts all routes, starts server.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const companyRoutes = require('./routes/companies');
const invoiceRoutes = require('./routes/invoices');

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,          // allow cookies to be sent cross-origin
}));
app.use(express.json());
app.use(cookieParser());

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',      authRoutes);
app.use('/api/users',     userRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/invoices',  invoiceRoutes);

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// ─── Database + Server ───────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('[MongoDB] Connected successfully');
    app.listen(PORT, () => console.log(`[Server] Running on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('[MongoDB] Connection failed:', err.message);
    process.exit(1);
  });
