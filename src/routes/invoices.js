/**
 * Invoice Routes
 * GET   /api/invoices          — list invoices (supports filters)
 * POST  /api/invoices          — create invoice + return PDF
 * PATCH /api/invoices/:id/paid — toggle paid status
 * GET   /api/invoices/:id/pdf  — regenerate + download PDF for existing invoice
 */

const router = require('express').Router();
const Invoice = require('../models/Invoice');
const Company = require('../models/Company');
const { authGuard } = require('../middleware/auth');
const { generateInvoiceNumber } = require('../utils/invoiceNumber');
const { toNairaWords } = require('../utils/numberToWords');
const { generatePdf } = require('../services/pdfService');

// All invoice routes require authentication
router.use(authGuard);

// ─── List Invoices (with filters) ─────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { dateFrom, dateTo, amount, companyName, paid } = req.query;

    const filter = {};

    // Date range filter
    if (dateFrom || dateTo) {
      filter.date = {};
      if (dateFrom) filter.date.$gte = new Date(dateFrom);
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);  // include full end day
        filter.date.$lte = endDate;
      }
    }

    // Amount filter (exact match on grandTotal)
    if (amount) {
      filter.grandTotal = Number(amount);
    }

    // Company name filter — resolve to company ID first
    if (companyName) {
      const companies = await Company.find({
        name: { $regex: companyName, $options: 'i' },
      }).select('_id');
      filter.company = { $in: companies.map((c) => c._id) };
    }

    // Paid status filter
    if (paid === 'true')  filter.paid = true;
    if (paid === 'false') filter.paid = false;

    const invoices = await Invoice.find(filter)
      .populate('company', 'name contact tel')
      .sort({ createdAt: -1 });

    res.json(invoices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Create Invoice + Return PDF ──────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { companyId, items, serviceDescription, rate, qty, vatPercent, discountPercent, date } = req.body;

    let company;
    if (req.body.company && req.body.company.name) {
      const companyData = req.body.company;
      // Find or create by name (case-insensitive) to prevent duplicates
      company = await Company.findOne({ name: { $regex: new RegExp('^' + companyData.name.trim() + '$', 'i') } });
      if (company) {
        // Update details if edited
        company.contact = companyData.contact !== undefined ? companyData.contact.trim() : company.contact;
        company.tel = companyData.tel !== undefined ? companyData.tel.trim() : company.tel;
        company.contactPerson = companyData.contactPerson !== undefined ? companyData.contactPerson.trim() : company.contactPerson;
        await company.save();
      } else {
        company = await Company.create({
          name:          companyData.name.trim(),
          contact:       companyData.contact?.trim() || '',
          tel:           companyData.tel?.trim() || '',
          contactPerson: companyData.contactPerson?.trim() || '',
        });
      }
    } else if (companyId) {
      if (!companyId.startsWith('ext_')) {
        company = await Company.findById(companyId);
      }
    }

    if (!company) {
      return res.status(400).json({ error: 'Valid company details or companyId is required' });
    }

    console.log('[Invoice Create Request] Body:', req.body);

    // Determine items array
    let invoiceItems = items;
    if (!invoiceItems || !Array.isArray(invoiceItems) || invoiceItems.length === 0) {
      if (serviceDescription && rate && qty) {
        invoiceItems = [{ description: serviceDescription, rate: Number(rate), qty: Number(qty) }];
      } else {
        return res.status(400).json({ error: 'items array is required' });
      }
    }

    // Calculate subtotal from items
    let subTotal = 0;
    const cleanedItems = invoiceItems.map(item => {
      const rateVal = Number(item.rate || 0);
      const qtyVal = Number(item.qty || 0);
      subTotal += rateVal * qtyVal;
      return {
        description: item.description?.trim() || 'HALAL CERTIFICATION',
        rate: rateVal,
        qty: qtyVal
      };
    });

    // Apply discount before VAT
    const discPct = discountPercent !== undefined ? Number(discountPercent) : 0;
    const discountAmount = parseFloat((subTotal * (discPct / 100)).toFixed(2));
    const vatBase = parseFloat((subTotal - discountAmount).toFixed(2));

    const vatPct = vatPercent !== undefined ? Number(vatPercent) : 7.5;
    const vatAmount = parseFloat((vatBase * (vatPct / 100)).toFixed(2));
    const grandTotal = parseFloat((vatBase + vatAmount).toFixed(2));

    console.log('[Invoice Calc] subTotal:', subTotal, 'discPct:', discPct, 'discountAmount:', discountAmount, 'vatBase:', vatBase, 'vatAmount:', vatAmount, 'grandTotal:', grandTotal);

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber();

    // Convert grand total to words
    const amountInWords = toNairaWords(grandTotal);

    // Create invoice record in DB
    const invoice = await Invoice.create({
      invoiceNumber,
      company:            company._id,
      items:              cleanedItems,
      subTotal,
      discountPercent:    discPct,
      discountAmount,
      vatPercent:         vatPct,
      vatAmount,
      grandTotal,
      amountInWords,
      date:               date ? new Date(date) : new Date(),
      createdBy:          req.user.name,
      createdByUser:      req.user.id,
    });

    // Generate PDF
    const pdfBuffer = await generatePdf({
      invoiceNumber,
      company,
      items: cleanedItems,
      subTotal,
      discountPercent: discPct,
      discountAmount,
      vatPercent: vatPct,
      vatAmount,
      grandTotal,
      amountInWords,
      date: invoice.date,
    });

    // Stream PDF to client
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${invoiceNumber.replace(/\//g, '-')}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    res.send(Buffer.from(pdfBuffer));
  } catch (err) {
    console.error('[Invoice Create Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Toggle Paid Status ────────────────────────────────────────────────────────
router.patch('/:id/paid', async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Toggle: if unpaid → mark paid; if paid → mark unpaid
    invoice.paid = !invoice.paid;
    invoice.paidAt = invoice.paid ? new Date() : null;
    await invoice.save();

    res.json({ paid: invoice.paid, paidAt: invoice.paidAt });
  } catch (err) {
    console.error('[Invoice Paid Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Regenerate PDF for Existing Invoice ──────────────────────────────────────
router.get('/:id/pdf', async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate('company');
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Fallback if the saved invoice has no items array (legacy format support)
    let invoiceItems = invoice.items;
    if (!invoiceItems || invoiceItems.length === 0) {
      invoiceItems = [{
        description: invoice.serviceDescription || 'HALAL CERTIFICATION',
        rate: invoice.rate || 0,
        qty: invoice.qty || 1
      }];
    }

    const pdfBuffer = await generatePdf({
      invoiceNumber:      invoice.invoiceNumber,
      company:            invoice.company,
      items:              invoiceItems,
      subTotal:           invoice.subTotal,
      discountPercent:    invoice.discountPercent || 0,
      discountAmount:     invoice.discountAmount || 0,
      vatPercent:         invoice.vatPercent,
      vatAmount:          invoice.vatAmount,
      grandTotal:         invoice.grandTotal,
      amountInWords:      invoice.amountInWords,
      date:               invoice.date,
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${invoice.invoiceNumber.replace(/\//g, '-')}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    res.send(Buffer.from(pdfBuffer));
  } catch (err) {
    console.error('[Invoice PDF Error]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
