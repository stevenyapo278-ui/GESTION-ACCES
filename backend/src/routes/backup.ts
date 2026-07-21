import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { Role } from '@prisma/client';

const router = Router();

async function gatherAllData() {
  const tables = await prisma.table.findMany({
    include: {
      columns: { orderBy: { order: 'asc' } },
      rows: {
        orderBy: { order: 'asc' },
        include: { cellValues: true },
      },
      views: {
        include: {
          viewColumns: true,
          filters: { orderBy: { order: 'asc' } },
        },
      },
      permissions: true,
      forms: {
        include: { submissions: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return {
    version: '1.0',
    createdAt: new Date().toISOString(),
    tables: tables.map((t) => ({
      table: {
        id: t.id,
        name: t.name,
        description: t.description,
        icon: t.icon,
        color: t.color,
        category: t.category,
        createdBy: t.createdBy,
        createdAt: t.createdAt,
      },
      columns: t.columns,
      rows: t.rows.map((r) => ({
        id: r.id,
        order: r.order,
        createdBy: r.createdBy,
        createdAt: r.createdAt,
        cellValues: r.cellValues,
      })),
      views: t.views.map((v) => ({
        id: v.id,
        name: v.name,
        type: v.type,
        settings: v.settings,
        isDefault: v.isDefault,
        createdBy: v.createdBy,
        viewColumns: v.viewColumns,
        filters: v.filters,
      })),
      permissions: t.permissions,
      forms: t.forms.map((f) => ({
        id: f.id,
        name: f.name,
        description: f.description,
        publicToken: f.publicToken,
        isActive: f.isActive,
        submitLabel: f.submitLabel,
        successMessage: f.successMessage,
        fields: f.fields,
        settings: f.settings,
        submissions: f.submissions,
      })),
    })),
  };
}

function generateBackupName(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `Sauvegarde_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}h${pad(now.getMinutes())}`;
}

async function createBackup(userId: string): Promise<any> {
  const data = await gatherAllData();
  const tableCount = data.tables.length;
  const rowCount = data.tables.reduce((sum, t) => sum + t.rows.length, 0);

  const backup = await prisma.backup.create({
    data: {
      name: generateBackupName(),
      tableCount,
      rowCount,
      data: data as any,
      createdBy: userId,
    },
  });

  return backup;
}

router.post('/', authenticate, authorize(Role.ADMIN), async (req: AuthRequest, res: Response) => {
  try {
    const backup = await createBackup(req.user!.id);
    res.status(201).json(backup);
  } catch (err) {
    console.error('Backup creation error:', err);
    res.status(500).json({ error: 'Erreur lors de la création de la sauvegarde' });
  }
});

router.get('/', authenticate, authorize(Role.ADMIN), async (_req: AuthRequest, res: Response) => {
  try {
    const backups = await prisma.backup.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        fileSize: true,
        tableCount: true,
        rowCount: true,
        createdBy: true,
        createdAt: true,
      },
    });
    res.json(backups);
  } catch (err) {
    console.error('Backup list error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des sauvegardes' });
  }
});

router.get('/:id', authenticate, authorize(Role.ADMIN), async (req: AuthRequest, res: Response) => {
  try {
    const backup = await prisma.backup.findUnique({
      where: { id: req.params.id },
    });
    if (!backup) {
      res.status(404).json({ error: 'Sauvegarde introuvable' });
      return;
    }
    res.json(backup);
  } catch (err) {
    console.error('Backup get error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération de la sauvegarde' });
  }
});

router.get('/:id/download', authenticate, authorize(Role.ADMIN), async (req: AuthRequest, res: Response) => {
  try {
    const backup = await prisma.backup.findUnique({
      where: { id: req.params.id },
    });
    if (!backup) {
      res.status(404).json({ error: 'Sauvegarde introuvable' });
      return;
    }
    const data = JSON.stringify(backup.data, null, 2);
    const filename = `${backup.name}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(data);
  } catch (err) {
    console.error('Backup download error:', err);
    res.status(500).json({ error: 'Erreur lors du téléchargement de la sauvegarde' });
  }
});

router.delete('/:id', authenticate, authorize(Role.ADMIN), async (req: AuthRequest, res: Response) => {
  try {
    const backup = await prisma.backup.findUnique({
      where: { id: req.params.id },
    });
    if (!backup) {
      res.status(404).json({ error: 'Sauvegarde introuvable' });
      return;
    }
    await prisma.backup.delete({ where: { id: req.params.id } });
    res.json({ message: 'Sauvegarde supprimée' });
  } catch (err) {
    console.error('Backup delete error:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression de la sauvegarde' });
  }
});

async function cleanOldBackups() {
  const maxBackups = 14;
  const backups = await prisma.backup.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true },
    skip: maxBackups,
  });
  for (const b of backups) {
    await prisma.backup.delete({ where: { id: b.id } });
  }
}

export async function runAutoBackup() {
  try {
    const admins = await prisma.user.findMany({
      where: { role: Role.ADMIN, isActive: true },
      select: { id: true },
    });

    if (admins.length === 0) {
      console.log('[AutoBackup] No active admin user found, skipping');
      return;
    }

    const backup = await createBackup(admins[0].id);
    await cleanOldBackups();
    console.log(`[AutoBackup] Backup created: ${backup.name} (${backup.tableCount} tables, ${backup.rowCount} rows)`);
  } catch (err) {
    console.error('[AutoBackup] Error:', err);
  }
}

export default router;
