/**
 * HCA Invoice Generator — Express Entry Point
 * Connects to MongoDB, mounts all routes, starts server.
 */

require('dotenv').config();

// Ensure Chrome is installed for Puppeteer PDF generation on startup
try {
  console.log('[Puppeteer] Ensuring Chrome is installed...');
  const { execSync } = require('child_process');
  execSync('npx puppeteer browsers install chrome', {
    stdio: 'inherit',
    env: { ...process.env, PUPPETEER_SKIP_CHROMIUM_DOWNLOAD: 'false' }
  });
  console.log('[Puppeteer] Chrome is ready.');
} catch (err) {
  console.error('[Puppeteer] Warning: Chrome installation check failed:', err.message);
}

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
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'https://hdiinvoice.vercel.app',
  'http://hdiinvoice.vercel.app',
  'https://invoice.hdiportal.com',
  'http://invoice.hdiportal.com',
];

if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
  if (process.env.FRONTEND_URL.startsWith('http://')) {
    allowedOrigins.push(process.env.FRONTEND_URL.replace('http://', 'https://'));
  }
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, postman, or curl)
    if (!origin) return callback(null, true);
    if (
      allowedOrigins.includes(origin) ||
      origin.endsWith('vercel.app') ||
      origin.endsWith('hdiportal.com')
    ) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
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
