const nodemailer = require('nodemailer');

let transporter;


// EMAIL_SMTP_* is the current contract; EMAIL_* is the legacy name.
// Safe to remove the EMAIL_* fallbacks once all deployed envs use EMAIL_SMTP_*.
function getEmailConfig() {
  const port = Number(process.env.EMAIL_SMTP_PORT || process.env.EMAIL_PORT || 465);
  const secureFlag = process.env.EMAIL_SMTP_SECURE;
  const secure = typeof secureFlag === 'string'
    ? secureFlag.toLowerCase() !== 'false'
    : port === 465;

  const config = {
    host: process.env.EMAIL_SMTP_HOST || process.env.EMAIL_HOST,
    port,
    secure,
    user: process.env.EMAIL_SMTP_USER || process.env.EMAIL_USER,
    pass: process.env.EMAIL_SMTP_PASS || process.env.EMAIL_PASS,
    from: process.env.EMAIL_FROM_ADDRESS
      || (process.env.EMAIL_SMTP_USER || process.env.EMAIL_USER
      ? `"ShareCare" <${process.env.EMAIL_SMTP_USER || process.env.EMAIL_USER}>`
      : null),
    replyTo: process.env.EMAIL_REPLY_TO || undefined,
  };

  const missing = Object.entries({
    EMAIL_HOST: config.host,
    EMAIL_USER: config.user,
    EMAIL_PASS: config.pass,
    EMAIL_FROM_ADDRESS: config.from,
  })
  .filter(([, value]) => !value)
  .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`Email service is not configured. Missing: ${missing.join(', ')}`);
  }

  if (Number.isNaN(config.port)) {
    throw new Error('Email port must be a valid number');
  }

  return config;
}

// Lazy init: creating the transporter at module-load time throws if env vars aren't set yet,
// which breaks any route that imports this service during test/CI startup.
function getTransporter() {
  if (!transporter) {
    const config = getEmailConfig();
    transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });
  }

  return transporter;
}

async function sendInviteEmail(toAddress, inviteLink) {
  if (!toAddress) {
    throw new Error('A recipient email address is required');
  }

  const config = getEmailConfig();
  const hasInviteLink = typeof inviteLink === 'string' && inviteLink.trim().length > 0;

  const result = await getTransporter().sendMail({
    from: config.from,
    to: toAddress,
    replyTo: config.replyTo,
    subject: hasInviteLink
      ? 'You have been invited to ShareCare'
      : 'ShareCare email delivery check',
    text: hasInviteLink
      ? `You have been invited to collaborate on a ShareCare parenting plan.\n\nAccept your invitation here:\n${inviteLink}\n\nThis link expires in 7 days.`
      : 'This is a test email from ShareCare using Gmail SMTP.',
    html: hasInviteLink
      ? `
        <p>You have been invited to collaborate on a <strong>ShareCare</strong> parenting plan.</p>
        <p><a href="${inviteLink}">Accept your invitation</a></p>
        <p>This link expires in 7 days.</p>
      `
      : '<p>This is a test email from <strong>ShareCare</strong> using Gmail SMTP.</p>',
    });

  return {
    accepted: result.accepted,
    rejected: result.rejected,
    messageId: result.messageId,
  };
}

module.exports = { sendInviteEmail };