import prisma from '../lib/prisma';

export async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.systemSetting.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await prisma.systemSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

// URL absolue du frontend pour les liens d'approbation envoyés par email
// (configurable en base, fallback sur la variable d'environnement FRONTEND_URL)
export async function resolveFrontendUrl(): Promise<string> {
  const stored = await getSetting('FRONTEND_URL');
  if (stored) return stored.replace(/\/+$/, '');
  return process.env.FRONTEND_URL || 'http://localhost:8888';
}

export async function getNotificationEmail(): Promise<string> {
  const stored = await getSetting('NOTIFICATION_EMAIL');
  if (stored) return stored;
  return process.env.NOTIFICATION_EMAIL || '';
}
