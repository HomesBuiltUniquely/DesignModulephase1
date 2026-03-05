import nodemailer from 'nodemailer';

const smtpHost = process.env.SMTP_HOST;
const smtpPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const mailFrom = process.env.MAIL_FROM || smtpUser;

if (!smtpHost || !smtpUser || !smtpPass) {
  // eslint-disable-next-line no-console
  console.warn('[mailer] SMTP configuration is incomplete. Emails will fail until env is set.');
}

export const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpPort === 465,
  auth: {
    user: smtpUser,
    pass: smtpPass,
  },
});

export type SendMailOptions = {
  to: string | string[];
  subject: string;
  html: string;
};

export async function sendMail(options: SendMailOptions) {
  if (!smtpHost || !smtpUser || !smtpPass) {
    throw new Error('SMTP configuration missing. Please set SMTP_HOST, SMTP_USER, SMTP_PASS.');
  }

  const info = await transporter.sendMail({
    from: mailFrom,
    to: options.to,
    subject: options.subject,
    html: options.html,
  });

  return info;
}

