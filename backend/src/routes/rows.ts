import prisma from '../lib/prisma';
import { Router, Response } from 'express';

import { authenticate, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/audit';
import { validateRowValues } from '../utils/validateCellValue';

const router = Router();

// POST /api/rows — Create a row with cell values
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { tableId, values } = req.body; // values: { [columnId]: value }

    if (!tableId) {
      res.status(400).json({ error: 'tableId is required' });
      return;
    }

    // Fetch columns for validation
    const columns = await prisma.column.findMany({ where: { tableId } });
    const validationError = validateRowValues(values || {}, columns);
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    // Get the max order
    const lastRow = await prisma.row.findFirst({
      where: { tableId },
      orderBy: { order: 'desc' },
    });

    const row = await prisma.row.create({
      data: {
        tableId,
        order: (lastRow?.order ?? -1) + 1,
        createdBy: req.user!.id,
        cellValues: {
          create: Object.entries(values || {}).map(([columnId, value]) => ({
            columnId,
            value: value as any,
          })),
        },
      },
      include: { cellValues: true },
    });

    await createAuditLog({
      tableId,
      userId: req.user!.id,
      action: 'CREATE',
      entity: 'ROW',
      entityId: row.id,
      changes: values,
    });

    res.status(201).json(row);
  } catch (error) {
    console.error('Create row error:', error);
    res.status(500).json({ error: 'Failed to create row' });
  }
});

// PUT /api/rows/:id — Update a row (and its cell values)
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { values } = req.body;
    const row = await prisma.row.findUnique({
      where: { id: req.params.id },
      include: { cellValues: true, table: { include: { columns: true } } },
    });

    if (!row) {
      res.status(404).json({ error: 'Row not found' });
      return;
    }

    // Validate values against column types
    if (values) {
      const validationError = validateRowValues(values, row.table.columns);
      if (validationError) {
        res.status(400).json({ error: validationError });
        return;
      }
    }

    // Update or create cell values
    if (values) {
      for (const [columnId, value] of Object.entries(values)) {
        await prisma.cellValue.upsert({
          where: {
            rowId_columnId: { rowId: row.id, columnId },
          },
          update: { value: value as any },
          create: {
            rowId: row.id,
            columnId,
            value: value as any,
          },
        });
      }
    }

    const updatedRow = await prisma.row.findUnique({
      where: { id: row.id },
      include: { cellValues: true },
    });

    await createAuditLog({
      tableId: row.tableId,
      userId: req.user!.id,
      action: 'UPDATE',
      entity: 'ROW',
      entityId: row.id,
      changes: { before: row.cellValues, after: updatedRow?.cellValues },
    });

    res.json(updatedRow);
  } catch (error) {
    console.error('Update row error:', error);
    res.status(500).json({ error: 'Failed to update row' });
  }
});

// DELETE /api/rows/:id — Delete a row
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const row = await prisma.row.findUnique({ where: { id: req.params.id } });
    if (!row) {
      res.status(404).json({ error: 'Row not found' });
      return;
    }

    await prisma.row.delete({ where: { id: req.params.id } });

    await createAuditLog({
      tableId: row.tableId,
      userId: req.user!.id,
      action: 'DELETE',
      entity: 'ROW',
      entityId: row.id,
      changes: null,
    });

    res.json({ message: 'Row deleted successfully' });
  } catch (error) {
    console.error('Delete row error:', error);
    res.status(500).json({ error: 'Failed to delete row' });
  }
});

// POST /api/rows/batch — Batch create rows
router.post('/batch', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { tableId, rows } = req.body; // rows: [{ values: {} }]

    // Validate all rows against column types
    const columns = await prisma.column.findMany({ where: { tableId } });
    for (const rowData of rows) {
      const validationError = validateRowValues(rowData.values || {}, columns);
      if (validationError) {
        res.status(400).json({ error: validationError });
        return;
      }
    }

    const created = await Promise.all(
      rows.map(async (rowData: any) => {
        const lastRow = await prisma.row.findFirst({
          where: { tableId },
          orderBy: { order: 'desc' },
        });

        return prisma.row.create({
          data: {
            tableId,
            order: (lastRow?.order ?? -1) + 1,
            createdBy: req.user!.id,
            cellValues: {
              create: Object.entries(rowData.values || {}).map(([columnId, value]) => ({
                columnId,
                value: value as any,
              })),
            },
          },
          include: { cellValues: true },
        });
      })
    );

    res.status(201).json(created);
  } catch (error) {
    console.error('Batch create rows error:', error);
    res.status(500).json({ error: 'Failed to create rows' });
  }
});

export default router;
