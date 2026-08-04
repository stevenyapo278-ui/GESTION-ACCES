import prisma from '../lib/prisma';
import { Router, Response } from 'express';
import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/users — List all users (admin only)
router.get('/', authenticate, authorize(Role.ADMIN), async (_req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        avatar: true,
        createdAt: true,
        _count: { select: { createdTables: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(users);
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// POST /api/users — Create user (admin only)
router.post('/', authenticate, authorize(Role.ADMIN), async (req: AuthRequest, res: Response) => {
  try {
    const { email, password, firstName, lastName, role } = req.body;

    if (!email || !password || !firstName || !lastName) {
      res.status(400).json({ error: 'All fields are required' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(400).json({ error: 'Email already in use' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role: role || Role.EDITOR,
      },
      select: { id: true, email: true, firstName: true, lastName: true, role: true },
    });

    res.status(201).json(user);
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// PUT /api/users/:id — Update user (admin only)
router.put('/:id', authenticate, authorize(Role.ADMIN), async (req: AuthRequest, res: Response) => {
  try {
    const { firstName, lastName, role, isActive } = req.body;

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { firstName, lastName, role, isActive },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true },
    });

    res.json(user);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// DELETE /api/users/:id — Delete user permanently (admin only)
router.delete('/:id', authenticate, authorize(Role.ADMIN), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Garde-fou : impossible de supprimer son propre compte
    if (id === req.user?.id) {
      res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      res.status(404).json({ error: 'Utilisateur introuvable' });
      return;
    }

    const adminId = req.user!.id;

    await prisma.$transaction(async (tx) => {
      // Détache les références optionnelles (cellules USER, demandes)
      await tx.cellValue.updateMany({ where: { userId: id }, data: { userId: null } });
      await tx.cellValue.updateMany({ where: { assigneeId: id }, data: { assigneeId: null } });
      await tx.request.updateMany({ where: { requesterId: id }, data: { requesterId: null } });
      await tx.request.updateMany({ where: { decidedBy: id }, data: { decidedBy: null } });

      // Transfère le contenu créé à l'admin qui supprime (les données ne sont pas perdues)
      await tx.table.updateMany({ where: { createdBy: id }, data: { createdBy: adminId } });
      await tx.column.updateMany({ where: { createdBy: id }, data: { createdBy: adminId } });
      await tx.row.updateMany({ where: { createdBy: id }, data: { createdBy: adminId } });
      await tx.view.updateMany({ where: { createdBy: id }, data: { createdBy: adminId } });
      await tx.auditLog.updateMany({ where: { userId: id }, data: { userId: adminId } });
      await tx.backup.updateMany({ where: { createdBy: id }, data: { createdBy: adminId } });
      await tx.document.updateMany({ where: { createdBy: id }, data: { createdBy: adminId } });

      // Supprime les réglages de backup (uniques par utilisateur) puis le compte
      // (les permissions sont supprimées en cascade)
      await tx.backupSettings.deleteMany({ where: { createdBy: id } });
      await tx.user.delete({ where: { id } });
    });

    res.json({ message: 'Utilisateur supprimé' });
  } catch (error: any) {
    console.error('Delete user error:', error);
    if (error?.code === 'P2025') {
      res.status(404).json({ error: 'Utilisateur introuvable' });
      return;
    }
    res.status(500).json({ error: 'Impossible de supprimer cet utilisateur (données liées)' });
  }
});

export default router;
