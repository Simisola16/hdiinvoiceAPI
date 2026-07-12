/**
 * PDF Service
 * Renders the invoice HTML template with dynamic data using Puppeteer,
 * and returns a PDF buffer.
 *
 * The template uses {{PLACEHOLDER}} tokens that are replaced with actual values.
 * PDFs are NOT persisted — this function is called both for new invoices
 * and for on-demand regeneration from stored invoice data.
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Path to the invoice HTML template
const TEMPLATE_PATH = path.join(__dirname, '../../templates/invoice.html');

/**
 * Formats a number with commas and 2 decimal places.
 * e.g. 1075000 → "1,075,000.00"
 */
const formatCurrency = (num) =>
  Number(num).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Formats a date as "10TH/JULY/2026" style (matching the invoice sample).
 */
const formatDate = (dateInput) => {
  const d = new Date(dateInput);
  const day = d.getDate();
  const months = [
    'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
    'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
  ];
  const month = months[d.getMonth()];
  const year = d.getFullYear();

  // Ordinal suffix
  const j = day % 10, k = day % 100;
  let suffix = 'TH';
  if (j === 1 && k !== 11) suffix = 'ST';
  else if (j === 2 && k !== 12) suffix = 'ND';
  else if (j === 3 && k !== 13) suffix = 'RD';

  return `${day}${suffix}/${month}/${year}`;
};

/**
 * generatePdf — main export.
 * @param {Object} data - Invoice data object with all fields.
 * @returns {Buffer} - PDF binary buffer.
 */
const generatePdf = async (data) => {
  // Read and populate the HTML template
  let html = fs.readFileSync(TEMPLATE_PATH, 'utf8');

  // Load logo as base64
  const logoPath = path.join(__dirname, '../../../frontend/public/hcaLogo.png');
  let logoBase64 = '';
  try {
    if (fs.existsSync(logoPath)) {
      const logoBuffer = fs.readFileSync(logoPath);
      logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
    } else {
      console.warn('[PDF] Logo not found at:', logoPath);
    }
  } catch (err) {
    console.error('Failed to load logo:', err);
  }

  // Build dynamic table rows HTML
  let tableRowsHtml = '';
  if (data.items && Array.isArray(data.items)) {
    data.items.forEach((item, index) => {
      tableRowsHtml += `
        <tr>
          <td class="sn-col">${index + 1}.</td>
          <td class="desc-col">${item.description}</td>
          <td class="amount-col">${formatCurrency(item.rate)}</td>
          <td>${item.qty}</td>
          <td class="amount-col">${formatCurrency(item.rate * item.qty)}</td>
        </tr>`;
    });

    // Add VAT row
    tableRowsHtml += `
        <tr>
          <td class="sn-col">${data.items.length + 1}.</td>
          <td class="desc-col">VAT OF ${data.vatPercent}%</td>
          <td></td>
          <td></td>
          <td class="amount-col">${formatCurrency(data.vatAmount)}</td>
        </tr>`;
  }

  const replacements = {
    '{{LOGO_BASE64}}':      logoBase64,
    '{{INVOICE_NUMBER}}':   data.invoiceNumber,
    '{{CLIENT_NAME}}':      data.company.name,
    '{{CLIENT_CONTACT}}':   data.company.contact || '',
    '{{CLIENT_TEL}}':       data.company.tel || '',
    '{{INVOICE_DATE}}':     formatDate(data.date),
    '{{TABLE_ROWS}}':       tableRowsHtml,
    '{{GRAND_TOTAL}}':      `N${formatCurrency(data.grandTotal)}`,
    '{{AMOUNT_IN_WORDS}}':  data.amountInWords,
  };

  // Replace all placeholders
  for (const [token, value] of Object.entries(replacements)) {
    html = html.replaceAll(token, value);
  }

  // Launch Puppeteer
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
    });

    return pdfBuffer;
  } finally {
    await browser.close();
  }
};

module.exports = { generatePdf };
