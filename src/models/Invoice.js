/**
 * Invoice Model
 * Stores all invoice data. PDFs are NOT stored — regenerated on demand.
 */

const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber:      { type: String, required: true, unique: true },
    company:            { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    items: [
      {
        description: { type: String, required: true },
        rate:        { type: Number, required: true },
        qty:         { type: Number, required: true },
      }
    ],
    subTotal:           { type: Number, required: true },
    // Discount applied before VAT
    discountPercent:    { type: Number, default: 0 },
    discountAmount:     { type: Number, default: 0 },
    vatPercent:         { type: Number, default: 7.5 },
    vatAmount:          { type: Number, required: true },
    grandTotal:         { type: Number, required: true },
    amountInWords:      { type: String, required: true },
    date:               { type: Date, default: Date.now },
    // Human-readable name of the creator (stored as string for display — survives user deletion)
    createdBy:          { type: String, required: true },
    // Reference to the user document for traceability
    createdByUser:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    // Payment status
    paid:               { type: Boolean, default: false },
    paidAt:             { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Invoice', invoiceSchema);
