const express = require('express');
const router = express.Router();
const Budget = require('../models/Budget');
const Transaction = require('../models/Transaction');
const { protect } = require('../middleware/auth');

router.use(protect);

// GET /api/budgets
router.get('/', async (req, res) => {
  try {
    const budgets = await Budget.find({ userId: req.user._id }).sort('-month');
    res.json(budgets);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/budgets/:month
router.get('/:month', async (req, res) => {
  try {
    const budget = await Budget.findOne({ userId: req.user._id, month: req.params.month });
    if (!budget) return res.status(404).json({ message: 'Budget not found' });

    // Get actual spending for this month
    const [year, m] = req.params.month.split('-');
    const start = new Date(year, m - 1, 1);
    const end = new Date(year, m, 0, 23, 59, 59);

    const spending = await Transaction.aggregate([
      { $match: { userId: req.user._id, type: 'expense', date: { $gte: start, $lte: end } } },
      { $group: { _id: '$category', spent: { $sum: '$amount' } } }
    ]);

    const totalSpent = spending.reduce((acc, s) => acc + s.spent, 0);
    res.json({ budget, spending, totalSpent });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/budgets
router.post('/', async (req, res) => {
  try {
    const existing = await Budget.findOne({ userId: req.user._id, month: req.body.month });
    if (existing) {
      const updated = await Budget.findByIdAndUpdate(existing._id, req.body, { new: true });
      return res.json(updated);
    }
    const budget = await Budget.create({ ...req.body, userId: req.user._id });
    res.status(201).json(budget);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/budgets/:id
router.delete('/:id', async (req, res) => {
  try {
    await Budget.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
