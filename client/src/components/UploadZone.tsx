import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, Film, Music, ArrowRight, AlertCircle, ExternalLink } from 'lucide-react';
import { SampleItem } from '../types';

interface UploadZoneProps {
  onFileUpload: (file: File) => void;
  onSampleSelect: (sampleId: string) => void;
  isUploading: boolean;
  uploadProgress: number;
}

export const UploadZone: React.FC<UploadZoneProps> = ({
  onFileUpload,
  onSampleSelect,
  isUploading,
  uploadProgress,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [samples, setSamples] = useState<SampleItem[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/samples')
      .then(res => res.json())
      .then(data => {
        if (data.samples) setSamples(data.samples);
      })
      .catch(() => {});
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const validateAndProcessFile = (file: File) => {
    setErrorMsg(null);
    const validExtensions = ['.mp4', '.mov', '.mkv', '.webm', '.mp3', '.wav', '.m4a', '.aac'];
    const fileName = file.name.toLowerCase();
    const hasValidExt = validExtensions.some(ext => fileName.endsWith(ext));

    if (!hasValidExt) {
      setErrorMsg(`Unsupported file type. Please upload: ${validExtensions.join(', ')}`);
      return;
    }

    if (file.size > 150 * 1024 * 1024) {
      setErrorMsg('File exceeds 150MB maximum size limit.');
      return;
    }

    onFileUpload(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndProcessFile(e.target.files[0]);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-8 py-6">
      {/* Hero Title */}
      <div className="text-center space-y-3">
        {/* Creator badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-medium bg-neutral-100 dark:bg-surface border border-neutral-200/80 dark:border-white/[0.12] mb-1">
          <span className="w-2 h-2 rounded-full bg-[#00f2fe] animate-pulse"></span>
          <span className="text-neutral-600 dark:text-neutral-300 font-semibold">AK Music Founder</span>
          <span className="text-neutral-400">•</span>
          <a
            href="https://akashcraft.com"
            target="_blank"
            rel="noreferrer"
            className="text-neutral-800 dark:text-neutral-200 font-semibold hover:text-[#00f2fe] inline-flex items-center gap-1 transition-colors"
          >
            Made by Akash Singh
            <ExternalLink className="w-3 h-3 text-[#00f2fe]" />
          </a>
        </div>

        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-neutral-900 dark:text-white leading-[1.1]">
          Find the music hidden inside<br />
          <span className="grad-text">
            any video or audio.
          </span>
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400 text-base max-w-lg mx-auto">
          Extract audio, isolate instruments from speech, accurately identify background songs across multiple sections, and download clean MP3s.
        </p>
      </div>

      {/* Drag & Drop Upload Box */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        className={`relative group cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-300 p-8 sm:p-12 text-center ${
          isDragOver
            ? 'border-[#00f2fe] bg-[#00f2fe]/10 scale-[1.01]'
            : 'border-neutral-300 dark:border-white/[0.14] bg-white/70 dark:bg-[#0E1015]/70 hover:border-[#00f2fe]/70 dark:hover:border-[#00f2fe]/60 shadow-sm'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".mp4,.mov,.mkv,.webm,.mp3,.wav,.m4a,.aac,video/*,audio/*"
          className="hidden"
          onChange={handleFileInputChange}
          disabled={isUploading}
        />

        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#4facfe]/20 to-[#00f2fe]/20 border border-[#00f2fe]/40 flex items-center justify-center text-[#00b4d8] dark:text-[#00f2fe] group-hover:scale-110 transition-transform duration-200 shadow-lg shadow-[#00f2fe]/10">
            <UploadCloud className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-center gap-2">
              <span className="inline-block px-5 py-2.5 rounded-full bg-gradient-to-r from-[#4facfe] to-[#00f2fe] hover:from-[#3b9bee] hover:to-[#00d5e2] text-[#08080B] font-semibold text-sm shadow-md shadow-[#00f2fe]/25 transition-all">
                Upload Video / Audio File
              </span>
            </div>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 pt-2">
              or drag & drop your media file here
            </p>
          </div>

          {/* Supported format badges */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-1.5 max-w-md text-[11px] text-neutral-500 dark:text-neutral-400">
            {['MP4', 'MOV', 'MKV', 'WEBM', 'MP3', 'WAV', 'M4A', 'AAC'].map((fmt) => (
              <span
                key={fmt}
                className="px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-white/[0.06] border border-neutral-200/60 dark:border-white/[0.1] font-mono"
              >
                {fmt}
              </span>
            ))}
            <span className="text-neutral-400 dark:text-neutral-500 pl-1">
              (up to 150MB)
            </span>
          </div>
        </div>

        {/* Uploading indicator */}
        {isUploading && (
          <div className="absolute inset-0 bg-white/95 dark:bg-[#0E1015]/95 rounded-2xl flex flex-col items-center justify-center p-6 z-10">
            <div className="w-full max-w-xs space-y-3">
              <div className="flex justify-between text-xs font-medium text-neutral-600 dark:text-neutral-400">
                <span>Processing media...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full h-2 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#4facfe] to-[#00f2fe] transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-[11px] text-neutral-400 text-center animate-pulse">
                Extracting audio and initializing separation engine...
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Error state */}
      {errorMsg && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-400 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Quick Sample Selector */}
      {samples.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-[0.14em] text-neutral-500 dark:text-[#EED9A2]">
              Or Try A Sample Demo File
            </span>
            <span className="text-[11px] text-neutral-400 font-mono">
              1-click test
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {samples.map((sample) => (
              <button
                key={sample.id}
                type="button"
                onClick={() => onSampleSelect(sample.id)}
                disabled={isUploading}
                className="group p-3.5 rounded-xl text-left border border-neutral-200 dark:border-white/[0.09] bg-white/60 dark:bg-[#0E1015]/60 hover:border-[#00f2fe]/60 hover:shadow-sm transition-all duration-200 flex flex-col justify-between"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-neutral-900 dark:text-white flex items-center gap-1.5">
                      {sample.type === 'video' ? (
                        <Film className="w-3.5 h-3.5 text-[#4facfe]" />
                      ) : (
                        <Music className="w-3.5 h-3.5 text-[#00f2fe]" />
                      )}
                      {sample.name.split(' (')[0]}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-white/[0.06] font-mono text-neutral-500">
                      {sample.duration}s
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 line-clamp-2">
                    {sample.description}
                  </p>
                </div>

                <div className="pt-2.5 mt-2 border-t border-neutral-100 dark:border-white/[0.08] flex items-center text-[11px] font-semibold text-[#00b4d8] dark:text-[#00f2fe] group-hover:translate-x-0.5 transition-transform">
                  <span>Analyze Sample</span>
                  <ArrowRight className="w-3 h-3 ml-1" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
