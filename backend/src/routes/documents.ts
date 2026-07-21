import { Router, Response } from 'express';
import multer from 'multer';
import * as Minio from 'minio';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../lib/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9000'),
  useSSL: false,
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin123',
});

const BUCKET = process.env.MINIO_BUCKET || 'gestions-access-uploads';

// GET /api/documents — public, only active documents
router.get('/', async (_req, res: Response) => {
  try {
    const documents = await prisma.document.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        title: true,
        description: true,
        fileName: true,
        fileSize: true,
        mimeType: true,
        createdAt: true,
      },
    });
    res.json(documents.map((d) => ({ ...d, fileUrl: `/api/documents/${d.id}/download` })));
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// GET /api/documents/admin — admin, all documents
router.get('/admin', authenticate, authorize('ADMIN'), async (_req: AuthRequest, res: Response) => {
  try {
    const documents = await prisma.document.findMany({
      orderBy: { order: 'asc' },
      include: {
        creator: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
    res.json(documents);
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// GET /api/documents/:id/download — public, stream file from MinIO
router.get('/:id/download', async (req, res: Response) => {
  try {
    const doc = await prisma.document.findUnique({
      where: { id: req.params.id },
    });
    if (!doc) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }
    if (!doc.isActive) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    res.setHeader('Content-Disposition', `attachment; filename="${doc.fileName}"`);
    res.setHeader('Content-Type', doc.mimeType);

    const stream = await minioClient.getObject(BUCKET, doc.objectKey);
    stream.on('error', () => res.status(500).end());
    stream.pipe(res);
  } catch (error) {
    console.error('Error downloading document:', error);
    res.status(500).json({ error: 'Failed to download document' });
  }
});

// POST /api/documents — admin, upload + create document
router.post('/', authenticate, authorize('ADMIN'), upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file provided' });
      return;
    }

    const ext = req.file.originalname.split('.').pop();
    const objectKey = `documents/${uuidv4()}.${ext}`;

    await minioClient.putObject(
      BUCKET,
      objectKey,
      req.file.buffer,
      req.file.size,
      { 'Content-Type': req.file.mimetype }
    );

    const document = await prisma.document.create({
      data: {
        title: req.body.title || req.file.originalname,
        description: req.body.description || null,
        fileUrl: '',
        objectKey,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        order: parseInt(req.body.order || '0'),
        isActive: req.body.isActive !== 'false',
        createdBy: req.user!.id,
      },
    });

    (document as any).fileUrl = `/api/documents/${document.id}/download`;

    res.json(document);
  } catch (error) {
    console.error('Document upload error:', error);
    res.status(500).json({ error: 'Failed to create document' });
  }
});

// PUT /api/documents/:id — admin update metadata
router.put('/:id', authenticate, authorize('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, isActive, order } = req.body;
    const document = await prisma.document.update({
      where: { id: req.params.id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(isActive !== undefined && { isActive }),
        ...(order !== undefined && { order: parseInt(order) }),
      },
    });
    res.json(document);
  } catch (error) {
    console.error('Error updating document:', error);
    res.status(500).json({ error: 'Failed to update document' });
  }
});

// DELETE /api/documents/:id — admin delete
router.delete('/:id', authenticate, authorize('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (doc) {
      await minioClient.removeObject(BUCKET, doc.objectKey).catch(() => {});
    }
    await prisma.document.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

export default router;
