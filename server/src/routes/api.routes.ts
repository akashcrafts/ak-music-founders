import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { dbQueries } from '../db/database';
import { FFmpegService } from '../services/ffmpeg.service';
import { JobQueue } from '../services/queue/job.queue';
import { SamplesService } from '../services/samples.service';
import { YouTubeService } from '../services/youtube.service';

const router = express.Router();

const getParam = (val: string | string[] | undefined): string => {
  if (Array.isArray(val)) return val[0];
  return val || '';
};

// Allowed file extensions
const ALLOWED_EXTS = ['.mp4', '.mov', '.mkv', '.webm', '.mp3', '.wav', '.m4a', '.aac'];

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(config.tempDir, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Sanitize filename
    const safeName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniqueName = `${Date.now()}_${uuidv4().slice(0, 8)}_${safeName}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: config.maxFileSizeMb * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTS.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file format "${ext}". Supported: ${ALLOWED_EXTS.join(', ')}`));
    }
  },
});

// GET /api/samples - List demo samples
router.get('/samples', (req: Request, res: Response) => {
  const samples = SamplesService.getSamplesList();
  res.json({ samples });
});

// POST /api/samples/load - Trigger pipeline with a sample file
router.post('/samples/load', async (req: Request, res: Response) => {
  try {
    const { sampleId } = req.body;
    const samples = SamplesService.getSamplesList();
    const sample = samples.find(s => s.id === sampleId);

    if (!sample || !fs.existsSync(sample.filePath)) {
      res.status(404).json({ error: 'Sample file not found. Please re-generate samples.' });
      return;
    }

    const jobId = uuidv4();
    const stats = fs.statSync(sample.filePath);

    // Initial probe & waveform
    const probe = await FFmpegService.probeMedia(sample.filePath);
    const waveform = await FFmpegService.generateWaveformPoints(sample.filePath, 80);

    // Create DB job
    dbQueries.createJob({
      id: jobId,
      user_id: null,
      original_filename: sample.filename,
      original_size: stats.size,
      duration: probe.duration || sample.duration,
      status: 'queued',
      progress: 5,
      current_step: 'Queued for processing',
      separation_method: null,
      original_media_path: sample.filePath,
      extracted_audio_path: null,
      vocals_path: null,
      instrumental_path: null,
      error_message: null,
    });

    dbQueries.addDebugLog(jobId, 'job_created', `Sample job initialized from ${sample.name}`);

    // Enqueue
    JobQueue.enqueue(jobId);

    res.json({
      jobId,
      filename: sample.filename,
      size: stats.size,
      duration: probe.duration || sample.duration,
      waveform,
      status: 'queued',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed loading sample' });
  }
});

// POST /api/upload - Handle user file upload
router.post('/upload', upload.single('media'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No media file was uploaded.' });
      return;
    }

    const filePath = req.file.path;
    const originalName = req.file.originalname;
    const fileSize = req.file.size;
    const jobId = uuidv4();

    // Probe duration & audio presence
    const probe = await FFmpegService.probeMedia(filePath);
    if (!probe.hasAudio) {
      fs.unlinkSync(filePath);
      res.status(400).json({ error: 'The uploaded file does not contain an audio track.' });
      return;
    }

    // Generate fast preview waveform
    const waveform = await FFmpegService.generateWaveformPoints(filePath, 80);

    // Store in DB
    dbQueries.createJob({
      id: jobId,
      user_id: null,
      original_filename: originalName,
      original_size: fileSize,
      duration: probe.duration,
      status: 'queued',
      progress: 5,
      current_step: 'File uploaded, queued for processing',
      separation_method: null,
      original_media_path: filePath,
      extracted_audio_path: null,
      vocals_path: null,
      instrumental_path: null,
      error_message: null,
    });

    dbQueries.addDebugLog(jobId, 'file_uploaded', `Uploaded ${originalName} (${(fileSize / (1024 * 1024)).toFixed(2)} MB, duration: ${probe.duration.toFixed(1)}s)`);

    // Enqueue in worker queue
    JobQueue.enqueue(jobId);

    res.json({
      jobId,
      filename: originalName,
      size: fileSize,
      duration: probe.duration,
      waveform,
      status: 'queued',
    });
  } catch (err: any) {
    console.error('[Upload] Error:', err);
    res.status(500).json({ error: err.message || 'Failed processing upload.' });
  }
});

// POST /api/upload-url - Ingest and analyze video/audio directly from a URL (YouTube, web video, etc.)
router.post('/upload-url', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string' || !url.trim()) {
      res.status(400).json({ error: 'Please enter a valid video or audio URL.' });
      return;
    }

    const cleanUrl = url.trim();
    const jobId = uuidv4();
    const jobTempDir = path.join(config.tempDir, jobId);
    if (!fs.existsSync(jobTempDir)) {
      fs.mkdirSync(jobTempDir, { recursive: true });
    }

    let filePath = '';
    let originalName = 'Online Video';

    // If it is a YouTube or streaming video URL supported by yt-dlp
    if (cleanUrl.includes('youtube.com') || cleanUrl.includes('youtu.be')) {
      const result = await YouTubeService.downloadToMp3(cleanUrl, 320);
      filePath = result.filePath;
      originalName = `${result.title}.mp3`;
    } else {
      // Direct media link (e.g. mp4, webm, mp3)
      const parsedUrl = new URL(cleanUrl);
      const urlExt = path.extname(parsedUrl.pathname) || '.mp4';
      filePath = path.join(jobTempDir, `downloaded_media${urlExt}`);
      originalName = path.basename(parsedUrl.pathname) || 'video_stream';

      const response = await fetch(cleanUrl);
      if (!response.ok) {
        throw new Error(`Failed to download media from URL (HTTP ${response.status})`);
      }
      const buffer = await response.arrayBuffer();
      fs.writeFileSync(filePath, Buffer.from(buffer));
    }

    const stats = fs.statSync(filePath);
    const probe = await FFmpegService.probeMedia(filePath);
    if (!probe.hasAudio) {
      res.status(400).json({ error: 'The video URL does not contain an accessible audio stream.' });
      return;
    }

    const waveform = await FFmpegService.generateWaveformPoints(filePath, 80);

    dbQueries.createJob({
      id: jobId,
      user_id: null,
      original_filename: originalName,
      original_size: stats.size,
      duration: probe.duration,
      status: 'queued',
      progress: 5,
      current_step: 'Video ingested from link, queued for separation',
      separation_method: null,
      original_media_path: filePath,
      extracted_audio_path: null,
      vocals_path: null,
      instrumental_path: null,
      error_message: null,
    });

    dbQueries.addDebugLog(jobId, 'url_ingested', `Ingested media from URL: ${cleanUrl} (${originalName})`);
    JobQueue.enqueue(jobId);

    res.json({
      jobId,
      filename: originalName,
      size: stats.size,
      duration: probe.duration,
      waveform,
      status: 'queued',
    });
  } catch (err: any) {
    console.error('[Upload URL] Error:', err);
    res.status(500).json({ error: err.message || 'Failed ingesting media from URL.' });
  }
});

// GET /api/jobs/:id - Get Job Status & Detected Tracks
router.get('/jobs/:id', (req: Request, res: Response) => {
  const jobId = getParam(req.params.id);
  const job = dbQueries.getJob(jobId);
  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  const tracks = dbQueries.getTracksByJob(job.id);

  res.json({
    job: {
      id: job.id,
      filename: job.original_filename,
      size: job.original_size,
      duration: job.duration,
      status: job.status,
      progress: job.progress,
      currentStep: job.current_step,
      separationMethod: job.separation_method,
      errorMessage: job.error_message,
      hasOriginal: Boolean(job.extracted_audio_path),
      hasVocals: Boolean(job.vocals_path),
      hasInstrumental: Boolean(job.instrumental_path),
      createdAt: job.created_at,
      completedAt: job.completed_at,
    },
    tracks,
  });
});

// GET /api/jobs/:id/events - SSE Stream for real-time updates
router.get('/jobs/:id/events', (req: Request, res: Response) => {
  const jobId = getParam(req.params.id);
  const job = dbQueries.getJob(jobId);

  if (!job) {
    res.status(404).end();
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  JobQueue.addSSEClient(jobId, res);
});

// GET /api/jobs/:id/debug - Developer Debug Logs
router.get('/jobs/:id/debug', (req: Request, res: Response) => {
  const jobId = getParam(req.params.id);
  const job = dbQueries.getJob(jobId);
  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  const logs = dbQueries.getDebugLogs(jobId);
  res.json({
    jobId,
    separationMethod: job.separation_method,
    status: job.status,
    logs,
  });
});

// GET /api/media/:jobId/:stem - Stream audio stems (original, vocals, instrumental)
router.get('/media/:jobId/:stem', (req: Request, res: Response) => {
  const jobId = getParam(req.params.jobId);
  const stem = getParam(req.params.stem);
  const job = dbQueries.getJob(jobId);

  if (!job) {
    res.status(404).send('Job not found');
    return;
  }

  let filePath: string | null = null;
  if (stem === 'original') filePath = job.extracted_audio_path;
  else if (stem === 'vocals') filePath = job.vocals_path;
  else if (stem === 'instrumental') filePath = job.instrumental_path;

  if (!filePath || !fs.existsSync(filePath)) {
    res.status(404).send('Stem audio not found or not yet processed');
    return;
  }

  // Support range requests for HTML5 audio seeking
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  const contentType = filePath.endsWith('.wav') ? 'audio/wav' : 'audio/mpeg';

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = end - start + 1;
    const file = fs.createReadStream(filePath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': contentType,
    };
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
    };
    res.writeHead(200, head);
    fs.createReadStream(filePath).pipe(res);
  }
});

// GET /api/download/:trackId - Download Legal MP3 with user selectable bitrate & ID3 tags
router.get('/download/:trackId', async (req: Request, res: Response) => {
  try {
    const trackId = getParam(req.params.trackId);
    const bitrate = parseInt((req.query.bitrate as string) || '320', 10);
    const validBitrates = [128, 192, 256, 320];
    const targetBitrate = validBitrates.includes(bitrate) ? bitrate : 320;

    const track = dbQueries.getTrackById(trackId);
    if (!track) {
      res.status(404).json({ error: 'Track not found' });
      return;
    }

    if (!track.download_available) {
      res.status(403).json({
        error: 'No authorized downloadable source found for this track.',
        officialSources: track.source_url,
      });
      return;
    }

    const job = dbQueries.getJob(track.job_id);
    if (!job) {
      res.status(404).json({ error: 'Associated job not found' });
      return;
    }

    // Prepare temp output mp3
    const safeTitle = `${track.artist} - ${track.title}`.replace(/[/\\?%*:|"<>]/g, '_');
    const outFilename = `${safeTitle}.mp3`;
    const tempOutPath = path.join(config.tempDir, `dl_${uuidv4()}_${outFilename}`);

    // If we have an instrumental stem from the job, or an audio source:
    const sourceAudioPath = job.instrumental_path || job.extracted_audio_path;
    if (!sourceAudioPath || !fs.existsSync(sourceAudioPath)) {
      res.status(404).json({ error: 'Source audio stem is missing' });
      return;
    }

    // Transcode to user's desired bitrate with ID3 metadata
    await FFmpegService.transcodeToMp3(sourceAudioPath, tempOutPath, {
      bitrateKbps: targetBitrate,
      title: track.title,
      artist: track.artist,
      album: track.album || 'MusicFinder AI Collection',
      year: track.release_year || '2023',
    });

    res.download(tempOutPath, outFilename, (err) => {
      // Clean up temp file after streaming
      if (fs.existsSync(tempOutPath)) {
        fs.unlinkSync(tempOutPath);
      }
    });
  } catch (err: any) {
    console.error('[Download] Error:', err);
    res.status(500).json({ error: err.message || 'MP3 conversion failed' });
  }
});

// GET /api/download/stem/:jobId/:stemType - Download user's isolated stem as MP3
router.get('/download/stem/:jobId/:stemType', async (req: Request, res: Response) => {
  try {
    const jobId = getParam(req.params.jobId);
    const stemType = getParam(req.params.stemType);
    const bitrate = parseInt((req.query.bitrate as string) || '320', 10);
    const validBitrates = [128, 192, 256, 320];
    const targetBitrate = validBitrates.includes(bitrate) ? bitrate : 320;

    const job = dbQueries.getJob(jobId);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    let inputPath: string | null = null;
    let label = 'Track';
    if (stemType === 'instrumental') {
      inputPath = job.instrumental_path;
      label = 'Instrumental';
    } else if (stemType === 'vocals') {
      inputPath = job.vocals_path;
      label = 'Vocals';
    } else {
      inputPath = job.extracted_audio_path;
      label = 'Original_Audio';
    }

    if (!inputPath || !fs.existsSync(inputPath)) {
      res.status(404).json({ error: 'Audio stem not found' });
      return;
    }

    const baseName = path.basename(job.original_filename, path.extname(job.original_filename));
    const outFilename = `${baseName}_${label}_${targetBitrate}kbps.mp3`;
    const tempOutPath = path.join(config.tempDir, `dl_${uuidv4()}_${outFilename}`);

    await FFmpegService.transcodeToMp3(inputPath, tempOutPath, {
      bitrateKbps: targetBitrate,
      title: `${baseName} (${label})`,
      artist: 'MusicFinder AI Stem',
      album: 'Separated Stems',
    });

    res.download(tempOutPath, outFilename, (err) => {
      if (fs.existsSync(tempOutPath)) {
        fs.unlinkSync(tempOutPath);
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Stem download failed' });
  }
});

// ==========================================
// YOUTUBE TO MP3 CONVERTER & DOWNLOADER ROUTES
// ==========================================

// POST /api/youtube/info - Inspect YouTube link
router.post('/youtube/info', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      res.status(400).json({ error: 'Please enter a valid YouTube video URL.' });
      return;
    }

    const info = await YouTubeService.getVideoInfo(url.trim());
    res.json({ info });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed fetching YouTube video details.' });
  }
});

// POST /api/youtube/convert - Download & Transcode to MP3
router.post('/youtube/convert', async (req: Request, res: Response) => {
  try {
    const { url, bitrate } = req.body;
    if (!url || typeof url !== 'string') {
      res.status(400).json({ error: 'Please enter a valid YouTube video URL.' });
      return;
    }

    const targetBitrate = bitrate ? parseInt(bitrate, 10) : 320;
    const result = await YouTubeService.downloadToMp3(url.trim(), targetBitrate);

    res.json({
      success: true,
      downloadId: result.downloadId,
      title: result.title,
      fileSize: result.fileSize,
      downloadUrl: `/api/youtube/download/${result.downloadId}`,
    });
  } catch (err: any) {
    console.error('[YouTube Convert] Error:', err);
    res.status(500).json({ error: err.message || 'Failed converting YouTube video to MP3.' });
  }
});

// GET /api/youtube/download-direct - Direct browser download
router.get('/youtube/download-direct', async (req: Request, res: Response) => {
  try {
    const url = req.query.url as string;
    if (!url || typeof url !== 'string') {
      res.status(400).send('Please provide a valid YouTube URL in the ?url= query parameter.');
      return;
    }

    const bitrate = req.query.bitrate ? parseInt(req.query.bitrate as string, 10) : 320;
    const result = await YouTubeService.downloadToMp3(url, bitrate);

    const safeFilename = `${result.title.replace(/[/\\?%*:|"<>]/g, '_')}.mp3`;
    res.download(result.filePath, safeFilename);
  } catch (err: any) {
    res.status(500).send(`Failed to convert YouTube audio: ${err.message}`);
  }
});

// GET /api/youtube/download/:downloadId - Stream MP3 download
router.get('/youtube/download/:downloadId', (req: Request, res: Response) => {
  const downloadId = getParam(req.params.downloadId);
  const fileInfo = YouTubeService.getDownloadedFile(downloadId);

  if (!fileInfo || !fs.existsSync(fileInfo.filePath)) {
    res.status(404).json({ error: 'Download expired or not found. Please convert again.' });
    return;
  }

  const rawName = fileInfo.filename.replace(/[/\\?%*:|"<>]/g, '_');
  const safeFilename = rawName.toLowerCase().endsWith('.mp3') ? rawName : `${rawName}.mp3`;
  res.download(fileInfo.filePath, safeFilename, (err) => {
    // Optionally clean up after 15 minutes or immediately
  });
});

export default router;
