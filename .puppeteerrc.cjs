/**
 * Puppeteer configuration for Render.com compatibility.
 * Sets cache path to /opt/render/.cache/puppeteer which is
 * the writable cache location on Render's infrastructure.
 */
const { join } = require('path');

/** @type {import("puppeteer").Configuration} */
module.exports = {
  // Skip downloading Chrome bundled with puppeteer
  // since we use @sparticuz/chromium in production
  skipDownload: true,
  cacheDirectory: process.env.PUPPETEER_CACHE_DIR || join(__dirname, '.cache', 'puppeteer'),
};
