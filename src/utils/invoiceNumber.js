/**
 * Invoice Number Generator
 * Format: HCA/YY/XXXX (4-digit zero-padded sequence, per-year)
 * Example: HCA/26/0001, HCA/26/0074
 */

const Invoice = require('../models/Invoice');

/**
 * Generates the next invoice number for the current year.
 * Queries the last invoice of this year and increments its sequence.
 * If no invoices exist for this year, starts at 0001.
 */
const generateInvoiceNumber = async () => {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2); // e.g. "26" for 2026
  const prefix = `HCA/${yy}/`;

  // Find the highest-numbered invoice for this year
  const lastInvoice = await Invoice.findOne({
    invoiceNumber: { $regex: `^${prefix}` },
  }).sort({ invoiceNumber: -1 });

  let nextSeq = 1;
  if (lastInvoice) {
    // Extract the numeric sequence from the end of the invoice number
    const lastSeq = parseInt(lastInvoice.invoiceNumber.split('/')[2], 10);
    nextSeq = lastSeq + 1;
  }

  // Zero-pad to 4 digits
  const paddedSeq = String(nextSeq).padStart(4, '0');
  return `${prefix}${paddedSeq}`;
};

module.exports = { generateInvoiceNumber };
