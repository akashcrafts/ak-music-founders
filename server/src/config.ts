import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB || '150', 10),
  tempDir: path.resolve(process.env.TEMP_DIR || 'uploads/temp'),
  mediaDir: path.resolve(process.env.MEDIA_DIR || 'uploads/media'),
  dbPath: path.resolve('uploads/musicfinder.db'),
  tempFileTtlMinutes: parseInt(process.env.TEMP_FILE_TTL_MINUTES || '60', 10),
  separationProvider: process.env.SEPARATION_PROVIDER || 'auto',
  demucsPath: process.env.DEMUCS_PATH || '',
  spleeterPath: process.env.SPLEETER_PATH || '',
  auddApiKey: process.env.AUDD_API_KEY || '',
  acrCloud: {
    host: process.env.ACRCLOUD_HOST || '',
    accessKey: process.env.ACRCLOUD_ACCESS_KEY || '',
    secretKey: process.env.ACRCLOUD_SECRET_KEY || '',
  },
  jamendoClientId: process.env.JAMENDO_CLIENT_ID || '',
};

// Ensure directories exist
[config.tempDir, config.mediaDir, path.dirname(config.dbPath)].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});
