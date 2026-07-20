import prisma from '../lib/prisma';
import { Router, Response } from 'express';

import { stringify } from 'csv-stringify/sync';
import PDFDocument from 'pdfkit';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/export/:tableId/csv — Export table to CSV
router.get('/:tableId/csv', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { tableId } = req.params;

    const table = await prisma.table.findUnique({
      where: { id: tableId },
      include: {
        columns: { orderBy: { order: 'asc' } },
        rows: {
          orderBy: { order: 'asc' },
          include: { cellValues: true },
        },
      },
    });

    if (!table) {
      res.status(404).json({ error: 'Table not found' });
      return;
    }

    // Build CSV data
    const headers = table.columns.map((c) => c.name);
    const data = table.rows.map((row) => {
      const cellMap = new Map(row.cellValues.map((cv) => [cv.columnId, cv.value]));
      return table.columns.map((col) => {
        const val = cellMap.get(col.id);
        if (val === null || val === undefined) return '';
        if (typeof val === 'object') return JSON.stringify(val);
        return String(val);
      });
    });

    const csv = stringify([headers, ...data]);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${table.name}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Export CSV error:', error);
    res.status(500).json({ error: 'Export failed' });
  }
});

// GET /api/export/:tableId/pdf — Export table to PDF
router.get('/:tableId/pdf', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { tableId } = req.params;

    const table = await prisma.table.findUnique({
      where: { id: tableId },
      include: {
        columns: { orderBy: { order: 'asc' } },
        rows: {
          orderBy: { order: 'asc' },
          include: { cellValues: true },
        },
      },
    });

    if (!table) {
      res.status(404).json({ error: 'Table not found' });
      return;
    }

    const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${table.name}.pdf"`);

    doc.pipe(res);

    // Title
    doc.fontSize(18).font('Helvetica-Bold').text(table.name, { align: 'center' });
    if (table.description) {
      doc.fontSize(10).font('Helvetica').text(table.description, { align: 'center' });
    }
    doc.moveDown(1);

    // Table header
    const headers = table.columns.map((c) => c.name);
    const cellMap = table.rows.map((row) => {
      const map = new Map(row.cellValues.map((cv) => [cv.columnId, cv.value]));
      return table.columns.map((col) => {
        const val = map.get(col.id);
        if (val === null || val === undefined) return '';
        return String(val);
      });
    });

    const colWidth = Math.min(150, Math.floor((doc.page.width - 60) / headers.length));

    // Draw table
    let y = doc.y;
    const rowHeight = 20;

    // Header row
    doc.fontSize(8).font('Helvetica-Bold');
    headers.forEach((header, i) => {
      doc.rect(30 + i * colWidth, y, colWidth, rowHeight).fill('#2563EB');
      doc.fill('#FFFFFF').text(header, 30 + i * colWidth + 3, y + 5, {
        width: colWidth - 6,
        align: 'left',
      });
    });

    y += rowHeight;

    // Data rows
    doc.font('Helvetica').fontSize(7);
    cellMap.forEach((row, rowIndex) => {
      const bgColor = rowIndex % 2 === 0 ? '#F8FAFC' : '#FFFFFF';
      row.forEach((cell, colIndex) => {
        doc.rect(30 + colIndex * colWidth, y, colWidth, rowHeight).fill(bgColor);
        doc.fill('#1E293B').text(
          cell,
          30 + colIndex * colWidth + 3,
          y + 5,
          { width: colWidth - 6, align: 'left' }
        );
      });
      y += rowHeight;

      // New page if needed
      if (y > doc.page.height - 40) {
        doc.addPage();
        y = 30;
      }
    });

    // Footer
    doc.fontSize(8).fill('#94A3B8').text(
      `Exporté le ${new Date().toLocaleDateString('fr-FR')} — ${table.rows.length} enregistrement(s)`,
      30,
      doc.page.height - 40,
      { align: 'center' }
    );

    doc.end();
  } catch (error) {
    console.error('Export PDF error:', error);
    res.status(500).json({ error: 'Export failed' });
  }
});

// GET /api/export/:tableId/excel — Export as Excel (using CSV for simplicity)
router.get('/:tableId/excel', authenticate, async (req: AuthRequest, res: Response) => {
  // For now, redirect to CSV with .xls extension (works with most spreadsheet software)
  try {
    const { tableId } = req.params;

    const table = await prisma.table.findUnique({
      where: { id: tableId },
      include: {
        columns: { orderBy: { order: 'asc' } },
        rows: {
          orderBy: { order: 'asc' },
          include: { cellValues: true },
        },
      },
    });

    if (!table) {
      res.status(404).json({ error: 'Table not found' });
      return;
    }

    const headers = table.columns.map((c) => c.name);
    const data = table.rows.map((row) => {
      const cellMap = new Map(row.cellValues.map((cv) => [cv.columnId, cv.value]));
      return table.columns.map((col) => {
        const val = cellMap.get(col.id);
        if (val === null || val === undefined) return '';
        if (typeof val === 'object') return JSON.stringify(val);
        return String(val);
      });
    });

    const csv = '\uFEFF' + stringify([headers, ...data]); // BOM for Excel UTF-8

    res.setHeader('Content-Type', 'application/vnd.ms-excel');
    res.setHeader('Content-Disposition', `attachment; filename="${table.name}.xls"`);
    res.send(csv);
  } catch (error) {
    console.error('Export Excel error:', error);
    res.status(500).json({ error: 'Export failed' });
  }
});

export default router;
