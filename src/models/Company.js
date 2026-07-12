/**
 * Company Model
 * Stores reusable client company info for invoices.
 */

const mongoose = require('mongoose');

const companySchema = new mongoose.Schema(
  {
    name:    { type: String, required: true, trim: true },
    contact: { type: String, trim: true },   // address line
    tel:     { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Company', companySchema);
