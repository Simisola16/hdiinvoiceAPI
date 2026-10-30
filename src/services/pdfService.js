/**
 * PDF Service
 * Renders the invoice HTML template with dynamic data using Puppeteer,
 * and returns a PDF buffer.
 *
 * On Render.com, Chrome must be installed during the build step.
 * Build command: npm install && npx puppeteer browsers install chrome
 *
 * The template uses {{PLACEHOLDER}} tokens that are replaced with actual values.
 * PDFs are NOT persisted — this function is called both for new invoices
 * and for on-demand regeneration from stored invoice data.
 */

const puppeteerCore = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

let chromium;
try {
  chromium = require('@sparticuz/chromium');
} catch (e) {
  console.warn('[PDF] @sparticuz/chromium not available');
}

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
  let logoPath = path.join(__dirname, '../../templates/hcaLogo.png');
  if (!fs.existsSync(logoPath)) {
    logoPath = path.join(__dirname, '../../../frontend/public/hcaLogo.png');
  }
  let signaturePath = path.join(__dirname, '../../templates/signature.png');
  if (!fs.existsSync(signaturePath)) {
    signaturePath = path.join(__dirname, '../../../frontend/public/signature.png');
  }

  let logoBase64 = '';
  let signatureBase64 = '';
  try {
    if (fs.existsSync(logoPath)) {
      const logoBuffer = fs.readFileSync(logoPath);
      logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
    } else {
      console.warn('[PDF] Logo not found at:', logoPath);
    }
    if (fs.existsSync(signaturePath)) {
      const sigBuffer = fs.readFileSync(signaturePath);
      signatureBase64 = `data:image/png;base64,${sigBuffer.toString('base64')}`;
    } else {
      console.warn('[PDF] Signature not found at:', signaturePath);
    }
  } catch (err) {
    console.error('Failed to load assets:', err);
  }

  const isUsd = data.currency === 'USD';
  const sym = isUsd ? '$' : '₦';
  const exchangeRate = Number(data.exchangeRate) || 1;
  const grandTotalInNaira = data.grandTotalInNaira != null
    ? Number(data.grandTotalInNaira)
    : (isUsd ? Number(data.grandTotal) * exchangeRate : Number(data.grandTotal));

  // Build dynamic table rows HTML
  let tableRowsHtml = '';
  let extraRowCount = 0;
  if (data.items && Array.isArray(data.items)) {
    data.items.forEach((item, index) => {
      tableRowsHtml += `
        <tr>
          <td class="sn-col">${index + 1}.</td>
          <td class="desc-col">${item.description}</td>
          <td class="amount-col">${sym}${formatCurrency(item.rate)}</td>
          <td>${item.qty}</td>
          <td class="amount-col">${sym}${formatCurrency(item.rate * item.qty)}</td>
        </tr>`;
    });

    // Add DISCOUNT row (only when discount is applied)
    const discPct = Number(data.discountPercent) || 0;
    const discAmt = Number(data.discountAmount)  || 0;
    if (discPct > 0) {
      extraRowCount++;
      tableRowsHtml += `
        <tr class="discount-row">
          <td class="sn-col">${data.items.length + extraRowCount}.</td>
          <td class="desc-col discount-label">DISCOUNT (${discPct}%)</td>
          <td></td>
          <td></td>
          <td class="amount-col discount-amount">- ${sym}${formatCurrency(discAmt)}</td>
        </tr>`;
    }

    // Add VAT row
    extraRowCount++;
    tableRowsHtml += `
        <tr>
          <td class="sn-col">${data.items.length + extraRowCount}.</td>
          <td class="desc-col">VAT OF ${data.vatPercent}%</td>
          <td></td>
          <td></td>
          <td class="amount-col">${sym}${formatCurrency(data.vatAmount)}</td>
        </tr>`;
  }

  const grandTotalDisplay = isUsd
    ? `$${formatCurrency(data.grandTotal)}`
    : `₦${formatCurrency(data.grandTotal)}`;

  const currencyNote = '';

  const replacements = {
    '{{LOGO_BASE64}}':      logoBase64,
    '{{SIGNATURE_BASE64}}': signatureBase64,
    '{{INVOICE_NUMBER}}':   data.invoiceNumber,
    '{{CLIENT_NAME}}':      data.company.name,
    '{{CLIENT_CONTACT}}':   data.company.contact || '',
    '{{CLIENT_TEL}}':       data.company.tel || '',
    '{{INVOICE_DATE}}':     formatDate(data.date),
    '{{RATE_HEADER}}':      isUsd ? 'RATE ($)' : 'RATE (₦)',
    '{{SUBTOTAL_HEADER}}':  isUsd ? 'SUB TOTAL ($)' : 'SUB TOTAL (₦)',
    '{{TABLE_ROWS}}':       tableRowsHtml,
    '{{CURRENCY_NOTE}}':    currencyNote,
    '{{GRAND_TOTAL}}':      grandTotalDisplay,
    '{{AMOUNT_IN_WORDS}}':  data.amountInWords,
  };

  // Replace all placeholders
  for (const [token, value] of Object.entries(replacements)) {
    html = html.replaceAll(token, value);
  }

  // Launch browser (Vercel Serverless Chromium or local Puppeteer)
  let browser;
  const isServerless = Boolean(
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.LAMBDA_TASK_ROOT ||
    process.env.AWS_EXECUTION_ENV
  );

  if (isServerless && chromium) {
    const executablePath = await chromium.executablePath();
    browser = await puppeteerCore.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: chromium.headless,
    });
  } else if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    browser = await puppeteerCore.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
  } else {
    try {
      const puppeteer = require('puppeteer');
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      });
    } catch (err) {
      if (chromium) {
        const executablePath = await chromium.executablePath();
        browser = await puppeteerCore.launch({
          args: chromium.args,
          defaultViewport: chromium.defaultViewport,
          executablePath,
          headless: chromium.headless,
        });
      } else {
        throw err;
      }
    }
  }

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
