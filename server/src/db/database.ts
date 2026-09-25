import Database from 'better-sqlite3';
import { config } from '../config';

const db = new Database(config.dbPath);

// Enable WAL mode for high concurrency
db.pragma('journal_mode = WAL');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    original_filename TEXT NOT NULL,
    original_size INTEGER NOT NULL,
    duration REAL DEFAULT 0,
    status TEXT NOT NULL,
    progress INTEGER DEFAULT 0,
    current_step TEXT,
    separation_method TEXT,
    original_media_path TEXT,
    extracted_audio_path TEXT,
    vocals_path TEXT,
    instrumental_path TEXT,
    error_message TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS tracks (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    album TEXT,
    release_year TEXT,
    genre TEXT,
    artwork_url TEXT,
    confidence INTEGER NOT NULL,
    start_time REAL NOT NULL,
    end_time REAL NOT NULL,
    duration_detected REAL NOT NULL,
    source_name TEXT,
    source_url TEXT,
    license_type TEXT,
    download_available INTEGER DEFAULT 0,
    download_format TEXT,
    download_quality TEXT,
    download_url TEXT,
    preview_audio_url TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(job_id) REFERENCES jobs(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS debug_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT NOT NULL,
    stage TEXT NOT NULL,
    level TEXT DEFAULT 'info',
    message TEXT NOT NULL,
    data_json TEXT,
    timestamp TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
  CREATE INDEX IF NOT EXISTS idx_tracks_job_id ON tracks(job_id);
  CREATE INDEX IF NOT EXISTS idx_debug_logs_job_id ON debug_logs(job_id);
`);

export interface JobRecord {
  id: string;
  user_id: string | null;
  original_filename: string;
  original_size: number;
  duration: number;
  status: string;
  progress: number;
  current_step: string | null;
  separation_method: string | null;
  original_media_path: string | null;
  extracted_audio_path: string | null;
  vocals_path: string | null;
  instrumental_path: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface TrackRecord {
  id: string;
  job_id: string;
  title: string;
  artist: string;
  album: string | null;
  release_year: string | null;
  genre: string | null;
  artwork_url: string | null;
  confidence: number;
  start_time: number;
  end_time: number;
  duration_detected: number;
  source_name: string | null;
  source_url: string | null;
  license_type: string | null;
  download_available: number;
  download_format: string | null;
  download_quality: string | null;
  download_url: string | null;
  preview_audio_url: string | null;
  created_at: string;
}

export interface DebugLogRecord {
  id: number;
  job_id: string;
  stage: string;
  level: string;
  message: string;
  data_json: string | null;
  timestamp: string;
}

export const dbQueries = {
  createJob: (job: Omit<JobRecord, 'created_at' | 'completed_at'>) => {
    const stmt = db.prepare(`
      INSERT INTO jobs (id, user_id, original_filename, original_size, duration, status, progress, current_step, separation_method, original_media_path, extracted_audio_path, vocals_path, instrumental_path, error_message)
      VALUES (@id, @user_id, @original_filename, @original_size, @duration, @status, @progress, @current_step, @separation_method, @original_media_path, @extracted_audio_path, @vocals_path, @instrumental_path, @error_message)
    `);
    stmt.run(job);
  },

  updateJobProgress: (id: string, status: string, progress: number, current_step: string) => {
    const stmt = db.prepare(`
      UPDATE jobs SET status = ?, progress = ?, current_step = ? WHERE id = ?
    `);
    stmt.run(status, progress, current_step, id);
  },

  updateJobPaths: (id: string, paths: { duration?: number; extracted_audio_path?: string; vocals_path?: string; instrumental_path?: string; separation_method?: string }) => {
    const updates: string[] = [];
    const params: any[] = [];

    if (paths.duration !== undefined) { updates.push('duration = ?'); params.push(paths.duration); }
    if (paths.extracted_audio_path !== undefined) { updates.push('extracted_audio_path = ?'); params.push(paths.extracted_audio_path); }
    if (paths.vocals_path !== undefined) { updates.push('vocals_path = ?'); params.push(paths.vocals_path); }
    if (paths.instrumental_path !== undefined) { updates.push('instrumental_path = ?'); params.push(paths.instrumental_path); }
    if (paths.separation_method !== undefined) { updates.push('separation_method = ?'); params.push(paths.separation_method); }

    if (updates.length > 0) {
      params.push(id);
      db.prepare(`UPDATE jobs SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }
  },

  completeJob: (id: string) => {
    db.prepare(`UPDATE jobs SET status = 'completed', progress = 100, current_step = 'Analysis complete', completed_at = datetime('now') WHERE id = ?`).run(id);
  },

  failJob: (id: string, errorMessage: string) => {
    db.prepare(`UPDATE jobs SET status = 'failed', current_step = 'Failed', error_message = ?, completed_at = datetime('now') WHERE id = ?`).run(errorMessage, id);
  },

  getJob: (id: string): JobRecord | undefined => {
    return db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(id) as JobRecord | undefined;
  },

  insertTrack: (track: Omit<TrackRecord, 'created_at'>) => {
    const stmt = db.prepare(`
      INSERT INTO tracks (id, job_id, title, artist, album, release_year, genre, artwork_url, confidence, start_time, end_time, duration_detected, source_name, source_url, license_type, download_available, download_format, download_quality, download_url, preview_audio_url)
      VALUES (@id, @job_id, @title, @artist, @album, @release_year, @genre, @artwork_url, @confidence, @start_time, @end_time, @duration_detected, @source_name, @source_url, @license_type, @download_available, @download_format, @download_quality, @download_url, @preview_audio_url)
    `);
    stmt.run(track);
  },

  getTracksByJob: (jobId: string): TrackRecord[] => {
    return db.prepare(`SELECT * FROM tracks WHERE job_id = ? ORDER BY start_time ASC`).all(jobId) as TrackRecord[];
  },

  getTrackById: (trackId: string): TrackRecord | undefined => {
    return db.prepare(`SELECT * FROM tracks WHERE id = ?`).get(trackId) as TrackRecord | undefined;
  },

  addDebugLog: (jobId: string, stage: string, message: string, data?: any, level = 'info') => {
    const dataJson = data ? JSON.stringify(data) : null;
    db.prepare(`
      INSERT INTO debug_logs (job_id, stage, level, message, data_json)
      VALUES (?, ?, ?, ?, ?)
    `).run(jobId, stage, level, message, dataJson);
  },

  getDebugLogs: (jobId: string): DebugLogRecord[] => {
    return db.prepare(`SELECT * FROM debug_logs WHERE job_id = ? ORDER BY id ASC`).all(jobId) as DebugLogRecord[];
  },

  cleanupOldJobs: (retentionMinutes: number) => {
    const cutoff = new Date(Date.now() - retentionMinutes * 60 * 1000).toISOString();
    return db.prepare(`SELECT id, original_media_path, extracted_audio_path, vocals_path, instrumental_path FROM jobs WHERE created_at < ?`).all(cutoff);
  }
};

export default db;
