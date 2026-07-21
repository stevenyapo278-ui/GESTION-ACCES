import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import tableRoutes from './routes/tables';
import columnRoutes from './routes/columns';
import rowRoutes from './routes/rows';
import viewRoutes from './routes/views';
import uploadRoutes from './routes/upload';
import searchRoutes from './routes/search';
import exportRoutes from './routes/export';
import importRoutes from './routes/import';
import analyticsRoutes from './routes/analytics';
import userRoutes from './routes/users';
import formRoutes from './routes/forms';
import prisma from './lib/prisma';
import backupRoutes, { runAutoBackup } from './routes/backup';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/columns', columnRoutes);
app.use('/api/rows', rowRoutes);
app.use('/api/views', viewRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/import', importRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/users', userRoutes);
app.use('/api/forms', formRoutes);
app.use('/api/backups', backupRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📋 API base: http://localhost:${PORT}/api`);
  console.log(`⏰ Auto-backup scheduler started`);

  const runBackupFromSettings = async () => {
    try {
      const settings = await prisma.backupSettings.findFirst();
      if (!settings || !settings.enabled || settings.frequency === 'manual') return;

      const now = new Date();
      if (settings.nextBackupAt && settings.nextBackupAt > now) return;

      await runAutoBackup();
    } catch {}
  };

  runBackupFromSettings();
  setInterval(runBackupFromSettings, 60_000);
});

export default app;
