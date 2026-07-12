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
    const search = req.query.search || '';

    // Fetch from external API
    const response = await fetch('https://api.hdiportal.com/api/users/external/clients', {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'hdi-api-key': process.env.HDIPORTAL_API_KEY || 'wdsvnkknnvdsxzeqaertyhnjkkknfdxxccwerty'
      }
    });

    if (!response.ok) {
      throw new Error(`External API responded with status ${response.status}`);
    }

    const data = await response.json();
    const externalUsers = data?.users || [];

    // Map external users to our format: { _id, name, contact, tel, contactPerson }
    // Since external API only gives companyName, we check our local DB to see if we have saved details.
    const localCompanies = await Company.find({});
    const localMap = new Map(localCompanies.map(c => [c.name.toLowerCase().trim(), c]));

    let companies = externalUsers.map(u => {
      const name = u.companyName || '';
      const localComp = localMap.get(name.toLowerCase().trim());
      return {
        _id: localComp?._id ? localComp._id.toString() : `ext_${u._id}`,
        name: name,
        contact: localComp?.contact || '',
        tel: localComp?.tel || '',
        contactPerson: localComp?.contactPerson || '',
        isExternal: !localComp
      };
    });

    // Apply search filter if provided
    if (search) {
      companies = companies.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
    }

    // Sort alphabetically by name
    companies.sort((a, b) => a.name.localeCompare(b.name));

    res.json(companies);
  } catch (err) {
    console.error('[Get Companies Proxy Error]', err.message);
    // If the external API fails (e.g. timeout/rate limit), fallback to returning local companies so the app doesn't break
    try {
      const filter = {};
      if (req.query.search) {
        filter.name = { $regex: req.query.search, $options: 'i' };
      }
      const localFallback = await Company.find(filter).sort({ name: 1 });
      res.json(localFallback.map(c => ({
        _id: c._id.toString(),
        name: c.name,
        contact: c.contact || '',
        tel: c.tel || '',
        contactPerson: c.contactPerson || '',
        isExternal: false
      })));
    } catch (fallbackErr) {
      res.status(500).json({ error: err.message });
    }
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
