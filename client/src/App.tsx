import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { UploadZone } from './components/UploadZone';
import { ProgressPipeline } from './components/ProgressPipeline';
import { StemPlayer } from './components/StemPlayer';
import { TrackCard } from './components/TrackCard';
import { DebugPanel } from './components/DebugPanel';
import { JobInfo, TrackInfo } from './types';
import { Music, AlertCircle, RefreshCw, CheckCircle2, Search, ExternalLink } from 'lucide-react';

export const App: React.FC = () => {
  // Theme state
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // UI states
  const [showDebug, setShowDebug] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [activeJob, setActiveJob] = useState<JobInfo | null>(null);
  const [tracks, setTracks] = useState<TrackInfo[]>([]);
  const [waveformPoints, setWaveformPoints] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);

  // Sync dark mode class
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Cleanup SSE on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  // Subscribe to SSE updates for a job
  const subscribeToJobEvents = (jobId: string) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource(`/api/jobs/${jobId}/events`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'STATUS_UPDATE') {
          setActiveJob((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              status: data.status,
              progress: data.progress,
              currentStep: data.currentStep,
            };
          });
        } else if (data.type === 'JOB_COMPLETED') {
          // Fetch final job details and tracks
          fetch(`/api/jobs/${jobId}`)
            .then((res) => res.json())
            .then((resData) => {
              if (resData.job) setActiveJob(resData.job);
              if (resData.tracks) setTracks(resData.tracks);
            })
            .catch(() => {});

          eventSource.close();
        } else if (data.type === 'JOB_FAILED') {
          setError(data.error || 'Job processing failed.');
          eventSource.close();
        }
      } catch (e) {
        console.error('Failed to parse SSE payload', e);
      }
    };

    eventSource.onerror = () => {
      // EventSource reconnects automatically
    };
  };

  // Upload user file with progress
  const handleFileUpload = (file: File) => {
    setError(null);
    setIsUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('media', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload');

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        setUploadProgress(percent);
      }
    };

    xhr.onload = () => {
      setIsUploading(false);
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          setActiveJob({
            id: res.jobId,
            filename: res.filename,
            size: res.size,
            duration: res.duration,
            status: 'queued',
            progress: 5,
            currentStep: 'Uploaded, queued for processing',
            separationMethod: null,
            errorMessage: null,
            hasOriginal: false,
            hasVocals: false,
            hasInstrumental: false,
            createdAt: new Date().toISOString(),
            completedAt: null,
          });

          if (res.waveform) {
            setWaveformPoints(res.waveform);
          }

          subscribeToJobEvents(res.jobId);
        } catch {
          setError('Failed to parse server response');
        }
      } else {
        try {
          const errRes = JSON.parse(xhr.responseText);
          setError(errRes.error || 'Upload failed');
        } catch {
          setError(`Upload failed with status code ${xhr.status}`);
        }
      }
    };

    xhr.onerror = () => {
      setIsUploading(false);
      setError('Network connection error during file upload');
    };

    xhr.send(formData);
  };

  // Select demo sample
  const handleSampleSelect = async (sampleId: string) => {
    setError(null);
    setIsUploading(true);
    setUploadProgress(100);

    try {
      const response = await fetch('/api/samples/load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sampleId }),
      });

      const res = await response.json();
      setIsUploading(false);

      if (!response.ok) {
        setError(res.error || 'Failed loading sample');
        return;
      }

      setActiveJob({
        id: res.jobId,
        filename: res.filename,
        size: res.size,
        duration: res.duration,
        status: 'queued',
        progress: 5,
        currentStep: 'Sample loaded, queued for processing',
        separationMethod: null,
        errorMessage: null,
        hasOriginal: false,
        hasVocals: false,
        hasInstrumental: false,
        createdAt: new Date().toISOString(),
        completedAt: null,
      });

      if (res.waveform) {
        setWaveformPoints(res.waveform);
      }

      subscribeToJobEvents(res.jobId);
    } catch (err: any) {
      setIsUploading(false);
      setError(err.message || 'Error loading sample');
    }
  };

  const handleReset = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    setActiveJob(null);
    setTracks([]);
    setWaveformPoints([]);
    setError(null);
    setIsUploading(false);
    setUploadProgress(0);
  };

  const isProcessing =
    activeJob &&
    ['queued', 'extracting', 'separating', 'analyzing', 'identifying', 'discovering'].includes(
      activeJob.status
    );

  const isCompleted = activeJob && activeJob.status === 'completed';

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc] dark:bg-[#08080B] text-neutral-900 dark:text-neutral-100 transition-colors duration-200">
      {/* Header */}
      <Header
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        showDebug={showDebug}
        setShowDebug={setShowDebug}
        onReset={handleReset}
        hasActiveJob={Boolean(activeJob)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Global Error Notice */}
        {error && (
          <div className="mb-8 p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/40 flex items-start justify-between gap-3 text-red-800 dark:text-red-300">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
              <div>
                <h4 className="text-sm font-semibold">Processing Notice</h4>
                <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">{error}</p>
              </div>
            </div>
            <button
              onClick={handleReset}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-900/60 hover:bg-red-200 text-red-900 dark:text-red-100 transition-colors"
            >
              Try Another File
            </button>
          </div>
        )}

        {/* 1. Upload View */}
        {!activeJob && (
          <UploadZone
            onFileUpload={handleFileUpload}
            onSampleSelect={handleSampleSelect}
            isUploading={isUploading}
            uploadProgress={uploadProgress}
          />
        )}

        {/* 2. Processing Pipeline View */}
        {isProcessing && (
          <ProgressPipeline job={activeJob} waveformPoints={waveformPoints} />
        )}

        {/* 3. Completed Results View */}
        {isCompleted && (
          <div className="space-y-8 animate-fade-in">
            {/* Completion Summary Header */}
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/40 mb-1">
                <CheckCircle2 className="w-4 h-4" />
                <span>Audio Extraction &amp; Recognition Complete</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-neutral-900 dark:text-white">
                {tracks.length > 0 ? (
                  <>
                    Found {tracks.length} Background {tracks.length === 1 ? 'Track' : 'Tracks'}
                  </>
                ) : (
                  'No Background Music Detected'
                )}
              </h2>
              <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 max-w-lg mx-auto">
                File: <span className="font-semibold text-neutral-700 dark:text-neutral-300">{activeJob.filename}</span> • Duration: {activeJob.duration.toFixed(1)}s
              </p>
            </div>

            {/* Vocal & Instrumental Stems Preview Player */}
            <StemPlayer job={activeJob} />

            {/* Detected Songs Cards */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold tracking-wide uppercase text-neutral-500 dark:text-neutral-400 flex items-center gap-2">
                  <Music className="w-4 h-4 text-[#00f2fe]" />
                  <span>Identified Music ({tracks.length})</span>
                </h3>
              </div>

              {tracks.length > 0 ? (
                <div className="space-y-4">
                  {tracks.map((track, idx) => (
                    <TrackCard
                      key={track.id}
                      track={track}
                      index={idx}
                      totalTracks={tracks.length}
                    />
                  ))}
                </div>
              ) : (
                <div className="p-8 rounded-2xl glass-panel text-center space-y-3">
                  <Search className="w-8 h-8 text-neutral-400 mx-auto" />
                  <h4 className="text-base font-semibold text-neutral-800 dark:text-neutral-200">
                    No matching music was identified
                  </h4>
                  <p className="text-xs text-neutral-500 max-w-md mx-auto">
                    The audio may contain only spoken dialogue, ambient background sounds, or an unindexed custom recording. You can still preview and download your separated instrumental and vocal stems above.
                  </p>
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="pt-6 text-center">
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#4facfe] to-[#00f2fe] text-[#08080B] text-sm font-bold shadow-md shadow-[#00f2fe]/20 transition-all hover:scale-[1.01]"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Analyze Another Video / Audio</span>
              </button>
            </div>
          </div>
        )}


      </main>

      {/* Footer with Akash Singh Branding */}
      <footer className="w-full border-t border-neutral-200 dark:border-white/[0.08] py-8 text-center text-xs text-neutral-500 dark:text-neutral-400 space-y-2 bg-white/40 dark:bg-obsidian/40 backdrop-blur">
        <div className="flex items-center justify-center gap-2 font-medium">
          <span className="text-neutral-700 dark:text-neutral-300 font-bold">AK Music Founder</span>
          <span>•</span>
          <span>Designed &amp; Built by</span>
          <a
            href="https://akashcraft.com"
            target="_blank"
            rel="noreferrer"
            className="text-[#00b4d8] dark:text-[#00f2fe] font-semibold hover:underline inline-flex items-center gap-1"
          >
            Akash Singh (akashcraft.com)
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
          Audio Extraction • Vocal Separation • Multi-Segment Recognition • Source Discovery
        </p>
      </footer>

      {/* Developer / Pipeline Debug Panel */}
      <DebugPanel
        job={activeJob}
        isOpen={showDebug}
        onClose={() => setShowDebug(false)}
      />
    </div>
  );
};

export default App;
