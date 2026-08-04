import prisma from '../lib/prisma';
import { Router, Response } from 'express';
import jwt from 'jsonwebtoken';
import { EmailProvider } from '@prisma/client';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { Role } from '@prisma/client';
import { resolveFrontendUrl, getNotificationEmail, getSuperiorEmails, setSuperiorEmails, setSetting } from '../services/systemSettings';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const GRAPH_SCOPES = ['offline_access', 'User.Read', 'Mail.Read', 'Mail.ReadWrite', 'Mail.Send'].join(' ');

function sanitize(account: any) {
  if (!account) return account;
  const { password, refreshToken, clientSecret, ...safe } = account;
  return { ...safe, hasPassword: !!password, hasRefreshToken: !!refreshToken, hasClientSecret: !!clientSecret };
}

// GET /api/email-accounts — List accounts (admin only)
router.get('/', authenticate, authorize(Role.ADMIN), async (_req: AuthRequest, res: Response) => {
  try {
    const accounts = await prisma.emailAccount.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(accounts.map(sanitize));
  } catch (error) {
    console.error('List email accounts error:', error);
    res.status(500).json({ error: 'Échec de la récupération des comptes email' });
  }
});

// POST /api/email-accounts — Create account (admin only)
router.post('/', authenticate, authorize(Role.ADMIN), async (req: AuthRequest, res: Response) => {
  try {
    const { label, provider, emailAddress, clientId, clientSecret, tenantId, imapHost, imapPort, smtpHost, smtpPort, username, password, useTls, isDefault } = req.body;

    if (!label || !provider || !emailAddress) {
      res.status(400).json({ error: 'label, provider et emailAddress sont requis' });
      return;
    }
    if (!Object.values(EmailProvider).includes(provider)) {
      res.status(400).json({ error: 'Provider invalide' });
      return;
    }

    if (isDefault) {
      await prisma.emailAccount.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
    }

    const account = await prisma.emailAccount.create({
      data: {
        label,
        provider,
        emailAddress,
        clientId: clientId || null,
        clientSecret: clientSecret || null,
        tenantId: tenantId || null,
        imapHost: imapHost || null,
        imapPort: imapPort ? Number(imapPort) : null,
        smtpHost: smtpHost || null,
        smtpPort: smtpPort ? Number(smtpPort) : null,
        username: username || null,
        password: password || null,
        useTls: useTls !== false,
        isDefault: !!isDefault,
      },
    });

    res.status(201).json(sanitize(account));
  } catch (error) {
    console.error('Create email account error:', error);
    res.status(500).json({ error: 'Échec de la création du compte email' });
  }
});

// GET /api/email-accounts/settings — Email-related settings (admin only)
router.get('/settings', authenticate, authorize(Role.ADMIN), async (_req: AuthRequest, res: Response) => {
  try {
    res.json({
      notificationEmail: await getNotificationEmail(),
      frontendUrl: await resolveFrontendUrl(),
      superiorEmails: (await getSuperiorEmails()).join('\n'),
    });
  } catch (error) {
    console.error('Get email settings error:', error);
    res.status(500).json({ error: 'Échec de la récupération des réglages' });
  }
});

// PUT /api/email-accounts/settings — Update email-related settings (admin only)
router.put('/settings', authenticate, authorize(Role.ADMIN), async (req: AuthRequest, res: Response) => {
  try {
    const { notificationEmail, frontendUrl, superiorEmails } = req.body;
    if (notificationEmail !== undefined) {
      await setSetting('NOTIFICATION_EMAIL', notificationEmail);
    }
    if (frontendUrl !== undefined) {
      await setSetting('FRONTEND_URL', frontendUrl);
    }
    if (superiorEmails !== undefined) {
      await setSuperiorEmails(superiorEmails);
    }
    res.json({
      notificationEmail: await getNotificationEmail(),
      frontendUrl: await resolveFrontendUrl(),
      superiorEmails: (await getSuperiorEmails()).join('\n'),
    });
  } catch (error) {
    console.error('Update email settings error:', error);
    res.status(500).json({ error: 'Échec de la mise à jour des réglages' });
  }
});

// PUT /api/email-accounts/:id — Update account (admin only)
router.put('/:id', authenticate, authorize(Role.ADMIN), async (req: AuthRequest, res: Response) => {
  try {
    const { label, emailAddress, clientId, clientSecret, tenantId, imapHost, imapPort, smtpHost, smtpPort, username, password, useTls, isActive, isDefault } = req.body;

    const existing = await prisma.emailAccount.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Compte introuvable' });
      return;
    }

    if (isDefault) {
      await prisma.emailAccount.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
    }

    const account = await prisma.emailAccount.update({
      where: { id: req.params.id },
      data: {
        ...(label !== undefined ? { label } : {}),
        ...(emailAddress !== undefined ? { emailAddress } : {}),
        ...(clientId !== undefined ? { clientId } : {}),
        // Seuls les champs explicitement fournis écrasent les secrets existants
        ...(clientSecret !== undefined && clientSecret !== '' ? { clientSecret } : {}),
        ...(tenantId !== undefined ? { tenantId } : {}),
        ...(imapHost !== undefined ? { imapHost } : {}),
        ...(imapPort !== undefined ? { imapPort: imapPort ? Number(imapPort) : null } : {}),
        ...(smtpHost !== undefined ? { smtpHost } : {}),
        ...(smtpPort !== undefined ? { smtpPort: smtpPort ? Number(smtpPort) : null } : {}),
        ...(username !== undefined ? { username } : {}),
        ...(password !== undefined && password !== '' ? { password } : {}),
        ...(useTls !== undefined ? { useTls } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
        ...(isDefault !== undefined ? { isDefault } : {}),
      },
    });

    res.json(sanitize(account));
  } catch (error) {
    console.error('Update email account error:', error);
    res.status(500).json({ error: 'Échec de la mise à jour du compte email' });
  }
});

// DELETE /api/email-accounts/:id — Delete account (admin only)
router.delete('/:id', authenticate, authorize(Role.ADMIN), async (req: AuthRequest, res: Response) => {
  try {
    await prisma.emailAccount.delete({ where: { id: req.params.id } });
    res.json({ message: 'Compte email supprimé' });
  } catch (error) {
    console.error('Delete email account error:', error);
    res.status(500).json({ error: 'Échec de la suppression du compte email' });
  }
});

// GET /api/email-accounts/:id/oauth/connect — Generate Microsoft OAuth URL (admin only)
router.get('/:id/oauth/connect', authenticate, authorize(Role.ADMIN), async (req: AuthRequest, res: Response) => {
  try {
    const account = await prisma.emailAccount.findUnique({ where: { id: req.params.id } });
    if (!account) {
      res.status(404).json({ error: 'Compte introuvable' });
      return;
    }
    if (!account.clientId || !account.tenantId || !account.clientSecret) {
      res.status(400).json({ error: 'Client ID, Tenant ID et Client Secret sont requis avant de connecter le compte' });
      return;
    }

    const frontendUrl = await resolveFrontendUrl();
    const redirectUri = process.env.MICROSOFT_REDIRECT_URI || `${frontendUrl}/api/oauth/outlook/callback`;

    const state = jwt.sign({ accountId: account.id }, JWT_SECRET, { expiresIn: '10m' });
    const params = new URLSearchParams({
      client_id: account.clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      response_mode: 'query',
      scope: GRAPH_SCOPES,
      state,
    });
    const url = `https://login.microsoftonline.com/${account.tenantId}/oauth2/v2.0/authorize?${params.toString()}`;

    res.json({ url, redirectUri });
  } catch (error) {
    console.error('OAuth connect error:', error);
    res.status(500).json({ error: 'Échec de la génération du lien OAuth' });
  }
});

export default router;
