import prisma from '../lib/prisma';
import { Router, Response } from 'express';
import multer from 'multer';
import * as Minio from 'minio';
import { v4 as uuidv4 } from 'uuid';
import { authenticate, AuthRequest } from '../middleware/auth';

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

async function ensureBucket(): Promise<void> {
  const exists = await minioClient.bucketExists(BUCKET);
  if (!exists) {
    await minioClient.makeBucket(BUCKET);
    console.log(`Bucket "${BUCKET}" created`);
  }
}

ensureBucket().catch(console.error);

// POST /api/upload
router.post('/', authenticate, upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file provided' });
      return;
    }

    const ext = req.file.originalname.split('.').pop();
    const fileName = `${uuidv4()}.${ext}`;
    const objectName = `uploads/${req.user!.id}/${fileName}`;

    await minioClient.putObject(
      BUCKET, objectName, req.file.buffer, req.file.size,
      { 'Content-Type': req.file.mimetype }
    );

    res.json({
      fileName: req.file.originalname,
      fileUrl: `/api/upload/file/${encodeURIComponent(objectName)}`,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// POST /api/upload/multiple
router.post('/multiple', authenticate, upload.array('files', 20), async (req: AuthRequest, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      res.status(400).json({ error: 'No files provided' });
      return;
    }

    const results = await Promise.all(
      files.map(async (file) => {
        const ext = file.originalname.split('.').pop();
        const fileName = `${uuidv4()}.${ext}`;
        const objectName = `uploads/${req.user!.id}/${fileName}`;

        await minioClient.putObject(
          BUCKET, objectName, file.buffer, file.size,
          { 'Content-Type': file.mimetype }
        );

        return {
          fileName: file.originalname,
          fileUrl: `/api/upload/file/${encodeURIComponent(objectName)}`,
          fileSize: file.size,
          mimeType: file.mimetype,
        };
      })
    );

    res.json(results);
  } catch (error) {
    console.error('Multiple upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// POST /api/upload/column — Upload a file for a specific cell (FILE/IMAGE column)
router.post('/column', authenticate, upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file provided' });
      return;
    }

    const { tableId, columnId, rowId, desiredName } = req.body;
    if (!tableId || !columnId) {
      res.status(400).json({ error: 'tableId and columnId are required' });
      return;
    }

    const ext = req.file.originalname.split('.').pop();
    const baseName = desiredName
      ? desiredName.replace(/[^a-zA-Z0-9_\-]/g, '_').substring(0, 100)
      : uuidv4();
    const fileName = `${baseName}.${ext}`;
    const objectName = `cells/${tableId}/${columnId}/${fileName}`;

    await minioClient.putObject(
      BUCKET, objectName, req.file.buffer, req.file.size,
      { 'Content-Type': req.file.mimetype }
    );

    const fileUrl = `/api/upload/file/${encodeURIComponent(objectName)}`;
    let cellValue = null;

    if (rowId) {
      cellValue = await prisma.cellValue.upsert({
        where: { rowId_columnId: { rowId, columnId } },
        update: { value: fileUrl, fileUrl },
        create: { rowId, columnId, value: fileUrl, fileUrl },
      });
    }

    res.json({
      fileName: req.file.originalname,
      storedAs: fileName,
      fileUrl,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      cellValue,
    });
  } catch (error) {
    console.error('Column upload error:', error);
    res.status(500).json({ error: 'Column upload failed' });
  }
});

// GET /api/upload/file/:objectKey(*) — Proxy file download from MinIO
router.get('/file/:objectKey(*)', async (req: AuthRequest, res: Response) => {
  try {
    const objectKey = decodeURIComponent(req.params.objectKey);
    const stream = await minioClient.getObject(BUCKET, objectKey);
    const stat = await minioClient.statObject(BUCKET, objectKey);

    res.setHeader('Content-Type', stat.meta?.['content-type'] || 'application/octet-stream');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', `inline; filename="${objectKey.split('/').pop()}"`);
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    stream.pipe(res);
  } catch (error) {
    res.status(404).json({ error: 'File not found' });
  }
});

export default router;
