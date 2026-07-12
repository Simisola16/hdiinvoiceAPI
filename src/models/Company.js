/**
 * Company Model
 * Stores reusable client company info for invoices.
 */

const mongoose = require('mongoose');

const companySchema = new mongoose.Schema(
  {
    name:          { type: String, required: true, trim: true },
    contact:       { type: String, trim: true },   // address line
    contactPerson: { type: String, trim: true },   // contact person name
    tel:           { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Company', companySchema);
