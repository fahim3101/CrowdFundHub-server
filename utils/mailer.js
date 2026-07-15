const nodemailer = require('nodemailer');

// Uses Gmail SMTP with an App Password, so no new third-party account is needed —
// just EMAIL_USER (your Gmail address) and EMAIL_PASS (a 16-char Gmail App Password) in .env.
// If those aren't set, this quietly does nothing so the app still works without email configured.
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendEmail = async ({ to, subject, html }) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return;

  try {
    await transporter.sendMail({
      from: `"CrowdFundHub" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });
  } catch (err) {
    // Never let an email failure break the actual API request
    console.error('Email send failed:', err.message);
  }
};

module.exports = sendEmail;
