import { Client } from 'ldapts';

// Configuration LDAP (voir .env) : même logique que le projet PROSUMA
// (serveur AD, domaine, domaine email) mais en bind simple userPrincipalName,
// équivalent standard du bind NTLM PROSUMA\username.

const LDAP_ENABLED = process.env.LDAP_ENABLED === 'true';
const LDAP_URL = process.env.LDAP_URL || 'ldap://10.0.70.1';
const LDAP_EMAIL_DOMAIN = process.env.LDAP_EMAIL_DOMAIN || 'prosuma.ci';
const LDAP_BIND_FORMAT = process.env.LDAP_BIND_FORMAT || '{username}@{domain}';
const LDAP_ADMIN_USERNAMES = (process.env.LDAP_ADMIN_USERNAMES || '')
  .split(',')
  .map((u) => u.trim().toLowerCase())
  .filter(Boolean);

export function isLdapEnabled(): boolean {
  return LDAP_ENABLED;
}

export function isLdapAdminUsername(username: string): boolean {
  return LDAP_ADMIN_USERNAMES.includes(username.trim().toLowerCase());
}

export function ldapEmailFor(username: string): string {
  return `${username.trim().toLowerCase()}@${LDAP_EMAIL_DOMAIN}`;
}

function buildBindDn(username: string): string {
  const domain = LDAP_EMAIL_DOMAIN;
  return LDAP_BIND_FORMAT
    .replace('{username}', username)
    .replace('{domain}', domain);
}

// Tente l'authentification LDAP/Active Directory. Retourne null si refusée.
export async function authenticateLdap(username: string, password: string): Promise<{ username: string; email: string } | null> {
  const client = new Client({ url: LDAP_URL, connectTimeout: 5000, timeout: 10000 });
  const bindDn = buildBindDn(username.trim());

  try {
    await client.bind(bindDn, password);
    return { username: username.trim(), email: ldapEmailFor(username) };
  } catch (error) {
    console.error('LDAP bind failed:', (error as Error).message);
    return null;
  } finally {
    try {
      await client.unbind();
    } catch {
      // socket déjà fermée — sans importance
    }
  }
}
