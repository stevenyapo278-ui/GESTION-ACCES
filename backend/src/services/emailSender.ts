import nodemailer from 'nodemailer';
import prisma from '../lib/prisma';
import { graphFetch } from './graphClient';
import { resolveFrontendUrl, getNotificationEmails } from './systemSettings';
import { requestDataPairs, attachmentBaseName } from './requestData';
import { buildRequestPdf } from './pdfGenerator';

export interface EmailAttachment {
  filename: string;
  contentType: string;
  content: string | Buffer;
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  bodyHtml: string;
  attachments?: EmailAttachment[];
}

// Sélection du compte d'envoi : priorité au compte Outlook (Graph API) par défaut,
// sinon Outlook actif, sinon SMTP par défaut, sinon SMTP actif.
export async function pickAccount() {
  let account = await prisma.emailAccount.findFirst({
    where: { provider: 'OUTLOOK', isActive: true, isDefault: true, refreshToken: { not: null } },
  });
  if (!account) {
    account = await prisma.emailAccount.findFirst({
      where: { provider: 'OUTLOOK', isActive: true, refreshToken: { not: null } },
    });
  }
  const isOutlook = !!account;

  if (!account) {
    account = await prisma.emailAccount.findFirst({
      where: { provider: 'IMAP_SMTP', isActive: true, isDefault: true, smtpHost: { not: null } },
    });
  }
  if (!account) {
    account = await prisma.emailAccount.findFirst({
      where: { provider: 'IMAP_SMTP', isActive: true, smtpHost: { not: null } },
    });
  }

  if (!account) throw new Error("Aucun compte email configuré pour l'envoi (Outlook/M365 ou SMTP)");
  return { account, isOutlook };
}

// Un compte peut recevoir les réponses par email si c'est un compte Outlook (Graph)
// ou si ses identifiants IMAP sont renseignés.
export function canMonitorReplies(account: any): boolean {
  return account?.provider === 'OUTLOOK' || !!account?.imapHost;
}

// Référence courte dérivée du jeton de décision, insérée dans l'objet des emails de
// validation pour retrouver la demande quand le supérieur répond à l'email.
export const REPLY_REF_PATTERN = /\[Réf:\s*([A-Fa-f0-9]{6,12})\]/;

export function replyRefOf(request: { decisionToken: string }): string {
  return request.decisionToken.replace(/-/g, '').slice(-8).toUpperCase();
}

// Envoi via SMTP générique (nodemailer)
async function sendEmailViaSmtp(account: any, { to, subject, bodyHtml, attachments }: SendEmailOptions) {
  const transporter = nodemailer.createTransport({
    host: account.smtpHost,
    port: account.smtpPort || 587,
    secure: account.useTls === false ? false : account.smtpPort === 465,
    auth: { user: account.username, pass: account.password },
  });
  await transporter.sendMail({
    from: account.emailAddress,
    to: Array.isArray(to) ? to.join(', ') : to,
    subject,
    html: bodyHtml,
    attachments: (attachments || []).map((a) => ({ filename: a.filename, contentType: a.contentType, content: a.content })),
  });
}

// Envoi via Microsoft Graph API (Outlook / Microsoft 365)
async function sendEmailViaGraph(account: any, { to, subject, bodyHtml, attachments }: SendEmailOptions) {
  const toRecipients = (Array.isArray(to) ? to : [to]).map((addr) => ({ emailAddress: { address: addr } }));
  const message = {
    subject,
    body: { contentType: 'HTML', content: bodyHtml },
    toRecipients,
    attachments: (attachments || []).map((a) => ({
      '@odata.type': '#microsoft.graph.fileAttachment',
      name: a.filename,
      contentType: a.contentType,
      contentBytes: Buffer.isBuffer(a.content) ? a.content.toString('base64') : Buffer.from(a.content).toString('base64'),
    })),
  };
  const draft = await graphFetch(account, '/me/messages', { method: 'POST', body: JSON.stringify(message) });
  await graphFetch(account, `/me/messages/${draft.id}/send`, { method: 'POST' });
}

export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const { account, isOutlook } = await pickAccount();
  if (isOutlook) {
    await sendEmailViaGraph(account, options);
  } else {
    await sendEmailViaSmtp(account, options);
  }
}

// Version interne acceptant un compte déjà sélectionné (évite de le re-résoudre)
export async function sendEmailWith(picked: { account: any; isOutlook: boolean }, options: SendEmailOptions): Promise<void> {
  if (picked.isOutlook) {
    await sendEmailViaGraph(picked.account, options);
  } else {
    await sendEmailViaSmtp(picked.account, options);
  }
}

// === Templates des demandes ===

const APP_NAME = 'Gestions Access';

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface EmailAction {
  href: string;
  label: string;
  bg: string;
}

interface EmailRow {
  label: string;
  value: string;
}

interface EmailLayoutOptions {
  title: string;
  badge?: { text: string; bg: string; color: string } | null;
  paragraphs: string[];
  rows: EmailRow[];
  actions?: EmailAction[];
  footerNote?: string;
  footerLink?: { href: string; label: string };
  notice?: { title: string; body: string } | null;
  preheader: string;
}

function actionButtons(actions: EmailAction[]): string {
  return actions
    .map(
      (a) => `
      <table role="presentation" cellpadding="0" cellspacing="0" style="display:inline-block;margin:2px 8px 2px 0;">
        <tr>
          <td style="border-radius:10px;background:${a.bg};">
            <a href="${a.href}" style="display:inline-block;padding:12px 24px;border-radius:10px;font-family:'Segoe UI',Arial,sans-serif;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;line-height:1.4;">${a.label}</a>
          </td>
        </tr>
      </table>`
    )
    .join('');
}

function rowsHtml(rows: EmailRow[]): string {
  if (!rows.length) return '<tr><td style="padding:10px 0;color:#64748b;font-size:13px;font-family:\'Segoe UI\',Arial,sans-serif;">—</td></tr>';
  return rows
    .map(
      (r) => `
      <tr>
        <td class="row-label" width="35%" style="padding:9px 12px 9px 0;border-bottom:1px solid #eef2f7;color:#64748b;font-size:13px;font-family:'Segoe UI',Arial,sans-serif;vertical-align:top;">${r.label}</td>
        <td class="row-value" style="padding:9px 0;border-bottom:1px solid #eef2f7;color:#0f172a;font-size:13px;font-weight:600;font-family:'Segoe UI',Arial,sans-serif;vertical-align:top;word-break:break-word;">${r.value}</td>
      </tr>`
    )
    .join('');
}

function emailLayout(opts: EmailLayoutOptions): string {
  const { title, badge, paragraphs, rows, actions, footerNote, footerLink, notice, preheader } = opts;
  const badgeHtml = badge
    ? `<span class="badge" style="display:inline-block;margin:0 0 14px;background:${badge.bg};color:${badge.color};padding:5px 14px;border-radius:999px;font-size:12px;font-weight:700;font-family:'Segoe UI',Arial,sans-serif;">${badge.text}</span>`
    : '';
  const paragraphsHtml = paragraphs
    .map(
      (p) =>
        `<p class="paragraph" style="margin:0 0 10px;color:#475569;font-size:14px;line-height:1.6;font-family:'Segoe UI',Arial,sans-serif;">${p}</p>`
    )
    .join('\n');
  const actionsHtml = actions?.length
    ? `<div style="margin:24px 0 6px;">${actionButtons(actions)}</div>`
    : '';
  const noticeHtml = notice
    ? `<div class="notice" style="margin-top:20px;background:#fffbeb;border:1px solid #fde68a;border-left:4px solid #d29922;border-radius:10px;padding:12px 16px;">
        <p style="margin:0 0 4px;color:#92400e;font-size:13px;font-weight:700;font-family:'Segoe UI',Arial,sans-serif;">${notice.title}</p>
        <p style="margin:0;color:#78350f;font-size:13px;line-height:1.6;font-family:'Segoe UI',Arial,sans-serif;">${notice.body}</p>
      </div>`
    : '';
  const footerLinkHtml = footerLink
    ? `<p style="margin:14px 0 0;"><a href="${footerLink.href}" style="color:#2563eb;text-decoration:underline;font-family:'Segoe UI',Arial,sans-serif;font-size:13px;">${footerLink.label}</a></p>`
    : '';
  const footerNoteHtml = footerNote
    ? `<p class="footer-note" style="margin:14px 0 0;color:#94a3b8;font-size:12px;line-height:1.5;font-family:'Segoe UI',Arial,sans-serif;">${footerNote}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${title}</title>
<style>
  @media (prefers-color-scheme: dark) {
    .body { background-color: #0b1220 !important; }
    .card { background-color: #111827 !important; }
    .title { color: #f9fafb !important; }
    .paragraph { color: #9ca3af !important; }
    .row-label { color: #9ca3af !important; }
    .row-value { color: #f3f4f6 !important; }
    .footer-note { color: #6b7280 !important; }
    .notice { background-color: #1a1a24 !important; border-color: #3f3f46 !important; }
  }
</style>
</head>
<body class="body" style="margin:0;padding:0;background-color:#f1f5f9;-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:24px 12px;">
  <tr>
    <td align="center">
      <table class="card" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
        <tr>
          <td style="background:#0f172a;background-image:linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%);padding:22px 32px;">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td style="vertical-align:middle;">
                  <div style="width:42px;height:42px;background:#d29922;border-radius:11px;text-align:center;font-family:'Segoe UI',Arial,sans-serif;font-size:18px;font-weight:800;color:#ffffff;line-height:42px;">GA</div>
                </td>
                <td style="padding-left:14px;vertical-align:middle;">
                  <div style="color:#ffffff;font-size:17px;font-weight:700;font-family:'Segoe UI',Arial,sans-serif;">${APP_NAME}</div>
                  <div style="color:#94a3b8;font-size:12px;font-family:'Segoe UI',Arial,sans-serif;">Gestion des accès et des demandes</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px 6px;">
            ${badgeHtml}
            <h1 class="title" style="margin:0 0 14px;color:#0f172a;font-size:20px;font-weight:700;font-family:'Segoe UI',Arial,sans-serif;">${title}</h1>
            ${paragraphsHtml}
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 0;border-collapse:collapse;">
              ${rowsHtml(rows)}
            </table>
            ${actionsHtml}
            ${noticeHtml}
          </td>
        </tr>
        <tr>
          <td class="footer" style="padding:18px 32px 26px;border-top:1px solid #eef2f7;color:#94a3b8;font-size:12px;line-height:1.6;font-family:'Segoe UI',Arial,sans-serif;">
            ${footerNoteHtml}
            ${footerLinkHtml}
            <p style="margin:14px 0 0;">Ceci est un message automatique envoyé par <strong style="color:#64748b;">${APP_NAME}</strong>. Merci de ne pas y répondre.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`.trim();
}

// Pièce jointe PDF récapitulative des informations renseignées par l'utilisateur
export async function requestAttachment(request: any): Promise<EmailAttachment> {
  const buffer = await buildRequestPdf(request);
  return { filename: `${attachmentBaseName(request)}.pdf`, contentType: 'application/pdf', content: buffer };
}

function requestRows(request: any): EmailRow[] {
  const pairs = requestDataPairs(request);
  const requesterEmail = request.requesterEmail || request.requester?.email || '';
  return pairs.map(({ label, value }) => {
    // Le demandeur garde sa forme enrichie (email atténué dans le mail)
    const isRequester = label === 'Demandeur' && requesterEmail;
    return {
      label: escapeHtml(label),
      value: isRequester
        ? `${escapeHtml(value.split(' (')[0])} <span style="font-weight:400;color:#64748b;">(${escapeHtml(requesterEmail)})</span>`
        : escapeHtml(value),
    };
  });
}

function decisionRows(request: any): EmailRow[] {
  const rows = requestRows(request);
  rows.push({ label: 'Supérieur', value: escapeHtml(request.superiorEmail) });
  if (request.decisionComment) rows.push({ label: 'Commentaire', value: escapeHtml(request.decisionComment) });
  rows.push({
    label: 'Décision le',
    value: escapeHtml(request.decidedAt ? new Date(request.decidedAt).toLocaleString('fr-FR') : '-'),
  });
  return rows;
}

// Email envoyé au supérieur hiérarchique avec les boutons Valider / Refuser
export async function sendRequestToSuperior(request: any): Promise<void> {
  const frontendUrl = await resolveFrontendUrl();
  const picked = await pickAccount();
  const reviewUrl = `${frontendUrl}/requests/review/${request.decisionToken}`;
  const requesterName = request.requesterName
    || (request.requester ? `${request.requester.firstName} ${request.requester.lastName}` : 'l\'utilisateur');
  const typeName = request.type?.name || 'Demande';
  const replyRef = replyRefOf(request);
  const subject = `[Validation][Réf: ${replyRef}] Demande de ${requesterName} — ${typeName}`;

  const bodyHtml = emailLayout({
    title: 'Demande de validation',
    preheader: `${requesterName} a soumis une demande qui requiert votre validation.`,
    paragraphs: [
      'Bonjour,',
      `${escapeHtml(requesterName)} a soumis une demande qui requiert votre validation. Voici le récapitulatif :`,
    ],
    rows: requestRows(request),
    actions: [
      { href: `${reviewUrl}?action=approve`, label: '✓ Valider', bg: '#16a34a' },
      { href: `${reviewUrl}?action=reject`, label: '✗ Refuser', bg: '#dc2626' },
    ],
    notice: canMonitorReplies(picked.account)
      ? {
          title: 'Réponse par email (sans ouvrir l’application)',
          body: 'Répondez simplement à cet email en écrivant VALIDER ou REFUSER (suivi de votre commentaire si vous le souhaitez) : votre réponse sera traitée automatiquement.',
        }
      : null,
    footerNote: 'Ce lien est à usage unique. La première réponse enregistrée fera foi.',
  });
  await sendEmailWith(picked, { to: request.superiorEmail, subject, bodyHtml });
}

// Email de notification au demandeur après la décision du supérieur
export async function sendRequestDecisionToRequester(request: any): Promise<void> {
  const requesterEmail = request.requesterEmail || request.requester?.email;
  if (!requesterEmail) return;

  const approved = request.status === 'APPROVED';
  const typeName = request.type?.name || 'Demande';
  const subject = `${approved ? '✅' : '❌'} Votre demande ${approved ? 'a été validée' : 'a été refusée'} — ${typeName}`;
  const badge = approved
    ? { text: 'Validée', bg: '#dcfce7', color: '#166534' }
    : { text: 'Refusée', bg: '#fee2e2', color: '#991b1b' };
  const frontendUrl = await resolveFrontendUrl();

  const bodyHtml = emailLayout({
    title: 'Décision sur votre demande',
    badge,
    preheader: `Votre demande a été ${approved ? 'validée' : 'refusée'} par votre supérieur.`,
    paragraphs: ['Bonjour,', 'Votre supérieur hiérarchique a pris une décision concernant votre demande :'],
    rows: decisionRows(request),
    footerLink: { href: `${frontendUrl}/requests`, label: 'Voir mes demandes dans l\'application' },
  });
  await sendEmail({ to: requesterEmail, subject, bodyHtml, attachments: [await requestAttachment(request)] });
}

// Email de notification à l'équipe après la décision du supérieur
export async function sendRequestDecisionToAdmin(request: any): Promise<void> {
  const recipients = await getNotificationEmails();
  if (recipients.length === 0) return;

  const approved = request.status === 'APPROVED';
  const requesterName = request.requesterName
    || (request.requester ? `${request.requester.firstName} ${request.requester.lastName}` : 'l\'utilisateur');
  const typeName = request.type?.name || 'Demande';
  const subject = `${approved ? '✅ Validée' : '❌ Refusée'} — Demande de ${requesterName} (${typeName})`;
  const badge = approved
    ? { text: 'Validée', bg: '#dcfce7', color: '#166534' }
    : { text: 'Refusée', bg: '#fee2e2', color: '#991b1b' };
  const frontendUrl = await resolveFrontendUrl();

  const bodyHtml = emailLayout({
    title: 'Décision reçue',
    badge,
    preheader: `Le supérieur a ${approved ? 'validé' : 'refusé'} la demande de ${requesterName}.`,
    paragraphs: ['Le supérieur hiérarchique a répondu à la demande suivante :'],
    rows: decisionRows(request),
    footerLink: { href: `${frontendUrl}/requests`, label: 'Voir les demandes dans l\'application' },
  });
  await sendEmail({ to: recipients, subject, bodyHtml, attachments: [await requestAttachment(request)] });
}
