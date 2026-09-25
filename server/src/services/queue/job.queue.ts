import path from 'path';
import fs from 'fs';
import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config';
import { dbQueries } from '../../db/database';
import { FFmpegService } from '../ffmpeg.service';
import { SeparationService } from '../separation/separation.service';
import { RecognitionService } from '../recognition/recognition.service';
import { SourceDiscoveryService } from '../sources/source.service';

interface SSEClient {
  jobId: string;
  res: Response;
}

export class JobQueue {
  private static sseClients: SSEClient[] = [];
  private static isProcessing = false;
  private static queue: string[] = [];

  /**
   * Register client for Server-Sent Events (SSE) updates
   */
  public static addSSEClient(jobId: string, res: Response) {
    this.sseClients.push({ jobId, res });

    // Initial event
    const job = dbQueries.getJob(jobId);
    if (job) {
      this.sendSSE(res, {
        type: 'STATUS_UPDATE',
        jobId,
        status: job.status,
        progress: job.progress,
        currentStep: job.current_step,
      });
    }

    res.on('close', () => {
      this.sseClients = this.sseClients.filter(c => c.res !== res);
    });
  }

  /**
   * Broadcast SSE payload to all clients tracking this jobId
   */
  public static broadcast(jobId: string, data: any) {
    const clients = this.sseClients.filter(c => c.jobId === jobId);
    for (const client of clients) {
      this.sendSSE(client.res, data);
    }
  }

  private static sendSSE(res: Response, data: any) {
    try {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch {
      // client disconnected
    }
  }

  /**
   * Enqueue job for background processing
   */
  public static enqueue(jobId: string) {
    this.queue.push(jobId);
    this.processNext();
  }

  private static async processNext() {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;
    const jobId = this.queue.shift()!;

    try {
      await this.runPipeline(jobId);
    } catch (err: any) {
      console.error(`[JobQueue] Job ${jobId} failed:`, err);
      dbQueries.failJob(jobId, err.message || 'Processing failed');
      this.broadcast(jobId, {
        type: 'JOB_FAILED',
        jobId,
        error: err.message || 'Processing failed',
      });
    } finally {
      this.isProcessing = false;
      this.processNext();
    }
  }

  /**
   * Executes the 5-step background pipeline
   */
  private static async runPipeline(jobId: string) {
    const job = dbQueries.getJob(jobId);
    if (!job || !job.original_media_path) {
      throw new Error('Job or media file not found');
    }

    const jobMediaDir = path.join(config.mediaDir, jobId);
    if (!fs.existsSync(jobMediaDir)) {
      fs.mkdirSync(jobMediaDir, { recursive: true });
    }

    dbQueries.addDebugLog(jobId, 'pipeline_start', `Starting processing pipeline for file: ${job.original_filename}`);

    // ==========================================
    // 1. EXTRACT AUDIO
    // ==========================================
    this.updateStatus(jobId, 'extracting', 10, 'Extracting audio from file...');
    const probe = await FFmpegService.probeMedia(job.original_media_path);
    dbQueries.addDebugLog(jobId, 'ffmpeg_probe', 'Media probe completed', probe);

    if (!probe.hasAudio) {
      throw new Error('Uploaded file contains no audio track. Please upload media with audio.');
    }

    const extractedAudioWav = path.join(jobMediaDir, 'original.wav');
    await FFmpegService.extractAudio(job.original_media_path, extractedAudioWav);

    dbQueries.updateJobPaths(jobId, {
      duration: probe.duration,
      extracted_audio_path: extractedAudioWav,
    });

    dbQueries.addDebugLog(jobId, 'audio_extracted', `Audio extracted successfully. Duration: ${probe.duration.toFixed(2)}s`);
    this.updateStatus(jobId, 'extracting', 25, 'Audio extracted and normalized');

    // ==========================================
    // 2. SEPARATE VOCALS & MUSIC
    // ==========================================
    this.updateStatus(jobId, 'separating', 35, 'Separating vocals and instrumental tracks...');
    dbQueries.addDebugLog(jobId, 'separation_start', 'Invoking vocal and instrumental separation engine');

    const sepResult = await SeparationService.separate(extractedAudioWav, jobMediaDir);

    dbQueries.updateJobPaths(jobId, {
      vocals_path: sepResult.vocalsPath,
      instrumental_path: sepResult.instrumentalPath,
      separation_method: sepResult.methodUsed,
    });

    dbQueries.addDebugLog(jobId, 'separation_complete', `Separation finished using ${sepResult.methodUsed} in ${sepResult.durationSeconds.toFixed(2)}s`);
    this.updateStatus(jobId, 'separating', 50, 'Vocals and instrumental separated');

    // ==========================================
    // 3. ANALYZE MUSIC SECTIONS & IDENTIFY
    // ==========================================
    this.updateStatus(jobId, 'analyzing', 60, 'Analyzing music sections and rhythms...');

    const identifiedTracks = await RecognitionService.analyzeInstrumental(
      jobId,
      sepResult.instrumentalPath,
      job.original_filename,
      probe.duration,
      (step, progress) => {
        this.updateStatus(jobId, 'identifying', progress, step);
      }
    );

    if (identifiedTracks.length === 0) {
      dbQueries.addDebugLog(jobId, 'no_tracks', 'No identifiable music tracks detected');
      this.updateStatus(jobId, 'completed', 100, 'Analysis complete. No background music detected.');
      dbQueries.completeJob(jobId);
      this.broadcast(jobId, { type: 'JOB_COMPLETED', jobId, tracksCount: 0 });
      return;
    }

    // ==========================================
    // 4. DISCOVER AUTHORIZED SOURCES
    // ==========================================
    this.updateStatus(jobId, 'discovering', 85, 'Searching for authorized and downloadable sources...');

    for (const track of identifiedTracks) {
      dbQueries.addDebugLog(jobId, 'source_search', `Searching legitimate sources for: ${track.artist} - ${track.title}`);
      const source = await SourceDiscoveryService.findAuthorizedSource(track.title, track.artist);

      const trackRecord = {
        id: uuidv4(),
        job_id: jobId,
        title: track.title,
        artist: track.artist,
        album: track.album,
        release_year: track.releaseYear,
        genre: track.genre,
        artwork_url: track.artworkUrl,
        confidence: track.confidence,
        start_time: track.startTime,
        end_time: track.endTime,
        duration_detected: track.durationDetected,
        source_name: source.sourceName,
        source_url: source.sourceUrl,
        license_type: source.licenseType,
        download_available: source.downloadAvailable ? 1 : 0,
        download_format: source.downloadFormat || 'MP3',
        download_quality: source.downloadQuality || '320 kbps',
        download_url: source.downloadUrl || null,
        preview_audio_url: track.previewAudioUrl || null,
      };

      dbQueries.insertTrack(trackRecord);
      dbQueries.addDebugLog(jobId, 'source_result', `Source found for ${track.title}: ${source.sourceName}`, source);
    }

    // ==========================================
    // 5. FINALIZE & COMPLETE
    // ==========================================
    this.updateStatus(jobId, 'completed', 100, 'Analysis complete! Results ready.');
    dbQueries.completeJob(jobId);

    const tracks = dbQueries.getTracksByJob(jobId);
    this.broadcast(jobId, {
      type: 'JOB_COMPLETED',
      jobId,
      tracksCount: tracks.length,
      tracks,
    });
  }

  private static updateStatus(jobId: string, status: string, progress: number, currentStep: string) {
    dbQueries.updateJobProgress(jobId, status, progress, currentStep);
    this.broadcast(jobId, {
      type: 'STATUS_UPDATE',
      jobId,
      status,
      progress,
      currentStep,
    });
  }
}
