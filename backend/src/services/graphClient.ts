import prisma from '../lib/prisma';

const GRAPH_SCOPES = ['offline_access', 'User.Read', 'Mail.Read', 'Mail.ReadWrite', 'Mail.Send'].join(' ');

export interface EmailAccountLike {
  id: string;
  label: string;
  tenantId: string | null;
  clientId: string | null;
  clientSecret: string | null;
  refreshToken: string | null;
}

// Échange le refresh token contre un access token, et met à jour le refresh token en base
// si Microsoft en renvoie un nouveau.
export async function getAccessToken(account: EmailAccountLike): Promise<string> {
  if (!account.refreshToken) {
    throw new Error(`Le compte mail "${account.label}" n'est pas connecté à Outlook (pas de refresh token)`);
  }
  if (!account.tenantId || !account.clientId || !account.clientSecret) {
    throw new Error(`Le compte mail "${account.label}" n'a pas de configuration OAuth2 complète`);
  }

  const res = await fetch(`https://login.microsoftonline.com/${account.tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: account.clientId,
      client_secret: account.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: account.refreshToken,
      scope: GRAPH_SCOPES,
    }),
  });

  const data = (await res.json()) as { access_token?: string; refresh_token?: string; error?: string; error_description?: string };
  if (!res.ok) {
    throw new Error(`Échec du rafraîchissement du token Outlook pour "${account.label}" : ${data.error_description || data.error}`);
  }

  if (data.refresh_token && data.refresh_token !== account.refreshToken) {
    await prisma.emailAccount.update({
      where: { id: account.id },
      data: { refreshToken: data.refresh_token },
    });
  }

  return data.access_token as string;
}

export async function graphFetch(account: EmailAccountLike, path: string, options: RequestInit = {}): Promise<any> {
  const accessToken = await getAccessToken(account);
  const url = path.startsWith('https://') ? path : `https://graph.microsoft.com/v1.0${path}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers as Record<string, string> | undefined),
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Erreur Graph API (${res.status}) sur ${path} : ${errBody}`);
  }

  const text = await res.text();
  if (!text) return null;
  return JSON.parse(text);
}
