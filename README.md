# MusicFinder AI 🎵

> Find the background music hidden inside any video or audio file.

MusicFinder AI is an Apple-inspired, full-stack web application that allows users to upload video or audio media, automatically separates vocals from background music, isolates the instrumental track, identifies all embedded background songs across multiple segments using a smart recognition pipeline, discovers authorized and legitimate downloadable sources (Internet Archive, Creative Commons, Jamendo), and provides selectable-bitrate MP3 conversion with ID3v2 metadata.

---

## Key Features

1. **Multi-Format Ingestion**:
   - Supported Formats: `MP4`, `MOV`, `MKV`, `WEBM`, `MP3`, `WAV`, `M4A`, `AAC`.
   - Real-time upload progress, file inspection (duration, size, codec), and waveform preview.

2. **FFmpeg Audio Extraction**:
   - Lossless audio extraction from video containers to 44.1kHz 16-bit PCM stereo WAV.
   - Normalization and energy analysis.

3. **Vocal & Music Separation**:
   - **Built-in DSP Vocal Cancellation & Dynamic Phase Isolation Engine**: Zero external weight downloads required; operates instantly on any system using center-channel phase inversion and vocal formant bandpass filtering.
   - **Demucs / Spleeter CLI Integration**: Pluggable provider architecture automatically delegates to Demucs if installed or configured in `.env`.
   - Outputs: Original Audio, Isolated Vocals, and Instrumental/Music Track (Primary Output).
   - Interactive 3-stem preview player with time synchronization and stem MP3 downloads.

4. **Smart Multi-Segment Music Recognition**:
   - Slices audio into candidate 10–20 second recognition segments based on RMS energy peaks.
   - Ignores silence and speech-heavy sections.
   - **Confidence Boosting**: If contiguous sections match the same song, confidence is boosted (up to 99%).
   - **Multi-Song Detection**: If different songs are detected across different intervals, separate chronological track cards are created with precise timestamp ranges (e.g. `00:00–00:45`, `00:45–01:20`).
   - Pluggable recognition providers: AudD / ACRCloud commercial API hooks + built-in acoustic signature & fingerprint database.

5. **Authorized & Legal Source Discovery**:
   - Strictly adheres to legal guidelines: **does not scrape or rip copyrighted material**.
   - Searches legitimate sources: **Internet Archive (Archive.org) Public Audio**, **Creative Commons Audio Libraries**, **Incompetech & Free Music Archive**, and **Jamendo CC Music**.
   - If an authorized source permits downloading, users can download the track as MP3 at 128 / 192 / 256 / 320 kbps with embedded ID3v2 tags.
   - For copyrighted tracks without legal download permissions, provides official listening links (Spotify, Apple Music, YouTube Music).

6. **MP3 Conversion & ID3 Tagging**:
   - High-fidelity FFmpeg MP3 encoding with user-selectable bitrates: 128, 192, 256, 320 kbps.
   - Automatically injects ID3v2 metadata: Title, Artist, Album, Year, and Cover Artwork.
   - Clean filename convention: `Artist - Song Title.mp3`.

7. **Developer / Pipeline Debug Panel**:
   - Toggleable from the header.
   - Displays real-time FFmpeg probe data, separation duration, sliced segments, recognition API latency, confidence scores, and source query logs.

---

## Architecture

```
Browser (React + TypeScript + Tailwind CSS)
  ↓ [Multipart Upload / SSE Stream]
Express API Server (Node.js v20)
  ↓
Job Queue Worker
  ├── 1. FFmpeg Audio Extraction & Waveform Computation
  ├── 2. Vocal & Music Separation (DSP / Demucs)
  ├── 3. Energy Detection & 10–20s Segment Slicing
  ├── 4. Music Recognition (AudD / Acoustic Signature Matcher)
  ├── 5. Authorized Source Discovery (Archive.org / Jamendo / CC)
  └── 6. FFmpeg MP3 Transcoding (128–320 kbps with ID3v2 Tags)
```

---

## Quick Start

### 1. Prerequisites
- Node.js v18+ (tested on v20)
- `ffmpeg-static` is pre-bundled; no global FFmpeg installation is required.

### 2. Installation
```bash
# Clone or navigate to the directory
cd musicfinder-ai

# Install server dependencies
cd server
npm install
npm run build

# Install client dependencies
cd ../client
npm install
npm run build
```

### 3. Running Development Mode
Run the backend on port 3001 and the frontend with Vite on port 5173:
```bash
# In terminal 1 (server):
cd server
npm run dev

# In terminal 2 (client):
cd client
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 4. Running Production Mode
In production, the backend serves both the API and the compiled React app:
```bash
npm start
```
Open [http://localhost:3001](http://localhost:3001) in your browser.

---

## Environment Variables (`server/.env`)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Express server port |
| `MAX_FILE_SIZE_MB` | `150` | Maximum uploaded file size |
| `SEPARATION_PROVIDER` | `auto` | `auto`, `dsp`, or `demucs` |
| `DEMUCS_PATH` | `demucs` | Optional path to Demucs CLI executable |
| `AUDD_API_KEY` | *(blank)* | Optional AudD API key for commercial music recognition |
| `ACRCLOUD_HOST` | *(blank)* | Optional ACRCloud host |
| `ACRCLOUD_ACCESS_KEY`| *(blank)* | Optional ACRCloud access key |
| `ACRCLOUD_SECRET_KEY`| *(blank)* | Optional ACRCloud secret key |
| `JAMENDO_CLIENT_ID` | *(blank)* | Optional Jamendo API client ID |
| `TEMP_FILE_TTL_MINUTES`| `60` | Auto-cleanup retention period for temp files |

---

## Bundled Sample Media for Instant Testing

The server includes pre-synthesized test files accessible directly from the UI:
1. **Vlog Video Clip** (`sample_vlog_video.mp4`): Video with voiceover and background acoustic music.
2. **Multi-Track Showcase** (`sample_multi_track.mp3`): 80-second track with two distinct musical transitions demonstrating multi-song detection.
3. **Acoustic Background Instrumental** (`sample_carefree_instrumental.mp3`): Solo background instrumental track.
