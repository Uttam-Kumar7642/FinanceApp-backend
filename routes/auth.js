const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const OTP = require('../models/OTP');
const { protect } = require('../middleware/auth');
const { sendOTPEmail } = require('../services/emailService');

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '30d' });

const generateOTP = () => crypto.randomInt(100000, 999999).toString();

// STEP 1 — Send OTP for Registration
router.post('/send-register-otp', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password min 6 chars')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { name, email, password } = req.body;
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: 'Email already registered. Please login.' });
    await OTP.deleteMany({ email, type: 'register' });
    const otp = generateOTP();
    await OTP.create({ email, otp, type: 'register' });
    const result = await sendOTPEmail(email, otp, 'register', name);
    res.json({
      success: true,
      message: `OTP sent to ${email}. Valid for 10 minutes.`,
      ...(process.env.NODE_ENV === 'development' && { devOtp: otp })
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// STEP 2 — Verify OTP & Complete Registration
router.post('/verify-register-otp', [
  body('email').isEmail(),
  body('otp').isLength({ min: 6, max: 6 }),
  body('name').trim().notEmpty(),
  body('password').isLength({ min: 6 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { email, otp, name, password } = req.body;
    const otpRecord = await OTP.findOne({ email, type: 'register', verified: false });
    if (!otpRecord) return res.status(400).json({ message: 'OTP not found. Request a new one.' });
    if (new Date() > otpRecord.expiresAt) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({ message: 'OTP expired. Request a new one.' });
    }
    if (otpRecord.attempts >= 5) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({ message: 'Too many attempts. Request a new OTP.' });
    }
    if (otpRecord.otp !== otp) {
      await OTP.updateOne({ _id: otpRecord._id }, { $inc: { attempts: 1 } });
      const remaining = 4 - otpRecord.attempts;
      return res.status(400).json({ message: `Invalid OTP. ${remaining} attempts remaining.` });
    }
    await OTP.deleteOne({ _id: otpRecord._id });
    const user = await User.create({ name, email, password });
    res.status(201).json({
      _id: user._id, name: user.name, email: user.email,
      currency: user.currency, token: generateToken(user._id)
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// LOGIN
router.post('/login', [
  body('email').isEmail(),
  body('password').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    res.json({
      _id: user._id, name: user.name, email: user.email,
      currency: user.currency, token: generateToken(user._id)
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// FORGOT PASSWORD — Step 1: Send OTP
router.post('/forgot-password', [
  body('email').isEmail()
], async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.json({ success: true, message: `If ${email} is registered, an OTP has been sent.` });
    await OTP.deleteMany({ email, type: 'forgot-password' });
    const otp = generateOTP();
    await OTP.create({ email, otp, type: 'forgot-password' });
    await sendOTPEmail(email, otp, 'forgot-password', user.name);
    res.json({
      success: true,
      message: `OTP sent to ${email}. Valid for 10 minutes.`,
      ...(process.env.NODE_ENV === 'development' && { devOtp: otp })
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// FORGOT PASSWORD — Step 2: Verify OTP
router.post('/verify-reset-otp', [
  body('email').isEmail(),
  body('otp').isLength({ min: 6, max: 6 })
], async (req, res) => {
  try {
    const { email, otp } = req.body;
    const otpRecord = await OTP.findOne({ email, type: 'forgot-password', verified: false });
    if (!otpRecord) return res.status(400).json({ message: 'OTP not found. Request a new one.' });
    if (new Date() > otpRecord.expiresAt) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({ message: 'OTP expired. Request a new one.' });
    }
    if (otpRecord.attempts >= 5) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({ message: 'Too many attempts. Request a new OTP.' });
    }
    if (otpRecord.otp !== otp) {
      await OTP.updateOne({ _id: otpRecord._id }, { $inc: { attempts: 1 } });
      return res.status(400).json({ message: `Invalid OTP. ${4 - otpRecord.attempts} attempts remaining.` });
    }
    await OTP.updateOne({ _id: otpRecord._id }, { verified: true });
    const resetToken = jwt.sign(
      { email, purpose: 'reset' },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '15m' }
    );
    res.json({ success: true, resetToken, message: 'OTP verified. Set your new password.' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// FORGOT PASSWORD — Step 3: Reset Password
router.post('/reset-password', [
  body('resetToken').notEmpty(),
  body('newPassword').isLength({ min: 6 })
], async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;
    let decoded;
    try {
      decoded = jwt.verify(resetToken, process.env.JWT_SECRET || 'fallback_secret');
    } catch {
      return res.status(400).json({ message: 'Reset token invalid or expired. Start over.' });
    }
    if (decoded.purpose !== 'reset') return res.status(400).json({ message: 'Invalid token.' });
    const otpRecord = await OTP.findOne({ email: decoded.email, type: 'forgot-password', verified: true });
    if (!otpRecord) return res.status(400).json({ message: 'Session expired. Please start over.' });
    const user = await User.findOne({ email: decoded.email });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    user.password = newPassword;
    await user.save();
    await OTP.deleteOne({ _id: otpRecord._id });
    res.json({ success: true, message: 'Password reset successfully! You can now login.' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// RESEND OTP
router.post('/resend-otp', [
  body('email').isEmail(),
  body('type').isIn(['register', 'forgot-password'])
], async (req, res) => {
  try {
    const { email, type } = req.body;
    const recent = await OTP.findOne({ email, type }).sort({ createdAt: -1 });
    if (recent) {
      const secondsAgo = (Date.now() - new Date(recent.createdAt)) / 1000;
      if (secondsAgo < 60) {
        return res.status(429).json({ message: `Wait ${Math.ceil(60 - secondsAgo)}s before requesting again.` });
      }
    }
    await OTP.deleteMany({ email, type });
    const otp = generateOTP();
    await OTP.create({ email, otp, type });
    const user = await User.findOne({ email });
    await sendOTPEmail(email, otp, type, user?.name || '');
    res.json({
      success: true, message: 'New OTP sent.',
      ...(process.env.NODE_ENV === 'development' && { devOtp: otp })
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET ME
router.get('/me', protect, async (req, res) => {
  try { res.json(req.user); }
  catch (err) { res.status(500).json({ message: err.message }); }
});

// UPDATE PROFILE
router.put('/profile', protect, async (req, res) => {
  try {
    const { name, currency } = req.body;
    const user = await User.findByIdAndUpdate(req.user._id, { name, currency }, { new: true });
    res.json(user);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
