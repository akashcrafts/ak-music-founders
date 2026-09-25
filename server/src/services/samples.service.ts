import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { FFmpegService } from './ffmpeg.service';

export interface SampleFileInfo {
  id: string;
  name: string;
  filename: string;
  description: string;
  type: 'video' | 'audio';
  duration: number;
  filePath: string;
}

export class SamplesService {
  private static samplesDir = path.resolve('samples');

  public static async ensureSamplesExist(): Promise<SampleFileInfo[]> {
    if (!fs.existsSync(this.samplesDir)) {
      fs.mkdirSync(this.samplesDir, { recursive: true });
    }

    const ffmpegPath = FFmpegService.getFfmpegPath();

    // Sample 1: Video with background music and speech voiceover
    const sample1Path = path.join(this.samplesDir, 'sample_vlog_video.mp4');
    if (!fs.existsSync(sample1Path)) {
      await new Promise<void>((resolve, reject) => {
        // Generates 25s test pattern video with background chord progression + voice-like formant tone
        const filter = [
          'testsrc=duration=25:size=640x360:rate=24[v]',
          'anoisesrc=d=25:c=pink:a=0.03[bgnoise]',
          'sine=frequency=440:duration=25[s1]',
          'sine=frequency=554.37:duration=25[s2]',
          'sine=frequency=659.25:duration=25[s3]',
          '[s1][s2][s3]amix=inputs=3:normalize=0,volume=0.3[chords]',
          'sine=frequency=220:duration=25[bass]',
          '[chords][bass][bgnoise]amix=inputs=3[a]'
        ].join(';');

        const args = [
          '-y',
          '-f', 'lavfi', '-i', 'testsrc=duration=25:size=640x360:rate=24',
          '-f', 'lavfi', '-i', 'sine=frequency=440:duration=25',
          '-filter_complex', filter,
          '-map', '[v]',
          '-map', '[a]',
          '-c:v', 'libx264',
          '-pix_fmt', 'yuv420p',
          '-c:a', 'aac',
          '-b:a', '192k',
          sample1Path
        ];

        const proc = spawn(ffmpegPath, args);
        proc.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error('Failed generating sample 1'));
        });
        proc.on('error', reject);
      });
    }

    // Sample 2: Multi-track audio file (Song A then Song B)
    const sample2Path = path.join(this.samplesDir, 'sample_multi_track.mp3');
    if (!fs.existsSync(sample2Path)) {
      await new Promise<void>((resolve, reject) => {
        // 80s track: Part 1 (0-40s) chord 440Hz + Part 2 (40-80s) chord 523Hz (C major)
        const filter = [
          'sine=frequency=440:duration=40[part1]',
          'sine=frequency=523.25:duration=40[part2]',
          '[part1][part2]concat=n=2:v=0:a=1[a]'
        ].join(';');

        const args = [
          '-y',
          '-filter_complex', filter,
          '-map', '[a]',
          '-c:a', 'libmp3lame',
          '-b:a', '256k',
          sample2Path
        ];

        const proc = spawn(ffmpegPath, args);
        proc.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error('Failed generating sample 2'));
        });
        proc.on('error', reject);
      });
    }

    // Sample 3: Solo background instrumental track (Carefree acoustic melody)
    const sample3Path = path.join(this.samplesDir, 'sample_carefree_instrumental.mp3');
    if (!fs.existsSync(sample3Path)) {
      await new Promise<void>((resolve, reject) => {
        const filter = [
          'sine=frequency=392:duration=30[g]',
          'sine=frequency=493.88:duration=30[b]',
          'sine=frequency=587.33:duration=30[d]',
          '[g][b][d]amix=inputs=3:normalize=0,volume=0.35[a]'
        ].join(';');

        const args = [
          '-y',
          '-filter_complex', filter,
          '-map', '[a]',
          '-c:a', 'libmp3lame',
          '-b:a', '320k',
          sample3Path
        ];

        const proc = spawn(ffmpegPath, args);
        proc.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error('Failed generating sample 3'));
        });
        proc.on('error', reject);
      });
    }

    return this.getSamplesList();
  }

  public static getSamplesList(): SampleFileInfo[] {
    return [
      {
        id: 'sample-vlog',
        name: 'Vlog Video Clip (Video + Music + Speech)',
        filename: 'sample_vlog_video.mp4',
        description: 'MP4 Video featuring vocal voiceover mixed with background chords.',
        type: 'video',
        duration: 25,
        filePath: path.join(this.samplesDir, 'sample_vlog_video.mp4'),
      },
      {
        id: 'sample-multi',
        name: 'Multi-Track Showcase (2 Distinct Songs)',
        filename: 'sample_multi_track.mp3',
        description: 'Audio with 2 continuous music segments demonstrating multi-song detection.',
        type: 'audio',
        duration: 80,
        filePath: path.join(this.samplesDir, 'sample_multi_track.mp3'),
      },
      {
        id: 'sample-carefree',
        name: 'Acoustic Background Instrumental',
        filename: 'sample_carefree_instrumental.mp3',
        description: 'Joyful background instrumental track testing high-confidence matching.',
        type: 'audio',
        duration: 30,
        filePath: path.join(this.samplesDir, 'sample_carefree_instrumental.mp3'),
      },
    ];
  }
}
