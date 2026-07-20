import prisma from '../lib/prisma';
import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/audit';

const router = Router();

const publicFormLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  message: { error: 'Trop de requêtes, veuillez réessayer dans quelques minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC ROUTES (no auth required)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/forms/public/:token — Fetch form definition (public, no auth)
router.get('/public/:token', publicFormLimiter, async (req: Request, res: Response) => {
  try {
    const form = await prisma.form.findUnique({
      where: { publicToken: req.params.token },
      include: {
        table: {
          include: {
            columns: { orderBy: { order: 'asc' } },
          },
        },
      },
    });

    if (!form || !form.isActive) {
      res.status(404).json({ error: 'Formulaire introuvable ou inactif' });
      return;
    }

    // Return only necessary info (no internal IDs leakage)
    res.json({
      id: form.id,
      name: form.name,
      description: form.description,
      submitLabel: form.submitLabel,
      successMessage: form.successMessage,
      fields: form.fields,
      settings: form.settings,
      columns: (form.table.columns as any[]).reduce((acc: Record<string, any>, col: any) => {
        acc[col.id] = { name: col.name, type: col.type, options: col.options };
        return acc;
      }, {}),
    });
  } catch (error) {
    console.error('Public form fetch error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/forms/public/:token/submit — Submit a public form (no auth)
router.post('/public/:token/submit', publicFormLimiter, async (req: Request, res: Response) => {
  try {
    const form = await prisma.form.findUnique({
      where: { publicToken: req.params.token },
      include: {
        table: { include: { columns: true } },
      },
    });

    if (!form || !form.isActive) {
      res.status(404).json({ error: 'Formulaire introuvable ou inactif' });
      return;
    }

    const fields = form.fields as any[];
    const submittedData = req.body.data as Record<string, any>;

    // Validate required fields
    for (const field of fields) {
      if (field.required && field.hidden !== true) {
        const val = submittedData[field.columnId];
        const isEmpty = val === undefined || val === null || val === '';
        if (isEmpty) {
          res.status(400).json({ error: `Le champ "${field.label}" est requis.` });
          return;
        }
      }
    }

    // We need a system user to create the row — use the form creator
    const systemUserId = form.createdBy;

    // Create a row in the linked table
    const row = await prisma.row.create({
      data: {
        tableId: form.tableId,
        order: 0,
        createdBy: systemUserId,
      },
    });

    // Create cell values
    const columns = form.table.columns;
    for (const field of fields) {
      if (field.hidden) continue;
      const column = columns.find((c: any) => c.id === field.columnId);
      if (!column) continue;

      const value = submittedData[field.columnId];
      if (value === undefined || value === null || value === '') continue;

      await prisma.cellValue.create({
        data: {
          rowId: row.id,
          columnId: field.columnId,
          value: typeof value === 'object' ? value : { raw: value },
        },
      });
    }

    // Log the submission
    await prisma.formSubmission.create({
      data: {
        formId: form.id,
        rowId: row.id,
        submitterIp: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || null,
        data: submittedData,
      },
    });

    res.status(201).json({
      success: true,
      message: form.successMessage,
      rowId: row.id,
    });
  } catch (error) {
    console.error('Form submit error:', error);
    res.status(500).json({ error: 'Erreur lors de la soumission du formulaire' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// AUTHENTICATED ROUTES
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/forms — List forms for a table
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { tableId } = req.query;
    if (!tableId) {
      res.status(400).json({ error: 'tableId requis' });
      return;
    }

    const forms = await prisma.form.findMany({
      where: { tableId: tableId as string },
      include: {
        _count: { select: { submissions: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    res.json(forms);
  } catch (error) {
    console.error('List forms error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/forms/:id — Get a single form
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const form = await prisma.form.findUnique({
      where: { id: req.params.id },
      include: {
        table: { include: { columns: { orderBy: { order: 'asc' } } } },
        _count: { select: { submissions: true } },
      },
    });

    if (!form) {
      res.status(404).json({ error: 'Formulaire introuvable' });
      return;
    }

    res.json(form);
  } catch (error) {
    console.error('Get form error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/forms — Create a new form
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { tableId, name, description, fields, settings, submitLabel, successMessage } = req.body;

    if (!tableId || !name) {
      res.status(400).json({ error: 'tableId et name sont requis' });
      return;
    }

    // Default fields: include all visible columns
    let formFields = fields;
    if (!formFields || formFields.length === 0) {
      const columns = await prisma.column.findMany({
        where: { tableId },
        orderBy: { order: 'asc' },
      });
      formFields = columns.map((col: any, i: number) => ({
        columnId: col.id,
        label: col.name,
        required: col.required,
        hidden: false,
        order: i,
        helpText: '',
      }));
    }

    const form = await prisma.form.create({
      data: {
        tableId,
        name,
        description,
        fields: formFields,
        settings: settings || {},
        submitLabel: submitLabel || 'Soumettre',
        successMessage: successMessage || 'Votre réponse a bien été enregistrée. Merci !',
        createdBy: req.user!.id,
      },
    });

    await createAuditLog({
      tableId,
      userId: req.user!.id,
      action: 'CREATE',
      entity: 'FORM',
      entityId: form.id,
      changes: { name, description },
    });

    res.status(201).json(form);
  } catch (error) {
    console.error('Create form error:', error);
    res.status(500).json({ error: 'Erreur lors de la création du formulaire' });
  }
});

// PUT /api/forms/:id — Update a form
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, fields, settings, submitLabel, successMessage, isActive } = req.body;

    const existing = await prisma.form.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Formulaire introuvable' });
      return;
    }

    const form = await prisma.form.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(fields !== undefined && { fields }),
        ...(settings !== undefined && { settings }),
        ...(submitLabel !== undefined && { submitLabel }),
        ...(successMessage !== undefined && { successMessage }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    res.json(form);
  } catch (error) {
    console.error('Update form error:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du formulaire' });
  }
});

// DELETE /api/forms/:id — Delete a form
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.form.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Formulaire introuvable' });
      return;
    }

    await prisma.form.delete({ where: { id: req.params.id } });
    res.json({ message: 'Formulaire supprimé' });
  } catch (error) {
    console.error('Delete form error:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

// POST /api/forms/:id/regenerate-token — Regenerate the public token (invalidates old links)
router.post('/:id/regenerate-token', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { v4: uuidv4 } = await import('uuid');
    const form = await prisma.form.update({
      where: { id: req.params.id },
      data: { publicToken: uuidv4() },
    });
    res.json({ publicToken: form.publicToken });
  } catch (error) {
    console.error('Regenerate token error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/forms/:id/submissions — List submissions for a form
router.get('/:id/submissions', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const submissions = await prisma.formSubmission.findMany({
      where: { formId: req.params.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(submissions);
  } catch (error) {
    console.error('List submissions error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
