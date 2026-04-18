const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['income', 'expense'],
    required: [true, 'Transaction type is required']
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0.01, 'Amount must be positive']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: [
      'Salary', 'Freelance', 'Investment', 'Business', 'Gift', 'Other Income',
      'Food & Dining', 'Shopping', 'Transport', 'Housing', 'Healthcare',
      'Entertainment', 'Education', 'Travel', 'Utilities', 'Insurance',
      'Savings', 'Other Expense'
    ]
  },
  date: { type: Date, default: Date.now, index: true },
  note: { type: String, trim: true, maxlength: 500 },
  tags: [{ type: String, trim: true }],
  recurring: {
    isRecurring: { type: Boolean, default: false },
    frequency: { type: String, enum: ['daily', 'weekly', 'monthly', 'yearly'] }
  }
}, { timestamps: true });

transactionSchema.index({ userId: 1, date: -1 });
transactionSchema.index({ userId: 1, type: 1 });
transactionSchema.index({ userId: 1, category: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);
