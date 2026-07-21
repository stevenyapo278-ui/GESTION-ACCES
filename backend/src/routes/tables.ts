import { v4 as uuidv4 } from 'uuid';
import prisma from '../lib/prisma';
import { Router, Response } from 'express';

import { authenticate, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/audit';

const router = Router();

// GET /api/tables — List all tables accessible to user
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { search, category } = req.query;

    const where: any = {};

    if (user.role !== 'ADMIN') {
      where.OR = [
        { createdBy: user.id },
        { permissions: { some: { userId: user.id } } },
      ];
    }

    if (search) {
      where.name = { contains: search as string, mode: 'insensitive' };
    }

    if (category) {
      where.category = category as string;
    }

    const tables = await prisma.table.findMany({
      where,
      include: {
        _count: { select: { columns: true, rows: true } },
        creator: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    res.json(tables);
  } catch (error) {
    console.error('List tables error:', error);
    res.status(500).json({ error: 'Failed to fetch tables' });
  }
});

// GET /api/tables/:id — Get table with columns, paginated rows, and views
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(500, Math.max(10, parseInt(req.query.pageSize as string) || 100));
    const skip = (page - 1) * pageSize;

    const [table, totalRows] = await Promise.all([
      prisma.table.findUnique({
        where: { id: req.params.id },
        include: {
          columns: { orderBy: { order: 'asc' } },
          rows: {
            orderBy: { order: 'asc' },
            skip,
            take: pageSize,
            include: { cellValues: true },
          },
          views: {
            include: {
              viewColumns: { orderBy: { order: 'asc' } },
              filters: { orderBy: { order: 'asc' } },
            },
          },
          creator: { select: { id: true, firstName: true, lastName: true, email: true } },
          _count: { select: { columns: true, rows: true } },
        },
      }),
      prisma.row.count({ where: { tableId: req.params.id } }),
    ]);

    if (!table) {
      res.status(404).json({ error: 'Table not found' });
      return;
    }

    res.json({
      ...table,
      pagination: {
        page,
        pageSize,
        total: totalRows,
        totalPages: Math.ceil(totalRows / pageSize),
      },
    });
  } catch (error) {
    console.error('Get table error:', error);
    res.status(500).json({ error: 'Failed to fetch table' });
  }
});


// POST /api/tables — Create a new table
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, icon, color, category } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Table name is required' });
      return;
    }

    const table = await prisma.table.create({
      data: {
        name,
        description,
        icon: icon || 'table',
        color: color || '#3B82F6',
        category,
        createdBy: req.user!.id,
        // Create default view
        views: {
          create: {
            name: 'Vue principale',
            type: 'TABLE',
            isDefault: true,
            createdBy: req.user!.id,
          },
        },
      },
      include: {
        views: true,
      },
    });

    await createAuditLog({
      tableId: table.id,
      userId: req.user!.id,
      action: 'CREATE',
      entity: 'TABLE',
      entityId: table.id,
      changes: { name, description, icon, color, category },
    });

    res.status(201).json(table);
  } catch (error) {
    console.error('Create table error:', error);
    res.status(500).json({ error: 'Failed to create table' });
  }
});

// PUT /api/tables/:id — Update a table
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, icon, color, category } = req.body;
    const oldTable = await prisma.table.findUnique({ where: { id: req.params.id } });

    if (!oldTable) {
      res.status(404).json({ error: 'Table not found' });
      return;
    }

    const table = await prisma.table.update({
      where: { id: req.params.id },
      data: { name, description, icon, color, category },
    });

    await createAuditLog({
      tableId: table.id,
      userId: req.user!.id,
      action: 'UPDATE',
      entity: 'TABLE',
      entityId: table.id,
      changes: { before: oldTable, after: table },
    });

    res.json(table);
  } catch (error) {
    console.error('Update table error:', error);
    res.status(500).json({ error: 'Failed to update table' });
  }
});

// DELETE /api/tables/:id — Delete a table (cascades)
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const table = await prisma.table.findUnique({ where: { id: req.params.id } });
    if (!table) {
      res.status(404).json({ error: 'Table not found' });
      return;
    }

    await prisma.table.delete({ where: { id: req.params.id } });

    res.json({ message: 'Table deleted successfully' });
  } catch (error) {
    console.error('Delete table error:', error);
    res.status(500).json({ error: 'Failed to delete table' });
  }
});

// POST /api/tables/:id/duplicate — Duplicate a table with all columns, rows, views
router.post('/:id/duplicate', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const source = await prisma.table.findUnique({
      where: { id: req.params.id },
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
      },
    });

    if (!source) {
      res.status(404).json({ error: 'Table not found' });
      return;
    }

    const userId = req.user!.id;

    const newTableId = uuidv4();
    const colIdMap: Record<string, string> = {};

    await prisma.table.create({
      data: {
        id: newTableId,
        name: `Copie de ${source.name}`,
        description: source.description,
        icon: source.icon,
        color: source.color,
        category: source.category,
        createdBy: userId,
      },
    });

    for (const col of source.columns) {
      const newId = uuidv4();
      colIdMap[col.id] = newId;
      await prisma.column.create({
        data: {
          id: newId,
          tableId: newTableId,
          name: col.name,
          type: col.type,
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

    for (const row of source.rows) {
      const newRowId = uuidv4();
      await prisma.row.create({
        data: {
          id: newRowId,
          tableId: newTableId,
          order: row.order,
          createdBy: userId,
        },
      });

      for (const cv of row.cellValues) {
        const mappedColId = colIdMap[cv.columnId];
        if (!mappedColId) continue;
        await prisma.cellValue.create({
          data: {
            rowId: newRowId,
            columnId: mappedColId,
            value: cv.value !== undefined ? cv.value as any : null,
            userId: null,
            assigneeId: null,
            fileUrl: cv.fileUrl || null,
          },
        });
      }
    }

    for (const view of source.views) {
      const newViewId = uuidv4();
      await prisma.view.create({
        data: {
          id: newViewId,
          tableId: newTableId,
          name: view.name,
          type: view.type,
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
              value: f.value !== undefined ? f.value as any : null,
              order: f.order,
            },
          });
        }
      }
    }

    const created = await prisma.table.findUnique({
      where: { id: newTableId },
      include: {
        columns: { orderBy: { order: 'asc' } },
        _count: { select: { columns: true, rows: true } },
        creator: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    res.status(201).json(created);
  } catch (error) {
    console.error('Duplicate table error:', error);
    res.status(500).json({ error: 'Failed to duplicate table' });
  }
});

// POST /api/tables/seed-access-template — Crée le template 'Demande d'accès'
router.post('/seed-access-template', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const columns: Array<{ name: string; type: any; order: number; required?: boolean; options?: string[] }> = [
      // Section 1 : Service ou Site Demandeur
      { name: 'Service ou Site', type: 'TEXT', order: 1, required: true },
      { name: 'Demandeur - Nom & Prénoms', type: 'TEXT', order: 2, required: true },
      { name: 'Demandeur - Identifiant', type: 'TEXT', order: 3 },
      { name: 'Demandeur - Fonction', type: 'TEXT', order: 4 },
      { name: 'Demandeur - Email', type: 'EMAIL', order: 5, required: true },

      // Section 2 : Création d'un nouveau compte
      { name: 'Nouveau compte - Nom & Prénoms', type: 'TEXT', order: 6 },
      { name: 'Nouveau compte - Fonction', type: 'TEXT', order: 7 },
      { name: 'Nouveau compte - Position hiérarchique', type: 'TEXT', order: 8 },
      { name: 'Nouveau compte - Email', type: 'EMAIL', order: 9 },
      { name: 'Nouveau compte - Identifiant', type: 'TEXT', order: 10 },
      { name: 'Nouveau compte - Matricule', type: 'TEXT', order: 11 },

      // Section 3 : Accès et Applications
      { name: 'Suite bureautique', type: 'DROPDOWN', order: 12, options: ['Oui', 'Non'] },
      { name: 'Office 365', type: 'DROPDOWN', order: 13, options: ['Oui', 'Non'] },
      { name: 'CYRUS', type: 'DROPDOWN', order: 14, options: ['Oui', 'Non'] },
      { name: 'CYRUS - Niveau accès', type: 'TEXT', order: 15 },
      { name: 'CYRUS - Profil témoin', type: 'TEXT', order: 16 },
      { name: 'ASTEN', type: 'DROPDOWN', order: 17, options: ['Oui', 'Non'] },
      { name: 'ASTEN - Niveau accès', type: 'TEXT', order: 18 },
      { name: 'ASTEN - Profil témoin', type: 'TEXT', order: 19 },
      { name: 'GPV', type: 'DROPDOWN', order: 20, options: ['Oui', 'Non'] },
      { name: 'GPV - Niveau accès', type: 'TEXT', order: 21 },
      { name: 'GPV - Profil témoin', type: 'TEXT', order: 22 },
      { name: 'LEGEND', type: 'DROPDOWN', order: 23, options: ['Oui', 'Non'] },
      { name: 'LEGEND - Niveau accès', type: 'TEXT', order: 24 },
      { name: 'LEGEND - Profil témoin', type: 'TEXT', order: 25 },
      { name: 'PROBI', type: 'DROPDOWN', order: 26, options: ['Oui', 'Non'] },
      { name: 'PROBI - Niveau accès', type: 'TEXT', order: 27 },
      { name: 'PROBI - Profil témoin', type: 'TEXT', order: 28 },
      { name: 'PROTRANS', type: 'DROPDOWN', order: 29, options: ['Oui', 'Non'] },
      { name: 'PROTRANS - Niveau accès', type: 'TEXT', order: 30 },
      { name: 'PROTRANS - Profil témoin', type: 'TEXT', order: 31 },
      { name: 'Accès par VPN', type: 'DROPDOWN', order: 32, options: ['Oui', 'Non'] },
      { name: 'VPN - Justification', type: 'TEXT', order: 33 },
      { name: 'Code caisse', type: 'DROPDOWN', order: 34, options: ['Oui', 'Non'] },
      { name: 'Dossiers partagés', type: 'LONG_TEXT', order: 35 },

      // Section 4 : Statut & Validation
      { name: 'Statut', type: 'DROPDOWN', order: 36, required: true, options: ['Brouillon', 'Soumis', 'Validé', 'Refusé'] },
      { name: 'Validateur - Nom & Prénoms', type: 'TEXT', order: 37 },
      { name: 'Validateur - Fonction', type: 'TEXT', order: 38 },
      { name: 'Avis', type: 'DROPDOWN', order: 39, options: ['Favorable', 'Défavorable'] },
      { name: 'Date validation', type: 'DATE', order: 40 },
    ];

    // Créer le tableau
    const table = await prisma.table.create({
      data: {
        name: "Demande d'accès",
        description: "Formulaire de demande d'accès aux applications (FRM-IAM-002)",
        icon: 'file-text',
        color: '#d29922',
        createdBy: userId,
        views: {
          create: {
            name: 'Toutes les demandes',
            type: 'TABLE',
            isDefault: true,
            createdBy: userId,
          },
        },
      },
      include: { views: true },
    });

    // Créer les colonnes
    for (const col of columns) {
      await prisma.column.create({
        data: {
          tableId: table.id,
          name: col.name,
          type: col.type,
          required: col.required ?? false,
          order: col.order,
          options: col.options ?? undefined,
          createdBy: userId,
        },
      });
    }

    // Configurer les colonnes de la vue
    const createdColumns = await prisma.column.findMany({
      where: { tableId: table.id },
      orderBy: { order: 'asc' },
    });
    if (table.views[0]) {
      await prisma.viewColumn.createMany({
        data: createdColumns.map((c, i) => ({
          viewId: table.views[0].id,
          columnId: c.id,
          order: i,
          visible: true,
        })),
      });
    }

    await createAuditLog({
      tableId: table.id,
      userId,
      action: 'CREATE',
      entity: 'TABLE',
      entityId: table.id,
      changes: { type: 'seed-template', name: "Demande d'accès" },
    });

    res.status(201).json(table);
  } catch (error) {
    console.error('Seed template error:', error);
    res.status(500).json({ error: 'Failed to create access request template' });
  }
});

export default router;
