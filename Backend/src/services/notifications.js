// ─────────────────────────────────────────────
// BuyerIQ — Notification Service
// ─────────────────────────────────────────────
// Channels: Email (Nodemailer/SMTP) + WhatsApp (Twilio)
//
// Setup:
//   Email: Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
//   WhatsApp: Set TWILIO_SID, TWILIO_TOKEN, TWILIO_WHATSAPP_FROM
// ─────────────────────────────────────────────
import nodemailer from 'nodemailer';
import { logger as log } from '../config/logger.js';

// Logger imported from config

// ── Email Transport ──────────────────────────
let emailTransport = null;

function getEmailTransport() {
  if (emailTransport) return emailTransport;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    log.warn('Email not configured — set SMTP_HOST, SMTP_USER, SMTP_PASS');
    return null;
  }

  emailTransport = nodemailer.createTransport({
    host, port,
    secure: port === 465,
    auth: { user, pass },
  });

  return emailTransport;
}

// ── Send Email ───────────────────────────────
export async function sendEmail({ to, subject, body, html }) {
  const transport = getEmailTransport();
  if (!transport) {
    log.warn(`Email skipped (not configured): ${subject} → ${to}`);
    return { success: false, error: 'Email not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS env vars.' };
  }

  try {
    const from = process.env.SMTP_FROM || process.env.SMTP_USER;
    const result = await transport.sendMail({
      from: `"BuyerIQ" <${from}>`,
      to,
      subject: `[BuyerIQ] ${subject}`,
      text: body || '',
      html: html || body || '',
    });

    log.info(`Email sent: ${subject} → ${to} (${result.messageId})`);
    return { success: true, messageId: result.messageId };
  } catch (err) {
    log.error(`Email failed: ${subject} → ${to}: ${err.message}`);
    return { success: false, error: err.message };
  }
}

// ── Send WhatsApp (via Twilio) ───────────────
export async function sendWhatsApp({ to, body }) {
  const sid = process.env.TWILIO_SID;
  const token = process.env.TWILIO_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM; // e.g., "whatsapp:+14155238886"

  if (!sid || !token || !from) {
    log.warn(`WhatsApp skipped (not configured): → ${to}`);
    return { success: false, error: 'WhatsApp not configured. Set TWILIO_SID, TWILIO_TOKEN, TWILIO_WHATSAPP_FROM env vars.' };
  }

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
    const auth = Buffer.from(`${sid}:${token}`).toString('base64');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: from,
        To: `whatsapp:${to}`,
        Body: body,
      }),
    });

    const result = await response.json();

    if (response.ok) {
      log.info(`WhatsApp sent → ${to} (${result.sid})`);
      return { success: true, sid: result.sid };
    } else {
      log.error(`WhatsApp failed → ${to}: ${result.message}`);
      return { success: false, error: result.message };
    }
  } catch (err) {
    log.error(`WhatsApp failed → ${to}: ${err.message}`);
    return { success: false, error: err.message };
  }
}

// ── Send Alert Notification ──────────────────
// Called by AI engine when critical alert is generated
export async function sendAlertNotification(alert) {
  const adminEmail = process.env.ALERT_NOTIFY_EMAIL || process.env.SMTP_USER;
  const adminWhatsApp = process.env.ALERT_NOTIFY_WHATSAPP;

  const subject = `${alert.urgency?.toUpperCase()} Alert: ${alert.title}`;
  const body = `
BuyerIQ Alert
─────────────────
Type: ${alert.type}
Urgency: ${alert.urgency}
Title: ${alert.title}

${alert.message}

─────────────────
Generated: ${new Date().toLocaleString()}
BuyerIQ — Senses Lifestyle
  `.trim();

  const results = {};

  // Email
  if (adminEmail) {
    results.email = await sendEmail({ to: adminEmail, subject, body });
  }

  // WhatsApp (critical only)
  if (adminWhatsApp && (alert.urgency === 'critical' || alert.urgency === 'high')) {
    results.whatsapp = await sendWhatsApp({
      to: adminWhatsApp,
      body: `🚨 *BuyerIQ ${alert.urgency?.toUpperCase()}*\n\n${alert.title}\n\n${alert.message?.slice(0, 500)}`,
    });
  }

  return results;
}

// ── Notification Status ──────────────────────
export function getNotificationStatus() {
  return {
    email: {
      configured: !!(process.env.SMTP_HOST && process.env.SMTP_USER),
      host: process.env.SMTP_HOST || null,
      from: process.env.SMTP_FROM || process.env.SMTP_USER || null,
    },
    whatsapp: {
      configured: !!(process.env.TWILIO_SID && process.env.TWILIO_TOKEN),
      from: process.env.TWILIO_WHATSAPP_FROM || null,
    },
    alert_recipients: {
      email: process.env.ALERT_NOTIFY_EMAIL || process.env.SMTP_USER || null,
      whatsapp: process.env.ALERT_NOTIFY_WHATSAPP || null,
    },
  };
}
