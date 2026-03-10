import nodemailer from 'nodemailer';

const smtpHost = process.env.SMTP_HOST;
const smtpPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const mailFrom = process.env.MAIL_FROM || smtpUser;

// Optional: separate SMTP for payment-related emails (10%, 40% payment request/approval)
const paymentSmtpHost = process.env.PAYMENT_SMTP_HOST;
const paymentSmtpPort = process.env.PAYMENT_SMTP_PORT ? Number(process.env.PAYMENT_SMTP_PORT) : 587;
const paymentSmtpUser = process.env.PAYMENT_SMTP_USER;
const paymentSmtpPass = process.env.PAYMENT_SMTP_PASS;
const paymentMailFrom = process.env.PAYMENT_MAIL_FROM || paymentSmtpUser;

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

const paymentTransporter =
  paymentSmtpHost && paymentSmtpUser && paymentSmtpPass
    ? nodemailer.createTransport({
        host: paymentSmtpHost,
        port: paymentSmtpPort,
        secure: paymentSmtpPort === 465,
        auth: {
          user: paymentSmtpUser,
          pass: paymentSmtpPass,
        },
      })
    : null;

export type MailAttachment = {
  filename: string;
  content: string | Buffer;
  encoding?: 'base64';
};

export type SendMailOptions = {
  to: string | string[];
  subject: string;
  html: string;
  cc?: string | string[];
  attachments?: MailAttachment[];
};

export async function sendMail(options: SendMailOptions) {
  if (!smtpHost || !smtpUser || !smtpPass) {
    throw new Error('SMTP configuration missing. Please set SMTP_HOST, SMTP_USER, SMTP_PASS.');
  }

  const msg: nodemailer.SendMailOptions = {
    from: mailFrom,
    to: options.to,
    subject: options.subject,
    html: options.html,
  };
  if (options.cc && (Array.isArray(options.cc) ? options.cc.length : options.cc)) {
    msg.cc = options.cc;
  }
  if (options.attachments && options.attachments.length > 0) {
    msg.attachments = options.attachments.map((a) => ({
      filename: a.filename,
      content: a.content,
      encoding: a.encoding,
    }));
  }

  const info = await transporter.sendMail(msg);
  return info;
}

/**
 * Send email using the payment-dedicated SMTP (when PAYMENT_SMTP_* is set).
 * Falls back to default sendMail() if payment SMTP is not configured.
 */
export async function sendMailForPayment(options: SendMailOptions) {
  if (paymentTransporter && paymentMailFrom) {
    const msg: nodemailer.SendMailOptions = {
      from: paymentMailFrom,
      to: options.to,
      subject: options.subject,
      html: options.html,
    };
    if (options.cc && (Array.isArray(options.cc) ? options.cc.length : options.cc)) {
      msg.cc = options.cc;
    }
    if (options.attachments && options.attachments.length > 0) {
      msg.attachments = options.attachments.map((a) => ({
        filename: a.filename,
        content: a.content,
        encoding: a.encoding,
      }));
    }
    return paymentTransporter.sendMail(msg);
  }
  return sendMail(options);
}

