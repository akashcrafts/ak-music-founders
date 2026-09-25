import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { FFmpegService } from '../ffmpeg.service';
import { config } from '../../config';

export interface SeparationResult {
  originalPath: string;
  vocalsPath: string;
  instrumentalPath: string;
  methodUsed: 'demucs' | 'spleeter' | 'dsp_phase_cancellation';
  durationSeconds: number;
}

export interface IAudioSeparationProvider {
  name: string;
  isAvailable(): Promise<boolean>;
  separate(inputAudioPath: string, outputDir: string): Promise<SeparationResult>;
}

/**
 * Built-in DSP Audio Separation Engine using FFmpeg:
 * Implements Center-Channel Dynamic Vocal Inversion (OOPS - Out of Phase Stereo)
 * with low-frequency mono bass retention crossover and vocal formant bandpass extraction.
 * Works out-of-the-box on every system without external heavy neural model weights.
 */
export class DspVocalSeparationProvider implements IAudioSeparationProvider {
  public name = 'dsp_phase_cancellation';

  public async isAvailable(): Promise<boolean> {
    return true; // Always available via bundled ffmpeg
  }

  public async separate(inputAudioPath: string, outputDir: string): Promise<SeparationResult> {
    const startTime = Date.now();
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const vocalsPath = path.join(outputDir, 'vocals.mp3');
    const instrumentalPath = path.join(outputDir, 'instrumental.mp3');
    const ffmpegPath = FFmpegService.getFfmpegPath();

    // 1. Generate Instrumental Track
    // OOPS filter cancels center channel (vocals) while retaining stereo sides,
    // combined with a lowpass filter to retain punchy low bass (<180Hz) which is often centered.
    await new Promise<void>((resolve, reject) => {
      // Complex filtergraph:
      // Split input into two:
      // a) low-pass filter below 180Hz (bass/kick)
      // b) high-pass above 180Hz passed through phase inversion vocal cancellation (L - R, R - L)
      // then amix them back together.
      const filterGraph = [
        '[0:a]asplit=2[bass_in][midhigh_in]',
        '[bass_in]lowpass=f=200,volume=1.0[bass]',
        '[midhigh_in]highpass=f=200,pan=stereo|c0=0.5*c0-0.5*c1|c1=0.5*c1-0.5*c0[sides]',
        '[bass][sides]amix=inputs=2:weights=1.1 1.2:normalize=0,dynaudnorm=p=0.9:m=10[out]'
      ].join(';');

      const args = [
        '-y',
        '-i', inputAudioPath,
        '-filter_complex', filterGraph,
        '-map', '[out]',
        '-c:a', 'libmp3lame',
        '-b:a', '320k',
        instrumentalPath
      ];

      const proc = spawn(ffmpegPath, args);
      let stderr = '';
      proc.stderr.on('data', (d) => { stderr += d.toString(); });
      proc.on('close', (code) => {
        if (code === 0 && fs.existsSync(instrumentalPath)) {
          resolve();
        } else {
          // Fallback simpler vocal removal if complex filter fails
          this.runFallbackInstrumental(inputAudioPath, instrumentalPath)
            .then(resolve)
            .catch(reject);
        }
      });
      proc.on('error', reject);
    });

    // 2. Generate Isolated Vocal Track
    // Extract center-channel vocal frequencies (250Hz - 4200Hz) and emphasize speech presence
    await new Promise<void>((resolve, reject) => {
      const vocalFilter = [
        // Center channel extraction: sum L and R, apply speech bandpass filter
        'pan=mono|c0=0.5*c0+0.5*c1',
        'highpass=f=260',
        'lowpass=f=4000',
        'equalizer=f=1200:t=q:w=1.5:g=3.5',
        'equalizer=f=3000:t=q:w=1.5:g=4.0',
        'dynaudnorm=p=0.9:m=12'
      ].join(',');

      const args = [
        '-y',
        '-i', inputAudioPath,
        '-af', vocalFilter,
        '-c:a', 'libmp3lame',
        '-b:a', '256k',
        vocalsPath
      ];

      const proc = spawn(ffmpegPath, args);
      let stderr = '';
      proc.stderr.on('data', (d) => { stderr += d.toString(); });
      proc.on('close', (code) => {
        if (code === 0 && fs.existsSync(vocalsPath)) {
          resolve();
        } else {
          reject(new Error(`Failed to isolate vocals: ${stderr.slice(-300)}`));
        }
      });
      proc.on('error', reject);
    });

    const durationSeconds = (Date.now() - startTime) / 1000;

    return {
      originalPath: inputAudioPath,
      vocalsPath,
      instrumentalPath,
      methodUsed: 'dsp_phase_cancellation',
      durationSeconds,
    };
  }

  private async runFallbackInstrumental(inputPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const ffmpegPath = FFmpegService.getFfmpegPath();
      const args = [
        '-y',
        '-i', inputPath,
        '-af', 'pan=stereo|c0=c0-c1|c1=c1-c0,volume=1.3',
        '-c:a', 'libmp3lame',
        '-b:a', '320k',
        outputPath
      ];
      const proc = spawn(ffmpegPath, args);
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error('Fallback instrumental extraction failed'));
      });
      proc.on('error', reject);
    });
  }
}

/**
 * Demucs Neural Network Provider (CLI wrapper)
 */
export class DemucsProvider implements IAudioSeparationProvider {
  public name = 'demucs';
  private demucsBin: string;

  constructor(demucsBin = config.demucsPath || 'demucs') {
    this.demucsBin = demucsBin;
  }

  public async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn(this.demucsBin, ['--help']);
      proc.on('close', (code) => resolve(code === 0));
      proc.on('error', () => resolve(false));
    });
  }

  public async separate(inputAudioPath: string, outputDir: string): Promise<SeparationResult> {
    const startTime = Date.now();
    return new Promise((resolve, reject) => {
      const args = [
        '--two-stems=vocals',
        '-o', outputDir,
        inputAudioPath
      ];

      const proc = spawn(this.demucsBin, args);
      let stderr = '';
      proc.stderr.on('data', (d) => { stderr += d.toString(); });

      proc.on('close', async (code) => {
        if (code === 0) {
          const trackBase = path.basename(inputAudioPath, path.extname(inputAudioPath));
          const demucsTrackDir = path.join(outputDir, 'htdemucs', trackBase);
          const vocalsWav = path.join(demucsTrackDir, 'vocals.wav');
          const noVocalsWav = path.join(demucsTrackDir, 'no_vocals.wav');

          const vocalsPath = path.join(outputDir, 'vocals.mp3');
          const instrumentalPath = path.join(outputDir, 'instrumental.mp3');

          // Convert to MP3
          await FFmpegService.transcodeToMp3(vocalsWav, vocalsPath, { bitrateKbps: 320 });
          await FFmpegService.transcodeToMp3(noVocalsWav, instrumentalPath, { bitrateKbps: 320 });

          resolve({
            originalPath: inputAudioPath,
            vocalsPath,
            instrumentalPath,
            methodUsed: 'demucs',
            durationSeconds: (Date.now() - startTime) / 1000,
          });
        } else {
          reject(new Error(`Demucs separation failed: ${stderr.slice(-300)}`));
        }
      });

      proc.on('error', reject);
    });
  }
}

/**
 * Separation Factory: selects best available separation provider
 */
export class SeparationService {
  public static async separate(inputAudioPath: string, outputDir: string): Promise<SeparationResult> {
    // Check user preference
    if (config.separationProvider === 'demucs' || config.separationProvider === 'auto') {
      const demucs = new DemucsProvider();
      if (await demucs.isAvailable()) {
        try {
          return await demucs.separate(inputAudioPath, outputDir);
        } catch (e) {
          console.warn('[SeparationService] Demucs failed, falling back to DSP engine', e);
        }
      }
    }

    // Default high-performance DSP engine
    const dsp = new DspVocalSeparationProvider();
    return await dsp.separate(inputAudioPath, outputDir);
  }
}
