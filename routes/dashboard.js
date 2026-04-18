const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const { protect } = require('../middleware/auth');

router.use(protect);

// GET /api/dashboard/overview
router.get('/overview', async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const [thisMonth, lastMonth] = await Promise.all([
      Transaction.aggregate([
        { $match: { userId: req.user._id, date: { $gte: startOfMonth, $lte: endOfMonth } } },
        { $group: { _id: '$type', total: { $sum: '$amount' } } }
      ]),
      Transaction.aggregate([
        { $match: { userId: req.user._id, date: { $gte: startOfLastMonth, $lte: endOfLastMonth } } },
        { $group: { _id: '$type', total: { $sum: '$amount' } } }
      ])
    ]);

    const fmt = (arr) => {
      const income = arr.find(x => x._id === 'income')?.total || 0;
      const expense = arr.find(x => x._id === 'expense')?.total || 0;
      return { income, expense, balance: income - expense };
    };

    // Monthly trend (last 6 months)
    const trend = await Transaction.aggregate([
      {
        $match: {
          userId: req.user._id,
          date: { $gte: new Date(now.getFullYear(), now.getMonth() - 5, 1) }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' },
            type: '$type'
          },
          total: { $sum: '$amount' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Recent transactions
    const recent = await Transaction.find({ userId: req.user._id })
      .sort('-date').limit(5);

    // Category breakdown this month
    const categoryBreakdown = await Transaction.aggregate([
      { $match: { userId: req.user._id, type: 'expense', date: { $gte: startOfMonth, $lte: endOfMonth } } },
      { $group: { _id: '$category', total: { $sum: '$amount' } } },
      { $sort: { total: -1 } },
      { $limit: 6 }
    ]);

    res.json({
      thisMonth: fmt(thisMonth),
      lastMonth: fmt(lastMonth),
      trend,
      recent,
      categoryBreakdown
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
