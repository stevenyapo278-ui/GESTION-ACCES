import nodemailer from 'nodemailer';
import prisma from '../lib/prisma';
import { graphFetch } from './graphClient';
import { resolveFrontendUrl, getNotificationEmail } from './systemSettings';

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  bodyHtml: string;
}

// Sélection du compte d'envoi : priorité au compte Outlook (Graph API) par défaut,
// sinon Outlook actif, sinon SMTP par défaut, sinon SMTP actif.
async function pickAccount() {
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

// Envoi via SMTP générique (nodemailer)
async function sendEmailViaSmtp(account: any, { to, subject, bodyHtml }: SendEmailOptions) {
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
  });
}

// Envoi via Microsoft Graph API (Outlook / Microsoft 365)
async function sendEmailViaGraph(account: any, { to, subject, bodyHtml }: SendEmailOptions) {
  const toRecipients = (Array.isArray(to) ? to : [to]).map((addr) => ({ emailAddress: { address: addr } }));
  const message = {
    subject,
    body: { contentType: 'HTML', content: bodyHtml },
    toRecipients,
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

// === Templates des demandes ===

const EMAIL_STYLE = `
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; background: #f8fafc; margin: 0; padding: 24px; }
    .card { background: #ffffff; border-radius: 12px; padding: 28px; max-width: 560px; margin: 0 auto; border: 1px solid #e2e8f0; }
    h2 { margin: 0 0 16px; color: #0f172a; }
    table { border-collapse: collapse; margin: 16px 0; width: 100%; }
    td { padding: 6px 12px 6px 0; color: #64748b; vertical-align: top; }
    td:last-child { color: #0f172a; font-weight: 600; }
    .btn { display: inline-block; padding: 12px 24px; border-radius: 8px; color: #fff; text-decoration: none; font-weight: 600; margin: 4px 8px 4px 0; }
    .btn-approve { background: #16a34a; }
    .btn-reject { background: #dc2626; }
    .footer { color: #94a3b8; font-size: 12px; margin-top: 24px; }
  </style>`;

function answersRows(request: any): string {
  const data = request.data && typeof request.data === 'object' ? request.data : {};
  const fields = Array.isArray(request.type?.fields) ? request.type.fields : [];
  const rows = fields
    .filter((f: any) => f?.key && data[f.key] !== undefined && data[f.key] !== '')
    .map((f: any) => `<tr><td>${f.label || f.key}</td><td>${data[f.key]}</td></tr>`)
    .join('');
  const extra = Object.entries(data)
    .filter(([k]) => !fields.some((f: any) => f.key === k))
    .map(([k, v]) => `<tr><td>${k}</td><td>${String(v)}</td></tr>`)
    .join('');
  return rows + extra;
}

function detailTable(request: any): string {
  const requesterName = request.requesterName
    || (request.requester ? `${request.requester.firstName} ${request.requester.lastName}` : 'Utilisateur');
  const requesterEmail = request.requesterEmail || request.requester?.email || '';
  return `
  <table>
    <tr><td>Demandeur</td><td>${requesterName} ${requesterEmail ? `(${requesterEmail})` : ''}</td></tr>
    <tr><td>Type de demande</td><td>${request.type?.name || 'Demande'}</td></tr>
    ${answersRows(request)}
    ${request.details ? `<tr><td>Détails</td><td>${request.details}</td></tr>` : ''}
    <tr><td>Date</td><td>${new Date(request.createdAt).toLocaleString('fr-FR')}</td></tr>
  </table>`;
}

// Email envoyé au supérieur hiérarchique avec les boutons Valider / Refuser
export async function sendRequestToSuperior(request: any): Promise<void> {
  const frontendUrl = await resolveFrontendUrl();
  const reviewUrl = `${frontendUrl}/requests/review/${request.decisionToken}`;
  const requesterName = request.requesterName
    || (request.requester ? `${request.requester.firstName} ${request.requester.lastName}` : 'l\'utilisateur');
  const subject = `[Validation] Demande de ${requesterName} — ${request.type?.name || 'Demande'}`;
  const bodyHtml = `
  ${EMAIL_STYLE}
  <div class="card">
    <h2>Demande de validation</h2>
    <p>Bonjour,</p>
    <p>L'utilisateur ci-dessous a soumis une demande qui requiert votre validation :</p>
    ${detailTable(request)}
    <p>Cliquez sur un des boutons pour répondre :</p>
    <p>
      <a class="btn btn-approve" href="${reviewUrl}?action=approve">✓ Valider</a>
      <a class="btn btn-reject" href="${reviewUrl}?action=reject">✗ Refuser</a>
    </p>
    <p class="footer">Ce lien est à usage unique. La première réponse enregistrée fera foi.</p>
  </div>`.trim();
  await sendEmail({ to: request.superiorEmail, subject, bodyHtml });
}

// Email de notification au demandeur après la décision du supérieur
export async function sendRequestDecisionToRequester(request: any): Promise<void> {
  const requesterEmail = request.requesterEmail || request.requester?.email;
  if (!requesterEmail) return;

  const approved = request.status === 'APPROVED';
  const typeName = request.type?.name || 'Demande';
  const subject = approved
    ? `✅ Votre demande a été validée — ${typeName}`
    : `❌ Votre demande a été refusée — ${typeName}`;
  const decisionBadge = approved
    ? '<span style="background:#dcfce7;color:#166534;padding:4px 12px;border-radius:999px;font-weight:600">Validée</span>'
    : '<span style="background:#fee2e2;color:#991b1b;padding:4px 12px;border-radius:999px;font-weight:600">Refusée</span>';
  const bodyHtml = `
  ${EMAIL_STYLE}
  <div class="card">
    <h2>Décision sur votre demande ${decisionBadge}</h2>
    <p>Bonjour,</p>
    <p>Voici la décision de votre supérieur concernant votre demande :</p>
    ${detailTable(request)}
    <table>
      <tr><td>Supérieur</td><td>${request.superiorEmail}</td></tr>
      ${request.decisionComment ? `<tr><td>Commentaire</td><td>${request.decisionComment}</td></tr>` : ''}
      <tr><td>Décision le</td><td>${request.decidedAt ? new Date(request.decidedAt).toLocaleString('fr-FR') : '-'}</td></tr>
    </table>
  </div>`.trim();
  await sendEmail({ to: requesterEmail, subject, bodyHtml });
}

// Email de notification à l'équipe après la décision du supérieur
export async function sendRequestDecisionToAdmin(request: any): Promise<void> {
  const notificationEmail = await getNotificationEmail();
  if (!notificationEmail) return;

  const approved = request.status === 'APPROVED';
  const requesterName = request.requesterName
    || (request.requester ? `${request.requester.firstName} ${request.requester.lastName}` : 'l\'utilisateur');
  const subject = `${approved ? '✅ Validée' : '❌ Refusée'} — Demande de ${requesterName} (${request.type?.name || 'Demande'})`;
  const decisionBadge = approved
    ? '<span style="background:#dcfce7;color:#166534;padding:4px 12px;border-radius:999px;font-weight:600">Validée</span>'
    : '<span style="background:#fee2e2;color:#991b1b;padding:4px 12px;border-radius:999px;font-weight:600">Refusée</span>';
  const bodyHtml = `
  ${EMAIL_STYLE}
  <div class="card">
    <h2>Décision reçue ${decisionBadge}</h2>
    <p>Le supérieur hiérarchique a répondu à la demande suivante :</p>
    ${detailTable(request)}
    <table>
      <tr><td>Supérieur</td><td>${request.superiorEmail}</td></tr>
      ${request.decisionComment ? `<tr><td>Commentaire</td><td>${request.decisionComment}</td></tr>` : ''}
      <tr><td>Décision le</td><td>${request.decidedAt ? new Date(request.decidedAt).toLocaleString('fr-FR') : '-'}</td></tr>
    </table>
  </div>`.trim();
  await sendEmail({ to: notificationEmail, subject, bodyHtml });
}
