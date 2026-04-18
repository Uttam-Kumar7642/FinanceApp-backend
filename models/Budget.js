const mongoose = require('mongoose');

const budgetSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  month: {
    type: String, // "2024-01" format
    required: [true, 'Month is required'],
    match: [/^\d{4}-\d{2}$/, 'Month must be in YYYY-MM format']
  },
  totalBudget: {
    type: Number,
    required: true,
    min: [0, 'Budget cannot be negative']
  },
  categoryBudgets: [{
    category: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 }
  }]
}, { timestamps: true });

budgetSchema.index({ userId: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('Budget', budgetSchema);
