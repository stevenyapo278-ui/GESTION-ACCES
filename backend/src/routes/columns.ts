import prisma from '../lib/prisma';
import { Router, Response } from 'express';
import { PrismaClient, ColumnType } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/audit';

const router = Router();

// POST /api/columns — Create a column
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { tableId, name, type, required, unique, options, formula, settings } = req.body;

    if (!tableId || !name || !type) {
      res.status(400).json({ error: 'tableId, name, and type are required' });
      return;
    }

    // Validate column type
    if (!Object.values(ColumnType).includes(type)) {
      res.status(400).json({ error: `Invalid column type: ${type}` });
      return;
    }

    // Get max order for the table
    const lastColumn = await prisma.column.findFirst({
      where: { tableId },
      orderBy: { order: 'desc' },
    });

    const column = await prisma.column.create({
      data: {
        tableId,
        name,
        type,
        required: required || false,
        unique: unique || false,
        order: (lastColumn?.order ?? -1) + 1,
        options: options || undefined,
        formula: formula || undefined,
        settings: settings || undefined,
        createdBy: req.user!.id,
      },
    });

    // Update default view to include this column
    const defaultView = await prisma.view.findFirst({
      where: { tableId, isDefault: true },
    });

    if (defaultView) {
      await prisma.viewColumn.create({
        data: {
          viewId: defaultView.id,
          columnId: column.id,
          order: column.order,
          visible: true,
        },
      });
    }

    await createAuditLog({
      tableId,
      userId: req.user!.id,
      action: 'CREATE',
      entity: 'COLUMN',
      entityId: column.id,
      changes: { name, type, required, unique, options, formula },
    });

    res.status(201).json(column);
  } catch (error) {
    console.error('Create column error:', error);
    res.status(500).json({ error: 'Failed to create column' });
  }
});

// PUT /api/columns/:id — Update a column
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { name, type, required, unique, options, formula, settings, order } = req.body;
    const oldColumn = await prisma.column.findUnique({ where: { id: req.params.id } });

    if (!oldColumn) {
      res.status(404).json({ error: 'Column not found' });
      return;
    }

    const column = await prisma.column.update({
      where: { id: req.params.id },
      data: { name, type, required, unique, options, formula, settings, order },
    });

    await createAuditLog({
      tableId: column.tableId,
      userId: req.user!.id,
      action: 'UPDATE',
      entity: 'COLUMN',
      entityId: column.id,
      changes: { before: oldColumn, after: column },
    });

    res.json(column);
  } catch (error) {
    console.error('Update column error:', error);
    res.status(500).json({ error: 'Failed to update column' });
  }
});

// DELETE /api/columns/:id — Delete a column
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const column = await prisma.column.findUnique({ where: { id: req.params.id } });
    if (!column) {
      res.status(404).json({ error: 'Column not found' });
      return;
    }

    await prisma.column.delete({ where: { id: req.params.id } });

    res.json({ message: 'Column deleted successfully' });
  } catch (error) {
    console.error('Delete column error:', error);
    res.status(500).json({ error: 'Failed to delete column' });
  }
});

// PUT /api/columns/reorder — Reorder columns
router.put('/reorder/batch', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { columns } = req.body; // Array of { id, order }

    await Promise.all(
      columns.map((col: { id: string; order: number }) =>
        prisma.column.update({
          where: { id: col.id },
          data: { order: col.order },
        })
      )
    );

    res.json({ message: 'Columns reordered' });
  } catch (error) {
    console.error('Reorder columns error:', error);
    res.status(500).json({ error: 'Failed to reorder columns' });
  }
});

export default router;
