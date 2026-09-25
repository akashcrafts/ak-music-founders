import { exec, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import ffmpegStatic from 'ffmpeg-static';

const ffmpegPath: string = ffmpegStatic || 'ffmpeg';

export interface MediaProbeInfo {
  duration: number; // in seconds
  formatName: string;
  hasAudio: boolean;
  hasVideo: boolean;
  audioCodec?: string;
  sampleRate?: number;
  channels?: number;
  bitrate?: number;
}

export interface Mp3TranscodeOptions {
  bitrateKbps: number; // 128, 192, 256, 320
  title?: string;
  artist?: string;
  album?: string;
  year?: string;
  artworkPath?: string;
}

export class FFmpegService {
  public static getFfmpegPath(): string {
    return ffmpegPath;
  }

  /**
   * Probes media file duration, streams, and codecs using ffmpeg.
   */
  public static async probeMedia(filePath: string): Promise<MediaProbeInfo> {
    return new Promise((resolve, reject) => {
      // ffmpeg -i <file> prints metadata to stderr
      const cmd = `"${ffmpegPath}" -hide_banner -i "${filePath}"`;
      exec(cmd, (error, stdout, stderr) => {
        const output = (stderr || '') + (stdout || '');

        let duration = 0;
        // Parse Duration: 00:01:23.45
        const durationMatch = output.match(/Duration:\s*(\d+):(\d+):(\d+\.?\d*)/);
        if (durationMatch) {
          const hours = parseFloat(durationMatch[1]);
          const minutes = parseFloat(durationMatch[2]);
          const seconds = parseFloat(durationMatch[3]);
          duration = hours * 3600 + minutes * 60 + seconds;
        }

        const hasAudio = /Audio:/.test(output);
        const hasVideo = /Video:/.test(output);

        // Parse Audio codec, sample rate, channels
        const audioMatch = output.match(/Audio:\s*([^,\s]+)[^,]*,\s*(\d+)\s*Hz,\s*([^,]+)/);
        const audioCodec = audioMatch ? audioMatch[1] : undefined;
        const sampleRate = audioMatch ? parseInt(audioMatch[2], 10) : undefined;
        const channels = audioMatch ? (audioMatch[3].includes('stereo') ? 2 : audioMatch[3].includes('mono') ? 1 : 2) : undefined;

        // Parse bitrate
        const bitrateMatch = output.match(/bitrate:\s*(\d+)\s*kb\/s/);
        const bitrate = bitrateMatch ? parseInt(bitrateMatch[1], 10) : undefined;

        resolve({
          duration,
          formatName: path.extname(filePath).replace('.', '').toLowerCase(),
          hasAudio,
          hasVideo,
          audioCodec,
          sampleRate,
          channels,
          bitrate,
        });
      });
    });
  }

  /**
   * Extracts audio from video or normalizes audio file to high-quality intermediate WAV (44.1kHz, 16-bit stereo).
   */
  public static async extractAudio(inputPath: string, outputPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const parentDir = path.dirname(outputPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      // -vn: ignore video
      // -acodec pcm_s16le: lossless 16-bit PCM
      // -ar 44100: 44.1kHz
      // -ac 2: stereo
      const args = [
        '-y',
        '-i', inputPath,
        '-vn',
        '-acodec', 'pcm_s16le',
        '-ar', '44100',
        '-ac', '2',
        outputPath
      ];

      const proc = spawn(ffmpegPath, args);
      let stderr = '';

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0 && fs.existsSync(outputPath)) {
          resolve(outputPath);
        } else {
          reject(new Error(`FFmpeg audio extraction failed (code ${code}): ${stderr.slice(-300)}`));
        }
      });

      proc.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Cuts a segment of audio between startTime and startTime + duration.
   */
  public static async extractSegment(inputPath: string, startTime: number, duration: number, outputPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = [
        '-y',
        '-ss', startTime.toFixed(2),
        '-t', duration.toFixed(2),
        '-i', inputPath,
        '-acodec', 'pcm_s16le',
        '-ar', '44100',
        '-ac', '2',
        outputPath
      ];

      const proc = spawn(ffmpegPath, args);
      let stderr = '';

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0 && fs.existsSync(outputPath)) {
          resolve(outputPath);
        } else {
          reject(new Error(`FFmpeg segment extraction failed (code ${code}): ${stderr.slice(-300)}`));
        }
      });

      proc.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Detects silent vs active music segments across the audio file.
   * Returns candidate non-silent sections with start and end times.
   */
  public static async detectActiveSections(audioPath: string, totalDuration: number): Promise<Array<{ start: number; end: number; duration: number }>> {
    return new Promise((resolve) => {
      const args = [
        '-hide_banner',
        '-i', audioPath,
        '-af', 'silencedetect=noise=-30dB:d=0.5',
        '-f', 'null',
        '-'
      ];

      const proc = spawn(ffmpegPath, args);
      let output = '';

      proc.stderr.on('data', (data) => {
        output += data.toString();
      });

      proc.on('close', () => {
        const silentRanges: Array<{ start: number; end: number }> = [];
        const silenceStartRegex = /silence_start:\s*(\d+\.?\d*)/g;
        const silenceEndRegex = /silence_end:\s*(\d+\.?\d*)/g;

        const starts: number[] = [];
        let match;
        while ((match = silenceStartRegex.exec(output)) !== null) {
          starts.push(parseFloat(match[1]));
        }

        const ends: number[] = [];
        while ((match = silenceEndRegex.exec(output)) !== null) {
          ends.push(parseFloat(match[1]));
        }

        for (let i = 0; i < Math.min(starts.length, ends.length); i++) {
          silentRanges.push({ start: starts[i], end: ends[i] });
        }

        // Invert silent ranges to find active audible sections
        const activeSections: Array<{ start: number; end: number; duration: number }> = [];
        let currentPos = 0;

        for (const silence of silentRanges) {
          if (silence.start > currentPos + 1) { // at least 1s of audio
            activeSections.push({
              start: currentPos,
              end: silence.start,
              duration: silence.start - currentPos
            });
          }
          currentPos = silence.end;
        }

        if (currentPos < totalDuration - 1) {
          activeSections.push({
            start: currentPos,
            end: totalDuration,
            duration: totalDuration - currentPos
          });
        }

        // If no silence was detected or audio is continuous, return primary intervals
        if (activeSections.length === 0) {
          activeSections.push({
            start: 0,
            end: totalDuration,
            duration: totalDuration
          });
        }

        resolve(activeSections);
      });
    });
  }

  /**
   * Transcodes an audio file to MP3 with selectable bitrate (128, 192, 256, 320 kbps)
   * and embeds ID3 metadata (Title, Artist, Album, Year, and Cover Artwork).
   */
  public static async transcodeToMp3(
    inputPath: string,
    outputPath: string,
    options: Mp3TranscodeOptions
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const parentDir = path.dirname(outputPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      const args: string[] = ['-y'];

      // Input audio
      args.push('-i', inputPath);

      // If artwork is provided and exists, add as second input
      const hasArtwork = options.artworkPath && fs.existsSync(options.artworkPath);
      if (hasArtwork) {
        args.push('-i', options.artworkPath!);
      }

      // Map streams
      if (hasArtwork) {
        args.push('-map', '0:a', '-map', '1:0');
        args.push('-c:v', 'copy', '-id3v2_version', '3', '-metadata:s:v', 'title="Album cover"', '-metadata:s:v', 'comment="Cover (front)"');
      }

      // Audio encoding parameters
      args.push('-c:a', 'libmp3lame');
      args.push('-b:a', `${options.bitrateKbps}k`);

      // ID3 Metadata
      if (options.title) args.push('-metadata', `title=${options.title}`);
      if (options.artist) args.push('-metadata', `artist=${options.artist}`);
      if (options.album) args.push('-metadata', `album=${options.album}`);
      if (options.year) args.push('-metadata', `date=${options.year}`);

      args.push(outputPath);

      const proc = spawn(ffmpegPath, args);
      let stderr = '';

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0 && fs.existsSync(outputPath)) {
          resolve(outputPath);
        } else {
          reject(new Error(`FFmpeg MP3 transcoding failed (code ${code}): ${stderr.slice(-300)}`));
        }
      });

      proc.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Generates a normalized array of waveform amplitude points (e.g. 100 values between 0.05 and 1.0)
   * for fast visual rendering in the frontend.
   */
  public static async generateWaveformPoints(audioPath: string, numPoints = 80): Promise<number[]> {
    return new Promise((resolve) => {
      // Use astats filter to extract RMS levels across slices or fast sample reading
      const args = [
        '-i', audioPath,
        '-ac', '1',
        '-filter:a', `aresample=1000`,
        '-f', 's16le',
        '-'
      ];

      const proc = spawn(ffmpegPath, args);
      const chunks: Buffer[] = [];

      proc.stdout.on('data', (chunk) => {
        chunks.push(chunk);
      });

      proc.on('close', () => {
        const fullBuffer = Buffer.concat(chunks);
        const totalSamples = Math.floor(fullBuffer.length / 2);
        if (totalSamples === 0) {
          // Fallback smooth curve
          const fallback = Array.from({ length: numPoints }, (_, i) => 
            Math.max(0.1, Math.sin((i / numPoints) * Math.PI) * 0.8 + 0.15)
          );
          return resolve(fallback);
        }

        const step = Math.max(1, Math.floor(totalSamples / numPoints));
        const points: number[] = [];
        let maxVal = 1;

        for (let i = 0; i < numPoints; i++) {
          const sampleIndex = Math.min(totalSamples - 1, i * step);
          let sum = 0;
          let count = 0;
          for (let s = 0; s < Math.min(step, 50); s++) {
            const idx = (sampleIndex + s) * 2;
            if (idx + 1 < fullBuffer.length) {
              const val = Math.abs(fullBuffer.readInt16LE(idx));
              sum += val;
              count++;
            }
          }
          const avg = count > 0 ? sum / count : 0;
          points.push(avg);
          if (avg > maxVal) maxVal = avg;
        }

        // Normalize points between 0.08 and 1.0
        const normalized = points.map((p) => Math.max(0.08, parseFloat((p / maxVal).toFixed(3))));
        resolve(normalized);
      });

      proc.on('error', () => {
        const fallback = Array.from({ length: numPoints }, (_, i) => 
          Math.max(0.1, Math.sin((i / numPoints) * Math.PI) * 0.8 + 0.15)
        );
        resolve(fallback);
      });
    });
  }
}
