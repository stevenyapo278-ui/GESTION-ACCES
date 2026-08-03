import prisma from '../lib/prisma';
import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { resolveFrontendUrl } from '../services/systemSettings';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const GRAPH_SCOPES = ['offline_access', 'User.Read', 'Mail.Read', 'Mail.ReadWrite', 'Mail.Send'].join(' ');

// GET /api/oauth/outlook/callback — Microsoft OAuth2 callback (public)
router.get('/callback', async (req: Request, res: Response) => {
  const { code, state, error, error_description } = req.query;

  if (error) {
    res.status(400).send(`Erreur Microsoft : ${error} - ${error_description || ''}`);
    return;
  }
  if (!code || !state) {
    res.status(400).send('Paramètres manquants (code/state)');
    return;
  }

  let payload: any;
  try {
    payload = jwt.verify(state as string, JWT_SECRET);
  } catch {
    res.status(400).send('State invalide ou expiré, veuillez recommencer la connexion');
    return;
  }

  const account = await prisma.emailAccount.findUnique({ where: { id: payload.accountId } });
  if (!account) {
    res.status(404).send('Compte introuvable');
    return;
  }

  const frontendUrl = await resolveFrontendUrl();
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI || `${frontendUrl}/api/oauth/outlook/callback`;

  try {
    const tokenRes = await fetch(`https://login.microsoftonline.com/${account.tenantId}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: account.clientId || '',
        client_secret: account.clientSecret || '',
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: redirectUri,
        scope: GRAPH_SCOPES,
      }),
    });

    const tokenData = (await tokenRes.json()) as { refresh_token?: string; error?: string; error_description?: string };
    if (!tokenRes.ok) {
      res.status(502).send(`Échec de l'échange du code : ${tokenData.error_description || tokenData.error}`);
      return;
    }

    await prisma.emailAccount.update({
      where: { id: account.id },
      data: { refreshToken: tokenData.refresh_token, isActive: true },
    });

    await prisma.emailAccount.updateMany({
      where: { id: account.id, isDefault: false },
      data: { isDefault: true },
    });

    res.send(
      '<html><body style="font-family:Segoe UI,Arial;display:flex;align-items:center;justify-content:center;height:100vh;background:#f8fafc">' +
      '<div style="text-align:center;background:#fff;padding:40px;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,.08)">' +
      '<h2 style="color:#166534">Compte Outlook connecté avec succès.</h2>' +
      '<p>Vous pouvez fermer cette fenêtre et retourner à l\'application.</p>' +
      '<a href="' + frontendUrl + '/email-accounts" style="color:#2563eb">Retour à l\'application</a>' +
      '</div></body></html>'
    );
  } catch (err: any) {
    res.status(502).send(`Erreur lors de la connexion : ${err.message}`);
  }
});

export default router;
