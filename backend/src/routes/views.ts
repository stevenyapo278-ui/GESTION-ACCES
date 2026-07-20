import prisma from '../lib/prisma';
import { Router, Response } from 'express';
import { PrismaClient, ViewType } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/audit';

const router = Router();

// POST /api/views — Create a view
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { tableId, name, type, settings } = req.body;

    if (!tableId || !name || !type) {
      res.status(400).json({ error: 'tableId, name, and type are required' });
      return;
    }

    const view = await prisma.view.create({
      data: {
        tableId,
        name,
        type,
        settings: settings || undefined,
        createdBy: req.user!.id,
      },
      include: { viewColumns: true, filters: true },
    });

    // Create view columns for all table columns
    const columns = await prisma.column.findMany({
      where: { tableId },
      orderBy: { order: 'asc' },
    });

    if (columns.length > 0) {
      await prisma.viewColumn.createMany({
        data: columns.map((col, idx) => ({
          viewId: view.id,
          columnId: col.id,
          order: idx,
          visible: true,
        })),
      });
    }

    const fullView = await prisma.view.findUnique({
      where: { id: view.id },
      include: {
        viewColumns: {
          include: { column: true },
          orderBy: { order: 'asc' },
        },
        filters: true,
      },
    });

    await createAuditLog({
      tableId,
      userId: req.user!.id,
      action: 'CREATE',
      entity: 'VIEW',
      entityId: view.id,
      changes: { name, type, settings },
    });

    res.status(201).json(fullView);
  } catch (error) {
    console.error('Create view error:', error);
    res.status(500).json({ error: 'Failed to create view' });
  }
});

// PUT /api/views/:id — Update a view
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { name, type, settings, isDefault } = req.body;

    const view = await prisma.view.update({
      where: { id: req.params.id },
      data: { name, type, settings, isDefault },
      include: {
        viewColumns: {
          include: { column: true },
          orderBy: { order: 'asc' },
        },
        filters: true,
      },
    });

    res.json(view);
  } catch (error) {
    console.error('Update view error:', error);
    res.status(500).json({ error: 'Failed to update view' });
  }
});

// DELETE /api/views/:id
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.view.delete({ where: { id: req.params.id } });
    res.json({ message: 'View deleted' });
  } catch (error) {
    console.error('Delete view error:', error);
    res.status(500).json({ error: 'Failed to delete view' });
  }
});

// PUT /api/views/:id/columns — Update view columns visibility/order
router.put('/:id/columns', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { columns } = req.body; // [{ columnId, order, visible, width }]

    // Delete existing view columns
    await prisma.viewColumn.deleteMany({ where: { viewId: req.params.id } });

    // Create new ones
    await prisma.viewColumn.createMany({
      data: columns.map((col: any, idx: number) => ({
        viewId: req.params.id,
        columnId: col.columnId,
        order: col.order ?? idx,
        visible: col.visible ?? true,
        width: col.width ?? 200,
      })),
    });

    const view = await prisma.view.findUnique({
      where: { id: req.params.id },
      include: {
        viewColumns: { orderBy: { order: 'asc' } },
        filters: true,
      },
    });

    res.json(view);
  } catch (error) {
    console.error('Update view columns error:', error);
    res.status(500).json({ error: 'Failed to update view columns' });
  }
});

// PUT /api/views/:id/filters — Update filters
router.put('/:id/filters', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { filters } = req.body; // [{ columnId, operator, value, order }]

    await prisma.filter.deleteMany({ where: { viewId: req.params.id } });

    if (filters && filters.length > 0) {
      await prisma.filter.createMany({
        data: filters.map((f: any, idx: number) => ({
          viewId: req.params.id,
          columnId: f.columnId,
          operator: f.operator,
          value: f.value || undefined,
          order: f.order ?? idx,
        })),
      });
    }

    res.json({ message: 'Filters updated' });
  } catch (error) {
    console.error('Update filters error:', error);
    res.status(500).json({ error: 'Failed to update filters' });
  }
});

export default router;
