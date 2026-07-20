import prisma from '../lib/prisma';
import { Router, Response } from 'express';

import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/search?tableId=xxx&q=searchTerm
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { tableId, q } = req.query;

    if (!tableId || !q) {
      res.status(400).json({ error: 'tableId and q (search query) are required' });
      return;
    }

    const searchTerm = q as string;

    // Find text-based columns for this table
    const columns = await prisma.column.findMany({
      where: { tableId: tableId as string },
      select: { id: true, name: true, type: true },
    });

    const textColumnIds = columns
      .filter((col) =>
        ['TEXT', 'LONG_TEXT', 'EMAIL', 'PHONE', 'URL', 'DROPDOWN', 'MULTI_SELECT'].includes(col.type)
      )
      .map((col) => col.id);

    if (textColumnIds.length === 0) {
      res.json({ rows: [], tables: [], total: 0 });
      return;
    }

    // Use raw SQL to search inside the JSONB `value` column
    // The value is stored as JSONB; we cast to text and do a case-insensitive search
    const rowIds: { row_id: string }[] = await prisma.$queryRawUnsafe(`
      SELECT DISTINCT cv.row_id
      FROM cell_values cv
      WHERE cv.column_id = ANY($1)
        AND cv.value IS NOT NULL
        AND LOWER(cv.value::text) LIKE $2
      LIMIT 200
    `, textColumnIds, `%${searchTerm.toLowerCase()}%`);

    const foundRowIds = rowIds.map((r) => r.row_id);

    // Also search in table names/descriptions
    const matchingTables = await prisma.table.findMany({
      where: {
        OR: [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { description: { contains: searchTerm, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        name: true,
        description: true,
        icon: true,
        color: true,
        _count: { select: { columns: true, rows: true } },
      },
    });

    const rows = await prisma.row.findMany({
      where: {
        id: { in: foundRowIds },
        tableId: tableId as string,
      },
      include: { cellValues: true },
      orderBy: { order: 'asc' },
      take: 200,
    });

    res.json({
      rows,
      tables: matchingTables,
      total: rows.length,
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// POST /api/search/advanced — Multi-criteria search with parameterized SQL
router.post('/advanced', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { tableId, filters } = req.body;

    if (!tableId || !filters || filters.length === 0) {
      res.status(400).json({ error: 'tableId and filters are required' });
      return;
    }

    // Build parameterized SQL. We start with params[0]=tableId, then add 2 params per filter (columnId, value)
    const params: any[] = [tableId];
    const conditions: string[] = [];

    for (const filter of filters) {
      const { columnId, operator, value } = filter;
      const baseIdx = params.length + 1; // $1 is tableId, so $2, $3...

      params.push(columnId); // column_id param
      const colParam = `$${params.length}`;

      switch (operator) {
        case 'eq': {
          params.push(value ?? '');
          conditions.push(`(cv.column_id = ${colParam} AND cv.value::text = $${params.length})`);
          break;
        }
        case 'neq': {
          params.push(value ?? '');
          conditions.push(`(cv.column_id = ${colParam} AND cv.value::text != $${params.length})`);
          break;
        }
        case 'gt':
        case 'gte':
        case 'lt':
        case 'lte': {
          const op = operator === 'gt' ? '>' : operator === 'gte' ? '>=' : operator === 'lt' ? '<' : '<=';
          params.push(value ?? 0);
          // #>> '{}' gets the JSON primitive as text; cast it to numeric
          conditions.push(`(cv.column_id = ${colParam} AND (cv.value #>> '{}')::numeric ${op} $${params.length})`);
          break;
        }
        case 'contains': {
          params.push(`%${String(value ?? '').toLowerCase()}%`);
          conditions.push(`(cv.column_id = ${colParam} AND LOWER(cv.value::text) LIKE $${params.length})`);
          break;
        }
        case 'isEmpty': {
          conditions.push(`(cv.column_id = ${colParam} AND (cv.value IS NULL OR cv.value::text = '""' OR cv.value::text = 'null'))`);
          break;
        }
        case 'isNotEmpty': {
          conditions.push(`(cv.column_id = ${colParam} AND cv.value IS NOT NULL AND cv.value::text != '""' AND cv.value::text != 'null')`);
          break;
        }
        default: {
          params.push(value ?? '');
          conditions.push(`(cv.column_id = ${colParam} AND cv.value::text = $${params.length})`);
        }
      }
    }

    // Append the expected match count to params (used in HAVING)
    params.push(filters.length);
    const countParam = `$${params.length}`;

    const whereClause = conditions.join(' AND ');

    const rowIds: { row_id: string }[] = await prisma.$queryRawUnsafe(`
      SELECT cv.row_id
      FROM cell_values cv
      INNER JOIN rows r ON r.id = cv.row_id AND r.table_id = $1
      WHERE ${whereClause}
      GROUP BY cv.row_id
      HAVING COUNT(*) = ${countParam}
      LIMIT 200
    `, ...params);

    const foundRowIds = rowIds.map((r) => r.row_id);

    const rows = await prisma.row.findMany({
      where: { id: { in: foundRowIds }, tableId },
      include: { cellValues: true },
      orderBy: { order: 'asc' },
    });

    res.json({ rows, total: rows.length });
  } catch (error) {
    console.error('Advanced search error:', error);
    res.status(500).json({ error: 'Advanced search failed' });
  }
});

export default router;
