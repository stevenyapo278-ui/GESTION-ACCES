import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../lib/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { Role, ColumnType } from '@prisma/client';

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
        id: t.id, name: t.name, description: t.description,
        icon: t.icon, color: t.color, category: t.category,
        createdBy: t.createdBy, createdAt: t.createdAt,
      },
      columns: t.columns,
      rows: t.rows.map((r) => ({
        id: r.id, order: r.order, createdBy: r.createdBy, createdAt: r.createdAt,
        cellValues: r.cellValues,
      })),
      views: t.views.map((v) => ({
        id: v.id, name: v.name, type: v.type, settings: v.settings,
        isDefault: v.isDefault, createdBy: v.createdBy,
        viewColumns: v.viewColumns, filters: v.filters,
      })),
      permissions: t.permissions,
      forms: t.forms.map((f) => ({
        id: f.id, name: f.name, description: f.description,
        publicToken: f.publicToken, isActive: f.isActive,
        submitLabel: f.submitLabel, successMessage: f.successMessage,
        fields: f.fields, settings: f.settings, submissions: f.submissions,
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
  const jsonData = JSON.stringify(data);
  const backup = await prisma.backup.create({
    data: {
      name: generateBackupName(),
      fileSize: Buffer.byteLength(jsonData, 'utf8'),
      tableCount, rowCount,
      data: data as any,
      createdBy: userId,
    },
  });
  return backup;
}

async function cleanOldBackups(retention: number) {
  const old = await prisma.backup.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true },
    skip: retention,
  });
  for (const b of old) {
    await prisma.backup.delete({ where: { id: b.id } });
  }
}

function computeNextBackup(last: Date | null, freq: string, val: number, unit: string): Date | null {
  if (freq === 'manual') return null;
  const now = new Date();
  const base = last || now;
  const next = new Date(base);
  if (unit === 'hours') next.setHours(next.getHours() + val);
  else if (unit === 'days') next.setDate(next.getDate() + val);
  else if (unit === 'weeks') next.setDate(next.getDate() + val * 7);
  else next.setDate(next.getDate() + 1);
  return next > now ? next : new Date(now.getTime() + 60_000);
}

export async function runAutoBackup() {
  try {
    const settings = await prisma.backupSettings.findFirst();
    if (!settings || !settings.enabled) return;

    const admins = await prisma.user.findMany({
      where: { role: Role.ADMIN, isActive: true },
      select: { id: true },
    });
    if (admins.length === 0) return;

    const backup = await createBackup(settings.createdBy);
    const nextBackupAt = computeNextBackup(
      new Date(), settings.frequency, settings.frequencyValue, settings.frequencyUnit
    );

    await prisma.backupSettings.update({
      where: { id: settings.id },
      data: { lastBackupAt: new Date(), nextBackupAt },
    });

    await cleanOldBackups(settings.retention);
    console.log(`[AutoBackup] ${backup.name} (${backup.tableCount} tables, ${backup.rowCount} rows)`);
  } catch (err) {
    console.error('[AutoBackup] Error:', err);
  }
}

router.get('/settings', authenticate, authorize(Role.ADMIN), async (req: AuthRequest, res: Response) => {
  try {
    let settings = await prisma.backupSettings.findFirst();
    if (!settings) {
      settings = await prisma.backupSettings.create({
        data: { createdBy: req.user!.id },
      });
    }
    res.json(settings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

router.put('/settings', authenticate, authorize(Role.ADMIN), async (req: AuthRequest, res: Response) => {
  try {
    const { enabled, frequency, frequencyValue, frequencyUnit, retention } = req.body;
    let settings = await prisma.backupSettings.findFirst();
    if (!settings) {
      settings = await prisma.backupSettings.create({
        data: { createdBy: req.user!.id },
      });
    }
    const nextBackupAt = enabled !== false && frequency !== 'manual'
      ? computeNextBackup(settings.lastBackupAt, frequency || settings.frequency, frequencyValue || settings.frequencyValue, frequencyUnit || settings.frequencyUnit)
      : null;

    const updated = await prisma.backupSettings.update({
      where: { id: settings.id },
      data: {
        ...(enabled !== undefined && { enabled }),
        ...(frequency !== undefined && { frequency }),
        ...(frequencyValue !== undefined && { frequencyValue }),
        ...(frequencyUnit !== undefined && { frequencyUnit }),
        ...(retention !== undefined && { retention }),
        nextBackupAt,
        createdBy: settings.createdBy || req.user!.id,
      },
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

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
      select: { id: true, name: true, description: true, fileSize: true, tableCount: true, rowCount: true, createdBy: true, createdAt: true },
    });
    res.json(backups);
  } catch (err) {
    res.status(500).json({ error: 'Erreur' });
  }
});

router.get('/:id', authenticate, authorize(Role.ADMIN), async (req: AuthRequest, res: Response) => {
  const backup = await prisma.backup.findUnique({ where: { id: req.params.id } });
  if (!backup) { res.status(404).json({ error: 'Sauvegarde introuvable' }); return; }
  res.json(backup);
});

router.get('/:id/download', authenticate, authorize(Role.ADMIN), async (req: AuthRequest, res: Response) => {
  const backup = await prisma.backup.findUnique({ where: { id: req.params.id } });
  if (!backup) { res.status(404).json({ error: 'Sauvegarde introuvable' }); return; }
  const data = JSON.stringify(backup.data, null, 2);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${backup.name}.json"`);
  res.send(data);
});

router.delete('/:id', authenticate, authorize(Role.ADMIN), async (req: AuthRequest, res: Response) => {
  const backup = await prisma.backup.findUnique({ where: { id: req.params.id } });
  if (!backup) { res.status(404).json({ error: 'Sauvegarde introuvable' }); return; }
  await prisma.backup.delete({ where: { id: req.params.id } });
  res.json({ message: 'Sauvegarde supprimée' });
});

router.post('/import', authenticate, authorize(Role.ADMIN), async (req: AuthRequest, res: Response) => {
  try {
    const raw = req.body;
    const backupData = raw.data || raw;
    if (!backupData.version || !backupData.tables) {
      res.status(400).json({ error: 'Format de sauvegarde invalide' });
      return;
    }

    const userId = req.user!.id;
    const idMap: Record<string, string> = {};
    let tablesCreated = 0;
    let rowsCreated = 0;

    for (const t of backupData.tables) {
      const newTableId = uuidv4();
      idMap[t.table.id] = newTableId;

      await prisma.table.create({
        data: {
          id: newTableId,
          name: t.table.name,
          description: t.table.description || '',
          icon: t.table.icon || 'table',
          color: t.table.color || '#3B82F6',
          category: t.table.category || null,
          createdBy: userId,
        },
      });
      tablesCreated++;

      const colIdMap: Record<string, string> = {};
      for (const col of t.columns) {
        const newColId = uuidv4();
        colIdMap[col.id] = newColId;
        idMap[col.id] = newColId;
        await prisma.column.create({
          data: {
            id: newColId,
            tableId: newTableId,
            name: col.name,
            type: col.type as ColumnType,
            required: col.required,
            unique: col.unique,
            order: col.order,
            options: col.options || undefined,
            formula: col.formula || undefined,
            settings: col.settings || undefined,
            createdBy: userId,
          },
        });
      }

      const rowIdMap: Record<string, string> = {};
      for (const row of t.rows) {
        const newRowId = uuidv4();
        rowIdMap[row.id] = newRowId;
        idMap[row.id] = newRowId;
        await prisma.row.create({
          data: {
            id: newRowId,
            tableId: newTableId,
            order: row.order,
            createdBy: userId,
          },
        });
        rowsCreated++;

        for (const cv of row.cellValues) {
          const mappedColId = colIdMap[cv.columnId];
          if (!mappedColId) continue;
          await prisma.cellValue.create({
            data: {
              rowId: newRowId,
              columnId: mappedColId,
              value: cv.value !== undefined ? cv.value : null,
              userId: null,
              assigneeId: null,
              fileUrl: cv.fileUrl || null,
            },
          });
        }
      }

      for (const view of t.views) {
        const newViewId = uuidv4();
        idMap[view.id] = newViewId;
        await prisma.view.create({
          data: {
            id: newViewId,
            tableId: newTableId,
            name: view.name,
            type: view.type as any,
            settings: view.settings || undefined,
            isDefault: view.isDefault,
            createdBy: userId,
          },
        });

        if (view.viewColumns) {
          for (const vc of view.viewColumns) {
            const mappedColId = colIdMap[vc.columnId];
            if (!mappedColId) continue;
            await prisma.viewColumn.create({
              data: {
                viewId: newViewId,
                columnId: mappedColId,
                order: vc.order,
                visible: vc.visible,
                width: vc.width || 200,
              },
            });
          }
        }

        if (view.filters) {
          for (const f of view.filters) {
            const mappedColId = colIdMap[f.columnId];
            if (!mappedColId) continue;
            await prisma.filter.create({
              data: {
                viewId: newViewId,
                columnId: mappedColId,
                operator: f.operator,
                value: f.value !== undefined ? f.value : null,
                order: f.order,
              },
            });
          }
        }
      }

      for (const form of t.forms) {
        const newFormId = uuidv4();
        idMap[form.id] = newFormId;
        const fields = Array.isArray(form.fields)
          ? form.fields.map((f: any) => ({
              ...f,
              columnId: colIdMap[f.columnId] || f.columnId,
            }))
          : form.fields;

        await prisma.form.create({
          data: {
            id: newFormId,
            tableId: newTableId,
            name: form.name,
            description: form.description || null,
            publicToken: form.publicToken || uuidv4(),
            isActive: form.isActive ?? true,
            submitLabel: form.submitLabel || 'Soumettre',
            successMessage: form.successMessage || '',
            fields: fields || [],
            settings: form.settings || undefined,
            createdBy: userId,
          },
        });

        if (form.submissions) {
          for (const sub of form.submissions) {
            await prisma.formSubmission.create({
              data: {
                formId: newFormId,
                submitterIp: null,
                data: sub.data || {},
              },
            });
          }
        }
      }

      for (const perm of t.permissions) {
        await prisma.permission.create({
          data: {
            tableId: newTableId,
            userId: perm.userId,
            level: perm.level as any,
          },
        });
      }
    }

    res.json({ message: 'Sauvegarde restaurée avec succès', tablesCreated, rowsCreated });
  } catch (err) {
    console.error('Backup import error:', err);
    res.status(500).json({ error: 'Erreur lors de la restauration de la sauvegarde' });
  }
});

export default router;
