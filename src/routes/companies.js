/**
 * Company Routes
 * GET  /api/companies — list all companies
 * POST /api/companies — add a new company
 */

const router = require('express').Router();
const Company = require('../models/Company');
const { authGuard } = require('../middleware/auth');

// All company routes require authentication
router.use(authGuard);

// ─── List all companies ────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    // Support optional name search (case-insensitive)
    const filter = {};
    if (req.query.search) {
      filter.name = { $regex: req.query.search, $options: 'i' };
    }
    const companies = await Company.find(filter).sort({ name: 1 });
    res.json(companies);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Create new company ────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { name, contact, contactPerson, tel } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Company name is required' });
    }

    const company = await Company.create({
      name:          name.trim(),
      contact:       contact?.trim() || '',
      contactPerson: contactPerson?.trim() || '',
      tel:           tel?.trim() || '',
    });

    res.status(201).json({ message: 'Company added successfully', company });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
