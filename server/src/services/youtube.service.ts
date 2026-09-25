import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { FFmpegService } from './ffmpeg.service';

const ytDlpPath = path.resolve('yt-dlp');

export interface YouTubeDownloadResult {
  downloadId: string;
  title: string;
  filePath: string;
  fileSize: number;
}

export class YouTubeService {
  /**
   * Sanitizes and validates a YouTube URL
   */
  public static cleanUrl(rawUrl: string): string {
    const trimmed = rawUrl.trim();
    if (!trimmed.includes('youtube.com') && !trimmed.includes('youtu.be')) {
      throw new Error('Please enter a valid YouTube video or Shorts link.');
    }
    return trimmed;
  }

  /**
   * Fetches metadata for a YouTube URL
   */
  public static async getVideoInfo(url: string): Promise<{ title: string; duration: number; thumbnail: string; uploader: string }> {
    return new Promise((resolve, reject) => {
      const cleaned = this.cleanUrl(url);
      const args = ['--dump-json', '--no-playlist', '--no-warnings', cleaned];
      const proc = spawn(ytDlpPath, args);
      let stdout = '';
      let stderr = '';
      proc.stdout.on('data', (d) => { stdout += d.toString(); });
      proc.stderr.on('data', (d) => { stderr += d.toString(); });
      proc.on('close', (code) => {
        if (code === 0 && stdout.trim().length > 0) {
          try {
            const data = JSON.parse(stdout);
            resolve({
              title: data.title || 'YouTube Audio',
              duration: data.duration || 0,
              thumbnail: data.thumbnail || '',
              uploader: data.uploader || data.channel || 'Unknown Channel',
            });
          } catch {
            resolve({ title: 'YouTube Audio', duration: 0, thumbnail: '', uploader: 'YouTube' });
          }
        } else {
          resolve({ title: 'YouTube Audio', duration: 0, thumbnail: '', uploader: 'YouTube' });
        }
      });
      proc.on('error', () => {
        resolve({ title: 'YouTube Audio', duration: 0, thumbnail: '', uploader: 'YouTube' });
      });
    });
  }

  /**
   * Downloads and converts YouTube video directly to MP3
   */
  public static async downloadToMp3(
    url: string,
    bitrate = 320,
    onProgress?: (percent: number, status: string) => void
  ): Promise<YouTubeDownloadResult> {
    const cleanedUrl = this.cleanUrl(url);
    const downloadId = uuidv4();
    const tempDir = path.join(config.tempDir, 'youtube');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const outputTemplate = path.join(tempDir, `${downloadId}_%(title)s.%(ext)s`);
    const ffmpegPath = FFmpegService.getFfmpegPath();

    onProgress?.(10, 'Connecting to YouTube servers...');

    return new Promise((resolve, reject) => {
      // Optimized high-speed flags: best audio, no playlist, newline progress
      const args = [
        '--ffmpeg-location', ffmpegPath,
        '-f', 'ba/b',
        '-x',
        '--audio-format', 'mp3',
        '--audio-quality', `${bitrate}k`,
        '--no-playlist',
        '--no-warnings',
        '--newline',
        '-o', outputTemplate,
        cleanedUrl
      ];

      const proc = spawn(ytDlpPath, args);
      let stderr = '';
      let detectedTitle = 'YouTube Audio';

      proc.stdout.on('data', (data) => {
        const text = data.toString();

        // Parse download percentage
        const matchPercent = text.match(/\[download\]\s+(\d+\.?\d*)%/);
        if (matchPercent) {
          const pct = Math.min(85, Math.max(15, Math.floor(parseFloat(matchPercent[1]))));
          onProgress?.(pct, `Downloading audio: ${matchPercent[1]}%`);
        }

        // Parse transcoding stage
        if (text.includes('[ExtractAudio]')) {
          onProgress?.(92, 'Transcoding audio to 320 kbps MP3...');
        }

        // Try to capture title from destination path
        const matchDest = text.match(/Destination:\s*.*[/\\]([a-f0-9-]+)_(.+)\.(webm|m4a|mp3)/i);
        if (matchDest && matchDest[2]) {
          detectedTitle = matchDest[2];
        }
      });

      proc.stderr.on('data', (d) => {
        stderr += d.toString();
      });

      proc.on('close', (code) => {
        // Find the generated mp3 file in tempDir starting with downloadId
        const files = fs.readdirSync(tempDir);
        const matchFile = files.find(f => f.startsWith(downloadId) && f.endsWith('.mp3'));

        if (code === 0 && matchFile) {
          const finalPath = path.join(tempDir, matchFile);
          const stats = fs.statSync(finalPath);
          const cleanTitle = matchFile.replace(`${downloadId}_`, '').replace(/\.mp3$/i, '');

          onProgress?.(100, 'Audio conversion complete!');
          resolve({
            downloadId,
            title: cleanTitle || detectedTitle,
            filePath: finalPath,
            fileSize: stats.size,
          });
        } else {
          reject(new Error(`Failed to convert YouTube audio: ${stderr.slice(-300) || 'Video unavailable'}`));
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`yt-dlp error: ${err.message}`));
      });
    });
  }

  public static getDownloadedFile(downloadId: string): { filePath: string; filename: string } | null {
    const tempDir = path.join(config.tempDir, 'youtube');
    if (!fs.existsSync(tempDir)) return null;

    const files = fs.readdirSync(tempDir);
    const match = files.find(f => f.startsWith(downloadId) && f.endsWith('.mp3'));
    if (!match) return null;

    const filePath = path.join(tempDir, match);
    const cleanName = match.replace(`${downloadId}_`, '').replace(/\.mp3$/i, '');
    return { filePath, filename: `${cleanName}.mp3` };
  }
}
