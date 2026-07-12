/**
 * Number to Words Utility
 * Converts a numeric grand total to Nigerian Naira words.
 * Example: 1075000 → "ONE MILLION, SEVENTY FIVE THOUSAND NAIRA ONLY"
 *
 * Uses the 'number-to-words' npm package for base conversion,
 * then formats the output to match the HCA invoice style.
 */

const ntw = require('number-to-words');

/**
 * Converts a number to Naira words in HCA invoice format.
 * Handles whole numbers (kobo/cents not shown on the invoice sample).
 *
 * @param {number} amount - The grand total numeric value
 * @returns {string} - e.g. "ONE MILLION, SEVENTY FIVE THOUSAND NAIRA ONLY"
 */
const toNairaWords = (amount) => {
  // Use the integer part only (consistent with the invoice sample)
  const intAmount = Math.round(amount);

  if (intAmount === 0) return 'ZERO NAIRA ONLY';

  // number-to-words gives: "one million, seventy-five thousand"
  const words = ntw.toWords(intAmount);

  // Capitalise and clean up hyphenated numbers (e.g. "seventy-five" → "SEVENTY FIVE")
  const formatted = words
    .toUpperCase()
    .replace(/-/g, ' ')    // remove hyphens
    .replace(/\s+/g, ' ')  // normalise spaces
    .trim();

  return `${formatted} NAIRA ONLY`;
};

module.exports = { toNairaWords };
