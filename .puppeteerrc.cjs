/**
 * Puppeteer configuration.
 * Sets the cache directory where Chrome is downloaded/stored.
 * On Render.com, the build command installs Chrome here:
 *   npm install && npx puppeteer browsers install chrome
 */
const { join } = require('path');

/** @type {import("puppeteer").Configuration} */
module.exports = {
  cacheDirectory: process.env.PUPPETEER_CACHE_DIR || join(__dirname, '.cache', 'puppeteer'),
};
