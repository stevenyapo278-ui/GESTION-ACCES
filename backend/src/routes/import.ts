import prisma from '../lib/prisma';
import { Router, Response } from 'express';

import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// POST /api/import/:tableId/csv — Import CSV into an existing table
router.post('/:tableId/csv', authenticate, upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const { tableId } = req.params;

    if (!req.file) {
      res.status(400).json({ error: 'No file provided' });
      return;
    }

    const csvContent = req.file.buffer.toString('utf-8');
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    if (records.length === 0) {
      res.status(400).json({ error: 'CSV file is empty' });
      return;
    }

    // Get existing columns
    const columns = await prisma.column.findMany({
      where: { tableId },
      select: { id: true, name: true, type: true },
    });

    const columnMap = new Map(columns.map((c) => [c.name.toLowerCase(), c]));

    // Create rows with cell values
    const createdRows = [];
    for (const record of records) {
      const values: Record<string, any> = {};

      for (const [csvHeader, value] of Object.entries(record)) {
        const column = columnMap.get(csvHeader.toLowerCase());
        if (column && value) {
          // Parse value based on column type
          let parsedValue: any = value;
          if (['NUMBER', 'DECIMAL', 'CURRENCY', 'PERCENTAGE'].includes(column.type)) {
            parsedValue = parseFloat(value as string);
          } else if (column.type === 'YES_NO' || column.type === 'CHECKBOX') {
            parsedValue = ['true', 'yes', 'oui', '1'].includes((value as string).toLowerCase());
          } else if (column.type === 'DATE') {
            parsedValue = value;
          }
          values[column.id] = parsedValue;
        }
      }

      if (Object.keys(values).length > 0) {
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
              create: Object.entries(values).map(([columnId, value]) => ({
                columnId,
                value,
              })),
            },
          },
          include: { cellValues: true },
        });

        createdRows.push(row);
      }
    }

    res.status(201).json({
      imported: createdRows.length,
      rows: createdRows,
    });
  } catch (error) {
    console.error('Import CSV error:', error);
    res.status(500).json({ error: 'Import failed. Check that your CSV headers match column names.' });
  }
});

// POST /api/import/create-and-import — Create table from CSV headers
router.post('/create-and-import', authenticate, upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file provided' });
      return;
    }

    const csvContent = req.file.buffer.toString('utf-8');
    const rawLines = csvContent.split('\n').filter((l) => l.trim());
    
    if (rawLines.length === 0) {
      res.status(400).json({ error: 'CSV file is empty' });
      return;
    }

    const headers = parse(rawLines[0], { columns: false, relax_column_count: true })[0] as string[];
    const records = parse(rawLines.slice(1).join('\n'), {
      columns: headers,
      skip_empty_lines: true,
      trim: true,
    });

    // Infer table name from filename
    const tableName = req.file.originalname.replace(/\.(csv|xls|xlsx)$/i, '');

    // Create table
    const table = await prisma.table.create({
      data: {
        name: tableName,
        createdBy: req.user!.id,
        views: {
          create: {
            name: 'Vue principale',
            type: 'TABLE',
            isDefault: true,
            createdBy: req.user!.id,
          },
        },
      },
    });

    // Create columns
    const columns = [];
    for (let i = 0; i < headers.length; i++) {
      // Infer column type from first data row
      let colType = 'TEXT';
      if (records.length > 0 && records[0][headers[i]]) {
        const val = records[0][headers[i]];
        const strVal = String(val);
        if (/^-?\d+\.?\d*$/.test(strVal)) {
          colType = strVal.includes('.') ? 'DECIMAL' : 'NUMBER';
        } else if (/^\d{4}-\d{2}-\d{2}/.test(strVal)) {
          colType = 'DATE';
        } else if (/^.+@.+\..+$/.test(strVal)) {
          colType = 'EMAIL';
        } else if (/^https?:\/\//.test(strVal)) {
          colType = 'URL';
        }
      }

      const column = await prisma.column.create({
        data: {
          tableId: table.id,
          name: headers[i].trim(),
          type: colType as any,
          order: i,
          createdBy: req.user!.id,
        },
      });
      columns.push(column);
    }

    // Add columns to default view
    const defaultView = await prisma.view.findFirst({
      where: { tableId: table.id, isDefault: true },
    });

    if (defaultView) {
      await prisma.viewColumn.createMany({
        data: columns.map((col, idx) => ({
          viewId: defaultView.id,
          columnId: col.id,
          order: idx,
          visible: true,
        })),
      });
    }

    // Import rows
    const createdRows = [];
    for (const record of records) {
      const cellValues: Record<string, any> = {};
      for (const col of columns) {
        const val = record[col.name];
        if (val !== undefined && val !== null && val !== '') {
          let parsedValue: any = val;
          if (['NUMBER', 'DECIMAL', 'CURRENCY', 'PERCENTAGE'].includes(col.type)) {
            parsedValue = parseFloat(String(val));
          } else if (col.type === 'YES_NO' || col.type === 'CHECKBOX') {
            parsedValue = ['true', 'yes', 'oui', '1'].includes(String(val).toLowerCase());
          }
          cellValues[col.id] = parsedValue;
        }
      }

      const lastRow = await prisma.row.findFirst({
        where: { tableId: table.id },
        orderBy: { order: 'desc' },
      });

      const row = await prisma.row.create({
        data: {
          tableId: table.id,
          order: (lastRow?.order ?? -1) + 1,
          createdBy: req.user!.id,
          cellValues: {
            create: Object.entries(cellValues).map(([columnId, value]) => ({
              columnId,
              value,
            })),
          },
        },
        include: { cellValues: true },
      });

      createdRows.push(row);
    }

    res.status(201).json({
      table,
      columns,
      imported: createdRows.length,
      rows: createdRows,
    });
  } catch (error) {
    console.error('Create and import error:', error);
    res.status(500).json({ error: 'Import failed' });
  }
});

export default router;
