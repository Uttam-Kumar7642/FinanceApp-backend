const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true, trim: true },
  otp: { type: String, required: true },
  type: { type: String, enum: ['register', 'forgot-password'], required: true },
  expiresAt: { type: Date, required: true, default: () => new Date(Date.now() + 10 * 60 * 1000) },
  verified: { type: Boolean, default: false },
  attempts: { type: Number, default: 0 }
}, { timestamps: true });

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
otpSchema.index({ email: 1, type: 1 });

module.exports = mongoose.model('OTP', otpSchema);
