import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { config } from './config';
import apiRouter from './routes/api.routes';
import { SamplesService } from './services/samples.service';
import { dbQueries } from './db/database';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api', apiRouter);

// Serve frontend build if dist exists
const clientDistPath = path.resolve('../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Error Handling Middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Unhandled Error]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error occurred',
  });
});

// Temp cleanup job every 30 minutes
setInterval(() => {
  try {
    const oldJobs = dbQueries.cleanupOldJobs(config.tempFileTtlMinutes);
    if (oldJobs.length > 0) {
      console.log(`[AutoCleanup] Sweeping ${oldJobs.length} expired jobs`);
      for (const j of oldJobs as any[]) {
        [j.extracted_audio_path, j.vocals_path, j.instrumental_path].forEach((file) => {
          if (file && fs.existsSync(file)) {
            try { fs.unlinkSync(file); } catch {}
          }
        });
      }
    }
  } catch (e) {
    console.error('[AutoCleanup] Error during file cleanup:', e);
  }
}, 30 * 60 * 1000);

// Start server
app.listen(config.port, async () => {
  console.log(`🚀 MusicFinder AI Backend running at http://localhost:${config.port}`);
  console.log(`📁 Temp directory: ${config.tempDir}`);
  console.log(`📁 Media directory: ${config.mediaDir}`);

  // Generate demo samples in background so app is ready instantly
  try {
    console.log('🎵 Initializing sample test assets...');
    await SamplesService.ensureSamplesExist();
    console.log('✅ Sample test assets ready');
  } catch (err) {
    console.warn('⚠️ Could not generate sample assets upfront:', err);
  }
});
