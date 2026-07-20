import prisma from '../lib/prisma';
import { Router, Response } from 'express';

import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/analytics/dashboard — Global dashboard stats
router.get('/dashboard', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'ADMIN';

    // Base filters
    const tableFilter = isAdmin ? {} : {
      OR: [
        { createdBy: userId },
        { permissions: { some: { userId } } },
      ],
    };

    const [
      totalTables,
      totalRows,
      totalUsers,
      activeUsers,
      recentChanges,
      recentTables,
      userTables,
    ] = await Promise.all([
      // Total tables accessible
      prisma.table.count({ where: tableFilter }),

      // Total rows
      prisma.row.count({
        where: { table: tableFilter },
      }),

      // Total users (admin only)
      isAdmin ? prisma.user.count() : Promise.resolve(0),

      // Active users (admin only)
      isAdmin ? prisma.user.count({ where: { isActive: true } }) : Promise.resolve(0),

      // Recent changes
      prisma.auditLog.findMany({
        where: isAdmin ? {} : { table: tableFilter },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
          table: { select: { id: true, name: true } },
        },
      }),

      // Recently updated tables
      prisma.table.findMany({
        where: tableFilter,
        orderBy: { updatedAt: 'desc' },
        take: 5,
        include: {
          _count: { select: { columns: true, rows: true } },
        },
      }),

      // Tables created by user
      prisma.table.count({ where: { createdBy: userId } }),
    ]);

    res.json({
      totalTables,
      totalRows,
      totalUsers,
      activeUsers,
      userTables,
      recentChanges,
      recentTables,
    });
  } catch (error) {
    console.error('Dashboard analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// GET /api/analytics/table/:tableId — Table-specific stats
router.get('/table/:tableId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { tableId } = req.params;

    const [totalRows, totalColumns, totalViews, historyCount, recentActivity] = await Promise.all([
      prisma.row.count({ where: { tableId } }),
      prisma.column.count({ where: { tableId } }),
      prisma.view.count({ where: { tableId } }),
      prisma.auditLog.count({ where: { tableId } }),
      prisma.auditLog.findMany({
        where: { tableId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
    ]);

    res.json({
      totalRows,
      totalColumns,
      totalViews,
      historyCount,
      recentActivity,
    });
  } catch (error) {
    console.error('Table analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch table analytics' });
  }
});

export default router;
