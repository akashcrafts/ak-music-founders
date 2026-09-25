import path from 'path';
import fs from 'fs';
import { FFmpegService } from '../services/ffmpeg.service';
import { SeparationService } from '../services/separation/separation.service';
import { RecognitionService } from '../services/recognition/recognition.service';
import { SourceDiscoveryService } from '../services/sources/source.service';
import { SamplesService } from '../services/samples.service';
import { dbQueries } from '../db/database';

async function runTest() {
  console.log('🧪 Starting MusicFinder AI Pipeline Integration Test...\n');

  // 1. Ensure samples exist
  console.log('1️⃣ Generating & loading test sample...');
  const samples = await SamplesService.ensureSamplesExist();
  const testSample = samples[0]; // Vlog Video Clip (Video + Music + Speech)
  console.log(`   Selected Sample: ${testSample.name} (${testSample.filePath})`);

  // 2. Probe media
  console.log('\n2️⃣ Testing FFmpeg Probe...');
  const probe = await FFmpegService.probeMedia(testSample.filePath);
  console.log('   Probe result:', {
    duration: probe.duration,
    format: probe.formatName,
    hasAudio: probe.hasAudio,
    hasVideo: probe.hasVideo,
    codec: probe.audioCodec,
  });

  if (!probe.hasAudio) {
    throw new Error('Probe failed: no audio detected');
  }

  // 3. Audio extraction
  console.log('\n3️⃣ Testing Audio Extraction...');
  const tempTestDir = path.resolve('uploads/test_run');
  if (!fs.existsSync(tempTestDir)) fs.mkdirSync(tempTestDir, { recursive: true });

  const extractedWav = path.join(tempTestDir, 'test_extracted.wav');
  await FFmpegService.extractAudio(testSample.filePath, extractedWav);
  console.log(`   Extracted audio to WAV: ${fs.existsSync(extractedWav)} (${fs.statSync(extractedWav).size} bytes)`);

  // 4. Waveform generation
  console.log('\n4️⃣ Testing Waveform Extraction...');
  const waveform = await FFmpegService.generateWaveformPoints(extractedWav, 40);
  console.log(`   Waveform points generated: ${waveform.length} (first 5: ${waveform.slice(0, 5).join(', ')})`);

  // 5. Vocal & Instrumental Separation
  console.log('\n5️⃣ Testing Vocal & Instrumental Separation...');
  const sepResult = await SeparationService.separate(extractedWav, tempTestDir);
  console.log('   Separation completed:', {
    methodUsed: sepResult.methodUsed,
    durationSeconds: sepResult.durationSeconds.toFixed(2),
    vocalsSize: fs.statSync(sepResult.vocalsPath).size,
    instrumentalSize: fs.statSync(sepResult.instrumentalPath).size,
  });

  // 6. Music Section Analysis & Multi-Segment Recognition
  console.log('\n6️⃣ Testing Music Analysis & Recognition Pipeline...');
  const testJobId = 'test-job-' + Date.now();
  dbQueries.createJob({
    id: testJobId,
    user_id: null,
    original_filename: testSample.filename,
    original_size: 1024,
    duration: probe.duration,
    status: 'analyzing',
    progress: 50,
    current_step: 'Test analysis',
    separation_method: sepResult.methodUsed,
    original_media_path: testSample.filePath,
    extracted_audio_path: extractedWav,
    vocals_path: sepResult.vocalsPath,
    instrumental_path: sepResult.instrumentalPath,
    error_message: null,
  });

  const identifiedTracks = await RecognitionService.analyzeInstrumental(
    testJobId,
    sepResult.instrumentalPath,
    testSample.filename,
    probe.duration
  );

  console.log(`   Identified ${identifiedTracks.length} track(s):`);
  identifiedTracks.forEach((t, i) => {
    console.log(`   [Track ${i + 1}] "${t.title}" by ${t.artist} (Confidence: ${t.confidence}%, Detected: ${t.startTime.toFixed(1)}s - ${t.endTime.toFixed(1)}s)`);
  });

  // 7. Legal Source Discovery
  console.log('\n7️⃣ Testing Authorized Source Discovery...');
  for (const track of identifiedTracks) {
    const source = await SourceDiscoveryService.findAuthorizedSource(track.title, track.artist);
    console.log(`   Source for "${track.title}":`, {
      sourceName: source.sourceName,
      licenseType: source.licenseType,
      downloadAvailable: source.downloadAvailable,
      quality: source.downloadQuality,
    });
  }

  // 8. MP3 Transcoding with Metadata
  console.log('\n8️⃣ Testing 320 kbps MP3 Transcoding with ID3 Metadata...');
  const outputMp3 = path.join(tempTestDir, 'test_output_320k.mp3');
  await FFmpegService.transcodeToMp3(sepResult.instrumentalPath, outputMp3, {
    bitrateKbps: 320,
    title: identifiedTracks[0]?.title || 'Carefree',
    artist: identifiedTracks[0]?.artist || 'Kevin MacLeod',
    album: 'MusicFinder AI Mastered',
    year: '2024',
  });

  const mp3Probe = await FFmpegService.probeMedia(outputMp3);
  console.log(`   Transcoded MP3 verified: ${fs.existsSync(outputMp3)} (${(fs.statSync(outputMp3).size / 1024).toFixed(1)} KB, Bitrate: ${mp3Probe.bitrate} kb/s)`);

  // Cleanup test run directory
  try {
    fs.rmSync(tempTestDir, { recursive: true, force: true });
  } catch {}

  console.log('\n🎉 ALL PIPELINE INTEGRATION TESTS PASSED SUCCESSFULLY!\n');
}

runTest().catch((err) => {
  console.error('\n❌ Integration test failed:', err);
  process.exit(1);
});
