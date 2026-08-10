import prisma from '../lib/prisma';
import { graphFetch } from './graphClient';
import {
  pickAccount,
  replyRefOf,
  REPLY_REF_PATTERN,
  sendRequestDecisionToAdmin,
  sendRequestDecisionToRequester,
} from './emailSender';
import { applyDecision } from '../routes/requests';

// ─────────────────────────────────────────────────────────────────────────────
// Réponses par email : le supérieur peut répondre « VALIDER » / « REFUSER »
// à l'email de validation reçu, la décision est appliquée automatiquement.
// Monitoré via Graph API pour les comptes Outlook/M365 connectés.
// ─────────────────────────────────────────────────────────────────────────────

export interface ReplyDecision {
  action: 'APPROVE' | 'REJECT' | null;
  comment?: string;
}

// Retire la partie citée du message d'origine (Gmail/Outlook) et les signatures
function extractBody(text: string): string {
  const lines = (text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const meaningful: string[] = [];
  for (const line of lines) {
    if (/^[>|]/.test(line)) break;
    if (/\b(de|from|envoyé|sent|à|to|cc|subject|objet|date|répondre|reply|réponse|response)\s*:/i.test(line)) break;
    if (/^--\s*$/.test(line)) break;
    if (/^le\s+.+a écrit :$|^on\s+.+wrote:$|^envoyé de mon/i.test(line)) break;
    meaningful.push(line);
  }
  return meaningful.slice(0, 12).join(' ');
}

// Analyse le corps de la réponse pour en extraire la décision et le commentaire
export function extractReplyDecision(rawText: string): ReplyDecision {
  const text = extractBody(rawText).slice(0, 800);
  const upper = text.toUpperCase();

  // Négations (« je ne valide pas », « pas d'accord ») → refus
  if (/\b(NE|N'|PAS|NON)\b[\s\w'’]{0,30}\b(VALIDER|VALIDE|APPROUVE|ACCORD|D'ACCORD|OUI)\b/i.test(text)) {
    return { action: 'REJECT' };
  }

  if (/\b(REFUS(?:ER|E|ES|ONS)?|REJET(?:ER|TE|TES)?|NON|ANNUL(?:ER|E|ES)?)\b/i.test(upper)) {
    return { action: 'REJECT', comment: cleanComment(text) };
  }

  if (/\b(VALIDER|VALIDE|APPROUVE|ACCORD\b|OUI\b|OK\b)\b/i.test(upper)) {
    return { action: 'APPROVE', comment: cleanComment(text) };
  }

  return { action: null };
}

function cleanComment(text: string): string | undefined {
  const withoutKeywords = text
    .replace(/\b(REFUSER|REFUS|REJETER|REJETTE|DECLINE|NON|VALIDER|VALIDE|APPROUVE|ACCORD|OUI|OK)\b[,.:\s]*/gi, ' ')
    .replace(/[✓✗]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 400);
  return withoutKeywords || undefined;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/\s+/g, ' ')
    .trim();
}

function bodyText(message: { body?: { contentType?: string; content?: string } }): string {
  const content = message.body?.content || '';
  if (message.body?.contentType === 'text') return content;
  return stripHtml(content);
}

export async function findPendingByRef(ref: string) {
  const pending = await prisma.request.findMany({
    where: { status: 'PENDING' },
    include: {
      type: { select: { name: true, fields: true } },
      requester: { select: { firstName: true, lastName: true, email: true } },
    },
  });
  return pending.find((r) => replyRefOf(r) === ref.toUpperCase()) || null;
}

// Applique la décision issue d'une réponse email, puis notifie (comme le bouton du site)
export async function applyReplyDecision(request: any, decision: ReplyDecision): Promise<void> {
  const updated = await applyDecision(request, decision.action as 'APPROVE' | 'REJECT', decision.comment);
  try {
    await sendRequestDecisionToAdmin({ ...updated, requester: request.requester, type: request.type });
  } catch (err) {
    console.error('Reply decision notification (admin) error:', (err as Error).message);
  }
  try {
    await sendRequestDecisionToRequester({ ...updated, requester: request.requester, type: request.type });
  } catch (err) {
    console.error('Reply decision notification (requester) error:', (err as Error).message);
  }
}

// Interroge la boîte de réception Outlook via Graph et traite les réponses
export async function pollOutlookReplies(account: any): Promise<{ checked: number; matched: number; decided: number }> {
  const result = { checked: 0, matched: 0, decided: 0 };

  const data = await graphFetch(
    account,
    '/me/messages?$top=50&$orderby=receivedDateTime%20desc&$select=id,subject,body,isRead'
  );
  const messages: Array<{ id: string; subject?: string; body?: any; isRead?: boolean }> = data?.value || [];
  result.checked = messages.length;

  for (const message of messages) {
    if (message.isRead) continue;
    const subject = message.subject || '';
    const refMatch = REPLY_REF_PATTERN.exec(subject);
    if (!refMatch) continue;

    const request = await findPendingByRef(refMatch[1]);
    result.matched += 1;

    if (!request) {
      graphFetch(account, `/me/messages/${message.id}`, { method: 'PATCH', body: JSON.stringify({ isRead: true }) }).catch(() => {});
      continue;
    }

    const decision = extractReplyDecision(bodyText(message));
    if (decision.action) {
      try {
        await applyReplyDecision(request, decision);
        result.decided += 1;
      } catch (err) {
        console.error('Reply decision error:', (err as Error).message);
      }
    }
    graphFetch(account, `/me/messages/${message.id}`, { method: 'PATCH', body: JSON.stringify({ isRead: true }) }).catch(() => {});
  }

  return result;
}

// Passe de surveillance à exécuter (manuellement ou périodiquement)
export async function pollOnce(): Promise<{
  mode: string;
  checked: number;
  matched: number;
  decided: number;
  error?: string;
}> {
  try {
    const { account, isOutlook } = await pickAccount();
    if (!isOutlook) {
      return { mode: 'smtp', checked: 0, matched: 0, decided: 0, error: 'Suivi des réponses par email : non disponible pour un compte SMTP.' };
    }
    const result = await pollOutlookReplies(account);
    return { mode: 'outlook', ...result };
  } catch (err) {
    const message = (err as Error).message;
    console.error('Reply monitor error:', message);
    return { mode: 'error', checked: 0, matched: 0, decided: 0, error: message };
  }
}

// Surveillance périodique (toutes les 5 minutes, premier passage après 30 s)
let timer: NodeJS.Timeout | null = null;
let running = false;

export function startReplyMonitor(): void {
  if (timer) return;

  const run = async () => {
    if (running) return;
    running = true;
    try {
      await pollOnce();
    } catch (err) {
      console.error('Reply monitor error:', (err as Error).message);
    } finally {
      running = false;
    }
  };

  setTimeout(run, 30_000);
  timer = setInterval(run, 5 * 60_000);
  if (timer.unref) timer.unref();
}