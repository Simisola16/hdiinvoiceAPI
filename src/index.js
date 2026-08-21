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
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'https://hdiinvoice.vercel.app',
  'http://hdiinvoice.vercel.app',
  'https://invoice.hdiportal.com',
  'https://www.invoice.hdiportal.com',
];

if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
  if (process.env.FRONTEND_URL.startsWith('http://')) {
    allowedOrigins.push(process.env.FRONTEND_URL.replace('http://', 'https://'));
  }
}

const isOriginAllowed = (origin) => {
  if (!origin) return true;
  return (
    allowedOrigins.includes(origin) ||
    origin.endsWith('.vercel.app') ||
    origin.endsWith('vercel.app') ||
    origin.endsWith('.hdiportal.com') ||
    origin.endsWith('hdiportal.com') ||
    origin.includes('localhost') ||
    origin.includes('127.0.0.1')
  );
};

const corsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Disposition'],
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json());
app.use(cookieParser());

// ─── Serverless Database Connection ──────────────────────────────────────────
let isDbConnected = false;
const connectDB = async () => {
  if (isDbConnected || mongoose.connection.readyState >= 1) {
    return;
  }
  if (!process.env.MONGODB_URI) {
    console.error('[MongoDB] MONGODB_URI is not set in environment');
    return;
  }
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    isDbConnected = true;
    console.log('[MongoDB] Connected successfully');
  } catch (err) {
    console.error('[MongoDB] Connection failed:', err.message);
  }
};

app.use(async (req, res, next) => {
  // Don't wait on DB connection for OPTIONS preflight checks
  if (req.method === 'OPTIONS') {
    return next();
  }
  await connectDB();
  next();
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',      authRoutes);
app.use('/api/users',     userRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/invoices',  invoiceRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  const origin = req.headers.origin;
  if (origin && isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// ─── Server Execution ────────────────────────────────────────────────────────
const PORT = process.env.PORT || 8080;
if (!process.env.VERCEL) {
  connectDB().then(() => {
    app.listen(PORT, '0.0.0.0', () => console.log(`[Server] Running on port ${PORT}`));
  });
}

module.exports = app;
