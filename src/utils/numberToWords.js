/**
 * Number to Words Utility
 * Converts a numeric grand total to words.
 * Supports NGN (Nigerian Naira) and USD (US Dollars) with Naira equivalent.
 *
 * Example (NGN): 1075000 → "ONE MILLION, SEVENTY FIVE THOUSAND NAIRA ONLY"
 * Example (USD): 1200 → "ONE THOUSAND TWO HUNDRED US DOLLARS ONLY (EQUIVALENT TO ONE MILLION, EIGHT HUNDRED THOUSAND NAIRA ONLY)"
 */

const ntw = require('number-to-words');

const formatWords = (num) => {
  const intVal = Math.floor(Math.abs(num));
  if (intVal === 0) return 'ZERO';
  const words = ntw.toWords(intVal);
  return words
    .toUpperCase()
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const toNairaWords = (amount) => {
  const rounded = Math.round(amount);
  return `${formatWords(rounded)} NAIRA ONLY`;
};

const toCurrencyWords = (amount, currency = 'NGN', exchangeRate = 1, grandTotalInNaira = null) => {
  if (currency === 'USD') {
    const dollars = Math.floor(amount);
    const cents = Math.round((amount - dollars) * 100);
    let usdText = `${formatWords(dollars)} US DOLLARS`;
    if (cents > 0) {
      usdText += ` AND ${formatWords(cents)} CENTS`;
    }
    usdText += ' ONLY';

    const nairaAmount = grandTotalInNaira != null
      ? Math.round(grandTotalInNaira)
      : Math.round(amount * (exchangeRate || 1));
    const nairaText = `${formatWords(nairaAmount)} NAIRA ONLY`;

    return `${usdText} (EQUIVALENT TO ${nairaText})`;
  }
  return toNairaWords(amount);
};

module.exports = { toNairaWords, toCurrencyWords };
