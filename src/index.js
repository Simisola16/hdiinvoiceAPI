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
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// ─── Local Server Execution ──────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
if (!process.env.VERCEL) {
  connectDB().then(() => {
    app.listen(PORT, () => console.log(`[Server] Running on http://localhost:${PORT}`));
  });
}

module.exports = app;
