import prisma from '../lib/prisma';
import { Router, Request, Response } from 'express';
import { RequestStatus, Role } from '@prisma/client';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { sendRequestToSuperior, sendRequestDecisionToAdmin, sendRequestDecisionToRequester } from '../services/emailSender';
import { getNotificationEmail } from '../services/systemSettings';

const router = Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Valide les réponses aux champs personnalisés du type de demande et retourne l'objet data
function validateAnswers(type: { fields?: unknown }, data: unknown): Record<string, string> {
  const answers: Record<string, string> = {};
  const fields = Array.isArray(type.fields) ? type.fields : [];
  for (const field of fields as Array<{ key?: string; label?: string; required?: boolean }>) {
    const value = (data && typeof data === 'object' ? (data as Record<string, unknown>)[field.key || ''] : undefined);
    if (field.required && (value === undefined || value === null || String(value).trim() === '')) {
      throw new Error(`Le champ « ${field.label || field.key} » est requis`);
    }
    if (value !== undefined && value !== null) answers[field.key || ''] = String(value);
  }
  return answers;
}

// Applique la décision (approbation/refus) sur une demande PENDING
export async function applyDecision(
  request: { id: string; status: RequestStatus },
  action: 'APPROVE' | 'REJECT',
  comment?: string
) {
  if (request.status !== RequestStatus.PENDING) {
    throw Object.assign(new Error('Cette demande a déjà reçu une réponse'), { status: 409, requestStatus: request.status });
  }

  return prisma.request.update({
    where: { id: request.id },
    data: {
      status: action === 'APPROVE' ? RequestStatus.APPROVED : RequestStatus.REJECTED,
      decidedAt: new Date(),
      decisionComment: comment || null,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC ROUTES (no auth required — lien de décision envoyé par email)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/requests/review/:token — Fetch request for the decision page (public)
router.get('/review/:token', async (req: Request, res: Response) => {
  try {
    const request = await prisma.request.findUnique({
      where: { decisionToken: req.params.token },
      include: {
        type: { select: { name: true, description: true, fields: true } },
        requester: { select: { firstName: true, lastName: true, email: true } },
      },
    });

    if (!request) {
      res.status(404).json({ error: 'Demande introuvable ou lien invalide' });
      return;
    }

    res.json({
      id: request.id,
      typeName: request.type.name,
      typeDescription: request.type.description,
      requesterName: request.requesterName || (request.requester ? `${request.requester.firstName} ${request.requester.lastName}` : 'Utilisateur'),
      requesterEmail: request.requesterEmail || request.requester?.email || '',
      details: request.details,
      data: request.data,
      typeFields: request.type.fields,
      createdAt: request.createdAt,
      status: request.status,
      decidedAt: request.decidedAt,
      decisionComment: request.decisionComment,
    });
  } catch (error) {
    console.error('Fetch request for review error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/requests/review/:token — Approve or reject a request (public)
router.post('/review/:token', async (req: Request, res: Response) => {
  try {
    const { action, comment } = req.body;
    if (!['APPROVE', 'REJECT'].includes(action)) {
      res.status(400).json({ error: 'Action invalide' });
      return;
    }

    const request = await prisma.request.findUnique({
      where: { decisionToken: req.params.token },
      include: {
        type: { select: { name: true, fields: true } },
        requester: { select: { firstName: true, lastName: true, email: true } },
      },
    });

    if (!request) {
      res.status(404).json({ error: 'Demande introuvable ou lien invalide' });
      return;
    }

    if (request.status !== RequestStatus.PENDING) {
      res.status(409).json({ error: 'Cette demande a déjà reçu une réponse', status: request.status });
      return;
    }

    const updated = await applyDecision(request, action as 'APPROVE' | 'REJECT', comment);

    // Notifier l'équipe et le demandeur par email (échec d'envoi non bloquant)
    try {
      await sendRequestDecisionToAdmin({
        ...updated,
        requester: request.requester,
        type: request.type,
      });
    } catch (err) {
      console.error('Notification email error:', (err as Error).message);
    }

    try {
      await sendRequestDecisionToRequester({
        ...updated,
        requester: request.requester,
        type: request.type,
      });
    } catch (err) {
      console.error('Requester notification email error:', (err as Error).message);
    }

    res.json({ message: action === 'APPROVE' ? 'Demande validée' : 'Demande refusée', status: updated.status });
  } catch (error) {
    console.error('Decide request error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/requests/types/public — List active request types (public)
router.get('/types/public', async (_req: Request, res: Response) => {
  try {
    const types = await prisma.requestType.findMany({
      where: { isActive: true },
      select: { id: true, name: true, description: true, fields: true },
      orderBy: { name: 'asc' },
    });
    res.json(types);
  } catch (error) {
    console.error('List public request types error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/requests/public/contact — Email de contact pour les formulaires à transmettre (public)
router.get('/public/contact', async (_req: Request, res: Response) => {
  try {
    const notificationEmail = await getNotificationEmail();
    res.json({ notificationEmail: notificationEmail || '' });
  } catch (error) {
    console.error('Get public contact email error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// AUTHENTICATED ROUTES
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/requests/types — List active request types
router.get('/types', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const types = await prisma.requestType.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    res.json(types);
  } catch (error) {
    console.error('List request types error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/requests/types/all — List all request types (admin only)
router.get('/types/all', authenticate, authorize(Role.ADMIN), async (_req: AuthRequest, res: Response) => {
  try {
    const types = await prisma.requestType.findMany({
      include: { _count: { select: { requests: true } } },
      orderBy: { name: 'asc' },
    });
    res.json(types);
  } catch (error) {
    console.error('List all request types error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/requests/types — Create a request type (admin only)
router.post('/types', authenticate, authorize(Role.ADMIN), async (req: AuthRequest, res: Response) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Le nom est requis' });
      return;
    }
    const fields = typeof req.body.fields === 'string' ? JSON.parse(req.body.fields) : req.body.fields;
    const type = await prisma.requestType.create({
      data: {
        name,
        description,
        ...(Array.isArray(fields) ? { fields } : {}),
      },
    });
    res.status(201).json(type);
  } catch (error: any) {
    if (error?.code === 'P2002') {
      res.status(400).json({ error: 'Ce type de demande existe déjà' });
      return;
    }
    console.error('Create request type error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/requests/types/:id — Update a request type (admin only)
router.put('/types/:id', authenticate, authorize(Role.ADMIN), async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, isActive } = req.body;
    const fields = typeof req.body.fields === 'string' ? JSON.parse(req.body.fields) : req.body.fields;
    const type = await prisma.requestType.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
        ...(Array.isArray(fields) ? { fields } : {}),
      },
    });
    res.json(type);
  } catch (error) {
    console.error('Update request type error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/requests/types/:id — Delete a request type (admin only)
router.delete('/types/:id', authenticate, authorize(Role.ADMIN), async (req: AuthRequest, res: Response) => {
  try {
    await prisma.requestType.delete({ where: { id: req.params.id } });
    res.json({ message: 'Type de demande supprimé' });
  } catch (error) {
    console.error('Delete request type error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/requests/mine — List own requests
router.get('/mine', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const requests = await prisma.request.findMany({
      where: { requesterId: req.user!.id },
      include: { type: { select: { name: true, fields: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(requests);
  } catch (error) {
    console.error('List my requests error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/requests/to-review — Demandes PENDING envoyées à l'utilisateur connecté (supérieur)
router.get('/to-review', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const requests = await prisma.request.findMany({
      where: { superiorEmail: req.user!.email, status: RequestStatus.PENDING },
      include: {
        type: { select: { name: true, fields: true } },
        requester: { select: { firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(requests);
  } catch (error) {
    console.error('List requests to review error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/requests/decide/:id — Valider/refuser une demande reçue (supérieur connecté)
router.post('/decide/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { action, comment } = req.body;
    if (!['APPROVE', 'REJECT'].includes(action)) {
      res.status(400).json({ error: 'Action invalide' });
      return;
    }

    const request = await prisma.request.findUnique({
      where: { id: req.params.id },
      include: {
        type: { select: { name: true, fields: true } },
        requester: { select: { firstName: true, lastName: true, email: true } },
      },
    });

    if (!request) {
      res.status(404).json({ error: 'Demande introuvable' });
      return;
    }

    if (request.superiorEmail.toLowerCase() !== req.user!.email.toLowerCase()) {
      res.status(403).json({ error: 'Cette demande ne vous a pas été adressée' });
      return;
    }

    if (request.status !== RequestStatus.PENDING) {
      res.status(409).json({ error: 'Cette demande a déjà reçu une réponse', status: request.status });
      return;
    }

    const updated = await applyDecision(request, action as 'APPROVE' | 'REJECT', comment);

    try {
      await sendRequestDecisionToAdmin({
        ...updated,
        requester: request.requester,
        type: request.type,
      });
    } catch (err) {
      console.error('Notification email error:', (err as Error).message);
    }

    try {
      await sendRequestDecisionToRequester({
        ...updated,
        requester: request.requester,
        type: request.type,
      });
    } catch (err) {
      console.error('Requester notification email error:', (err as Error).message);
    }

    res.json({ message: action === 'APPROVE' ? 'Demande validée' : 'Demande refusée', status: updated.status });
  } catch (error) {
    console.error('Decide request error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/requests — List all requests (admin only)
router.get('/', authenticate, authorize(Role.ADMIN), async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.query;
    const requests = await prisma.request.findMany({
      where: status ? { status: status as RequestStatus } : {},
      include: {
        type: { select: { name: true } },
        requester: { select: { firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(requests);
  } catch (error) {
    console.error('List all requests error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/requests — Create a request
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { typeId, superiorEmail, details, data } = req.body;

    if (!typeId) {
      res.status(400).json({ error: 'Le type de demande est requis' });
      return;
    }
    if (!superiorEmail || !EMAIL_REGEX.test(superiorEmail)) {
      res.status(400).json({ error: 'Adresse email du supérieur invalide' });
      return;
    }

    const type = await prisma.requestType.findUnique({ where: { id: typeId } });
    if (!type || !type.isActive) {
      res.status(400).json({ error: 'Type de demande introuvable ou inactif' });
      return;
    }

    let answers: Record<string, string>;
    try {
      answers = validateAnswers(type, data);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
      return;
    }

    const request = await prisma.request.create({
      data: {
        typeId,
        requesterId: req.user!.id,
        requesterName: `${req.user!.firstName} ${req.user!.lastName}`,
        requesterEmail: req.user!.email,
        superiorEmail,
        details: details || null,
        data: answers,
      },
    });

    // Envoi de l'email au supérieur : s'il échoue, la demande n'est pas créée
    // (on ne peut pas confirmer l'envoi avec une adresse invalide / un problème de config).
    try {
      await sendRequestToSuperior({
        ...request,
        requester: { firstName: req.user!.firstName, lastName: req.user!.lastName, email: req.user!.email },
        type,
      });
    } catch (err) {
      console.error('Superior email error:', (err as Error).message);
      await prisma.request.delete({ where: { id: request.id } }).catch(() => {});
      res.status(500).json({
        error: "L'email de validation n'a pas pu être envoyé au supérieur. Vérifiez l'adresse email et la configuration du compte d'envoi, puis réessayez.",
      });
      return;
    }

    res.status(201).json(request);
  } catch (error) {
    console.error('Create request error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
