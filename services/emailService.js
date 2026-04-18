const nodemailer = require('nodemailer');

const createTransporter = () => {
  if (process.env.EMAIL_SERVICE === 'gmail') {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });
  }
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });
  }
  return null;
};

const getTestTransporter = async () => {
  const testAccount = await nodemailer.createTestAccount();
  console.log('\n📧 Ethereal test email (dev mode)');
  console.log('   User:', testAccount.user);
  return nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: { user: testAccount.user, pass: testAccount.pass }
  });
};

const otpEmailTemplate = (otp, type, name) => {
  const isRegister = type === 'register';
  const title = isRegister ? 'Verify Your Email' : 'Reset Your Password';
  const subtitle = isRegister
    ? 'Welcome to FinanceApp! Use the OTP below to verify your email.'
    : 'You requested a password reset. Use the OTP below.';
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 20px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">
        <tr><td align="center" style="padding-bottom:32px;">
          <div style="background:#6c63ff;border-radius:14px;padding:12px 20px;display:inline-block;">
            <span style="color:#fff;font-size:20px;font-weight:800;">💰 FinanceApp</span>
          </div>
        </td></tr>
        <tr><td style="background:#1c1c28;border:1px solid #2a2a3a;border-radius:20px;padding:40px 36px;">
          <h1 style="color:#f0f0f8;font-size:26px;font-weight:800;margin:0 0 12px;">${title}</h1>
          <p style="color:#9090aa;font-size:15px;line-height:1.6;margin:0 0 32px;">Hi ${name || 'there'}, ${subtitle}</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
            <tr><td align="center" style="background:#111118;border:2px dashed #6c63ff;border-radius:16px;padding:28px;">
              <p style="color:#9090aa;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:2px;margin:0 0 12px;">Your One-Time Password</p>
              <p style="color:#f0f0f8;font-size:48px;font-weight:800;letter-spacing:16px;margin:0;font-family:'Courier New',monospace;">${otp}</p>
              <p style="color:#5a5a75;font-size:13px;margin:16px 0 0;">⏱ Expires in <strong style="color:#ffb347;">10 minutes</strong></p>
            </td></tr>
          </table>
          <p style="color:#5a5a75;font-size:12px;line-height:1.7;margin:0;">
            🔒 If you did not request this, please ignore this email. Do not share this OTP with anyone.
          </p>
        </td></tr>
        <tr><td align="center" style="padding-top:24px;">
          <p style="color:#3a3a4a;font-size:12px;margin:0;">© ${new Date().getFullYear()} FinanceApp</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
};

const sendOTPEmail = async (email, otp, type, name = '') => {
  try {
    let transporter = createTransporter();
    let isTest = false;
    if (!transporter) { transporter = await getTestTransporter(); isTest = true; }
    const subject = type === 'register' ? '🔐 Verify your FinanceApp account' : '🔑 Reset your FinanceApp password';
    const info = await transporter.sendMail({
      from: `"FinanceApp" <${process.env.EMAIL_USER || 'noreply@financeApp.com'}>`,
      to: email, subject, html: otpEmailTemplate(otp, type, name)
    });
    if (isTest) {
      console.log('\n📧 OTP Email Preview:', nodemailer.getTestMessageUrl(info));
      console.log('   OTP:', otp, '\n');
    }
    return { success: true };
  } catch (err) {
    console.error('Email error:', err.message);
    return { success: false, error: err.message };
  }
};

module.exports = { sendOTPEmail };
