/**
 * Seed script - populates DB with sample data for testing
 * Run: node seed.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Transaction = require('./models/Transaction');
const Budget = require('./models/Budget');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/financeapp';

const INCOME_CATS = ['Salary', 'Freelance', 'Investment'];
const EXPENSE_CATS = ['Food & Dining', 'Shopping', 'Transport', 'Housing', 'Healthcare', 'Entertainment', 'Utilities'];

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[rand(0, arr.length - 1)]; }
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d; }

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  // Clean
  await User.deleteMany({ email: 'demo@financeapp.com' });

  // Create demo user
  const user = await User.create({
    name: 'Demo User',
    email: 'demo@financeapp.com',
    password: 'demo123456',
    currency: 'USD'
  });
  console.log('Created user: demo@financeapp.com / demo123456');

  // Create transactions for last 6 months
  const transactions = [];
  for (let monthBack = 0; monthBack < 6; monthBack++) {
    // Monthly salary
    const salaryDate = new Date();
    salaryDate.setMonth(salaryDate.getMonth() - monthBack);
    salaryDate.setDate(1);
    transactions.push({ userId: user._id, type: 'income', amount: rand(4500, 5500), category: 'Salary', date: salaryDate, note: 'Monthly salary' });

    // Freelance some months
    if (Math.random() > 0.4) {
      const d = new Date();
      d.setMonth(d.getMonth() - monthBack);
      d.setDate(rand(5, 20));
      transactions.push({ userId: user._id, type: 'income', amount: rand(300, 1200), category: 'Freelance', date: d, note: 'Client project' });
    }

    // 15-25 expenses per month
    const numExpenses = rand(15, 25);
    for (let i = 0; i < numExpenses; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() - monthBack);
      d.setDate(rand(1, 28));
      const cat = pick(EXPENSE_CATS);
      const amounts = {
        'Food & Dining': [15, 120], 'Shopping': [20, 200], 'Transport': [10, 80],
        'Housing': [800, 1500], 'Healthcare': [30, 200], 'Entertainment': [20, 100], 'Utilities': [60, 180]
      };
      const [min, max] = amounts[cat] || [20, 100];
      transactions.push({ userId: user._id, type: 'expense', amount: rand(min, max), category: cat, date: d });
    }
  }
  await Transaction.insertMany(transactions);
  console.log(`Created ${transactions.length} transactions`);

  // Budget for current month
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  await Budget.create({
    userId: user._id, month, totalBudget: 3500,
    categoryBudgets: [
      { category: 'Food & Dining', amount: 600 },
      { category: 'Shopping', amount: 400 },
      { category: 'Transport', amount: 200 },
      { category: 'Entertainment', amount: 250 },
      { category: 'Utilities', amount: 200 },
    ]
  });
  console.log('Created budget');

  console.log('\n✅ Seed complete!');
  console.log('Login: demo@financeapp.com / demo123456');
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
