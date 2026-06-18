const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const emailServicePath = path.join(__dirname, '..', 'src', 'services', 'emailService.js');

const VALID_ENV = {
  EMAIL_SMTP_HOST: 'smtp.example.com',
  EMAIL_SMTP_PORT: '587',
  EMAIL_SMTP_USER: 'test@example.com',
  EMAIL_SMTP_PASS: 'secret',
  EMAIL_FROM_ADDRESS: '"ShareCare" <test@example.com>',
};

// Loads a fresh emailService instance with mocked nodemailer and controlled env vars.
// Deletes the module cache so the lazy transporter reinitialises each test.
function loadEmailService({ envVars = {}, mockSendMail = null } = {}) {
  const savedEnv = {};
  for (const [key, value] of Object.entries(envVars)) {
    savedEnv[key] = process.env[key];
    process.env[key] = value;
  }

  const sentMails = [];
  const defaultSendMail = async (opts) => {
    sentMails.push(opts);
    return { accepted: [opts.to], rejected: [], messageId: '<test-id>' };
  };

  const nodemailerPath = require.resolve('nodemailer');
  const originalNodemailer = require.cache[nodemailerPath];
  require.cache[nodemailerPath] = {
    id: nodemailerPath,
    filename: nodemailerPath,
    loaded: true,
    exports: {
      createTransport: () => ({ sendMail: mockSendMail || defaultSendMail }),
    },
  };

  const resolvedService = require.resolve(emailServicePath);
  delete require.cache[resolvedService];
  const emailService = require(emailServicePath);

  return {
    emailService,
    sentMails,
    restore() {
      delete require.cache[resolvedService];
      if (originalNodemailer) require.cache[nodemailerPath] = originalNodemailer;
      else delete require.cache[nodemailerPath];
      for (const [key, orig] of Object.entries(savedEnv)) {
        if (orig === undefined) delete process.env[key];
        else process.env[key] = orig;
      }
    },
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

test('sendInviteEmail with invite link — subject contains "invited" and body includes the link', async (t) => {
  const { emailService, sentMails, restore } = loadEmailService({ envVars: VALID_ENV });
  t.after(restore);

  await emailService.sendInviteEmail('co@example.com', 'https://app.example.com/invite/abc123');

  assert.equal(sentMails.length, 1);
  assert.match(sentMails[0].subject, /invited/i);
  assert.equal(sentMails[0].to, 'co@example.com');
  assert.ok(sentMails[0].text.includes('https://app.example.com/invite/abc123'));
});

test('sendInviteEmail without invite link — sends delivery-check subject', async (t) => {
  const { emailService, sentMails, restore } = loadEmailService({ envVars: VALID_ENV });
  t.after(restore);

  await emailService.sendInviteEmail('admin@example.com');

  assert.equal(sentMails.length, 1);
  assert.match(sentMails[0].subject, /delivery check/i);
});

test('sendInviteEmail throws a descriptive error when email config is incomplete', async (t) => {
  // Explicitly clear the host vars so the config validator fires
  const { emailService, restore } = loadEmailService({
    envVars: { ...VALID_ENV, EMAIL_SMTP_HOST: '', EMAIL_HOST: '' },
  });
  t.after(restore);

  await assert.rejects(
    () => emailService.sendInviteEmail('x@example.com', 'https://example.com/invite/tok'),
    /Missing/i
  );
});

test('sendInviteEmail throws when toAddress is missing', async (t) => {
  const { emailService, restore } = loadEmailService({ envVars: VALID_ENV });
  t.after(restore);

  await assert.rejects(
    () => emailService.sendInviteEmail(null),
    /recipient email address is required/i
  );
});
