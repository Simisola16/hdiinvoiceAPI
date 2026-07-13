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
    const response = await fetch('https://api.hdiportal.com/api/users', {
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
    const localCompanies = await Company.find({});
    const localMap = new Map(localCompanies.map(c => [c.name.toLowerCase().trim(), c]));

    let companies = externalUsers
      .filter(u => u.role === 'company' || u.companyName)
      .map(u => {
        const name = (u.companyName || '').trim();
        const localComp = localMap.get(name.toLowerCase());

        // Extract and construct default address from API
        let defaultContact = '';
        if (u.address && u.address !== 'N/A') {
          defaultContact = u.address.trim();
          if (u.city && u.city !== 'N/A') defaultContact += `, ${u.city.trim()}`;
          if (u.state && u.state !== 'N/A') defaultContact += `, ${u.state.trim()}`;
        }

        // Extract phone number from API (filter out placeholders like '00000000000')
        let defaultTel = u.companyContact || u.contact || '';
        if (defaultTel === '00000000000' || defaultTel === 'N/A') {
          defaultTel = '';
        }

        // Extract contact person from API
        const defaultPerson = u.fullName && u.fullName !== 'N/A' ? u.fullName.trim() : '';

        return {
          _id: localComp?._id ? localComp._id.toString() : `ext_${u._id}`,
          name: name,
          contact: localComp?.contact !== undefined ? localComp.contact : defaultContact,
          tel: localComp?.tel !== undefined ? localComp.tel : defaultTel,
          contactPerson: localComp?.contactPerson !== undefined ? localComp.contactPerson : defaultPerson,
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

// ─── Lookup local company by name (for auto-fill of address/tel/contactPerson) ──
// GET /api/companies/lookup?name=COMPANY_NAME
// Returns the stored local record so the form can auto-populate when selecting
// a company that originally came from the external HDI portal API.
router.get('/lookup', async (req, res) => {
  try {
    const { name } = req.query;
    if (!name) return res.status(400).json({ error: 'name query param is required' });

    const company = await Company.findOne({
      name: { $regex: new RegExp('^' + name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') }
    });

    if (company) {
      return res.json({
        found: true,
        _id: company._id.toString(),
        contact: company.contact || '',
        tel: company.tel || '',
        contactPerson: company.contactPerson || '',
      });
    }

    // Not in local DB — try fetching default values from external portal API
    const response = await fetch('https://api.hdiportal.com/api/users', {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'hdi-api-key': process.env.HDIPORTAL_API_KEY || 'wdsvnkknnvdsxzeqaertyhnjkkknfdxxccwerty'
      }
    });

    if (response.ok) {
      const data = await response.json();
      const externalUsers = data?.users || [];
      const targetUser = externalUsers.find(u => (u.companyName || '').toLowerCase().trim() === name.toLowerCase().trim());
      if (targetUser) {
        let defaultContact = '';
        if (targetUser.address && targetUser.address !== 'N/A') {
          defaultContact = targetUser.address.trim();
          if (targetUser.city && targetUser.city !== 'N/A') defaultContact += `, ${targetUser.city.trim()}`;
          if (targetUser.state && targetUser.state !== 'N/A') defaultContact += `, ${targetUser.state.trim()}`;
        }
        let defaultTel = targetUser.companyContact || targetUser.contact || '';
        if (defaultTel === '00000000000' || defaultTel === 'N/A') defaultTel = '';
        const defaultPerson = targetUser.fullName && targetUser.fullName !== 'N/A' ? targetUser.fullName.trim() : '';

        return res.json({
          found: true,
          contact: defaultContact,
          tel: defaultTel,
          contactPerson: defaultPerson
        });
      }
    }

    // Fallback if not found anywhere
    res.json({ found: false, contact: '', tel: '', contactPerson: '' });
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
