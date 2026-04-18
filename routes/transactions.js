const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Transaction = require('../models/Transaction');
const { protect } = require('../middleware/auth');

router.use(protect);

// GET /api/transactions
router.get('/', async (req, res) => {
  try {
    const { type, category, startDate, endDate, page = 1, limit = 20, sort = '-date' } = req.query;
    const query = { userId: req.user._id };
    if (type) query.type = type;
    if (category) query.category = category;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }
    const total = await Transaction.countDocuments(query);
    const transactions = await Transaction.find(query)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    res.json({ transactions, total, pages: Math.ceil(total / limit), page: parseInt(page) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/transactions
router.post('/', [
  body('type').isIn(['income', 'expense']),
  body('amount').isFloat({ min: 0.01 }),
  body('category').notEmpty(),
  body('date').optional().isISO8601()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const transaction = await Transaction.create({ ...req.body, userId: req.user._id });
    res.status(201).json(transaction);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/transactions/:id
router.put('/:id', async (req, res) => {
  try {
    const transaction = await Transaction.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!transaction) return res.status(404).json({ message: 'Transaction not found' });
    res.json(transaction);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/transactions/:id
router.delete('/:id', async (req, res) => {
  try {
    const transaction = await Transaction.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!transaction) return res.status(404).json({ message: 'Transaction not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/transactions/summary
router.get('/summary', async (req, res) => {
  try {
    const { month } = req.query; // "2024-01"
    let matchStage = { userId: req.user._id };
    if (month) {
      const [year, m] = month.split('-');
      const start = new Date(year, m - 1, 1);
      const end = new Date(year, m, 0, 23, 59, 59);
      matchStage.date = { $gte: start, $lte: end };
    }
    const summary = await Transaction.aggregate([
      { $match: matchStage },
      { $group: {
        _id: '$type',
        total: { $sum: '$amount' },
        count: { $sum: 1 }
      }}
    ]);
    const categoryBreakdown = await Transaction.aggregate([
      { $match: matchStage },
      { $group: {
        _id: { type: '$type', category: '$category' },
        total: { $sum: '$amount' },
        count: { $sum: 1 }
      }},
      { $sort: { total: -1 } }
    ]);
    res.json({ summary, categoryBreakdown });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
